-- ============================================================================
-- EBEXTA SEARCH-VISIBILITY VERIFICATION + DISMISS/CYCLING
--
-- Fixes the Furnishka bug: an SEO agency was shown the single most
-- search-visible company in its category at 97% intent. Nothing ever checked
-- whether the company already ranked the strategy only ASKED the model to
-- skip top results, and momentum signals (funding, hiring) did the scoring.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run. ADDS only.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. WHAT WE ACTUALLY VERIFIED ABOUT THEIR SEARCH PRESENCE
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS search_visibility TEXT,
  ADD COLUMN IF NOT EXISTS rank_evidence     JSONB,
  ADD COLUMN IF NOT EXISTS excluded_reason   TEXT;

COMMENT ON COLUMN leads.search_visibility IS
  '''dominant'' = top 3 / ads / map pack (EXCLUDED for visibility sectors) · ''visible'' · ''weak'' · ''absent'' (ideal buyer) · ''not_checked'' (sector does not depend on visibility).';
COMMENT ON COLUMN leads.rank_evidence IS
  'The query used and where they appeared so the judgement is auditable.';
COMMENT ON COLUMN leads.excluded_reason IS
  'Why a lead was filtered out. Kept so the gate can never silently over-filter.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. DISMISSED never show this company to this user again
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dismissed_leads (
  id             UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id        UUID NOT NULL,
  company_name   TEXT NOT NULL,
  company_domain TEXT,
  reason         TEXT,
  dismissed_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, company_name)
);

ALTER TABLE dismissed_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dl own insert" ON dismissed_leads;
DROP POLICY IF EXISTS "dl own read"   ON dismissed_leads;
DROP POLICY IF EXISTS "dl own delete" ON dismissed_leads;

CREATE POLICY "dl own insert" ON dismissed_leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "dl own read" ON dismissed_leads
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "dl own delete" ON dismissed_leads
  FOR DELETE USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. SERVED what this user has already been shown, and in which cycle.
--    Drives "rescan gives me NEW companies" and the rollover when the market
--    is genuinely exhausted.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS served_leads (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,
  company_name TEXT NOT NULL,
  scan_id      UUID,
  served_at    TIMESTAMPTZ DEFAULT NOW(),
  cycle_number INTEGER DEFAULT 1
);

ALTER TABLE served_leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sl own insert" ON served_leads;
DROP POLICY IF EXISTS "sl own read"   ON served_leads;

CREATE POLICY "sl own insert" ON served_leads
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "sl own read" ON served_leads
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_dismissed_user ON dismissed_leads(user_id, company_name);
CREATE INDEX IF NOT EXISTS idx_served_user    ON served_leads(user_id, company_name);
CREATE INDEX IF NOT EXISTS idx_served_cycle   ON served_leads(user_id, cycle_number, served_at);


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'leads'
--     AND column_name IN ('search_visibility','rank_evidence','excluded_reason');
--   -- expect 3 rows
--
--   SELECT COUNT(*) FROM dismissed_leads;  -- expect 0
--   SELECT COUNT(*) FROM served_leads;     -- expect 0
--
-- No Edge Function needed for this one.
-- ────────────────────────────────────────────────────────────────────────────
