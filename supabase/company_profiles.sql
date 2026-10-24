-- ============================================================================
-- EBEXTA · Self-service company profiles (automated dossier)
-- ----------------------------------------------------------------------------
-- Each member fills in their own company details ONCE. When another member
-- connects / messages them, those details are shown automatically no admin
-- data entry, no per-request research. Company A texting Company B sees B's
-- self-entered profile.
--
-- company_profile JSONB keys (all optional strings):
--   future_scope, financial_funding, strategic_needs, major_projects,
--   employees, revenue, stage, location, recent_signals, key_contacts,
--   data_integrity
-- (name = company_name, already on profiles.)
--
-- Run once in the Supabase SQL editor. Idempotent. Requires public.is_admin()
-- and the profiles "network read" policy (chat_and_signals.sql).
-- ============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS company_profile JSONB DEFAULT '{}'::jsonb;

-- The client can't write arbitrary profile columns (column lockdown), so the
-- user saves their company profile through this SECURITY DEFINER function.
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

-- Expose company_profile in the safe network view so connected/matched members
-- can read it automatically (inherits the profiles network-read RLS).
DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = on) AS
SELECT id, company_name, mission, mode, website, company_profile, created_at
FROM public.profiles;
GRANT SELECT ON public.network_profiles TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify:  SELECT id, company_name, company_profile FROM public.network_profiles LIMIT 5;
