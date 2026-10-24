-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · FIX & LOCK ADMIN ACCESS + RESTORE ACTIVE ACCOUNT ACCESS
-- Run this in Supabase SQL Editor:
-- https://supabase.com/dashboard/project/bwulvxrggpcvqducpuuq/sql/new
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Ensure column exists and default value is STRICTLY false
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ALTER COLUMN is_admin SET DEFAULT false;

-- 2. Strip admin privileges and reset 'EBEXTA Admin' brand name for all non-admin accounts
-- (Keeps their active plan status intact)
UPDATE public.profiles
SET 
  is_admin = false,
  company_name = CASE WHEN company_name = 'EBEXTA Admin' THEN NULL ELSE company_name END
WHERE id NOT IN (
  SELECT id FROM auth.users
  WHERE lower(email) = 'arunchinnu2005@gmail.com'
);

-- 3. Set the sole official EBEXTA platform administrator
UPDATE public.profiles
SET 
  is_admin = true,
  company_name = 'EBEXTA Admin',
  plan = 'enterprise',
  plan_status = 'active',
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '100 years')
WHERE id IN (
  SELECT id FROM auth.users
  WHERE lower(email) = 'arunchinnu2005@gmail.com'
);

-- 4. Restore active plan status for all existing active accounts
-- (Ensures active users are NEVER redirected to /choose-plan or asked to re-select plans)
UPDATE public.profiles
SET 
  plan_status = 'active',
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '100 years'),
  credit_limit = GREATEST(COALESCE(credit_limit, 0), 1000),
  credits = GREATEST(COALESCE(credits, 0), 100)
WHERE plan_status = 'none' OR plan_status IS NULL;

-- 4b. Ensure the 4 primary active user accounts have enterprise plan active with full credits (is_admin remains false)
UPDATE public.profiles
SET 
  plan = 'enterprise',
  plan_status = 'active',
  plan_expires_at = COALESCE(plan_expires_at, now() + interval '100 years'),
  credit_limit = 1000,
  credits = 1000
WHERE id IN (
  SELECT id FROM auth.users
  WHERE lower(email) IN (
    'arunverse15@gmail.com',
    'ebexta26@gmail.com',
    'arunv.z1502@gmail.com',
    'arunverse1506@gmail.com'
  )
);

-- 5. Server-Side is_admin() function with dual verification (RLS security)
-- Checks BOTH the database flag AND the verified owner email in auth.users
CREATE OR REPLACE FUNCTION public.is_admin() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(
    (
      SELECT p.is_admin = true
      FROM public.profiles p
      JOIN auth.users u ON u.id = p.id
      WHERE p.id = auth.uid()
        AND lower(u.email) = 'arunchinnu2005@gmail.com'
    ),
    false
  );
$$;

-- 6. Harden user creation trigger: newly registered users ALWAYS get is_admin = false
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_is_admin boolean := false;
  v_company_name text := NULL;
  v_plan text := 'starter';
  v_plan_status text := 'none';
BEGIN
  IF lower(NEW.email) = 'arunchinnu2005@gmail.com' THEN
    v_is_admin := true;
    v_company_name := 'EBEXTA Admin';
    v_plan := 'enterprise';
    v_plan_status := 'active';
  END IF;

  INSERT INTO public.profiles (id, sender_email, email, company_name, mode, plan, credits, credit_limit, plan_status, is_admin)
  VALUES (NEW.id, NEW.email, NEW.email, v_company_name, 'seeker', v_plan, 0, 0, v_plan_status, v_is_admin)
  ON CONFLICT (id) DO UPDATE SET
    sender_email = EXCLUDED.sender_email,
    email        = EXCLUDED.email,
    is_admin     = v_is_admin;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. Verification query 1: MUST return EXACTLY ONE row (arunchinnu2005@gmail.com)
SELECT u.email, p.is_admin, p.company_name, p.plan, p.plan_status
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.is_admin = true;

-- 8. Verification query 2: Check status of active user accounts (is_admin = false, plan_status = active)
SELECT u.email, p.is_admin, p.company_name, p.plan, p.plan_status, p.credit_limit
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) IN (
  'arunverse15@gmail.com',
  'ebexta26@gmail.com',
  'arunv.z1502@gmail.com',
  'arunverse1506@gmail.com'
);
