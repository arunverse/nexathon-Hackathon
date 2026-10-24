-- ============================================================================
-- EBEXTA Dynamic Requirement Rules
-- Move the sector families, strategies and universal meta-rules out of code and
-- into the database so the admin can create / edit / delete everything at
-- runtime. The app seeds the built-in 22 families + 20 meta-rules on first use
-- (from the admin "Restore built-in rules" action); until then the app falls
-- back to the built-in defaults, so scanning always works.
-- Run once in the Supabase SQL editor.
-- ============================================================================

-- Strategies (built-in + custom). Referenced by sector_rules.strategy (by name).
CREATE TABLE IF NOT EXISTS public.rule_strategies (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  description TEXT,
  is_builtin  BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- One row per sector family. Arrays / JSONB hold the editable collections.
CREATE TABLE IF NOT EXISTS public.sector_rules (
  id                UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  sector            TEXT UNIQUE NOT NULL,
  aliases           TEXT[]  DEFAULT '{}',
  strategy          TEXT    DEFAULT 'STANDARD',
  physical_evidence BOOLEAN DEFAULT false,
  gap_signals       JSONB   DEFAULT '[]',   -- [{ "signal": "...", "points": 30 }]
  trigger_signals   JSONB   DEFAULT '[]',
  anti_signals      TEXT[]  DEFAULT '{}',
  buyer_roles       TEXT[]  DEFAULT '{}',
  search_queries    TEXT[]  DEFAULT '{}',
  is_builtin        BOOLEAN DEFAULT false,
  sort_order        INT     DEFAULT 100,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

-- Universal meta-rules.
CREATE TABLE IF NOT EXISTS public.meta_rules (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name        TEXT UNIQUE NOT NULL,
  points      INT  DEFAULT 20,
  description TEXT,
  applies_to  TEXT[] DEFAULT '{ALL}',
  is_builtin  BOOLEAN DEFAULT false,
  sort_order  INT    DEFAULT 100,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.rule_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sector_rules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meta_rules      ENABLE ROW LEVEL SECURITY;

-- Read: any signed-in user (the scan runs client-side and needs the rules).
-- Write: admins only (is_admin() from rls_lockdown.sql).
DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['rule_strategies','sector_rules','meta_rules'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "%s read"  ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "%s write" ON public.%I;', t, t);
    EXECUTE format('CREATE POLICY "%s read"  ON public.%I FOR SELECT USING (true);', t, t);
    EXECUTE format('CREATE POLICY "%s write" ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());', t, t);
  END LOOP;
END $$;

-- updated_at touch
CREATE OR REPLACE FUNCTION public.touch_rules_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DROP TRIGGER IF EXISTS trg_sector_rules_touch ON public.sector_rules;
CREATE TRIGGER trg_sector_rules_touch BEFORE UPDATE ON public.sector_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_rules_updated_at();
DROP TRIGGER IF EXISTS trg_meta_rules_touch ON public.meta_rules;
CREATE TRIGGER trg_meta_rules_touch BEFORE UPDATE ON public.meta_rules
  FOR EACH ROW EXECUTE FUNCTION public.touch_rules_updated_at();

-- Seed the three built-in strategies (families + meta-rules are seeded from the
-- app via "Restore built-in rules", which writes the full 22 + 20 defaults).
INSERT INTO public.rule_strategies (name, description, is_builtin) VALUES
  ('ABSENCE_HUNT',  'Find companies MISSING something web-presence / capability gaps.', true),
  ('EVENT_TRIGGER', 'Find companies where a business EVENT (new plant, tender, export) created the need.', true),
  ('STANDARD',      'Generic requirement hunting gap = need, anti-signal = exclude.', true)
ON CONFLICT (name) DO NOTHING;
