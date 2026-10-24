-- ============================================================================
-- EBEXTA UX polish sweep
-- Tracks whether a user has seen the one-time product tour, and which one-time
-- tip banners they've dismissed. Run once in the Supabase SQL editor.
-- ============================================================================

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_tour_done BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS tips_dismissed       JSONB   DEFAULT '[]';
