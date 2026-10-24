-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Verified Contacts upgrade (#6)
-- Run this ENTIRE file in Supabase → SQL Editor → New Query.
-- Adds the richer fields the admin captures when verifying a contact, and a
-- persistent verified_contacts pool that mirrors every delivered verification.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Extra fields captured by the admin on delivery ────────────────────────
--    (verified_email / verified_phone / verified_linkedin / confidence_score
--     already exist from earlier migrations.)
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS verified_name        TEXT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS verified_position    TEXT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS verified_website     TEXT;
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS verified_evidence_url TEXT;
-- Evidence links are temporary valid for 30 days after delivery.
ALTER TABLE verification_requests ADD COLUMN IF NOT EXISTS evidence_expires_at  TIMESTAMPTZ;

-- Allow the 'verified' status too (older check constraints may already permit it).
-- No-op if the constraint already allows these values.

-- ── 2. Persistent verified-contacts pool ─────────────────────────────────────
--    One row per delivered verification. This is the admin's saved "verified
--    section" and the source of truth the user's dashboard reflects.
CREATE TABLE IF NOT EXISTS verified_contacts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  request_id UUID,                 -- source verification_request
  user_id UUID,                    -- the user who requested it
  lead_id UUID,                    -- the lead the contact belongs to (nullable for local leads)
  company_name TEXT,
  company_domain TEXT,
  contact_name TEXT,               -- verified name
  contact_position TEXT,           -- verified position/title
  contact_email TEXT,
  contact_phone TEXT,
  contact_website TEXT,
  contact_linkedin TEXT,
  evidence_url TEXT,
  evidence_expires_at TIMESTAMPTZ, -- 30-day temporary evidence link
  confidence_score INTEGER,
  verified_by TEXT DEFAULT 'ebexta_admin',
  verified_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE verified_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own verified contacts read" ON verified_contacts;
DROP POLICY IF EXISTS "dev vc insert" ON verified_contacts;
DROP POLICY IF EXISTS "dev vc read"   ON verified_contacts;
DROP POLICY IF EXISTS "dev vc update" ON verified_contacts;
DROP POLICY IF EXISTS "dev vc delete" ON verified_contacts;

-- The user can read their own verified contacts (dashboard reflection).
CREATE POLICY "own verified contacts read" ON verified_contacts
  FOR SELECT USING (auth.uid() = user_id);

-- DEV-ONLY open policies so the hardcoded-auth admin panel can write/read all
-- rows. Tighten to an is_admin role check before launch.
CREATE POLICY "dev vc insert" ON verified_contacts FOR INSERT WITH CHECK (true);
CREATE POLICY "dev vc read"   ON verified_contacts FOR SELECT USING (true);
CREATE POLICY "dev vc update" ON verified_contacts FOR UPDATE USING (true);
CREATE POLICY "dev vc delete" ON verified_contacts FOR DELETE USING (true);

-- ── 3. Helpful indexes ───────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_verified_contacts_user ON verified_contacts (user_id);
CREATE INDEX IF NOT EXISTS idx_verified_contacts_lead ON verified_contacts (lead_id);
CREATE INDEX IF NOT EXISTS idx_vr_lead ON verification_requests (lead_id);

-- Done.
