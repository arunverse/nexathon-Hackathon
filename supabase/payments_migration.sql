-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Payments (Razorpay). Run in Supabase → SQL Editor.
-- NOTE: ideally run supabase/production_hardening.sql first (it defines
-- public.is_admin()). This file recreates that helper defensively so it can be
-- run standalone without erroring.
-- ═══════════════════════════════════════════════════════════════════════════

-- Defensive: ensure the admin helper exists (also created in production_hardening.sql).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- Plan validity (set by the razorpay Edge Function on successful payment).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS plan_valid_until TIMESTAMPTZ;

-- Payment ledger.
CREATE TABLE IF NOT EXISTS payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  kind TEXT,             -- 'plan' | 'credits'
  item TEXT,             -- tier key or pack key
  order_id TEXT,
  payment_id TEXT,
  amount_inr INTEGER,
  status TEXT DEFAULT 'paid',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own payments read" ON payments;
DROP POLICY IF EXISTS "payments admin read" ON payments;
-- Users read their own; the Edge Function writes via service role (bypasses RLS).
CREATE POLICY "own payments read" ON payments FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_payments_user ON payments (user_id);
CREATE INDEX IF NOT EXISTS idx_payments_created ON payments (created_at);
