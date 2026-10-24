-- ============================================================================
-- EBEXTA Product-level matching
-- Lets a user take a specific PRODUCT/SERVICE to market (not just their whole
-- company). We store the product, the extracted doc text, and the AI-derived
-- ideal-buyer profile, then target that product's buyers on scans.
-- Run this once in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_products (
  id                  UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id             UUID NOT NULL,
  target_type         TEXT DEFAULT 'company',   -- 'company' | 'product'
  product_name        TEXT,
  product_description TEXT,
  doc_path            TEXT,                      -- Storage object path (product-docs bucket)
  doc_extracted_text  TEXT,
  ideal_buyer_profile JSONB,                     -- AI-derived buyer ICP
  is_active           BOOLEAN DEFAULT TRUE,      -- the product currently being scanned for
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own products insert" ON user_products;
DROP POLICY IF EXISTS "own products read"   ON user_products;
DROP POLICY IF EXISTS "own products update" ON user_products;
DROP POLICY IF EXISTS "own products delete" ON user_products;

CREATE POLICY "own products insert" ON user_products
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products read" ON user_products
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own products update" ON user_products
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own products delete" ON user_products
  FOR DELETE USING (auth.uid() = user_id);

-- Admins can see products in the console (is_admin() from rls_lockdown.sql)
DROP POLICY IF EXISTS "admin products read" ON user_products;
CREATE POLICY "admin products read" ON user_products
  FOR SELECT USING (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_user_products_user ON user_products(user_id, created_at DESC);

-- Whether the account is currently marketing a company or a specific product
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS target_type TEXT DEFAULT 'company';

-- ============================================================================
-- STORAGE private 'product-docs' bucket + owner-scoped policies
-- The bucket itself must be created ONCE in the dashboard:
--   Storage → New bucket → name "product-docs" → PRIVATE (uncheck "public")
-- Then run the policies below so each user can only touch files under their
-- own id/ prefix.
-- ============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-docs', 'product-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "product-docs owner insert" ON storage.objects;
DROP POLICY IF EXISTS "product-docs owner read"   ON storage.objects;
DROP POLICY IF EXISTS "product-docs owner delete" ON storage.objects;

-- Path convention: product-docs/<uid>/<filename> first folder must be the uid.
CREATE POLICY "product-docs owner insert" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'product-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "product-docs owner read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'product-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  );
CREATE POLICY "product-docs owner delete" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'product-docs' AND (storage.foldername(name))[1] = auth.uid()::text
  );
