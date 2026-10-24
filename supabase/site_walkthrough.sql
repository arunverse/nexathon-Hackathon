-- ============================================================================
-- EBEXTA DEEP SITE WALKTHROUGH
-- Every claim gets checked against the company's actual live website.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run. ADDS columns only nothing existing is altered or dropped.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. LEADS new columns holding the site evidence
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS site_walkthrough   JSONB,
  ADD COLUMN IF NOT EXISTS pages_read         JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS site_read_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS claim_verification JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS site_read_status   TEXT;
  -- site_read_status: 'full' | 'partial' | 'unreachable' | 'blocked'

COMMENT ON COLUMN leads.site_walkthrough IS
  'What Gemini read from the pages we actually fetched never from memory.';
COMMENT ON COLUMN leads.pages_read IS
  'Every URL fetched, with the facts extracted from each by regex (no AI).';
COMMENT ON COLUMN leads.claim_verification IS
  'CONFIRMED / CONTRADICTED / NOT_ON_SITE per field, with the proving URL.';
COMMENT ON COLUMN leads.site_read_status IS
  'full = 4+ pages read; partial = 1-3; unreachable = no site; blocked = robots/403.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. SITE CACHE shared across ALL users.
--    A company scanned by ten users is fetched once, for 30 days.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS site_cache (
  domain      TEXT PRIMARY KEY,
  walkthrough JSONB,
  pages_read  JSONB,
  status      TEXT,
  fetched_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE site_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc read"   ON site_cache;
DROP POLICY IF EXISTS "sc write"  ON site_cache;
DROP POLICY IF EXISTS "sc update" ON site_cache;

-- Deliberately open: this is public website content, not user data. Sharing it
-- is the whole point it is what keeps the fetch cost down across the userbase.
CREATE POLICY "sc read"   ON site_cache FOR SELECT USING (true);
CREATE POLICY "sc write"  ON site_cache FOR INSERT WITH CHECK (true);
CREATE POLICY "sc update" ON site_cache FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_site_cache_fetched ON site_cache(fetched_at DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'leads'
--     AND column_name IN ('site_walkthrough','pages_read','site_read_at',
--                         'claim_verification','site_read_status');
--   -- expect 5 rows
--
--   SELECT COUNT(*) FROM site_cache;   -- expect 0 (table exists, empty)
--
-- THEN deploy the Edge Function that does the fetching:
--   supabase functions deploy site-walkthrough
-- ────────────────────────────────────────────────────────────────────────────
