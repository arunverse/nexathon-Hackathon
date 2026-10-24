-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Per-user credit limits (admin-configurable)
-- Run in Supabase → SQL Editor.
-- credit_limit = max Gemini API calls a user may consume PER CALENDAR MONTH.
-- The gemini Edge Function enforces it; the admin Users page sets it.
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credit_limit INTEGER DEFAULT 1000;

-- Optional: give everyone a starting limit if null.
UPDATE profiles SET credit_limit = 1000 WHERE credit_limit IS NULL;
