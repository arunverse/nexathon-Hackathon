-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA FIX MIGRATION run this ENTIRE file in Supabase → SQL Editor
--
-- Fixes three reported problems:
--  1. "Verify by EBEXTA" button does nothing  → verification_requests table +
--     insert/read policies were missing or blocked by RLS/FK.
--  2. Intents & signals not appearing        → the leads INSERT includes rich
--     columns (signals, contacts, funding…) that the original table doesn't
--     have, so EVERY lead insert was silently failing. This adds them all.
--  3. Regenerated leads scoring 0            → old cached_leads rows (built
--     before the matching fix) are flushed so fresh scans run properly.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. LEADS add every rich column the app writes ─────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_linkedin TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_twitter TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS requirement_theme TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS turnover TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS revenue_growth TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS funding_details TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS funding_source_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS investment_history TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS big_projects JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS match_reason JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS contacts JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_stage TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS is_strongly_recommended BOOLEAN DEFAULT false;
-- recent_signals / intent_flags may be missing on older databases:
ALTER TABLE leads ADD COLUMN IF NOT EXISTS recent_signals JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS intent_flags TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS validation_errors TEXT[];
ALTER TABLE leads ADD COLUMN IF NOT EXISTS stakeholders JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS evidence_source_url TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS trust_score INTEGER DEFAULT 0;
-- Company-level contact fallback (Google Maps / contact page) shown when
-- no named stakeholders are found:
ALTER TABLE leads ADD COLUMN IF NOT EXISTS company_contact JSONB;

-- ── 2. VERIFICATION REQUESTS table + working policies ─────────────────────
CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  lead_id UUID,
  company_name TEXT,
  company_domain TEXT,
  contact_name TEXT,
  contact_title TEXT,
  status TEXT DEFAULT 'pending',
  verified_email TEXT,
  verified_phone TEXT,
  verified_linkedin TEXT,
  confidence_score INTEGER,
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

-- A lead may live only in the browser (localStorage) a strict foreign key
-- on lead_id makes the insert fail. Remove it if an older migration added one.
ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_lead_id_fkey;
ALTER TABLE verification_requests DROP CONSTRAINT IF EXISTS verification_requests_user_id_fkey;

ALTER TABLE verification_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own requests" ON verification_requests;
DROP POLICY IF EXISTS "Users read own requests" ON verification_requests;
DROP POLICY IF EXISTS "Admin read all requests" ON verification_requests;
DROP POLICY IF EXISTS "Admin update all requests" ON verification_requests;
DROP POLICY IF EXISTS "dev admin read vr" ON verification_requests;
DROP POLICY IF EXISTS "dev admin update vr" ON verification_requests;

-- Users can create and watch their own requests (live monitor)
CREATE POLICY "Users insert own requests" ON verification_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users read own requests" ON verification_requests
  FOR SELECT USING (auth.uid() = user_id);

-- DEV ONLY: admin console reads/updates everything (tighten before launch)
CREATE POLICY "dev admin read vr" ON verification_requests
  FOR SELECT USING (true);
CREATE POLICY "dev admin update vr" ON verification_requests
  FOR UPDATE USING (true);

-- ── 3. ADMIN TABLES in case admin_migration.sql wasn't run yet ────────────
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT,
  model TEXT,
  tokens_used INTEGER DEFAULT 0,
  calls INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT,
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev insert api_usage" ON api_usage;
DROP POLICY IF EXISTS "dev read api_usage" ON api_usage;
DROP POLICY IF EXISTS "dev insert logs" ON system_logs;
DROP POLICY IF EXISTS "dev read logs" ON system_logs;

CREATE POLICY "dev insert api_usage" ON api_usage FOR INSERT WITH CHECK (true);
CREATE POLICY "dev read api_usage" ON api_usage FOR SELECT USING (true);
CREATE POLICY "dev insert logs" ON system_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "dev read logs" ON system_logs FOR SELECT USING (true);

-- ── 4. DEV ADMIN READ ACCESS on core tables ──────────────────────────────────
DROP POLICY IF EXISTS "dev admin read leads" ON leads;
DROP POLICY IF EXISTS "dev admin read scans" ON scans;
DROP POLICY IF EXISTS "dev admin read profiles" ON profiles;
DROP POLICY IF EXISTS "dev admin read intents" ON declared_intents;

CREATE POLICY "dev admin read leads" ON leads FOR SELECT USING (true);
CREATE POLICY "dev admin read scans" ON scans FOR SELECT USING (true);
CREATE POLICY "dev admin read profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "dev admin read intents" ON declared_intents FOR SELECT USING (true);

-- ── 5. FLUSH STALE CACHE old entries pre-date the matching fix ────────────
DELETE FROM cached_leads;

-- Done. Now: refresh the app → run a scan → click "Request Verified Contact"
-- → watch it appear in Verified Contacts (user) and /admin/queue (admin).
