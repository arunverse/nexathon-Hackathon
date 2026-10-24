-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA RESTORE WORKING RLS
-- Run this ENTIRE file in Supabase → SQL Editor if the app stopped reading data
-- (blank leads, "Your Company", empty pages) after production_hardening.sql.
--
-- It re-opens read/write to the known-good pre-hardening behavior so the app
-- works again. Your API-key security (S1 Edge Function) is UNAFFECTED.
-- Re-harden RLS later once everything is confirmed working.
-- ═══════════════════════════════════════════════════════════════════════════

-- Helper stays (harmless). Recreate defensively in case it failed to create.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- profiles ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles self read" ON profiles;
DROP POLICY IF EXISTS "profiles self write" ON profiles;
DROP POLICY IF EXISTS "Users own profile" ON profiles;
CREATE POLICY "profiles read all"  ON profiles FOR SELECT USING (true);
CREATE POLICY "profiles own write" ON profiles FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- scans ──────────────────────────────────────────────────────────────────
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "scans read" ON scans;
DROP POLICY IF EXISTS "scans insert" ON scans;
DROP POLICY IF EXISTS "scans update" ON scans;
DROP POLICY IF EXISTS "scans delete" ON scans;
DROP POLICY IF EXISTS "Users own scans" ON scans;
CREATE POLICY "scans read all" ON scans FOR SELECT USING (true);
CREATE POLICY "scans own write" ON scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- leads ──────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads read" ON leads;
DROP POLICY IF EXISTS "leads insert" ON leads;
DROP POLICY IF EXISTS "leads update" ON leads;
DROP POLICY IF EXISTS "leads delete" ON leads;
DROP POLICY IF EXISTS "Users own leads" ON leads;
CREATE POLICY "leads read all" ON leads FOR SELECT USING (true);
CREATE POLICY "leads own write" ON leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- outreach ────────────────────────────────────────────────────────────────
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "outreach read" ON outreach;
DROP POLICY IF EXISTS "outreach insert" ON outreach;
DROP POLICY IF EXISTS "outreach update" ON outreach;
DROP POLICY IF EXISTS "outreach delete" ON outreach;
DROP POLICY IF EXISTS "Users own outreach" ON outreach;
CREATE POLICY "outreach read all" ON outreach FOR SELECT USING (true);
CREATE POLICY "outreach own write" ON outreach FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- declared_intents ─────────────────────────────────────────────────────────
ALTER TABLE declared_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intents read" ON declared_intents;
DROP POLICY IF EXISTS "intents own write" ON declared_intents;
DROP POLICY IF EXISTS "Users own intents" ON declared_intents;
DROP POLICY IF EXISTS "network read active intents" ON declared_intents;
CREATE POLICY "intents read all" ON declared_intents FOR SELECT USING (true);
CREATE POLICY "intents own write" ON declared_intents FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- verification_requests ────────────────────────────────────────────────────
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "vr read" ON verification_requests;
DROP POLICY IF EXISTS "vr insert" ON verification_requests;
DROP POLICY IF EXISTS "vr update" ON verification_requests;
CREATE POLICY "vr read all"  ON verification_requests FOR SELECT USING (true);
CREATE POLICY "vr insert own" ON verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vr update all" ON verification_requests FOR UPDATE USING (true);

-- saved_leads ──────────────────────────────────────────────────────────────
ALTER TABLE saved_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved read" ON saved_leads;
DROP POLICY IF EXISTS "own saved insert" ON saved_leads;
DROP POLICY IF EXISTS "own saved delete" ON saved_leads;
CREATE POLICY "saved read all"  ON saved_leads FOR SELECT USING (true);
CREATE POLICY "saved own write" ON saved_leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- cached_leads (public) ─────────────────────────────────────────────────────
ALTER TABLE cached_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cached leads public read" ON cached_leads;
DROP POLICY IF EXISTS "Cached leads insert" ON cached_leads;
CREATE POLICY "Cached leads public read" ON cached_leads FOR SELECT USING (true);
CREATE POLICY "Cached leads insert" ON cached_leads FOR INSERT WITH CHECK (true);

-- api_usage / system_logs (open dev) ───────────────────────────────────────
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_usage read" ON api_usage;
DROP POLICY IF EXISTS "api_usage insert" ON api_usage;
CREATE POLICY "api_usage read all"  ON api_usage FOR SELECT USING (true);
CREATE POLICY "api_usage insert all" ON api_usage FOR INSERT WITH CHECK (true);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_logs read" ON system_logs;
DROP POLICY IF EXISTS "system_logs insert" ON system_logs;
CREATE POLICY "system_logs read all"  ON system_logs FOR SELECT USING (true);
CREATE POLICY "system_logs insert all" ON system_logs FOR INSERT WITH CHECK (true);

-- verified_leads / verified_contacts (only if the tables exist) ─────────────
DO $$ BEGIN
  IF to_regclass('public.verified_leads') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE verified_leads ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "verified_leads public read" ON verified_leads';
    EXECUTE 'DROP POLICY IF EXISTS "verified_leads admin write" ON verified_leads';
    EXECUTE 'CREATE POLICY "verified_leads public read" ON verified_leads FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "verified_leads write all" ON verified_leads FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF to_regclass('public.verified_contacts') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE verified_contacts ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "own verified contacts read" ON verified_contacts';
    EXECUTE 'DROP POLICY IF EXISTS "vc admin write" ON verified_contacts';
    EXECUTE 'CREATE POLICY "vc read all" ON verified_contacts FOR SELECT USING (true)';
    EXECUTE 'CREATE POLICY "vc write all" ON verified_contacts FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF to_regclass('public.signal_watches') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE signal_watches ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "sw own" ON signal_watches';
    EXECUTE 'CREATE POLICY "sw all" ON signal_watches FOR ALL USING (true) WITH CHECK (true)';
  END IF;
  IF to_regclass('public.signal_matches') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE signal_matches ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "sm own" ON signal_matches';
    EXECUTE 'CREATE POLICY "sm all" ON signal_matches FOR ALL USING (true) WITH CHECK (true)';
  END IF;
END $$;

-- Done. Reads/writes are open again (dev behavior). Re-tighten later.
