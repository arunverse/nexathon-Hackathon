-- ============================================================================
-- EBEXTA · Grant a standing Enterprise plan (skips the plan gate + billing)
-- ----------------------------------------------------------------------------
-- Marks the given account(s) as an active Enterprise subscriber so they go
-- straight into the app and never see /choose-plan. The frontend also has these
-- emails on a bypass list (PlanGate.GRANTED_EMAILS), so it works even before
-- this runs but running it makes the plan real everywhere (Billing, admin).
--
-- Run once in the Supabase SQL editor. Idempotent. Edit the emails if needed.
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan            TEXT,
  ADD COLUMN IF NOT EXISTS plan_status     TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_limit    INTEGER DEFAULT 1000;

UPDATE public.profiles p SET
  plan            = 'enterprise',
  plan_status     = 'active',
  plan_started_at = COALESCE(p.plan_started_at, now()),
  plan_expires_at = now() + interval '100 years',   -- effectively permanent
  credit_limit    = GREATEST(COALESCE(p.credit_limit, 0), 3000)
WHERE p.id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN ('arunchinn2005@gmail.com', 'arunchinnu2005@gmail.com')
);

-- Verify:
SELECT u.email, p.plan, p.plan_status, p.plan_expires_at
FROM public.profiles p JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) IN ('arunchinn2005@gmail.com', 'arunchinnu2005@gmail.com');
