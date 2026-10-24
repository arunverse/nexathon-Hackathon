-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · RECOVER admin login + plan for arunchinnu2005@gmail.com
-- Run once in Supabase → SQL Editor. Idempotent. Fixes:
--   • "choose a plan" instead of dashboard  (plan_status wasn't 'active')
--   • can't read profile after rls_lockdown  (repairs profiles policies)
--   • admin access                            (is_admin = true)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Admin-check function must exist (policies below use it).
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 2. Repair profiles read/write policies (in case a migration dropped them and
--    left the table unreadable → that alone causes the plan gate + login to fail).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles self or admin read" ON public.profiles;
CREATE POLICY "profiles self or admin read" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
DROP POLICY IF EXISTS "profiles self write" ON public.profiles;
CREATE POLICY "profiles self write" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- 3. Make sure the columns exist.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan            TEXT,
  ADD COLUMN IF NOT EXISTS plan_status     TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_limit    INTEGER DEFAULT 1000;

-- 4. Grant this account permanent Enterprise + admin + credits.
UPDATE public.profiles p SET
  is_admin        = true,
  plan            = 'enterprise',
  plan_status     = 'active',
  plan_started_at = COALESCE(p.plan_started_at, now()),
  plan_expires_at = now() + interval '100 years',
  credit_limit    = GREATEST(COALESCE(p.credit_limit, 0), 3000)
WHERE p.id IN (SELECT id FROM auth.users WHERE lower(email) = lower('arunchinnu2005@gmail.com'));

NOTIFY pgrst, 'reload schema';

-- 5. Verify should return one row: is_admin = t, plan_status = active.
SELECT u.email, p.is_admin, p.plan_status, p.plan_expires_at, p.credit_limit
FROM public.profiles p JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) = lower('arunchinnu2005@gmail.com');
