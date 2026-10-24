-- ============================================================================
-- EBEXTA CREDIT SYSTEM + HARD LIMITS
-- Every costly action consumes a credit. At zero, scanning stops enforced
-- server-side, not in the browser.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run. Creates new tables and functions; alters nothing existing.
--
-- SECURITY MODEL: users can READ their own balance but never WRITE it. Every
-- mutation goes through the SECURITY DEFINER functions below, which are called
-- only by the Edge Functions using the service role. A user cannot grant
-- themselves credits by hitting the REST API.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. PER-USER BALANCE
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_credits (
  user_id               UUID PRIMARY KEY,
  plan                  TEXT DEFAULT 'pro',
  scan_credits          INTEGER DEFAULT 40,
  scan_credits_used     INTEGER DEFAULT 0,
  verified_credits      INTEGER DEFAULT 10,
  verified_credits_used INTEGER DEFAULT 0,
  bonus_credits         INTEGER DEFAULT 0,
  cycle_start           TIMESTAMPTZ DEFAULT NOW(),
  cycle_end             TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '30 days'),
  is_suspended          BOOLEAN DEFAULT false,
  suspend_reason        TEXT,
  lifetime_cost_inr     NUMERIC DEFAULT 0,
  /** Auto-throttle flag set when one user eats >30% of the daily cap. */
  hourly_scan_cap       INTEGER,
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_credits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "uc own read" ON user_credits;
-- READ ONLY. No insert/update policy exists on purpose balances are written
-- exclusively by the SECURITY DEFINER functions below.
CREATE POLICY "uc own read" ON user_credits
  FOR SELECT USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 2. LEDGER every credit movement, auditable
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS credit_ledger (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID NOT NULL,
  action        TEXT,        -- scan|enrich|verified_contact|email|proposal|
                             -- site_walkthrough|topup|reset|admin_grant|refund
  credit_type   TEXT,        -- scan | verified | bonus
  amount        INTEGER,     -- negative = consumed
  balance_after INTEGER,
  api_calls     INTEGER DEFAULT 0,
  tokens_used   INTEGER DEFAULT 0,
  est_cost_inr  NUMERIC DEFAULT 0,
  reference_id  UUID,        -- scan_id / lead_id / request_id
  note          TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE credit_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cl own read" ON credit_ledger;
CREATE POLICY "cl own read" ON credit_ledger
  FOR SELECT USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. GLOBAL CONTROLS single row, the emergency brake
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_limits (
  id                    INTEGER PRIMARY KEY DEFAULT 1,
  daily_api_call_cap    INTEGER DEFAULT 900,
  daily_calls_used      INTEGER DEFAULT 0,
  monthly_budget_inr    NUMERIC DEFAULT 5000,
  monthly_spend_inr     NUMERIC DEFAULT 0,
  global_scans_paused   BOOLEAN DEFAULT false,
  pause_reason          TEXT,
  cost_per_scan_inr     NUMERIC DEFAULT 25,
  cost_per_verified_inr NUMERIC DEFAULT 15,
  default_scan_credits     INTEGER DEFAULT 40,
  default_verified_credits INTEGER DEFAULT 10,
  last_reset            DATE DEFAULT CURRENT_DATE,
  month_anchor          DATE DEFAULT date_trunc('month', CURRENT_DATE)::date,
  CONSTRAINT single_row CHECK (id = 1)
);

INSERT INTO system_limits (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE system_limits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sl read" ON system_limits;
-- Readable by all (the app needs to show the pause banner). Writes are
-- admin-only via ebexta_admin_set_limits() below.
CREATE POLICY "sl read" ON system_limits FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_ledger_user   ON credit_ledger(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_action ON credit_ledger(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uc_cost       ON user_credits(lifetime_cost_inr DESC);


-- ════════════════════════════════════════════════════════════════════════════
-- HOUSEKEEPING daily and monthly rollovers, computed lazily (no cron needed)
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ebexta_roll_system_counters()
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  -- New day → zero the daily call counter.
  UPDATE system_limits
     SET daily_calls_used = 0, last_reset = CURRENT_DATE
   WHERE id = 1 AND last_reset < CURRENT_DATE;

  -- New month → zero the spend counter.
  UPDATE system_limits
     SET monthly_spend_inr = 0, month_anchor = date_trunc('month', CURRENT_DATE)::date
   WHERE id = 1 AND month_anchor < date_trunc('month', CURRENT_DATE)::date;
END;
$$;


/** Reset a user's cycle. Bonus credits carry over; plan credits do not. */
CREATE OR REPLACE FUNCTION ebexta_reset_cycle(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE user_credits
     SET scan_credits_used = 0,
         verified_credits_used = 0,
         cycle_start = NOW(),
         cycle_end = NOW() + INTERVAL '30 days',
         updated_at = NOW()
   WHERE user_id = p_user;

  INSERT INTO credit_ledger (user_id, action, credit_type, amount, balance_after, note)
  SELECT p_user, 'reset', 'scan', 0, scan_credits + bonus_credits, 'Cycle renewed'
    FROM user_credits WHERE user_id = p_user;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- THE GATE returns the FIRST failure, in the order the spec defines
-- ════════════════════════════════════════════════════════════════════════════

/**
 * Returns { allowed, reason, code, remaining, cycle_end }.
 * Read-only apart from the lazy rollovers safe to call as often as needed.
 */
CREATE OR REPLACE FUNCTION ebexta_check_credits(p_user UUID, p_action TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s system_limits%ROWTYPE;
  u user_credits%ROWTYPE;
  remaining INTEGER;
  user_calls_today INTEGER;
BEGIN
  PERFORM ebexta_roll_system_counters();
  SELECT * INTO s FROM system_limits WHERE id = 1;

  -- 1. Global pause the emergency brake.
  IF s.global_scans_paused THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'PAUSED',
      'reason', COALESCE(NULLIF(s.pause_reason, ''), 'EBEXTA is temporarily paused. Try again soon.'));
  END IF;

  -- 2. Daily API capacity.
  IF s.daily_calls_used >= s.daily_api_call_cap THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'DAILY_CAP',
      'reason', 'Daily capacity reached. Resets at midnight.');
  END IF;

  -- 3. Monthly budget.
  IF s.monthly_spend_inr >= s.monthly_budget_inr THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'BUDGET',
      'reason', 'Monthly capacity reached. New scans resume next month.');
  END IF;

  SELECT * INTO u FROM user_credits WHERE user_id = p_user;

  -- No row yet (user predates the credit system) → create one on the spot.
  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, scan_credits, verified_credits)
    VALUES (p_user, s.default_scan_credits, s.default_verified_credits)
    ON CONFLICT (user_id) DO NOTHING;
    SELECT * INTO u FROM user_credits WHERE user_id = p_user;
  END IF;

  -- 4. Suspended.
  IF u.is_suspended THEN
    RETURN jsonb_build_object('allowed', false, 'code', 'SUSPENDED',
      'reason', COALESCE(NULLIF(u.suspend_reason, ''), 'Your account is paused. Please contact support.'));
  END IF;

  -- 5. Cycle expired → renew, then continue with fresh figures.
  IF u.cycle_end < NOW() THEN
    PERFORM ebexta_reset_cycle(p_user);
    SELECT * INTO u FROM user_credits WHERE user_id = p_user;
  END IF;

  -- 5b. Auto-throttle: one user must not eat the whole day's capacity.
  IF u.hourly_scan_cap IS NOT NULL AND p_action = 'scan' THEN
    SELECT COUNT(*) INTO user_calls_today
      FROM credit_ledger
     WHERE user_id = p_user AND action = 'scan'
       AND created_at > NOW() INTERVAL '1 hour';
    IF user_calls_today >= u.hourly_scan_cap THEN
      RETURN jsonb_build_object('allowed', false, 'code', 'THROTTLED',
        'reason', 'You are scanning unusually fast. Please wait an hour before the next scan.');
    END IF;
  END IF;

  -- 6. Balance.
  IF p_action = 'verified_contact' THEN
    remaining := (u.verified_credits + u.bonus_credits) u.verified_credits_used;
    IF remaining <= 0 THEN
      RETURN jsonb_build_object('allowed', false, 'code', 'NO_CREDITS', 'remaining', 0,
        'cycle_end', u.cycle_end,
        'reason', format('You''ve used all %s verified contacts this cycle. Renews %s.',
                         u.verified_credits, to_char(u.cycle_end, 'DD Mon')));
    END IF;
  ELSE
    remaining := (u.scan_credits + u.bonus_credits) u.scan_credits_used;
    IF remaining <= 0 THEN
      RETURN jsonb_build_object('allowed', false, 'code', 'NO_CREDITS', 'remaining', 0,
        'cycle_end', u.cycle_end,
        'reason', format('You''ve used all %s scans this cycle. Renews %s.',
                         u.scan_credits, to_char(u.cycle_end, 'DD Mon')));
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'remaining', remaining, 'cycle_end', u.cycle_end);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- CONSUME called ONLY after the action succeeded. Atomic.
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ebexta_consume_credit(
  p_user UUID, p_action TEXT, p_api_calls INTEGER DEFAULT 0,
  p_tokens INTEGER DEFAULT 0, p_reference UUID DEFAULT NULL, p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s system_limits%ROWTYPE;
  cost NUMERIC;
  ctype TEXT;
  after INTEGER;
  share NUMERIC;
BEGIN
  PERFORM ebexta_roll_system_counters();
  SELECT * INTO s FROM system_limits WHERE id = 1;

  IF p_action = 'verified_contact' THEN
    ctype := 'verified';
    cost  := s.cost_per_verified_inr;
    UPDATE user_credits
       SET verified_credits_used = verified_credits_used + 1,
           lifetime_cost_inr = lifetime_cost_inr + cost,
           updated_at = NOW()
     WHERE user_id = p_user
    RETURNING (verified_credits + bonus_credits) verified_credits_used INTO after;
  ELSE
    ctype := 'scan';
    cost  := s.cost_per_scan_inr;
    UPDATE user_credits
       SET scan_credits_used = scan_credits_used + 1,
           lifetime_cost_inr = lifetime_cost_inr + cost,
           updated_at = NOW()
     WHERE user_id = p_user
    RETURNING (scan_credits + bonus_credits) scan_credits_used INTO after;
  END IF;

  INSERT INTO credit_ledger (user_id, action, credit_type, amount, balance_after,
                             api_calls, tokens_used, est_cost_inr, reference_id, note)
  VALUES (p_user, p_action, ctype, -1, after, p_api_calls, p_tokens, cost, p_reference, p_note);

  UPDATE system_limits
     SET monthly_spend_inr = monthly_spend_inr + cost,
         daily_calls_used  = daily_calls_used + GREATEST(p_api_calls, 1)
   WHERE id = 1;

  -- Auto-throttle a single user eating >30% of the day's capacity.
  SELECT COALESCE(SUM(api_calls), 0)::NUMERIC / NULLIF(s.daily_api_call_cap, 0)
    INTO share
    FROM credit_ledger
   WHERE user_id = p_user AND created_at::date = CURRENT_DATE;

  IF share > 0.30 THEN
    UPDATE user_credits SET hourly_scan_cap = 2 WHERE user_id = p_user AND hourly_scan_cap IS NULL;
    INSERT INTO system_logs (user_id, event_type, message, metadata)
    VALUES (p_user, 'error', 'User auto-throttled: >30% of daily API capacity',
            jsonb_build_object('share', share, 'cap', 2));
  END IF;

  RETURN jsonb_build_object('ok', true, 'remaining', after, 'cost_inr', cost);
END;
$$;


/** Refund a credit. Users must never pay for OUR failures. */
CREATE OR REPLACE FUNCTION ebexta_refund_credit(
  p_user UUID, p_action TEXT, p_reference UUID DEFAULT NULL, p_note TEXT DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s system_limits%ROWTYPE;
  cost NUMERIC; ctype TEXT; after INTEGER;
BEGIN
  SELECT * INTO s FROM system_limits WHERE id = 1;

  IF p_action = 'verified_contact' THEN
    ctype := 'verified'; cost := s.cost_per_verified_inr;
    UPDATE user_credits
       SET verified_credits_used = GREATEST(0, verified_credits_used 1),
           lifetime_cost_inr = GREATEST(0, lifetime_cost_inr cost), updated_at = NOW()
     WHERE user_id = p_user
    RETURNING (verified_credits + bonus_credits) verified_credits_used INTO after;
  ELSE
    ctype := 'scan'; cost := s.cost_per_scan_inr;
    UPDATE user_credits
       SET scan_credits_used = GREATEST(0, scan_credits_used 1),
           lifetime_cost_inr = GREATEST(0, lifetime_cost_inr cost), updated_at = NOW()
     WHERE user_id = p_user
    RETURNING (scan_credits + bonus_credits) scan_credits_used INTO after;
  END IF;

  INSERT INTO credit_ledger (user_id, action, credit_type, amount, balance_after, est_cost_inr, reference_id, note)
  VALUES (p_user, 'refund', ctype, 1, after, -cost, p_reference, COALESCE(p_note, 'Automatic refund'));

  UPDATE system_limits SET monthly_spend_inr = GREATEST(0, monthly_spend_inr cost) WHERE id = 1;

  RETURN jsonb_build_object('ok', true, 'remaining', after);
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- ADMIN ACTIONS every one checks profiles.is_admin
-- ════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ebexta_is_admin() RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM profiles WHERE id = auth.uid()), false);
$$;

/** Grant bonus credits. */
CREATE OR REPLACE FUNCTION ebexta_admin_grant(p_user UUID, p_amount INTEGER, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE after INTEGER;
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE user_credits SET bonus_credits = bonus_credits + p_amount, updated_at = NOW()
   WHERE user_id = p_user
  RETURNING (scan_credits + bonus_credits) scan_credits_used INTO after;

  INSERT INTO credit_ledger (user_id, action, credit_type, amount, balance_after, note)
  VALUES (p_user, 'admin_grant', 'bonus', p_amount, after, COALESCE(p_note, 'Granted by admin'));
  RETURN jsonb_build_object('ok', true, 'remaining', after);
END;
$$;

/** Adjust one user's plan limits. */
CREATE OR REPLACE FUNCTION ebexta_admin_set_user_limits(
  p_user UUID, p_scans INTEGER, p_verified INTEGER
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE user_credits SET scan_credits = p_scans, verified_credits = p_verified, updated_at = NOW()
   WHERE user_id = p_user;
END;
$$;

/** Suspend / unsuspend a user. */
CREATE OR REPLACE FUNCTION ebexta_admin_suspend(p_user UUID, p_suspend BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE user_credits
     SET is_suspended = p_suspend,
         suspend_reason = CASE WHEN p_suspend THEN p_reason ELSE NULL END,
         hourly_scan_cap = CASE WHEN p_suspend THEN hourly_scan_cap ELSE NULL END,
         updated_at = NOW()
   WHERE user_id = p_user;
END;
$$;

/** Admin-triggered cycle reset. */
CREATE OR REPLACE FUNCTION ebexta_admin_reset_cycle(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  PERFORM ebexta_reset_cycle(p_user);
END;
$$;

/** Global controls, including the emergency brake. */
CREATE OR REPLACE FUNCTION ebexta_admin_set_limits(p JSONB)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  UPDATE system_limits SET
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

/**
 * Refund ANOTHER user's credit. Used when an admin marks a verification
 * 'could_not_verify' we could not deliver, so the user must not pay.
 */
CREATE OR REPLACE FUNCTION ebexta_admin_refund(p_user UUID, p_action TEXT, p_note TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN ebexta_refund_credit(p_user, p_action, NULL, COALESCE(p_note, 'Refunded by admin'));
END;
$$;

/** Admin read of every user's credit row (RLS would hide other users). */
CREATE OR REPLACE FUNCTION ebexta_admin_all_credits()
RETURNS SETOF user_credits LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY SELECT * FROM user_credits ORDER BY lifetime_cost_inr DESC;
END;
$$;

/** Admin read of the full ledger. */
CREATE OR REPLACE FUNCTION ebexta_admin_ledger(p_limit INTEGER DEFAULT 300)
RETURNS SETOF credit_ledger LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT ebexta_is_admin() THEN RAISE EXCEPTION 'Not authorised'; END IF;
  RETURN QUERY SELECT * FROM credit_ledger ORDER BY created_at DESC LIMIT p_limit;
END;
$$;


-- ════════════════════════════════════════════════════════════════════════════
-- SEED every existing profile gets a balance; new signups get one automatically
-- ════════════════════════════════════════════════════════════════════════════

INSERT INTO user_credits (user_id, scan_credits, verified_credits)
SELECT p.id,
       (SELECT default_scan_credits FROM system_limits WHERE id = 1),
       (SELECT default_verified_credits FROM system_limits WHERE id = 1)
  FROM profiles p
 WHERE NOT EXISTS (SELECT 1 FROM user_credits uc WHERE uc.user_id = p.id);

CREATE OR REPLACE FUNCTION ebexta_seed_credits_for_new_profile()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO user_credits (user_id, scan_credits, verified_credits)
  VALUES (NEW.id,
          (SELECT default_scan_credits FROM system_limits WHERE id = 1),
          (SELECT default_verified_credits FROM system_limits WHERE id = 1))
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_seed_credits ON profiles;
CREATE TRIGGER trg_seed_credits
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION ebexta_seed_credits_for_new_profile();


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--
--   SELECT COUNT(*) FROM user_credits;      -- one row per existing profile
--   SELECT * FROM system_limits;            -- exactly 1 row
--   SELECT ebexta_check_credits(auth.uid(), 'scan');   -- {"allowed": true, ...}
--
-- THEN deploy the Edge Function that enforces this:
--   supabase functions deploy credits
--   supabase functions deploy gemini      (re-deploy credit guard added)
-- ────────────────────────────────────────────────────────────────────────────
