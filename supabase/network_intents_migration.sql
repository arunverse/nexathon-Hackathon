-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Network intent sharing + company website (#7)
-- Run this ENTIRE file in Supabase → SQL Editor → New Query.
-- Makes posted intents visible to OTHER verified users (opposite-side matching)
-- with the poster's company info, and stores each company's website.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Company website on the profile (captured in onboarding) ───────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS website TEXT;

-- ── 2. Denormalized poster info on each intent ───────────────────────────────
--    So a viewer sees WHO posted the intent (and how to evaluate them) without
--    a join. Populated by the app at insert time.
ALTER TABLE declared_intents ADD COLUMN IF NOT EXISTS company_name    TEXT;
ALTER TABLE declared_intents ADD COLUMN IF NOT EXISTS company_website TEXT;
ALTER TABLE declared_intents ADD COLUMN IF NOT EXISTS poster_mission  TEXT;

-- ── 3. Cross-user visibility ─────────────────────────────────────────────────
--    RLS policies are PERMISSIVE (OR'd together). The existing
--    "Users own intents" policy still lets a user manage their own rows; this
--    added policy lets any authenticated user READ active (non-expired) intents
--    so the marketplace / signals feed works.
--    DEV NOTE: tighten to verified users / add rate limits before launch.
DROP POLICY IF EXISTS "network read active intents" ON declared_intents;
CREATE POLICY "network read active intents"
  ON declared_intents
  FOR SELECT
  TO authenticated
  USING (expires_at > NOW());

-- Helpful index for the opposite-mode feed query.
CREATE INDEX IF NOT EXISTS idx_intents_mode_expires
  ON declared_intents (mode, expires_at);

-- Done.
