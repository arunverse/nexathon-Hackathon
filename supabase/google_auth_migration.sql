-- ─── EBEXTA Google Authentication Migration ─────────────────────────────
-- Run this in Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS google_sub TEXT UNIQUE;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS profile_image_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS authentication_provider TEXT DEFAULT 'email';

-- Fast lookup indexes
CREATE INDEX IF NOT EXISTS idx_profiles_google_sub ON public.profiles(google_sub);
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);

-- Ensure existing sender_email syncs to email if email column is empty
UPDATE public.profiles
SET email = sender_email
WHERE email IS NULL AND sender_email IS NOT NULL;
