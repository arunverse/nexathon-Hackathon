-- ============================================================================
-- EBEXTA · Onboarding flag
-- ----------------------------------------------------------------------------
-- Adds profiles.onboarded so a freshly-activated user is sent through the
-- Welcome overview → onboarding BEFORE the dashboard. Existing users are marked
-- onboarded=true so they are NOT pushed back through onboarding.
--
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarded BOOLEAN DEFAULT false;

-- Mark users who have ALREADY completed onboarding as done, so they aren't
-- disrupted. Proxy: onboarding is what sets company_name, so anyone with a
-- company name has onboarded. Users without one stay false → they'll get the
-- Welcome → onboarding flow. New signups default to false too.
UPDATE public.profiles
  SET onboarded = true
  WHERE COALESCE(company_name, '') <> '';
UPDATE public.profiles
  SET onboarded = false
  WHERE COALESCE(company_name, '') = '' AND onboarded IS NULL;

-- To RE-TEST the welcome flow for a specific account, reset it:
--   UPDATE public.profiles SET onboarded = false
--   WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('someone@example.com'));

-- The client can't write `onboarded` directly (column lockdown), so completion
-- is recorded via this SECURITY DEFINER function at the end of onboarding.
CREATE OR REPLACE FUNCTION public.ebexta_mark_onboarded()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  UPDATE public.profiles SET onboarded = true WHERE id = auth.uid();
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_mark_onboarded()    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_mark_onboarded() TO authenticated;

NOTIFY pgrst, 'reload schema';
