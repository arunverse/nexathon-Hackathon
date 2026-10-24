-- ============================================================================
-- EBEXTA Admin Credit & Limit RPC Aliases & Fixes
-- Provides ebexta_admin_* function signatures so admin console can save limits,
-- resume scanning, and view credits and ledger without missing-function errors.
-- ============================================================================

-- Ensure is_admin helper exists
CREATE OR REPLACE FUNCTION public.ebexta_is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 1. ebexta_admin_set_limits: Unpause/pause scanning, configure caps and budget
CREATE OR REPLACE FUNCTION public.ebexta_admin_set_limits(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.system_limits SET
    daily_api_call_cap       = COALESCE((p->>'daily_api_call_cap')::INTEGER, daily_api_call_cap),
    monthly_budget_inr       = COALESCE((p->>'monthly_budget_inr')::NUMERIC, monthly_budget_inr),
    cost_per_scan_inr        = COALESCE((p->>'cost_per_scan_inr')::NUMERIC, cost_per_scan_inr),
    cost_per_verified_inr    = COALESCE((p->>'cost_per_verified_inr')::NUMERIC, cost_per_verified_inr),
    default_scan_credits     = COALESCE((p->>'default_scan_credits')::INTEGER, default_scan_credits),
    default_verified_credits = COALESCE((p->>'default_verified_credits')::INTEGER, default_verified_credits),
    global_scans_paused      = COALESCE((p->>'global_scans_paused')::BOOLEAN, global_scans_paused),
    pause_reason             = COALESCE(p->>'pause_reason', pause_reason)
  WHERE id = 1;
END;
$$;

-- 2. ketag alias just in case
CREATE OR REPLACE FUNCTION public.ketag_admin_set_limits(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.ebexta_admin_set_limits(p);
END;
$$;

-- 3. ebexta_admin_all_credits
CREATE OR REPLACE FUNCTION public.ebexta_admin_all_credits()
RETURNS TABLE(
  user_id                UUID,
  plan                   TEXT,
  scan_credits           INTEGER,
  scan_credits_used      INTEGER,
  verified_credits       INTEGER,
  verified_credits_used  INTEGER,
  bonus_credits          INTEGER,
  cycle_end              TIMESTAMPTZ,
  is_suspended           BOOLEAN,
  suspend_reason         TEXT,
  lifetime_cost_inr      NUMERIC,
  hourly_scan_cap        INTEGER
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
    SELECT
      uc.user_id,
      COALESCE(p.plan, 'starter') AS plan,
      uc.scan_credits,
      uc.scan_credits_used,
      uc.verified_credits,
      uc.verified_credits_used,
      uc.bonus_credits,
      uc.cycle_end,
      uc.is_suspended,
      uc.suspend_reason,
      uc.lifetime_cost_inr,
      uc.hourly_scan_cap
    FROM public.user_credits uc
    LEFT JOIN public.profiles p ON p.id = uc.user_id
    ORDER BY uc.lifetime_cost_inr DESC;
END;
$$;

-- 4. ebexta_admin_ledger
CREATE OR REPLACE FUNCTION public.ebexta_admin_ledger(p_limit INT DEFAULT 300)
RETURNS TABLE(
  id            UUID,
  user_id       UUID,
  action        TEXT,
  credit_type   TEXT,
  amount        INTEGER,
  balance_after INTEGER,
  est_cost_inr  NUMERIC,
  note          TEXT,
  created_at    TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  RETURN QUERY
    SELECT cl.id, cl.user_id, cl.action, cl.credit_type, cl.amount, cl.balance_after, cl.est_cost_inr, cl.note, cl.created_at
    FROM public.credit_ledger cl
    ORDER BY cl.created_at DESC
    LIMIT p_limit;
END;
$$;

-- 5. ebexta_admin_grant
CREATE OR REPLACE FUNCTION public.ebexta_admin_grant(p_user UUID, p_amount INTEGER, p_note TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.user_credits
     SET bonus_credits = bonus_credits + p_amount
   WHERE user_id = p_user;

  INSERT INTO public.credit_ledger (user_id, action, credit_type, amount, balance_after, est_cost_inr, note)
  SELECT p_user, 'admin_grant', 'scan', p_amount, (scan_credits + bonus_credits - scan_credits_used), 0, COALESCE(p_note, 'Granted by admin')
    FROM public.user_credits WHERE user_id = p_user;
END;
$$;

-- 6. ebexta_admin_suspend
CREATE OR REPLACE FUNCTION public.ebexta_admin_suspend(p_user UUID, p_suspend BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.user_credits
     SET is_suspended = p_suspend, suspend_reason = p_reason
   WHERE user_id = p_user;
END;
$$;

-- 7. ebexta_admin_reset_cycle
CREATE OR REPLACE FUNCTION public.ebexta_admin_reset_cycle(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.ebexta_is_admin() OR public.is_admin()) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  UPDATE public.user_credits
     SET scan_credits_used = 0, verified_credits_used = 0, cycle_end = NOW() + INTERVAL '30 days'
   WHERE user_id = p_user;
END;
$$;

-- 8. Allow direct admin update on system_limits as well
DROP POLICY IF EXISTS "sl admin update" ON public.system_limits;
CREATE POLICY "sl admin update" ON public.system_limits
  FOR UPDATE USING (public.is_admin() OR public.ebexta_is_admin())
  WITH CHECK (public.is_admin() OR public.ebexta_is_admin());

-- 9. Immediately ensure global scans are unpaused
UPDATE public.system_limits
   SET global_scans_paused = false, pause_reason = ''
 WHERE id = 1;
