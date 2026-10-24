-- supabase/accuracy_upgrades.sql
-- Run this ENTIRE file in Supabase Dashboard → SQL Editor → New Query

ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS honesty_score INTEGER,
  ADD COLUMN IF NOT EXISTS unknown_fields TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS claim_audit JSONB DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS second_pass_agreed BOOLEAN;

CREATE TABLE IF NOT EXISTS public.accuracy_audits (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID,
  field_name TEXT,
  claimed_value TEXT,
  actual_value TEXT,
  audit_result TEXT, -- 'match'|'mismatch'|'unverifiable'
  audited_by TEXT,   -- 'system'|'admin'|'user_report'
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.accuracy_audits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aa read" ON public.accuracy_audits;
DROP POLICY IF EXISTS "aa write" ON public.accuracy_audits;

CREATE POLICY "aa read" ON public.accuracy_audits
  FOR SELECT USING (true);

CREATE POLICY "aa write" ON public.accuracy_audits
  FOR INSERT WITH CHECK (true);
