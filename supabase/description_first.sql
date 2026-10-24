-- ============================================================================
-- EBEXTA DESCRIPTION-FIRST MATCHING + REUSABLE LEAD POOL
--
-- Fixes the regression where a game-development provider was shown SaaS/cloud
-- companies: the user's DESCRIPTION is now the primary matching input, and
-- filters only narrow it.
--
-- Run ONCE in the Supabase SQL editor. Safe to re-run. ADDS only.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. WHY THIS LEAD MATCHED stored per lead so a bad match is visible
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS source_description      TEXT,
  ADD COLUMN IF NOT EXISTS need_summary            TEXT,
  ADD COLUMN IF NOT EXISTS description_match_score INTEGER DEFAULT 0;

COMMENT ON COLUMN leads.need_summary IS
  'One sentence on why THIS company specifically needs what the user sells. If this reads generic, the match is bad that is the point.';
COMMENT ON COLUMN leads.description_match_score IS
  '0-100. How well need_summary connects to the user''s core service. Below 40 is excluded, never shown.';

ALTER TABLE scans
  ADD COLUMN IF NOT EXISTS description_used TEXT;

COMMENT ON COLUMN scans.description_used IS
  'The buyer profile EBEXTA extracted from the description and actually searched with.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. REUSABLE LEAD POOL shared across users.
--    A company found for one game-dev seller is reusable by the next, but
--    NEVER by a SaaS seller with the same industry filter. Reuse is keyed on
--    need_categories (what the company NEEDS), not on filters.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS lead_pool (
  id                 UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  company_name       TEXT NOT NULL,
  company_domain     TEXT,
  industry           TEXT,
  city               TEXT,
  location           TEXT,
  employee_count     INTEGER,
  funding_stage      TEXT,
  mode_side          TEXT,          -- 'seeker' | 'provider'
  need_summary       TEXT,          -- what this company NEEDS
  need_categories    TEXT[],        -- normalized need tags the reuse key
  source_description TEXT,          -- the description that found it
  lead_data          JSONB NOT NULL,
  times_served       INTEGER DEFAULT 0,
  last_verified      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(company_name, mode_side)
);

ALTER TABLE lead_pool ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "lp read"   ON lead_pool;
DROP POLICY IF EXISTS "lp write"  ON lead_pool;
DROP POLICY IF EXISTS "lp update" ON lead_pool;

-- Open by design: this is discovered public-company intelligence, not user
-- data. Sharing it is what makes the pool cheaper than re-discovering.
CREATE POLICY "lp read"   ON lead_pool FOR SELECT USING (true);
CREATE POLICY "lp write"  ON lead_pool FOR INSERT WITH CHECK (true);
CREATE POLICY "lp update" ON lead_pool FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_pool_cat  ON lead_pool USING GIN(need_categories);
CREATE INDEX IF NOT EXISTS idx_pool_mode ON lead_pool(mode_side, city);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. Atomic serve counter several users can draw from the pool at once.
-- ────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION ebexta_pool_served(p_ids UUID[])
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE lead_pool SET times_served = times_served + 1 WHERE id = ANY(p_ids);
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'leads'
--     AND column_name IN ('source_description','need_summary','description_match_score');
--   -- expect 3 rows
--
--   SELECT COUNT(*) FROM lead_pool;   -- expect 0 (table exists, empty)
--
-- No Edge Function needed for this one.
-- ────────────────────────────────────────────────────────────────────────────
