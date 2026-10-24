ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS enriched_description TEXT,
  ADD COLUMN IF NOT EXISTS clarification_answers JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS description_specificity TEXT DEFAULT 'unknown';

ALTER TABLE user_products
  ADD COLUMN IF NOT EXISTS raw_description TEXT,
  ADD COLUMN IF NOT EXISTS enriched_description TEXT,
  ADD COLUMN IF NOT EXISTS clarification_answers JSONB DEFAULT '[]';
