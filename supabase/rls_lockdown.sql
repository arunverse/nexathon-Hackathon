-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · RLS LOCKDOWN close cross-user data access (IDOR) before launch
-- Run once in Supabase → SQL Editor. Idempotent & deterministic.
--
-- PROBLEM (found in the auth/IDOR audit):
--   Several dev migrations (restore_working_rls.sql, fix_migration.sql,
--   admin_migration.sql, verified_contacts_migration.sql) created open policies
--   like "leads read all" / "dev admin read profiles" USING (true) and
--   "dev insert api_usage" WITH CHECK (true). RLS policies are OR-ADDITIVE, so a
--   single surviving open policy nullifies the correct owner-scoped ones:
--     • any logged-in user could read EVERY user's profiles, leads, scans,
--       outreach, intents, saved leads, verification requests, usage + logs;
--     • WITH CHECK (true) on api_usage let a user insert usage rows under ANOTHER
--       user's id to exhaust their credits (griefing).
--
-- FIX: for each user-owned table, DROP EVERY existing policy (removes the open
--   ones regardless of name) and recreate ONLY owner-or-admin scoped policies.
--   SECURITY DEFINER functions (handle_new_user, ebexta_matched_intents, admin
--   RPCs) and the network_profiles view are unaffected they bypass RLS by
--   design and enforce their own checks.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Wipe ALL existing policies on the user-owned tables (kills every stray
--    open/dev policy), then re-enable RLS.
DO $$
DECLARE t text; pol record;
  tables text[] := ARRAY[
    'profiles','scans','leads','outreach','declared_intents',
    'verification_requests','saved_leads','api_usage','system_logs',
    'verified_contacts','signal_watches','signal_matches'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass('public.'||t) IS NOT NULL THEN
      FOR pol IN SELECT policyname FROM pg_policies WHERE schemaname='public' AND tablename=t LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t);
      END LOOP;
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END $$;

-- 2. Recreate the correct, owner-scoped policies. --------------------------------

-- profiles (keyed by id). Cross-user reads go through the network_profiles
-- definer view + ebexta_matched_intents(), never the raw base row.
CREATE POLICY "profiles self or admin read" ON public.profiles
  FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles self write" ON public.profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
-- (Column-level UPDATE grants from secure_profiles.sql still block is_admin/
--  credits/plan writes; this policy only governs the row.)

-- scans / leads / outreach / declared_intents / saved_leads (keyed by user_id):
-- read your own (admins read all); write only your own rows.
CREATE POLICY "scans read"  ON public.scans  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "scans write" ON public.scans  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "leads read"  ON public.leads  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "leads write" ON public.leads  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "outreach read"  ON public.outreach FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "outreach write" ON public.outreach FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "intents read"  ON public.declared_intents FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "intents write" ON public.declared_intents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "saved read"  ON public.saved_leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "saved write" ON public.saved_leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- verification_requests: user reads/creates own; only admins update (verify).
CREATE POLICY "vr read"   ON public.verification_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "vr insert" ON public.verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vr update" ON public.verification_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- api_usage / system_logs: read your own (admins all); INSERT only for YOURSELF
-- (blocks griefing other users' credit counts). No UPDATE/DELETE → usage can't be
-- tampered/reset. The gemini Edge Function writes via service role (bypasses RLS).
CREATE POLICY "api_usage read"   ON public.api_usage FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "api_usage insert" ON public.api_usage FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "system_logs read"   ON public.system_logs FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "system_logs insert" ON public.system_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- verified_contacts: user reads own; only admins write (hand-verified pool).
CREATE POLICY "vc read"  ON public.verified_contacts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "vc write" ON public.verified_contacts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- signal_watches / signal_matches: fully owner-scoped.
CREATE POLICY "sw own" ON public.signal_watches FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sm own" ON public.signal_matches FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

-- Verify (as a NON-admin user): each of these must return ONLY your own rows.
--   SELECT count(*) FROM public.leads;      -- your leads only
--   SELECT count(*) FROM public.profiles;   -- 1 (yourself)
--   INSERT INTO public.api_usage (user_id, action) VALUES ('<someone-else-id>','x'); -- must FAIL
