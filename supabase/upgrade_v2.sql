-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA UPGRADE V2 run this ENTIRE file in Supabase → SQL Editor
-- Covers: saved leads, admin verified-leads pool, intent score breakdown,
-- per-mode scans, deep lead intel cache.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Saved leads per user ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS saved_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID,
  lead_snapshot JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, lead_id)
);
ALTER TABLE saved_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own saved insert" ON saved_leads;
DROP POLICY IF EXISTS "own saved read" ON saved_leads;
DROP POLICY IF EXISTS "own saved delete" ON saved_leads;
DROP POLICY IF EXISTS "dev admin read saved" ON saved_leads;

CREATE POLICY "own saved insert" ON saved_leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own saved read" ON saved_leads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own saved delete" ON saved_leads
  FOR DELETE USING (auth.uid() = user_id);
-- DEV ONLY: admin drilldown can count saved leads per user
CREATE POLICY "dev admin read saved" ON saved_leads
  FOR SELECT USING (true);

-- ── Admin-verified leads pool ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS verified_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  source_lead_id UUID,
  company_name TEXT NOT NULL,
  industry TEXT,
  city TEXT,
  location TEXT,
  employee_count INTEGER,
  funding_stage TEXT,
  service_categories TEXT[],
  mode_side TEXT,           -- 'seeker' or 'provider' (which side the LEAD is)
  lead_data JSONB NOT NULL, -- full lead incl. verified stakeholders
  verified_stakeholders JSONB,
  verified_by TEXT DEFAULT 'admin',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE verified_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dev vl insert" ON verified_leads;
DROP POLICY IF EXISTS "dev vl read" ON verified_leads;
DROP POLICY IF EXISTS "dev vl update" ON verified_leads;
DROP POLICY IF EXISTS "dev vl delete" ON verified_leads;

-- DEV-ONLY policies (tighten before launch)
CREATE POLICY "dev vl insert" ON verified_leads
  FOR INSERT WITH CHECK (true);
CREATE POLICY "dev vl read" ON verified_leads
  FOR SELECT USING (true);
CREATE POLICY "dev vl update" ON verified_leads
  FOR UPDATE USING (true);
CREATE POLICY "dev vl delete" ON verified_leads
  FOR DELETE USING (true);

-- ── Intent score breakdown on leads ──────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS score_breakdown JSONB;

-- ── Deep lead intel cache (Task 1 enrich once, never regenerate) ───────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS deep_intel JSONB;

-- ── Per-mode scans (Task 6 mode-refresh bug) ───────────────────────────────
ALTER TABLE scans ADD COLUMN IF NOT EXISTS mode TEXT;

-- Done.
