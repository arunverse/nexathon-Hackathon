-- ============================================================================
-- EBEXTA · Network chat + Signal↔Intent matching + admin monitoring
-- ----------------------------------------------------------------------------
-- 1. conversations + messages  → Instagram-style DMs between two EBEXTA users.
-- 2. ebexta_matched_intents()   → declared intents (from other users) that match
--                                the caller's watched keywords → surfaced in
--                                Signal Watch.
-- 3. admin read policies       → the admin can monitor intents, signals and
--                                conversations, and verify contacts.
--
-- Run once in the Supabase SQL editor. Idempotent. Requires public.is_admin().
-- ============================================================================

-- ─────────────────────────── 1. CHAT ───────────────────────────────────────
-- Canonical participant ordering (user_a < user_b) → one row per pair.
CREATE TABLE IF NOT EXISTS public.conversations (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_a          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_b          UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message    TEXT,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS public.messages (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON public.messages (conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_conv_a ON public.conversations (user_a, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_conv_b ON public.conversations (user_b, last_message_at DESC);

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv participants"     ON public.conversations;
DROP POLICY IF EXISTS "msg read participants" ON public.messages;
DROP POLICY IF EXISTS "msg send participant"  ON public.messages;
DROP POLICY IF EXISTS "msg update read"       ON public.messages;

-- Participants (or admin) can read their conversations.
CREATE POLICY "conv participants" ON public.conversations
  FOR SELECT USING (auth.uid() IN (user_a, user_b) OR public.is_admin());

-- Read messages in conversations you're part of (or admin).
CREATE POLICY "msg read participants" ON public.messages
  FOR SELECT USING (
    public.is_admin() OR EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND auth.uid() IN (c.user_a, c.user_b)
    )
  );

-- Send a message only as yourself, only into a conversation you're part of.
CREATE POLICY "msg send participant" ON public.messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid() AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)
    )
  );

-- Mark messages read (only the recipient side).
CREATE POLICY "msg update read" ON public.messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.conversations c
            WHERE c.id = messages.conversation_id AND auth.uid() IN (c.user_a, c.user_b))
  );

-- Keep conversation preview fresh whenever a message lands.
CREATE OR REPLACE FUNCTION public.tg_touch_conversation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations
    SET last_message = LEFT(NEW.body, 140), last_message_at = NEW.created_at
    WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS touch_conversation ON public.messages;
CREATE TRIGGER touch_conversation AFTER INSERT ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.tg_touch_conversation();

-- Start (or fetch) a conversation with another user. Returns the conversation id.
CREATE OR REPLACE FUNCTION public.ebexta_start_conversation(other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE me uuid := auth.uid(); a uuid; b uuid; cid uuid;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF other_user IS NULL OR other_user = me THEN RAISE EXCEPTION 'Invalid recipient'; END IF;
  a := LEAST(me, other_user); b := GREATEST(me, other_user);
  SELECT id INTO cid FROM public.conversations WHERE user_a = a AND user_b = b;
  IF cid IS NULL THEN
    INSERT INTO public.conversations (user_a, user_b) VALUES (a, b) RETURNING id INTO cid;
  END IF;
  RETURN cid;
END; $$;

-- Realtime for live chat (ignore errors if already added).
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
EXCEPTION WHEN duplicate_object THEN NULL; WHEN undefined_object THEN NULL; END $$;

REVOKE ALL ON FUNCTION public.ebexta_start_conversation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_start_conversation(uuid) TO authenticated;

-- ─────────────────── 2. SIGNAL ↔ INTENT MATCHING ───────────────────────────
-- Declared intents (posted by OTHER users, not expired) whose text or industry
-- tags match ANY of the caller's active watched keywords. This is how a posted
-- intent shows up under someone's Signal Watch.
CREATE OR REPLACE FUNCTION public.ebexta_matched_intents()
RETURNS TABLE (
  intent_id      uuid,
  poster_id      uuid,
  company_name   text,
  mode           text,
  requirement    text,
  industry_tags  text[],
  budget_range   text,
  matched_keyword text,
  created_at     timestamptz
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT ON (di.id)
    di.id, di.user_id, p.company_name, di.mode, di.requirement,
    di.industry_tags, di.budget_range, sw.keyword, di.created_at
  FROM public.signal_watches sw
  JOIN public.declared_intents di
    ON di.user_id <> auth.uid()
   AND (di.expires_at IS NULL OR di.expires_at > now())
   AND (
        di.requirement ILIKE '%' || sw.keyword || '%'
     OR EXISTS (SELECT 1 FROM unnest(COALESCE(di.industry_tags, '{}')) t WHERE t ILIKE '%' || sw.keyword || '%')
   )
  LEFT JOIN public.profiles p ON p.id = di.user_id
  WHERE sw.user_id = auth.uid() AND sw.active IS TRUE
  ORDER BY di.id, di.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.ebexta_matched_intents() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_matched_intents() TO authenticated;

-- ─────────────────── 3. ADMIN MONITORING POLICIES ──────────────────────────
-- Let the admin read intents + signal matches for monitoring/verification.
ALTER TABLE public.declared_intents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "intents read own or admin" ON public.declared_intents;
CREATE POLICY "intents read own or admin" ON public.declared_intents
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());

-- Minimal profile read so chat + network profiles can resolve names/company for
-- any counterpart you have a conversation or matched intent with, and for admin.
DROP POLICY IF EXISTS "profiles network read" ON public.profiles;
CREATE POLICY "profiles network read" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.conversations c
               WHERE auth.uid() IN (c.user_a, c.user_b) AND id IN (c.user_a, c.user_b))
    OR EXISTS (SELECT 1 FROM public.declared_intents di
               JOIN public.signal_watches sw ON sw.user_id = auth.uid() AND sw.active
               WHERE di.user_id = public.profiles.id)
  );

NOTIFY pgrst, 'reload schema';

-- Verify:
--   SELECT public.ebexta_start_conversation('<other-user-uuid>');
--   SELECT * FROM public.ebexta_matched_intents();
