-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA PRODUCTION HARDENING (run ENTIRE file in Supabase → SQL Editor)
-- Covers: S2 (is_admin), S9 (RLS audit admin-aware, drop dev USING(true)),
--         C3 (filter_hash), C6 (indexes).
--
-- Safe to re-run (idempotent). Run AFTER the earlier migrations
-- (migrations.sql, admin_migration.sql, upgrade_v2.sql,
--  verified_contacts_migration.sql, network_intents_migration.sql).
-- ═══════════════════════════════════════════════════════════════════════════

-- ── S2: admin flag ───────────────────────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- >>> SET YOURSELF AS ADMIN (replace the email), then keep this commented:
-- UPDATE profiles SET is_admin = true WHERE sender_email = 'arunchinnu2005@gmail.com';

-- Admin check helper SECURITY DEFINER so it reads profiles WITHOUT triggering
-- the profiles RLS policy (prevents infinite recursion when used in policies).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ── C3: scan cache key ───────────────────────────────────────────────────────
ALTER TABLE scans ADD COLUMN IF NOT EXISTS filter_hash TEXT;

-- ═══════════════════════════════════════════════════════════════════════════
-- S9: RLS AUDIT replace all dev-only "USING (true)" policies with proper
-- per-user + admin-aware policies. Every table: SELECT/INSERT/UPDATE/DELETE
-- scoped to the owner, plus admin read where the console needs cross-user view.
-- ═══════════════════════════════════════════════════════════════════════════

-- Drop the permissive dev policies created by earlier migrations.
DROP POLICY IF EXISTS "dev admin read leads"      ON leads;
DROP POLICY IF EXISTS "dev admin read scans"      ON scans;
DROP POLICY IF EXISTS "dev admin read profiles"   ON profiles;
DROP POLICY IF EXISTS "dev admin read vr"         ON verification_requests;
DROP POLICY IF EXISTS "dev admin update vr"       ON verification_requests;
DROP POLICY IF EXISTS "dev admin read intents"    ON declared_intents;
DROP POLICY IF EXISTS "Admin read all requests"   ON verification_requests;
DROP POLICY IF EXISTS "Admin update all requests" ON verification_requests;
DROP POLICY IF EXISTS "dev insert api_usage"      ON api_usage;
DROP POLICY IF EXISTS "dev read api_usage"        ON api_usage;
DROP POLICY IF EXISTS "dev insert logs"           ON system_logs;
DROP POLICY IF EXISTS "dev read logs"             ON system_logs;
DROP POLICY IF EXISTS "dev admin read saved"      ON saved_leads;
DROP POLICY IF EXISTS "dev vl insert"             ON verified_leads;
DROP POLICY IF EXISTS "dev vl read"               ON verified_leads;
DROP POLICY IF EXISTS "dev vl update"             ON verified_leads;
DROP POLICY IF EXISTS "dev vl delete"             ON verified_leads;
DROP POLICY IF EXISTS "dev vc insert"             ON verified_contacts;
DROP POLICY IF EXISTS "dev vc read"               ON verified_contacts;
DROP POLICY IF EXISTS "dev vc update"             ON verified_contacts;
DROP POLICY IF EXISTS "dev vc delete"             ON verified_contacts;

-- ── profiles ────────────────────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own profile" ON profiles;
DROP POLICY IF EXISTS "profiles self read" ON profiles;
DROP POLICY IF EXISTS "profiles admin read" ON profiles;
DROP POLICY IF EXISTS "profiles self write" ON profiles;
CREATE POLICY "profiles self read"  ON profiles FOR SELECT USING (auth.uid() = id OR public.is_admin());
CREATE POLICY "profiles self write" ON profiles FOR ALL    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ── scans ─────────────────────────────────────────────────────────────────────
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own scans" ON scans;
DROP POLICY IF EXISTS "scans read" ON scans;
DROP POLICY IF EXISTS "scans insert" ON scans;
DROP POLICY IF EXISTS "scans update" ON scans;
DROP POLICY IF EXISTS "scans delete" ON scans;
CREATE POLICY "scans read"   ON scans FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "scans insert" ON scans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scans update" ON scans FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "scans delete" ON scans FOR DELETE USING (auth.uid() = user_id);

-- ── leads ─────────────────────────────────────────────────────────────────────
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own leads" ON leads;
DROP POLICY IF EXISTS "leads read" ON leads;
DROP POLICY IF EXISTS "leads insert" ON leads;
DROP POLICY IF EXISTS "leads update" ON leads;
DROP POLICY IF EXISTS "leads delete" ON leads;
CREATE POLICY "leads read"   ON leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "leads insert" ON leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads update" ON leads FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "leads delete" ON leads FOR DELETE USING (auth.uid() = user_id);

-- ── outreach ──────────────────────────────────────────────────────────────────
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own outreach" ON outreach;
DROP POLICY IF EXISTS "outreach read" ON outreach;
DROP POLICY IF EXISTS "outreach insert" ON outreach;
DROP POLICY IF EXISTS "outreach update" ON outreach;
DROP POLICY IF EXISTS "outreach delete" ON outreach;
CREATE POLICY "outreach read"   ON outreach FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "outreach insert" ON outreach FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outreach update" ON outreach FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "outreach delete" ON outreach FOR DELETE USING (auth.uid() = user_id);

