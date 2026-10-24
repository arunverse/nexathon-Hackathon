-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · SECURITY REMEDIATION run ONCE in Supabase → SQL Editor.
-- Closes findings from the 2026-07-18 attacker-perspective review.
-- Idempotent. Safe to re-run. Read each section's comment before running.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─── FIX 1 (CRITICAL) · Kill self-serve plan activation ──────────────────────
-- ebexta_set_plan() let ANY authenticated user set their own plan_status='active'
-- (free Enterprise). ebexta_start_trial() let anyone self-grant/repeat trials.
-- Billing is now admin-activated (ebexta_activate_request), so these dev-only
-- RPCs must not exist in production. Drop them entirely.
DROP FUNCTION IF EXISTS public.ebexta_set_plan(text, int);
DROP FUNCTION IF EXISTS public.ebexta_start_trial();

-- If you still want a self-serve TRIAL later, re-create it with a hard,
-- server-side one-trial-ever guard (example, commented out):
-- CREATE OR REPLACE FUNCTION public.ebexta_start_trial()
-- RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
-- BEGIN
--   IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
--   -- Only from a virgin account that has NEVER had a plan/trial.
--   IF EXISTS (SELECT 1 FROM public.profiles
--              WHERE id = auth.uid()
--                AND (plan_status IS DISTINCT FROM 'none' OR plan_started_at IS NOT NULL)) THEN
--     RAISE EXCEPTION 'Trial not available';
--   END IF;
--   UPDATE public.profiles
--      SET plan='starter', plan_status='trial',
--          plan_started_at=now(), plan_expires_at=now()+interval '7 days'
--    WHERE id = auth.uid();
-- END; $$;
-- REVOKE ALL ON FUNCTION public.ebexta_start_trial() FROM PUBLIC, anon;
-- GRANT EXECUTE ON FUNCTION public.ebexta_start_trial() TO authenticated;


-- ─── FIX 2 (MEDIUM) · Stop email harvesting through network_profiles ─────────
-- The view exposed sender_email of ANY user who posted a declared_intent to
-- ANYONE holding a single active signal_watch (no keyword match). Rebuild the
-- view so the intent-match branch actually matches the watcher's keyword to the
-- poster's intent (mirrors ebexta_matched_intents), keeping email limited to
-- genuine matches + chat partners + self + admin.
DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = off) AS
SELECT
  p.id, p.company_name, p.sender_email, p.mission, p.mode,
  p.website, p.company_profile, p.created_at
FROM public.profiles p
WHERE
  auth.uid() = p.id
  OR public.is_admin()
  OR EXISTS (                                            -- people you chat with
      SELECT 1 FROM public.conversations c
      WHERE auth.uid() IN (c.user_a, c.user_b)
        AND p.id IN (c.user_a, c.user_b))
  OR EXISTS (                                            -- posters your watch ACTUALLY matched
      SELECT 1
      FROM public.signal_watches sw
      JOIN public.declared_intents di
        ON di.user_id = p.id
       AND (di.expires_at IS NULL OR di.expires_at > now())
       AND (
            di.requirement ILIKE '%' || sw.keyword || '%'
         OR EXISTS (SELECT 1 FROM unnest(COALESCE(di.industry_tags,'{}')) t
                    WHERE t ILIKE '%' || sw.keyword || '%')
       )
      WHERE sw.user_id = auth.uid() AND sw.active IS TRUE);

ALTER VIEW public.network_profiles OWNER TO postgres;
REVOKE ALL ON public.network_profiles FROM anon;
GRANT SELECT ON public.network_profiles TO authenticated;


-- ─── FIX 3 (MEDIUM) · Single-use coupon table (used by the account fn fix) ───
-- Enforces one redemption per (user, code) so a leaked code can't be reused and
-- can't be used to reset the Gemini billing window. The account Edge Function
-- (updated in code) inserts here and rejects on conflict.
CREATE TABLE IF NOT EXISTS public.coupon_redemptions (
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code        TEXT NOT NULL,
  redeemed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, code)
);
ALTER TABLE public.coupon_redemptions ENABLE ROW LEVEL SECURITY;
-- Only the service role (Edge Function) writes; users may read their own.
DROP POLICY IF EXISTS "coupon self read" ON public.coupon_redemptions;
CREATE POLICY "coupon self read" ON public.coupon_redemptions
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());


-- ─── FIX 4 (LOW) · Lock down the shared cached_leads table ───────────────────
-- Previously: INSERT WITH CHECK (true) → any client could inject/poison shared
-- cache rows and bloat storage. Require an authenticated caller and stamp the
-- inserter. (Reads stay public it's a shared discovery cache.)
DO $$
BEGIN
  IF to_regclass('public.cached_leads') IS NOT NULL THEN
    -- add an owner column if missing so we can attribute/limit inserts
    BEGIN
      ALTER TABLE public.cached_leads ADD COLUMN IF NOT EXISTS created_by UUID;
    EXCEPTION WHEN others THEN NULL;
    END;
    DROP POLICY IF EXISTS "Cached leads insert" ON public.cached_leads;
    DROP POLICY IF EXISTS "Cached leads public read" ON public.cached_leads;
    CREATE POLICY "Cached leads public read" ON public.cached_leads
      FOR SELECT USING (true);
    CREATE POLICY "Cached leads auth insert" ON public.cached_leads
      FOR INSERT TO authenticated
      WITH CHECK (created_by = auth.uid() OR created_by IS NULL);
  END IF;
END $$;


-- ─── FIX 5 (HIGH, VERIFY) · Confirm the RLS lockdown is actually live ────────
-- The older dev migrations (restore_working_rls.sql, fix_migration.sql,
-- admin_migration.sql, upgrade_v2.sql, verified_contacts_migration.sql,
-- migrations.sql) created OPEN policies (USING(true)). rls_lockdown.sql +
-- production_hardening.sql remove them but ONLY if they were the last thing
-- run. Run the audit below; every row it returns is a table where ANY logged-in
-- user can read/insert ACROSS users. Expected result: ZERO rows (except the
-- intentional public pools: verified_leads read, cached_leads read).
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (qual = 'true' OR with_check = 'true')
  AND tablename IN (
    'profiles','scans','leads','outreach','declared_intents',
    'verification_requests','saved_leads','api_usage','system_logs',
    'verified_contacts','signal_watches','signal_matches',
    'conversations','messages','payments','plan_requests',
    'dossiers','dossier_requests'
  )
ORDER BY tablename, cmd;
-- If ANY rows come back → re-run supabase/rls_lockdown.sql (then this file)
-- immediately; the database is currently exposed to cross-user reads/writes.

-- Also confirm the column-level privilege lockdown is in place (blocks a user
-- from writing their own is_admin/credits/plan). This must return ONLY the
-- harmless columns (company_name, sender_email, mission, mode, website,
-- updated_at). If it lists is_admin/credits/plan/credit_limit → re-run
-- supabase/secure_profiles.sql.
SELECT column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='public' AND table_name='profiles'
  AND grantee='authenticated' AND privilege_type='UPDATE'
ORDER BY column_name;

NOTIFY pgrst, 'reload schema';
-- Done.
