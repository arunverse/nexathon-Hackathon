-- ============================================================================
-- EBEXTA FEASIBILITY GATE
-- Some products have PREREQUISITES. Without the prerequisite the lead is
-- unsellable no matter how strong every other signal is and having the
-- prerequisite at scale is often a stronger buying signal than funding.
--
-- Run ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run. ADDS columns only nothing existing is altered or dropped.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- 1. WHERE THE PREREQUISITE IS STORED
--    profiles      → company-level targeting
--    user_products → product-level targeting (takes priority when active)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT '[]';

ALTER TABLE user_products
  ADD COLUMN IF NOT EXISTS prerequisites JSONB DEFAULT '[]';

COMMENT ON COLUMN profiles.prerequisites IS
  'Infrastructure a client must ALREADY have for this seller''s product to be deployable. Empty array = feasibility gate is skipped entirely.';
COMMENT ON COLUMN user_products.prerequisites IS
  'Product-level prerequisites. Take priority over profiles.prerequisites when product targeting is active.';


-- ────────────────────────────────────────────────────────────────────────────
-- 2. THE VERDICT ON EACH LEAD
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS feasibility_status   TEXT,
  ADD COLUMN IF NOT EXISTS feasibility_evidence JSONB   DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS feasibility_score    INTEGER DEFAULT 0;

COMMENT ON COLUMN leads.feasibility_status IS
  '''ready'' = prerequisite present · ''unknown'' = cannot determine · ''not_viable'' = clearly absent (excluded from results).';
COMMENT ON COLUMN leads.feasibility_evidence IS
  'What drove the verdict, with the source page URL where the evidence came from a fetched page.';
COMMENT ON COLUMN leads.feasibility_score IS
  '+40 ready at scale · +25 ready basic · 0 unknown. Feeds the score breakdown like any other signal.';

CREATE INDEX IF NOT EXISTS idx_leads_feasibility
  ON leads(user_id, feasibility_status);


-- ────────────────────────────────────────────────────────────────────────────
-- 3. AUDIT what the gate filtered out, so it can never silently starve a user
--    of results. Admin reads this to confirm the gate isn't over-filtering.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS feasibility_exclusions (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID NOT NULL,
  scan_id      UUID,
  company_name TEXT,
  prerequisite TEXT,
  reason       TEXT,
  evidence     JSONB DEFAULT '[]',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE feasibility_exclusions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fe own insert" ON feasibility_exclusions;
DROP POLICY IF EXISTS "fe own read"   ON feasibility_exclusions;

CREATE POLICY "fe own insert" ON feasibility_exclusions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "fe own read" ON feasibility_exclusions
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_fe_user ON feasibility_exclusions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fe_scan ON feasibility_exclusions(scan_id);


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name = 'leads'
--     AND column_name IN ('feasibility_status','feasibility_evidence','feasibility_score');
--   -- expect 3 rows
--
--   SELECT column_name FROM information_schema.columns
--   WHERE table_name IN ('profiles','user_products') AND column_name = 'prerequisites';
--   -- expect 2 rows
--
--   SELECT COUNT(*) FROM feasibility_exclusions;   -- expect 0
--
-- NOTE: users with no prerequisites set are completely unaffected the gate
-- short-circuits before doing any work.
-- ────────────────────────────────────────────────────────────────────────────