-- ── declared_intents (own manage + network read of ACTIVE intents) ────────────
ALTER TABLE declared_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users own intents" ON declared_intents;
DROP POLICY IF EXISTS "intents own write" ON declared_intents;
DROP POLICY IF EXISTS "intents read" ON declared_intents;
-- Read: your own (any state) OR any non-expired intent (the network feed) OR admin.
CREATE POLICY "intents read" ON declared_intents FOR SELECT
  USING (auth.uid() = user_id OR expires_at > NOW() OR public.is_admin());
CREATE POLICY "intents own write" ON declared_intents FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ── verification_requests (user owns; admin reads+updates the queue) ──────────
ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users insert own requests" ON verification_requests;
DROP POLICY IF EXISTS "Users read own requests" ON verification_requests;
DROP POLICY IF EXISTS "vr read" ON verification_requests;
DROP POLICY IF EXISTS "vr insert" ON verification_requests;
DROP POLICY IF EXISTS "vr update" ON verification_requests;
CREATE POLICY "vr read"   ON verification_requests FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "vr insert" ON verification_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "vr update" ON verification_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── saved_leads ───────────────────────────────────────────────────────────────
ALTER TABLE saved_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own saved insert" ON saved_leads;
DROP POLICY IF EXISTS "own saved read" ON saved_leads;
DROP POLICY IF EXISTS "own saved delete" ON saved_leads;
CREATE POLICY "own saved read"   ON saved_leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "own saved insert" ON saved_leads FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saved delete" ON saved_leads FOR DELETE USING (auth.uid() = user_id);

-- ── verified_leads (public read pool; admin write only) ───────────────────────
ALTER TABLE verified_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "verified_leads public read" ON verified_leads;
DROP POLICY IF EXISTS "verified_leads admin write" ON verified_leads;
CREATE POLICY "verified_leads public read" ON verified_leads FOR SELECT USING (true);
CREATE POLICY "verified_leads admin write" ON verified_leads FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── verified_contacts (owner read; admin write) ───────────────────────────────
ALTER TABLE verified_contacts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own verified contacts read" ON verified_contacts;
DROP POLICY IF EXISTS "vc admin write" ON verified_contacts;
CREATE POLICY "own verified contacts read" ON verified_contacts FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "vc admin write" ON verified_contacts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ── api_usage (owner + admin read; owner/authenticated insert) ────────────────
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "api_usage read" ON api_usage;
DROP POLICY IF EXISTS "api_usage insert" ON api_usage;
CREATE POLICY "api_usage read"   ON api_usage FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
-- Insert path is the Edge Function (service role, bypasses RLS). This covers any
-- authenticated client insert while still stamping the caller's own id.
CREATE POLICY "api_usage insert" ON api_usage FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── system_logs (owner + admin read; authenticated insert) ────────────────────
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "system_logs read" ON system_logs;
DROP POLICY IF EXISTS "system_logs insert" ON system_logs;
CREATE POLICY "system_logs read"   ON system_logs FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "system_logs insert" ON system_logs FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ── cached_leads (public read; authenticated insert) ──────────────────────────
ALTER TABLE cached_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Cached leads public read" ON cached_leads;
DROP POLICY IF EXISTS "Cached leads insert" ON cached_leads;
CREATE POLICY "Cached leads public read" ON cached_leads FOR SELECT USING (true);
CREATE POLICY "Cached leads insert" ON cached_leads FOR INSERT WITH CHECK (true);

-- ── signal_watches / signal_matches (owner-scoped; create tables if missing) ──
CREATE TABLE IF NOT EXISTS signal_watches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID, keyword TEXT, industry TEXT, notes TEXT,
  active BOOLEAN DEFAULT true, created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS signal_matches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  watch_id UUID, user_id UUID, company_name TEXT, signal_text TEXT,
  source_url TEXT, detected_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE signal_watches ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_matches ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sw own" ON signal_watches;
DROP POLICY IF EXISTS "sm own" ON signal_matches;
CREATE POLICY "sw own" ON signal_watches FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sm own" ON signal_matches FOR ALL USING (auth.uid() = user_id OR public.is_admin()) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- C6: INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_leads_user_id      ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_scan_id      ON leads(scan_id);
CREATE INDEX IF NOT EXISTS idx_leads_intent       ON leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_leads_status       ON leads(verification_status);
CREATE INDEX IF NOT EXISTS idx_scans_user_id      ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_scans_mode         ON scans(mode);
CREATE INDEX IF NOT EXISTS idx_scans_hash         ON scans(filter_hash);
CREATE INDEX IF NOT EXISTS idx_vr_user_id         ON verification_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_vr_status          ON verification_requests(status);
CREATE INDEX IF NOT EXISTS idx_saved_user_id      ON saved_leads(user_id);
CREATE INDEX IF NOT EXISTS idx_api_created        ON api_usage(created_at);
CREATE INDEX IF NOT EXISTS idx_api_user_action    ON api_usage(user_id, action, created_at);
CREATE INDEX IF NOT EXISTS idx_api_model_created  ON api_usage(model, created_at);
CREATE INDEX IF NOT EXISTS idx_logs_created       ON system_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_verified_industry  ON verified_leads(industry);
CREATE INDEX IF NOT EXISTS idx_verified_city      ON verified_leads(city);
CREATE INDEX IF NOT EXISTS idx_intents_user       ON declared_intents(user_id);
CREATE INDEX IF NOT EXISTS idx_intents_mode_exp   ON declared_intents(mode, expires_at);
CREATE INDEX IF NOT EXISTS idx_profiles_admin     ON profiles(is_admin) WHERE is_admin = true;

-- Done. Verify with:
--   SELECT tablename, policyname, cmd, qual, with_check FROM pg_policies ORDER BY tablename;
