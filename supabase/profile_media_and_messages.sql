-- ============================================================================
-- EBEXTA · Complete Backend Schema Migration for Profile, Media, & Messaging
-- ----------------------------------------------------------------------------
-- Run this script once in your Supabase SQL Editor (https://supabase.com/dashboard).
-- It ensures all columns, tables, RLS policies, and RPC helper functions exist.
-- ============================================================================

-- ── 1. PROFILES TABLE ENHANCEMENTS ──────────────────────────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS full_name          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name               TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url        TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS logo_url          TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name       TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin          BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_profile   JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credits           INTEGER;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS credit_limit      INTEGER DEFAULT 1000;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_blocked        BOOLEAN DEFAULT false;


-- ── 2. COMMUNITY POSTS MEDIA & ATTACHMENTS ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_posts (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_name    TEXT,
  company_logo    TEXT,
  post_type       TEXT NOT NULL DEFAULT 'update',
  content         TEXT NOT NULL,
  image_url       TEXT,
  video_url       TEXT,
  link_url        TEXT,
  likes_count     INT DEFAULT 0,
  comments_count  INT DEFAULT 0,
  is_verified     BOOLEAN DEFAULT false,
  deleted_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Ensure media columns exist if community_posts table already existed
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS image_url TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE public.community_posts ADD COLUMN IF NOT EXISTS link_url  TEXT;


-- ── 3. DIRECT MESSAGING & NOTIFICATIONS ────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.community_notifications (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  actor_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL DEFAULT 'system',
  title      TEXT NOT NULL,
  body       TEXT NOT NULL,
  link       TEXT,
  read       BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.community_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_user_all" ON public.community_notifications;
CREATE POLICY "notifications_user_all" ON public.community_notifications
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());


-- ── 4. RPC FUNCTIONS ────────────────────────────────────────────────────────

-- 4.1 Save Company Profile RPC
CREATE OR REPLACE FUNCTION public.ebexta_save_company_profile(p jsonb)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.profiles
     SET company_profile = COALESCE(p, '{}'::jsonb),
         updated_at = now()
   WHERE id = auth.uid();
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_save_company_profile(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_save_company_profile(jsonb) TO authenticated;


-- 4.2 Admin Update Profile RPC (Admin-gated profile patching)
CREATE OR REPLACE FUNCTION public.admin_update_profile(target_user uuid, updates jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    credits          = COALESCE((updates->>'credits')::int, p.credits),
    credit_limit     = COALESCE((updates->>'credit_limit')::int, p.credit_limit),
    is_blocked       = COALESCE((updates->>'is_blocked')::boolean, p.is_blocked)
  WHERE p.id = target_user;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_profile(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_update_profile(uuid, jsonb) TO authenticated;


-- 4.3 Unread Notification Count RPC
CREATE OR REPLACE FUNCTION public.ebexta_unread_count()
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN (
    SELECT COUNT(*)::int
    FROM public.community_notifications
    WHERE user_id = auth.uid() AND read = false
  );
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_unread_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_unread_count() TO authenticated;

NOTIFY pgrst, 'reload schema';
