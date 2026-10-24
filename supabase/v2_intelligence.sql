-- ============================================================================
-- EBEXTA V2 INTELLIGENCE LAYER
-- Company Memory is the container. Trust History, Deal Strategy, Relationship
-- Map, Opportunity Timeline and Interactions all live inside it.
--
-- Run this ONCE in the Supabase SQL editor (Dashboard → SQL → New query).
-- Safe to re-run: every statement is idempotent.
-- ============================================================================


-- ────────────────────────────────────────────────────────────────────────────
-- ★ COMPANY MEMORY one persistent record per company per user.
--   Survives scans forever. Never wiped, only merged into.
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_memory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  company_name TEXT NOT NULL,
  company_domain TEXT,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  latest_lead_id UUID,
  company_snapshot JSONB,        -- latest firmographics
  contacts JSONB DEFAULT '[]',   -- accumulated stakeholders
  relationship_map JSONB,        -- #2 hierarchy
  deal_strategy JSONB,           -- #3 AI strategy
  opportunity_timeline JSONB,    -- #4 buying stages
  verification_matrix JSONB,     -- #5 what was verified
  internal_notes TEXT,
  outcome TEXT,                  -- #10 won/lost/etc
  outcome_at TIMESTAMPTZ,
  deal_value NUMERIC,            -- #9 ROI
  intelligence_generated_at TIMESTAMPTZ,
  UNIQUE(user_id, company_name)
);

ALTER TABLE company_memory ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm own insert" ON company_memory;
DROP POLICY IF EXISTS "cm own read"   ON company_memory;
DROP POLICY IF EXISTS "cm own update" ON company_memory;

CREATE POLICY "cm own insert" ON company_memory
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cm own read" ON company_memory
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "cm own update" ON company_memory
  FOR UPDATE USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- #1 TRUST HISTORY dated event timeline per company
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_timeline (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID REFERENCES company_memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_date DATE,
  event_type TEXT,   -- funding|hiring|expansion|launch|verification|contact|
                     -- proposal|meeting|scan|note|outcome
  event_title TEXT,
  event_detail TEXT,
  source_url TEXT,
  is_verified BOOLEAN DEFAULT false,   -- VERIFIED (has a source) vs INFERRED
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_timeline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ct own insert" ON company_timeline;
DROP POLICY IF EXISTS "ct own read"   ON company_timeline;
DROP POLICY IF EXISTS "ct own update" ON company_timeline;
DROP POLICY IF EXISTS "ct own delete" ON company_timeline;

CREATE POLICY "ct own insert" ON company_timeline
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ct own read" ON company_timeline
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "ct own update" ON company_timeline
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "ct own delete" ON company_timeline
  FOR DELETE USING (auth.uid() = user_id);

-- Lookup index for the app-side de-dupe (a re-scan reads existing titles for
-- this memory and inserts ONLY signals that aren't already recorded).
CREATE INDEX IF NOT EXISTS idx_ct_dedupe
  ON company_timeline(memory_id, event_type);


-- ────────────────────────────────────────────────────────────────────────────
-- INTERACTION LOG emails, proposals, meetings, notes
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_interactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID REFERENCES company_memory(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  interaction_type TEXT, -- email_sent|proposal_sent|reply|meeting|call|note
  subject TEXT,
  body_preview TEXT,
  contact_name TEXT,
  occurred_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE company_interactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ci own insert" ON company_interactions;
DROP POLICY IF EXISTS "ci own read"   ON company_interactions;

CREATE POLICY "ci own insert" ON company_interactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ci own read" ON company_interactions
  FOR SELECT USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- #9 ROI PIPELINE user-logged funnel outcomes
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS pipeline_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  memory_id UUID REFERENCES company_memory(id) ON DELETE CASCADE,
  stage TEXT,  -- lead|contacted|meeting|proposal|won|lost
  value NUMERIC,
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE pipeline_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pe own insert" ON pipeline_events;
DROP POLICY IF EXISTS "pe own read"   ON pipeline_events;

CREATE POLICY "pe own insert" ON pipeline_events
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pe own read" ON pipeline_events
  FOR SELECT USING (auth.uid() = user_id);


-- ────────────────────────────────────────────────────────────────────────────
-- #8 TEAM WORKSPACE (schema now, minimal UI)
-- ────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS teams (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  team_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS team_members (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT DEFAULT 'member',   -- owner|admin|member
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, user_id)
);

-- Pending invites by email a team_members row is created when they sign up.
CREATE TABLE IF NOT EXISTS team_invites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID REFERENCES teams(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  invited_by UUID,
  role TEXT DEFAULT 'member',
  accepted BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, email)
);

CREATE TABLE IF NOT EXISTS lead_assignments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  memory_id UUID REFERENCES company_memory(id) ON DELETE CASCADE,
  assigned_to UUID,
  assigned_by UUID,
  status TEXT DEFAULT 'assigned',   -- assigned|working|meeting_scheduled|
                                    -- proposal_sent|closed
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE teams            ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_members     ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_invites     ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "t owner"    ON teams;
DROP POLICY IF EXISTS "tm read"    ON team_members;
DROP POLICY IF EXISTS "tm insert"  ON team_members;
DROP POLICY IF EXISTS "ti read"    ON team_invites;
DROP POLICY IF EXISTS "ti insert"  ON team_invites;
DROP POLICY IF EXISTS "la read"    ON lead_assignments;
DROP POLICY IF EXISTS "la insert"  ON lead_assignments;
DROP POLICY IF EXISTS "la update"  ON lead_assignments;

CREATE POLICY "t owner" ON teams
  FOR ALL USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "tm read" ON team_members
  FOR SELECT USING (auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM teams
      WHERE teams.id = team_members.team_id
      AND teams.owner_id = auth.uid()));

CREATE POLICY "tm insert" ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.owner_id = auth.uid()));

