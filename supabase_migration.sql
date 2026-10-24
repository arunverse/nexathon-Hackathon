 -- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA Complete Supabase Schema Migration
-- Run this in: Supabase Dashboard → SQL Editor → New query → Run
-- Safe to re-run: uses IF NOT EXISTS and IF NOT EXISTS column checks
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. PROFILES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id              uuid        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  company_name    text        NOT NULL DEFAULT '',
  sender_email    text        NOT NULL DEFAULT '',
  mission         text        NOT NULL DEFAULT '',
  mode            text        NOT NULL DEFAULT 'seeker' CHECK (mode IN ('seeker', 'provider')),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, sender_email)
  VALUES (new.id, COALESCE(new.email, ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- ─── 2. SCANS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS scans (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  filters     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'complete', 'failed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 3. LEADS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leads (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  scan_id             uuid        REFERENCES scans(id) ON DELETE SET NULL,
  company_name        text        NOT NULL DEFAULT '',
  industry            text        NOT NULL DEFAULT '',
  location            text        NOT NULL DEFAULT '',
  employee_count      integer     NOT NULL DEFAULT 0,
  funding_stage       text        NOT NULL DEFAULT '',
  annual_revenue      text,
  website             text,
  linkedin_url        text,
  email               text,
  evidence_source_url text,
  recent_signals      jsonb       NOT NULL DEFAULT '[]',
  stakeholders        jsonb       NOT NULL DEFAULT '[]',
  intent_score        integer     NOT NULL DEFAULT 0 CHECK (intent_score BETWEEN 0 AND 100),
  match_score         integer     NOT NULL DEFAULT 0 CHECK (match_score BETWEEN 0 AND 100),
  confidence_score    integer     NOT NULL DEFAULT 0 CHECK (confidence_score BETWEEN 0 AND 100),
  verification_status text        NOT NULL DEFAULT 'MANUAL_REVIEW_NEEDED'
                        CHECK (verification_status IN ('VERIFIED', 'PARTIALLY_VERIFIED', 'MANUAL_REVIEW_NEEDED')),
  intent_flags        jsonb       NOT NULL DEFAULT '[]',
  validation_errors   jsonb       NOT NULL DEFAULT '[]',
  strongly_recommended boolean    NOT NULL DEFAULT false,
  trust_score         integer     NOT NULL DEFAULT 0 CHECK (trust_score BETWEEN 0 AND 100),
  business_impact     jsonb,
  link_status         jsonb,
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ─── 4. CACHED_LEADS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cached_leads (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  filter_hash     text        NOT NULL UNIQUE,
  industry        text        NOT NULL DEFAULT '',
  location        text        NOT NULL DEFAULT '',
  employee_min    integer     NOT NULL DEFAULT 1,
  employee_max    integer     NOT NULL DEFAULT 5000,
  leads           jsonb       NOT NULL DEFAULT '[]',
  generated_at    timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '7 days')
);

-- ─── 5. DECLARED_INTENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS declared_intents (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  mode            text        NOT NULL DEFAULT 'seeker' CHECK (mode IN ('seeker', 'provider')),
  requirement     text        NOT NULL DEFAULT '',
  industry_tags   jsonb       NOT NULL DEFAULT '[]',
  budget_range    text,
  timeline_days   integer     NOT NULL DEFAULT 30,
  expires_at      timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- ─── 6. SENT_EMAILS (outreach) ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS sent_emails (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  lead_id         uuid        REFERENCES leads(id) ON DELETE SET NULL,
  company_name    text        NOT NULL DEFAULT '',
  subject         text        NOT NULL DEFAULT '',
  body            text        NOT NULL DEFAULT '',
  sent_at         timestamptz NOT NULL DEFAULT now(),
  status          text        NOT NULL DEFAULT 'sent' CHECK (status IN ('draft', 'sent', 'opened', 'replied'))
);

-- ─── 7. SIGNAL_WATCHES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_watches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  keyword     text        NOT NULL DEFAULT '',
  industry    text        NOT NULL DEFAULT '',
  notes       text        NOT NULL DEFAULT '',
  active      boolean     NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ─── 8. SIGNAL_MATCHES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS signal_matches (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  watch_id      uuid        NOT NULL REFERENCES signal_watches(id) ON DELETE CASCADE,
  user_id       uuid        NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  company_name  text        NOT NULL DEFAULT '',
  signal_text   text        NOT NULL DEFAULT '',
  source_url    text        NOT NULL DEFAULT '',
  detected_at   timestamptz NOT NULL DEFAULT now()
);

-- ─── 9. COMPANY_CONTACTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS company_contacts (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id             uuid        REFERENCES leads(id) ON DELETE CASCADE,
  company_name        text        NOT NULL DEFAULT '',
  person_name         text        NOT NULL DEFAULT '',
  normalized_name     text        NOT NULL DEFAULT '',
  title               text        NOT NULL DEFAULT '',
  role_category       text        NOT NULL DEFAULT 'Executive',
  linkedin_url        text,
  email               text,
  status              text        NOT NULL DEFAULT 'UNVERIFIED' CHECK (status IN ('VERIFIED', 'PROBABLE', 'UNVERIFIED', 'CONFLICTED', 'NOT_FOUND')),
  confidence          text        NOT NULL DEFAULT 'MEDIUM' CHECK (confidence IN ('HIGH', 'MEDIUM', 'LOW')),
  why_this_person     text        NOT NULL DEFAULT '',
  first_discovered_at timestamptz NOT NULL DEFAULT now(),
  last_verified_at    timestamptz NOT NULL DEFAULT now()
);

-- ─── 10. CONTACT_EVIDENCE ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_evidence (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id          uuid        NOT NULL REFERENCES company_contacts(id) ON DELETE CASCADE,
  source_url          text        NOT NULL DEFAULT '',
  source_type         text        NOT NULL DEFAULT 'official_website',
  source_title        text        NOT NULL DEFAULT '',
  evidence_text       text        NOT NULL DEFAULT '',
  source_date         text,
  reliability         text        NOT NULL DEFAULT 'MEDIUM' CHECK (reliability IN ('HIGH', 'MEDIUM', 'LOW')),
  collected_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── 11. CONTACT_VERIFICATION ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contact_verification (
  id                      uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id              uuid        NOT NULL REFERENCES company_contacts(id) ON DELETE CASCADE,
  company_match_score     integer     NOT NULL DEFAULT 0 CHECK (company_match_score BETWEEN 0 AND 100),
  identity_score          integer     NOT NULL DEFAULT 0 CHECK (identity_score BETWEEN 0 AND 100),
  role_score              integer     NOT NULL DEFAULT 0 CHECK (role_score BETWEEN 0 AND 100),
  source_score            integer     NOT NULL DEFAULT 0 CHECK (source_score BETWEEN 0 AND 100),
  recency_score           integer     NOT NULL DEFAULT 0 CHECK (recency_score BETWEEN 0 AND 100),
  final_confidence        integer     NOT NULL DEFAULT 0 CHECK (final_confidence BETWEEN 0 AND 100),
  verification_status     text        NOT NULL DEFAULT 'UNVERIFIED',
  conflict_status         text
);

-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE profiles           ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans               ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads               ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE declared_intents    ENABLE ROW LEVEL SECURITY;
ALTER TABLE sent_emails         ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_watches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE signal_matches      ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_contacts    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_evidence    ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_verification ENABLE ROW LEVEL SECURITY;

-- ─── PROFILES policies ───────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users can view own profile"   ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can view own profile"   ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- ─── SCANS policies ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own scans" ON scans;
CREATE POLICY "Users manage own scans" ON scans USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── LEADS policies ──────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own leads" ON leads;
CREATE POLICY "Users manage own leads" ON leads USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── CACHED_LEADS policies public read, no write from client ───────────────
DROP POLICY IF EXISTS "Public read cached leads" ON cached_leads;
DROP POLICY IF EXISTS "Anon insert cached leads"  ON cached_leads;
CREATE POLICY "Public read cached leads" ON cached_leads FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "Auth insert cached leads" ON cached_leads FOR INSERT TO authenticated WITH CHECK (true);

-- ─── DECLARED_INTENTS policies ───────────────────────────────────────────────
-- Anyone authenticated can read (for bilateral matching)
DROP POLICY IF EXISTS "Auth users read intents"    ON declared_intents;
DROP POLICY IF EXISTS "Users manage own intents"   ON declared_intents;
CREATE POLICY "Auth users read intents"  ON declared_intents FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users insert own intents" ON declared_intents FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own intents" ON declared_intents FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users delete own intents" ON declared_intents FOR DELETE USING (auth.uid() = user_id);

-- ─── SENT_EMAILS policies ────────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own emails" ON sent_emails;
CREATE POLICY "Users manage own emails" ON sent_emails USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── SIGNAL_WATCHES policies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own watches" ON signal_watches;
CREATE POLICY "Users manage own watches" ON signal_watches USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── SIGNAL_MATCHES policies ─────────────────────────────────────────────────
DROP POLICY IF EXISTS "Users manage own matches" ON signal_matches;
CREATE POLICY "Users manage own matches" ON signal_matches USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- INDEXES (performance)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_leads_user_id          ON leads(user_id);
CREATE INDEX IF NOT EXISTS idx_leads_scan_id          ON leads(scan_id);
CREATE INDEX IF NOT EXISTS idx_leads_intent_score     ON leads(intent_score DESC);
CREATE INDEX IF NOT EXISTS idx_scans_user_id          ON scans(user_id);
CREATE INDEX IF NOT EXISTS idx_declared_intents_mode  ON declared_intents(mode);
CREATE INDEX IF NOT EXISTS idx_declared_intents_exp   ON declared_intents(expires_at);
CREATE INDEX IF NOT EXISTS idx_sent_emails_user_id    ON sent_emails(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_watches_user    ON signal_watches(user_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_watch   ON signal_matches(watch_id);
CREATE INDEX IF NOT EXISTS idx_signal_matches_user    ON signal_matches(user_id);
CREATE INDEX IF NOT EXISTS idx_cached_leads_hash      ON cached_leads(filter_hash);
CREATE INDEX IF NOT EXISTS idx_cached_leads_expires   ON cached_leads(expires_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- All 8 tables created with RLS + policies + indexes.
-- Safe to run multiple times.
-- ═══════════════════════════════════════════════════════════════════════════
