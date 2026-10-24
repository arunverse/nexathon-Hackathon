-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · FIX ADMIN DASHBOARD DATA & ROW LEVEL SECURITY (RLS)
-- Run this ONCE in Supabase SQL Editor (https://supabase.com/dashboard/project/bwulvxrggpcvqducpuuq/sql/new)
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Helper function to check if the authenticated user is an Admin
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- 2. Make sure necessary admin columns exist on profiles table
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan            TEXT,
  ADD COLUMN IF NOT EXISTS plan_status     TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credits          INTEGER,
  ADD COLUMN IF NOT EXISTS credit_limit    INTEGER DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS is_blocked       BOOLEAN DEFAULT false;

-- 3. Set is_admin = true & Enterprise status for admin accounts
UPDATE public.profiles p SET
  is_admin        = true,
  plan            = 'enterprise',
  plan_status     = 'active',
  plan_started_at = COALESCE(p.plan_started_at, now()),
  plan_expires_at = now() + interval '100 years',
  credit_limit    = GREATEST(COALESCE(p.credit_limit, 0), 10000)
WHERE p.id IN (
  SELECT id FROM auth.users WHERE lower(email) IN (
    'arunchinnu2005@gmail.com',
    'arunverse15@gmail.com',
    'ebexta26@gmail.com',
    'arunverse1506@gmail.com',
    'arunv.z1502@gmail.com'
  )
);

-- 4. Grant Admin SELECT permissions across all core tables (bypasses per-user RLS lockouts)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles self or admin read" ON public.profiles;
CREATE POLICY "profiles self or admin read" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

DROP POLICY IF EXISTS "profiles self write" ON public.profiles;
CREATE POLICY "profiles self write" ON public.profiles
  FOR ALL USING (auth.uid() = id OR public.is_admin()) WITH CHECK (auth.uid() = id OR public.is_admin());

-- Scans RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'scans') THEN
    ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "scans self or admin read" ON public.scans;
    CREATE POLICY "scans self or admin read" ON public.scans FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- Leads RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'leads') THEN
    ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "leads self or admin read" ON public.leads;
    CREATE POLICY "leads self or admin read" ON public.leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- Verification requests RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'verification_requests') THEN
    ALTER TABLE public.verification_requests ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "verification_requests self or admin read" ON public.verification_requests;
    CREATE POLICY "verification_requests self or admin read" ON public.verification_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- Saved leads RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'saved_leads') THEN
    ALTER TABLE public.saved_leads ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "saved_leads self or admin read" ON public.saved_leads;
    CREATE POLICY "saved_leads self or admin read" ON public.saved_leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- Declared intents RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'declared_intents') THEN
    ALTER TABLE public.declared_intents ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "declared_intents self or admin read" ON public.declared_intents;
    CREATE POLICY "declared_intents self or admin read" ON public.declared_intents FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- API usage RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'api_usage') THEN
    ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "api_usage self or admin read" ON public.api_usage;
    CREATE POLICY "api_usage self or admin read" ON public.api_usage FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- System logs RLS admin read
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'system_logs') THEN
    ALTER TABLE public.system_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "system_logs self or admin read" ON public.system_logs;
    CREATE POLICY "system_logs self or admin read" ON public.system_logs FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
  END IF;
END $$;

-- 5. Admin profile patch RPC function
CREATE OR REPLACE FUNCTION public.admin_update_profile(target_user uuid, updates jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: caller is not an admin';
  END IF;
  UPDATE public.profiles p SET
    company_name     = COALESCE(updates->>'company_name', p.company_name),
    full_name        = COALESCE(updates->>'full_name', p.full_name),
    name             = COALESCE(updates->>'name', p.name),
    profile_image_url= COALESCE(updates->>'profile_image_url', p.profile_image_url),
    avatar_url       = COALESCE(updates->>'avatar_url', p.avatar_url),
    plan             = COALESCE(updates->>'plan', p.plan),
    plan_status      = COALESCE(updates->>'plan_status', p.plan_status),
    plan_expires_at  = COALESCE((updates->>'plan_expires_at')::timestamptz, p.plan_expires_at),
    credits          = COALESCE((updates->>'credits')::int, p.credits),
    credit_limit     = COALESCE((updates->>'credit_limit')::int, p.credit_limit),
    is_blocked       = COALESCE((updates->>'is_blocked')::boolean, p.is_blocked),
    credits_reset_at = COALESCE((updates->>'credits_reset_at')::timestamptz, p.credits_reset_at)
  WHERE p.id = target_user;
END; $$;

REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, jsonb) TO authenticated;

NOTIFY pgrst, 'reload schema';
