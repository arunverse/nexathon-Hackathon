-- public.taxonomy_and_telemetry.sql
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS implicit_gap_facts JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS registry_checks JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS tech_fingerprints TEXT[],
  ADD COLUMN IF NOT EXISTS ad_spend_detected BOOLEAN,
  ADD COLUMN IF NOT EXISTS resolved_sector TEXT,
  ADD COLUMN IF NOT EXISTS sector_confidence TEXT;
    -- 'matched' | 'nearest_fallback' | 'unmatched'

CREATE TABLE IF NOT EXISTS public.sector_taxonomy (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch TEXT,
  sub_category TEXT,
  seeker_profile TEXT,
  loophole_signal TEXT,
  signal_source TEXT,
  verifiability TEXT, -- 'strong'|'moderate'|'weak'
  registry_backed BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.sector_taxonomy ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "st read" ON public.sector_taxonomy;
DROP POLICY IF EXISTS "st write" ON public.sector_taxonomy;
CREATE POLICY "st read" ON public.sector_taxonomy FOR SELECT USING (true);
CREATE POLICY "st write" ON public.sector_taxonomy FOR INSERT WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.accuracy_telemetry (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID,
  user_id UUID,
  sector TEXT,
  total_leads INTEGER,
  crawled_successfully INTEGER,
  crawled_partially INTEGER,
  crawled_blocked INTEGER,
  avg_confidence_score NUMERIC,
  leads_kept INTEGER,
  leads_dismissed INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.accuracy_telemetry ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "at read" ON public.accuracy_telemetry;
DROP POLICY IF EXISTS "at write" ON public.accuracy_telemetry;
CREATE POLICY "at read" ON public.accuracy_telemetry FOR SELECT USING (true);
CREATE POLICY "at write" ON public.accuracy_telemetry FOR INSERT WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_tax_branch ON public.sector_taxonomy(branch);
