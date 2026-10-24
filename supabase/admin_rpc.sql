-- ============================================================================
-- EBEXTA · Admin profile updates WITHOUT an Edge Function
-- ----------------------------------------------------------------------------
-- Lets the admin panel set a user's credit limit / plan / block / reset by
-- calling a SECURITY DEFINER Postgres function via supabase.rpc(...). No Edge
-- Function deployment (no CLI / Docker) required.
--
-- Security: the function itself checks that the CALLER is a real admin
-- (profiles.is_admin = true) before writing, and only whitelisted columns can
-- change. Normal users still cannot touch these columns directly.
--
-- Run this ONCE in the Supabase SQL editor. Idempotent.
-- (You must also have run make_admin.sql so YOUR account is is_admin = true.)
-- ============================================================================

-- Make sure the columns the admin edits exist.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin         BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits          INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_limit     INTEGER DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked       BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_valid_until TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_status      TEXT DEFAULT 'none';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_started_at  TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_expires_at  TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.admin_update_profile(target_user uuid, updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Authorize: the caller must be a real admin in the database.
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: caller is not an admin';
  END IF;

  -- Apply ONLY whitelisted fields; keys not present in `updates` are unchanged.
  UPDATE public.profiles p SET
    company_name     = COALESCE(updates->>'company_name', p.company_name),
    full_name        = COALESCE(updates->>'full_name', p.full_name),
    name             = COALESCE(updates->>'name', p.name),
    profile_image_url= COALESCE(updates->>'profile_image_url', p.profile_image_url),
    avatar_url       = COALESCE(updates->>'avatar_url', p.avatar_url),
    plan             = COALESCE(updates->>'plan', p.plan),
    plan_status      = COALESCE(updates->>'plan_status', p.plan_status),
    plan_expires_at  = COALESCE((updates->>'plan_expires_at')::timestamptz, p.plan_expires_at),
    plan_started_at  = COALESCE((updates->>'plan_started_at')::timestamptz, p.plan_started_at),
    credits          = COALESCE((updates->>'credits')::int, p.credits),
    credit_limit     = COALESCE((updates->>'credit_limit')::int, p.credit_limit),
    is_blocked       = COALESCE((updates->>'is_blocked')::boolean, p.is_blocked),
    credits_reset_at = COALESCE((updates->>'credits_reset_at')::timestamptz, p.credits_reset_at),
    plan_valid_until = COALESCE((updates->>'plan_valid_until')::timestamptz, p.plan_valid_until)
  WHERE p.id = target_user;
END;
$$;

-- Only signed-in users may call it (and the body still requires is_admin).
REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, jsonb) TO authenticated;

-- Quick test (run as yourself after make_admin.sql):
--   SELECT public.admin_update_profile(
--     (SELECT id FROM auth.users WHERE lower(email)=lower('SOME_USER@example.com')),
--     '{"credit_limit": 1000}'::jsonb);
