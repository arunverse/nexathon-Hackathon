-- ─── EBEXTA V1 Admin Console Migration ──────────────────────────────────────
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor → New Query
-- BEFORE using the new admin dashboard.

-- API usage tracking table
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  action TEXT,              -- 'discovery','enrich','email','proposal'
  model TEXT,               -- which gemini model
  tokens_used INTEGER DEFAULT 0,
  calls INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- System event log
CREATE TABLE IF NOT EXISTS system_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID,
  event_type TEXT,          -- 'scan','error','login','verification','export'
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure verification_requests exists (from earlier)
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

-- DEV-ONLY open read policies so the admin panel
-- can see all rows (tighten before launch)
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev insert api_usage" ON api_usage;
DROP POLICY IF EXISTS "dev read api_usage" ON api_usage;
DROP POLICY IF EXISTS "dev insert logs" ON system_logs;
DROP POLICY IF EXISTS "dev read logs" ON system_logs;

CREATE POLICY "dev insert api_usage" ON api_usage
  FOR INSERT WITH CHECK (true);
CREATE POLICY "dev read api_usage" ON api_usage
  FOR SELECT USING (true);
CREATE POLICY "dev insert logs" ON system_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "dev read logs" ON system_logs
  FOR SELECT USING (true);

-- DEV-ONLY: allow admin panel to read all core
-- tables (replace with is_admin role checks before launch)
DROP POLICY IF EXISTS "dev admin read leads" ON leads;
DROP POLICY IF EXISTS "dev admin read scans" ON scans;
DROP POLICY IF EXISTS "dev admin read profiles" ON profiles;
DROP POLICY IF EXISTS "dev admin read vr" ON verification_requests;
DROP POLICY IF EXISTS "dev admin update vr" ON verification_requests;
DROP POLICY IF EXISTS "dev admin read intents" ON declared_intents;

CREATE POLICY "dev admin read leads" ON leads
  FOR SELECT USING (true);
CREATE POLICY "dev admin read scans" ON scans
  FOR SELECT USING (true);
CREATE POLICY "dev admin read profiles" ON profiles
  FOR SELECT USING (true);
CREATE POLICY "dev admin read vr"
  ON verification_requests
  FOR SELECT USING (true);
CREATE POLICY "dev admin update vr"
  ON verification_requests
  FOR UPDATE USING (true);
CREATE POLICY "dev admin read intents"
  ON declared_intents
  FOR SELECT USING (true);
