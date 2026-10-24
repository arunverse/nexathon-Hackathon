-- ============================================================================
-- EBEXTA Requirement Rules Engine: unmatched-sector "build-next" queue
-- When a user's service text matches none of the 22 sector families, we log it
-- here (with a hit_count) so the team knows which family to hand-build next.
-- Run once in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS unmatched_sectors (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  service_text TEXT,
  hit_count    INTEGER DEFAULT 1,
  first_seen   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE unmatched_sectors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "us write"  ON unmatched_sectors;
DROP POLICY IF EXISTS "us read"   ON unmatched_sectors;
DROP POLICY IF EXISTS "us update" ON unmatched_sectors;

CREATE POLICY "us write"  ON unmatched_sectors FOR INSERT WITH CHECK (true);
CREATE POLICY "us read"   ON unmatched_sectors FOR SELECT USING (true);
CREATE POLICY "us update" ON unmatched_sectors FOR UPDATE USING (true);

CREATE INDEX IF NOT EXISTS idx_unmatched_hits ON unmatched_sectors(hit_count DESC);
