-- ============================================================================
-- EBEXTA · network_profiles v2 include a person identity for chat
-- ----------------------------------------------------------------------------
-- The inbox showed "EBEXTA member" whenever company_name was empty. Expose
-- sender_email (a real identity) so the chat can always show WHO you're talking
-- to the company name when set, and the person's email/name as well.
--
-- Only people you're connected to (a conversation, a matched intent) or an admin
-- can read these rows that's enforced by the profiles "network read" RLS.
--
-- Run once in the Supabase SQL editor. Idempotent. Requires chat_and_signals.sql
-- (network read policy) and, ideally, company_profiles.sql (company_profile).
-- ============================================================================

DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = on) AS
SELECT
  id,
  company_name,
  sender_email,            -- person identity for chat partners
  mission,
  mode,
  website,
  company_profile,
  created_at
FROM public.profiles;

GRANT SELECT ON public.network_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify:  SELECT id, company_name, sender_email FROM public.network_profiles LIMIT 5;
