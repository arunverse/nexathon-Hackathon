-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Lock down privileged profile columns (run in Supabase → SQL Editor)
--
-- PROBLEM: RLS lets a user update their OWN profile row. Row-level security does
-- NOT restrict columns, so a user could set is_admin=true or credit_limit=999999
-- on themselves via a direct API call. FIX: column-level privileges users may
-- only update the harmless fields; is_admin/credits/limit/plan/blocked are
-- writable ONLY by the service role (Edge Functions), which bypasses these grants.
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Make sure the editable columns exist (older tables may lack these).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1. Remove blanket UPDATE from client roles.
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

-- 2. Grant UPDATE back ONLY on the columns users legitimately edit (Settings, mode).
GRANT UPDATE (company_name, sender_email, mission, mode, website, updated_at)
  ON public.profiles TO authenticated;

-- (is_admin, credits, credit_limit, credits_reset_at, plan, plan_valid_until,
--  is_blocked are intentionally NOT granted only the service role can write them.)

-- 3. Keep the row-level policies (users manage their own row; admins can read all).
--    The column grants above are what actually blocks privilege escalation.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
-- (profiles self read / self write policies from production_hardening.sql remain.)

-- Verify:  users updating is_admin/credit_limit now get "permission denied for
-- column ...". Edge Functions (service role) still update everything.
