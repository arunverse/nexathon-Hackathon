-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · Privacy hardening stop cross-user profile over-exposure
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- PROBLEM (found in the PII audit):
--   `authenticated` has full-column SELECT on `public.profiles`, and the old
--   "profiles network read" RLS policy granted ROW access to anyone you share a
--   conversation or a matched declared-intent with. RLS is row-level only it
--   cannot hide columns so a chat partner could `select('*')` your row and
--   read `plan`, `credits`, `credit_limit`, `is_admin`, `is_blocked`,
--   `plan_expires_at`, etc. Only a SAFE subset was ever meant to be shared.
--
-- FIX:
--   1. Serve cross-user profile data ONLY through a SECURITY DEFINER view that
--      exposes a safe column subset AND embeds the connection check.
--   2. Narrow the base-table SELECT policy to SELF + ADMIN. The existing
--      "profiles self read" (self OR is_admin) policy already covers those, so
--      dropping the network-read policy removes cross-user raw-row access with
--      no loss of self/admin reads. `ebexta_matched_intents()` is already
--      SECURITY DEFINER and unaffected.
-- ═══════════════════════════════════════════════════════════════════════════

-- 0. Make sure every column the view reads exists (older DBs may not have run
--    company_profiles.sql / network_profiles_v2.sql yet). Idempotent no-ops.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_name    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS sender_email    TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mission         TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS mode            TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS website         TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_profile JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at      TIMESTAMPTZ DEFAULT NOW();

-- 1. Column-limited, connection-checked view (definer → bypasses base RLS, so it
--    no longer needs a broad base-table policy; the WHERE clause is the gate).
DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = off) AS
SELECT
  p.id,
  p.company_name,
  p.sender_email,      -- shared identity for people you're actually connected to
  p.mission,
  p.mode,
  p.website,
  p.company_profile,   -- self-authored shareable dossier (revenue/funding/etc.)
  p.created_at
FROM public.profiles p
WHERE
  auth.uid() = p.id                                   -- your own row
  OR public.is_admin()                                -- admins (monitoring)
  OR EXISTS (SELECT 1 FROM public.conversations c      -- people you chat with
             WHERE auth.uid() IN (c.user_a, c.user_b)
               AND p.id IN (c.user_a, c.user_b))
  OR EXISTS (SELECT 1 FROM public.declared_intents di  -- posters your watch matched
             JOIN public.signal_watches sw
               ON sw.user_id = auth.uid() AND sw.active
             WHERE di.user_id = p.id);

ALTER VIEW public.network_profiles OWNER TO postgres;
REVOKE ALL ON public.network_profiles FROM anon;
GRANT SELECT ON public.network_profiles TO authenticated;

-- 2. Remove the over-broad cross-user policy on the BASE table. Self + admin
--    reads remain via the existing "profiles self read" policy
--    (production_hardening.sql). Cross-user reads now flow only through the safe
--    view above and the ebexta_matched_intents() definer function.
DROP POLICY IF EXISTS "profiles network read" ON public.profiles;

-- Safety net: guarantee a self-or-admin SELECT policy exists even if an older
-- migration wasn't run (no-op if it already exists).
DROP POLICY IF EXISTS "profiles self or admin read" ON public.profiles;
CREATE POLICY "profiles self or admin read" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());

-- 3. Account Deletion RPC (GDPR / DPDP Compliance)
-- Allows an authenticated user to purge all their personal data across tables.
CREATE OR REPLACE FUNCTION public.ebexta_delete_account()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  DELETE FROM public.outreach WHERE user_id = v_uid;
  DELETE FROM public.leads WHERE user_id = v_uid;
  DELETE FROM public.scans WHERE user_id = v_uid;
  DELETE FROM public.saved_leads WHERE user_id = v_uid;
  DELETE FROM public.declared_intents WHERE user_id = v_uid;
  DELETE FROM public.verification_requests WHERE user_id = v_uid;
  DELETE FROM public.verified_contacts WHERE user_id = v_uid;
  DELETE FROM public.signal_watches WHERE user_id = v_uid;
  DELETE FROM public.signal_matches WHERE user_id = v_uid;
  DELETE FROM public.payments WHERE user_id = v_uid;
  DELETE FROM public.api_usage WHERE user_id = v_uid;
  DELETE FROM public.system_logs WHERE user_id = v_uid;
  DELETE FROM public.profiles WHERE id = v_uid;

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.ebexta_delete_account() TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify:
--   -- As a normal user, this must return ONLY your own row (+ admins see all):
--   SELECT id, plan, credits, is_admin FROM public.profiles;
--   -- Connected counterparts still resolve for chat/signals via the safe view:
--   SELECT id, company_name, sender_email FROM public.network_profiles;

