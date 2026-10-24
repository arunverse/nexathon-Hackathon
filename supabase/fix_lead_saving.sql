-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · FIX LEAD SAVING restore new leads flowing into the Admin monitor
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- PROBLEM: the scan's DB save is intentionally non-fatal (leads still render
-- from localStorage), so when the app started writing NEW columns that the
-- database didn't have (mode on scans; score_breakdown / contacts /
-- company_contact / … on leads), every insert failed SILENTLY. Users kept
-- seeing their leads, but nothing new reached the leads table → the Admin
-- Leads Monitor froze ~2 weeks ago.
--
-- FIX: add every column the app writes (ADD COLUMN IF NOT EXISTS = safe), and
-- re-assert the insert/read policies so users can save and admins can see all.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. scans the save writes `mode`; if missing, the WHOLE save aborts first.
ALTER TABLE public.scans
  ADD COLUMN IF NOT EXISTS mode    TEXT,
  ADD COLUMN IF NOT EXISTS status  TEXT,
  ADD COLUMN IF NOT EXISTS filters JSONB;

-- 2. leads every field the insert writes (missing ones abort the insert).
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS scan_id                 UUID,
  ADD COLUMN IF NOT EXISTS company_name            TEXT,
  ADD COLUMN IF NOT EXISTS industry                TEXT,
  ADD COLUMN IF NOT EXISTS location                TEXT,
  ADD COLUMN IF NOT EXISTS employee_count          INTEGER,
  ADD COLUMN IF NOT EXISTS funding_stage           TEXT,
  ADD COLUMN IF NOT EXISTS annual_revenue          TEXT,
  ADD COLUMN IF NOT EXISTS website                 TEXT,
  ADD COLUMN IF NOT EXISTS linkedin_url            TEXT,
  ADD COLUMN IF NOT EXISTS email                   TEXT,
  ADD COLUMN IF NOT EXISTS intent_score            INTEGER,
  ADD COLUMN IF NOT EXISTS match_score             INTEGER,
  ADD COLUMN IF NOT EXISTS confidence_score        INTEGER,
  ADD COLUMN IF NOT EXISTS verification_status     TEXT,
  ADD COLUMN IF NOT EXISTS is_strongly_recommended BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS trust_score             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS intent_flags            JSONB,
  ADD COLUMN IF NOT EXISTS validation_errors       JSONB,
  ADD COLUMN IF NOT EXISTS stakeholders            JSONB,
  ADD COLUMN IF NOT EXISTS description             TEXT,
  ADD COLUMN IF NOT EXISTS company_linkedin        TEXT,
  ADD COLUMN IF NOT EXISTS company_twitter         TEXT,
  ADD COLUMN IF NOT EXISTS requirement_theme       TEXT,
  ADD COLUMN IF NOT EXISTS turnover                TEXT,
  ADD COLUMN IF NOT EXISTS revenue_growth          TEXT,
  ADD COLUMN IF NOT EXISTS funding_details         TEXT,
  ADD COLUMN IF NOT EXISTS funding_source_url      TEXT,
  ADD COLUMN IF NOT EXISTS investment_history      TEXT,
  ADD COLUMN IF NOT EXISTS big_projects            JSONB,
  ADD COLUMN IF NOT EXISTS match_reason            JSONB,
  ADD COLUMN IF NOT EXISTS contacts                JSONB,
  ADD COLUMN IF NOT EXISTS company_stage           TEXT,
  ADD COLUMN IF NOT EXISTS company_contact         JSONB,
  ADD COLUMN IF NOT EXISTS score_breakdown         JSONB,
  ADD COLUMN IF NOT EXISTS evidence_source_url     TEXT,
  ADD COLUMN IF NOT EXISTS created_at              TIMESTAMPTZ DEFAULT NOW();

-- 3. Policies safety net users write their own rows; admins read everything.
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scans read"  ON public.scans;
CREATE POLICY "scans read"  ON public.scans FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "scans write" ON public.scans;
CREATE POLICY "scans write" ON public.scans FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "leads read"  ON public.leads;
CREATE POLICY "leads read"  ON public.leads FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
DROP POLICY IF EXISTS "leads write" ON public.leads;
CREATE POLICY "leads write" ON public.leads FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

NOTIFY pgrst, 'reload schema';

-- Verify after running:
--   1. Run a scan in the app.
--   2. SELECT company_name, created_at FROM public.leads ORDER BY created_at DESC LIMIT 5;
--      → the new scan's companies must appear with today's timestamp.
--   3. Open Admin → Leads Monitor → the new leads are there.
