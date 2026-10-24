-- ============================================================================
-- EBEXTA · Billing history / invoices / usage  (safe to run multiple times)
-- ----------------------------------------------------------------------------
-- Purpose: let a signed-in user READ their own payment history, invoices and
-- API usage in the Billing section, while the Edge Functions (service role)
-- remain the ONLY writers. Users can never write these tables from the client.
--
-- Run this in the Supabase SQL editor once. It is idempotent.
-- ============================================================================

-- ── 1. PAYMENTS ─────────────────────────────────────────────────────────────
-- (created by payments_migration.sql; re-declared here defensively so this file
--  works even on a fresh project.)
CREATE TABLE IF NOT EXISTS public.payments (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind       TEXT,                       -- 'plan' | 'credits'
  item       TEXT,                       -- tier key or pack key
  order_id   TEXT,
  payment_id TEXT,
  amount_inr INTEGER,
  status     TEXT DEFAULT 'paid',        -- 'paid' | 'failed' | 'refunded'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Users read ONLY their own rows (admins read all). No INSERT/UPDATE/DELETE
-- policy exists for the client → only the service-role Edge Function can write.
DROP POLICY IF EXISTS "own payments read" ON public.payments;
CREATE POLICY "own payments read" ON public.payments
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_payments_user    ON public.payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON public.payments (created_at DESC);


-- ── 2. API USAGE ────────────────────────────────────────────────────────────
-- One row per AI call (1 credit). Written by the gemini Edge Function.
CREATE TABLE IF NOT EXISTS public.api_usage (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  action      TEXT,                      -- 'scan','discovery','enrich','email','proposal'
  model       TEXT,
  tokens_used INTEGER DEFAULT 0,
  calls       INTEGER DEFAULT 1,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;

-- Users may READ their own usage so the Usage Metrics tab works. Writes stay
-- server-side (service role bypasses RLS), so a user can't fake usage/credits.
DROP POLICY IF EXISTS "own usage read" ON public.api_usage;
CREATE POLICY "own usage read" ON public.api_usage
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_api_usage_user    ON public.api_usage (user_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created ON public.api_usage (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_usage_user_created ON public.api_usage (user_id, created_at DESC);


-- ── 3. INVOICES VIEW ────────────────────────────────────────────────────────
-- A friendly, read-only projection of payments the UI can query directly as
-- "invoices". Inherits row security from the underlying payments table
-- (security_invoker = on → the caller's RLS applies).
DROP VIEW IF EXISTS public.invoices;
CREATE VIEW public.invoices
  WITH (security_invoker = on) AS
SELECT
  p.id,
  p.user_id,
  COALESCE(p.payment_id, LEFT(p.id::text, 12))                    AS reference,
  p.kind,
  p.item,
  CASE
    WHEN p.kind = 'plan' THEN INITCAP(p.item) || ' plan'
    ELSE REPLACE(p.item, 'pack_', '') || ' credit pack'
  END                                                             AS description,
  p.amount_inr,
  ROUND(p.amount_inr / 100.0, 2)                                  AS amount_rupees_display,
  UPPER(COALESCE(p.status, 'paid'))                               AS status,
  p.created_at                                                    AS invoice_date
FROM public.payments p
ORDER BY p.created_at DESC;

GRANT SELECT ON public.invoices TO authenticated;


-- ── 4. MONTHLY USAGE SUMMARY VIEW ───────────────────────────────────────────
-- Per-user, per-month, per-action credit totals for the Usage Metrics tab and
-- for admin reporting. Also security_invoker so each user sees only their own.
DROP VIEW IF EXISTS public.usage_monthly;
CREATE VIEW public.usage_monthly
  WITH (security_invoker = on) AS
SELECT
  u.user_id,
  date_trunc('month', u.created_at)          AS month,
  u.action,
  SUM(u.calls)                               AS credits_used,
  SUM(u.tokens_used)                         AS tokens_used,
  COUNT(*)                                   AS events
FROM public.api_usage u
GROUP BY u.user_id, date_trunc('month', u.created_at), u.action
ORDER BY month DESC;

GRANT SELECT ON public.usage_monthly TO authenticated;


-- ── 5. is_admin() guard ─────────────────────────────────────────────────────
-- These policies reference public.is_admin(); ensure it exists (created in
-- admin_account_controls.sql). Defensive no-op stub if it is somehow missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_proc WHERE proname = 'is_admin' AND pronamespace = 'public'::regnamespace
  ) THEN
    EXECUTE $fn$
      CREATE FUNCTION public.is_admin() RETURNS boolean
      LANGUAGE sql SECURITY DEFINER STABLE AS
      $body$ SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) $body$;
    $fn$;
  END IF;
END $$;

-- Done. Verify:
--   SELECT * FROM public.invoices;        -- your invoices only
--   SELECT * FROM public.usage_monthly;   -- your monthly credit usage only
