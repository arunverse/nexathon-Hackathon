-- ============================================================================
-- EBEXTA Support tickets (raised by the in-app assistant bot)
-- The bot answers from canned responses at zero cost; when a user asks to reach
-- the team / raise a ticket, a row lands here and shows in the admin console.
-- Inbox chats (conversations / messages) already have is_admin() read policies,
-- so the admin monitor needs no new SQL for those.
-- Run once in the Supabase SQL editor.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.support_tickets (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email       TEXT,
  subject     TEXT,
  message     TEXT NOT NULL,
  source      TEXT DEFAULT 'bot',            -- 'bot' | 'inbox' | 'manual'
  status      TEXT DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  transcript  JSONB,                         -- recent bot conversation for context
  admin_note  TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tickets insert own"  ON public.support_tickets;
DROP POLICY IF EXISTS "tickets read own"    ON public.support_tickets;
DROP POLICY IF EXISTS "tickets admin read"  ON public.support_tickets;
DROP POLICY IF EXISTS "tickets admin write" ON public.support_tickets;

-- Owner: raise + read their own tickets
CREATE POLICY "tickets insert own" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tickets read own" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

-- Admin: read + triage every ticket (is_admin() from rls_lockdown.sql)
CREATE POLICY "tickets admin read" ON public.support_tickets
  FOR SELECT USING (public.is_admin());
CREATE POLICY "tickets admin write" ON public.support_tickets
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.support_tickets(status, created_at DESC);

CREATE OR REPLACE FUNCTION public.touch_support_tickets()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_tickets_touch ON public.support_tickets;
CREATE TRIGGER trg_tickets_touch BEFORE UPDATE ON public.support_tickets
  FOR EACH ROW EXECUTE FUNCTION public.touch_support_tickets();
