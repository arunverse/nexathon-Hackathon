-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Admin account controls (block / reset / tier / credits)
-- Run in Supabase → SQL Editor.
-- ═══════════════════════════════════════════════════════════════════════════

-- Block a user (blocked users can't use AI features).
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false;

-- "Reset quota" marker credit-limit usage is counted from this time (or the
-- start of the month, whichever is later). Admin "Reset" sets it to NOW().
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ;

-- (credit_limit, credits, plan, plan_valid_until already exist from earlier migrations.)