CREATE POLICY "ti read" ON team_invites
  FOR SELECT USING (
    auth.uid() = invited_by OR
    EXISTS (SELECT 1 FROM teams
      WHERE teams.id = team_invites.team_id
      AND teams.owner_id = auth.uid()));

CREATE POLICY "ti insert" ON team_invites
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM teams
      WHERE teams.id = team_id
      AND teams.owner_id = auth.uid()));

CREATE POLICY "la read" ON lead_assignments
  FOR SELECT USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);

CREATE POLICY "la insert" ON lead_assignments
  FOR INSERT WITH CHECK (auth.uid() = assigned_by);

CREATE POLICY "la update" ON lead_assignments
  FOR UPDATE USING (auth.uid() = assigned_to OR auth.uid() = assigned_by);


-- ────────────────────────────────────────────────────────────────────────────
-- #6 AI EXPLAINABILITY + #10 LEARNING LOOP
--   NOTE: leads.rules_fired and rule_performance did NOT exist before this
--   migration. score_breakdown already did. These two close the loop so a
--   'Won' / 'Excellent Match' outcome actually teaches the rule engine.
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE leads ADD COLUMN IF NOT EXISTS rules_fired      JSONB;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS match_breakdown  JSONB;

CREATE TABLE IF NOT EXISTS rule_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  rule_key TEXT NOT NULL,          -- e.g. 'Recent Funding', 'WEB_DEVELOPMENT'
  leads_scored INTEGER DEFAULT 0,
  leads_converted INTEGER DEFAULT 0,
  last_converted_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, rule_key)
);

ALTER TABLE rule_performance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rp own insert" ON rule_performance;
DROP POLICY IF EXISTS "rp own read"   ON rule_performance;
DROP POLICY IF EXISTS "rp own update" ON rule_performance;

CREATE POLICY "rp own insert" ON rule_performance
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rp own read" ON rule_performance
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "rp own update" ON rule_performance
  FOR UPDATE USING (auth.uid() = user_id);

-- Atomic increment avoids a read-modify-write race when several rules fire.
CREATE OR REPLACE FUNCTION ebexta_bump_rule_performance(
  p_rule_keys TEXT[],
  p_converted BOOLEAN DEFAULT false
) RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  k TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  FOREACH k IN ARRAY p_rule_keys LOOP
    INSERT INTO rule_performance (user_id, rule_key, leads_scored, leads_converted, last_converted_at)
    VALUES (
      auth.uid(), k, 1,
      CASE WHEN p_converted THEN 1 ELSE 0 END,
      CASE WHEN p_converted THEN NOW() ELSE NULL END
    )
    ON CONFLICT (user_id, rule_key) DO UPDATE SET
      leads_scored      = rule_performance.leads_scored + 1,
      leads_converted   = rule_performance.leads_converted + (CASE WHEN p_converted THEN 1 ELSE 0 END),
      last_converted_at = CASE WHEN p_converted THEN NOW() ELSE rule_performance.last_converted_at END,
      updated_at        = NOW();
  END LOOP;
END;
$$;


-- ────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cm_user   ON company_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_cm_name   ON company_memory(user_id, company_name);
CREATE INDEX IF NOT EXISTS idx_cm_updated ON company_memory(user_id, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_ct_memory ON company_timeline(memory_id, event_date DESC);
CREATE INDEX IF NOT EXISTS idx_ci_memory ON company_interactions(memory_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_pe_user   ON pipeline_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pe_memory ON pipeline_events(memory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_la_memory ON lead_assignments(memory_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ti_email  ON team_invites(email);
CREATE INDEX IF NOT EXISTS idx_rp_user   ON rule_performance(user_id, leads_converted DESC);


-- ────────────────────────────────────────────────────────────────────────────
-- DONE. Verify with:
--   SELECT table_name FROM information_schema.tables
--   WHERE table_name IN ('company_memory','company_timeline',
--     'company_interactions','pipeline_events','teams','team_members',
--     'team_invites','lead_assignments','rule_performance');
-- Expect 9 rows.
-- ────────────────────────────────────────────────────────────────────────────
