-- ─── EBEXTA by Ebexta Full Schema Migration ──────────────────────────────────
-- Run this entire file in Supabase Dashboard → SQL Editor → New Query

-- PROFILES TABLE
CREATE TABLE IF NOT EXISTS profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  company_name TEXT,
  sender_email TEXT,
  mission TEXT,
  mode TEXT DEFAULT 'seeker' CHECK (mode IN ('seeker','provider')),
  plan TEXT DEFAULT 'starter',
  credits INTEGER DEFAULT 20,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- SCANS TABLE
CREATE TABLE IF NOT EXISTS scans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  filters JSONB,
  status TEXT DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- LEADS TABLE
CREATE TABLE IF NOT EXISTS leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  scan_id UUID REFERENCES scans(id),
  user_id UUID REFERENCES profiles(id),
  company_name TEXT,
  industry TEXT,
  location TEXT,
  employee_count INTEGER,
  funding_stage TEXT,
  annual_revenue TEXT,
  website TEXT,
  intent_score INTEGER,
  match_score INTEGER,
  confidence_score INTEGER,
  verification_status TEXT DEFAULT 'MANUAL_REVIEW_NEEDED',
  intent_flags TEXT[],
  validation_errors TEXT[],
  stakeholders JSONB,
  evidence_source_url TEXT,
  linkedin_url TEXT,
  email TEXT,
  recent_signals JSONB,
  strongly_recommended BOOLEAN DEFAULT false,
  trust_score INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- DECLARED INTENTS TABLE
CREATE TABLE IF NOT EXISTS declared_intents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  requirement TEXT NOT NULL,
  mode TEXT CHECK (mode IN ('seeker','provider')),
  industry_tags TEXT[],
  budget_range TEXT,
  duration INTEGER CHECK (duration IN (30,60,90)),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- OUTREACH TABLE
CREATE TABLE IF NOT EXISTS outreach (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES leads(id),
  user_id UUID REFERENCES profiles(id),
  email_subject TEXT,
  email_body TEXT,
  strategy JSONB,
  sentiment TEXT DEFAULT 'none',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CACHED LEADS TABLE (7-day cache to reduce Gemini API costs)
CREATE TABLE IF NOT EXISTS cached_leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filter_hash TEXT NOT NULL UNIQUE,
  industry TEXT,
  location TEXT,
  employee_min INTEGER,
  employee_max INTEGER,
  funding_stage TEXT,
  leads JSONB NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '7 days'
);

-- ─── ROW LEVEL SECURITY ───────────────────────────────────────────────────────

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE declared_intents ENABLE ROW LEVEL SECURITY;
ALTER TABLE outreach ENABLE ROW LEVEL SECURITY;
ALTER TABLE cached_leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "Users own profile" ON profiles;
DROP POLICY IF EXISTS "Users own scans" ON scans;
DROP POLICY IF EXISTS "Users own leads" ON leads;
DROP POLICY IF EXISTS "Users own intents" ON declared_intents;
DROP POLICY IF EXISTS "Users own outreach" ON outreach;
DROP POLICY IF EXISTS "Cached leads public read" ON cached_leads;
DROP POLICY IF EXISTS "Cached leads insert" ON cached_leads;

CREATE POLICY "Users own profile" ON profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users own scans" ON scans FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own leads" ON leads FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own intents" ON declared_intents FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users own outreach" ON outreach FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Cached leads public read" ON cached_leads FOR SELECT USING (true);
CREATE POLICY "Cached leads insert" ON cached_leads FOR INSERT WITH CHECK (true);

-- ─── VERIFICATION REQUESTS TABLE ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS verification_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES profiles(id),
  lead_id UUID REFERENCES leads(id),
  company_name TEXT,
  company_domain TEXT,
  contact_name TEXT,
  contact_title TEXT,
  status TEXT DEFAULT 'pending'
    CHECK (status IN (
      'pending', 'in_progress', 'verified',
      'delivered', 'could_not_verify'
    )),
  verified_email TEXT,
  verified_phone TEXT,
  verified_linkedin TEXT,
  confidence_score INTEGER,
  admin_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ
);

ALTER TABLE verification_requests
  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users insert own requests" ON verification_requests;
DROP POLICY IF EXISTS "Users read own requests" ON verification_requests;

CREATE POLICY "Users insert own requests"
  ON verification_requests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users read own requests"
  ON verification_requests
  FOR SELECT USING (auth.uid() = user_id);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, sender_email, mode, plan, credits)
  VALUES (NEW.id, NEW.email, 'seeker', 'starter', 20)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE handle_new_user();

-- ─── ADMIN RLS POLICIES (DEV ONLY) ───────────────────────────────────────────
-- DEV ONLY: remove or restrict to a real is_admin role before launch.
-- These policies allow the anon key to read and update ALL verification_requests,
-- which is required for the hardcoded-auth admin panel to function.
-- Apply in Supabase Dashboard → SQL Editor → New Query.

DROP POLICY IF EXISTS "Admin read all requests" ON verification_requests;
DROP POLICY IF EXISTS "Admin update all requests" ON verification_requests;

-- DEV ONLY: remove or restrict before launch
CREATE POLICY "Admin read all requests"
  ON verification_requests
  FOR SELECT USING (true);

CREATE POLICY "Admin update all requests"
  ON verification_requests
  FOR UPDATE USING (true);
