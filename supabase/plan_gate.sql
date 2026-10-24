-- ============================================================================
-- EBEXTA · Plan gate subscription columns + activation RPCs
-- ----------------------------------------------------------------------------
-- Adds the plan lifecycle columns and two SECURITY DEFINER functions the
-- app uses to start a trial or activate a plan for the CURRENT user.
--
--   plan_status:  none | trial | active | expired
--
-- Real payments go through the razorpay Edge Function (service role) which sets
-- these columns directly. `ebexta_set_plan` is ALSO used by the trial button and
-- the clearly-marked DEV "Simulate payment" button so the gate is testable
-- without deploying Razorpay.
--
-- ⚠️ Before going live, either drop ebexta_set_plan or restrict it otherwise a
--    user could self-activate without paying. It is DEV/testing convenience.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan             TEXT,
  ADD COLUMN IF NOT EXISTS plan_status      TEXT DEFAULT 'none',   -- none | trial | active | expired
  ADD COLUMN IF NOT EXISTS plan_started_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;   -- used by ebexta_set_plan

-- Everyone existing without a status becomes 'none' (gated).
UPDATE public.profiles SET plan_status = 'none' WHERE plan_status IS NULL;

-- ── Start a 7-day trial (Starter). Only from a non-active state. ─────────────
CREATE OR REPLACE FUNCTION public.ebexta_start_trial()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  -- Don't let an already-active/trialing user restart a trial.
  IF EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND plan_status = 'trial'
      AND plan_expires_at > now()
  ) THEN
    RETURN; -- already trialing
  END IF;
  UPDATE public.profiles SET
    plan            = 'starter',
    plan_status     = 'trial',
    plan_started_at = now(),
    plan_expires_at = now() + interval '7 days'
  WHERE id = auth.uid();
END;
$$;

-- ── Activate a plan for the caller (used by trial-upgrade + DEV simulate). ───
-- p_days: 30 for monthly, 365 for yearly.
CREATE OR REPLACE FUNCTION public.ebexta_set_plan(p_plan text, p_days int DEFAULT 30)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF p_plan NOT IN ('starter','growth','pro','enterprise') THEN
    RAISE EXCEPTION 'Unknown plan %', p_plan;
  END IF;
  UPDATE public.profiles SET
    plan            = p_plan,
    plan_status     = 'active',
    plan_started_at = now(),
    plan_expires_at = now() + (p_days || ' days')::interval,
    credits_reset_at = now()   -- fresh monthly billing period
  WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.ebexta_start_trial()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_set_plan(text, int)      FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_start_trial()         TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_set_plan(text, int)   TO authenticated;

-- Force PostgREST to reload its schema cache so the RPCs are callable IMMEDIATELY
-- (otherwise the client can see "Could not find the function ... in the schema
-- cache" for a minute or two after creating them).
NOTIFY pgrst, 'reload schema';

-- Verify:  SELECT plan, plan_status, plan_expires_at FROM public.profiles WHERE id = auth.uid();
--          SELECT public.ebexta_set_plan('growth', 30);   -- should return void, no error
