-- ============================================================================
-- EBEXTA · Chat v2 (attachments, read receipts, unread) + Tiered Dossiers
-- ----------------------------------------------------------------------------
-- Requires chat_and_signals.sql (conversations/messages) + public.is_admin().
-- Run once in the Supabase SQL editor. Idempotent.
-- ============================================================================

-- ───────────────────────── 1. MESSAGE ATTACHMENTS ──────────────────────────
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
  ADD COLUMN IF NOT EXISTS attachment_name TEXT,
  ADD COLUMN IF NOT EXISTS attachment_type TEXT;

-- Private storage bucket for chat files. Path convention: <conversationId>/<file>.
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "chat upload" ON storage.objects;
DROP POLICY IF EXISTS "chat read"   ON storage.objects;
-- Only conversation participants may upload to / read from that conversation's folder.
CREATE POLICY "chat upload" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments' AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[1] AND auth.uid() IN (c.user_a, c.user_b)
    )
  );
CREATE POLICY "chat read" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[1] AND auth.uid() IN (c.user_a, c.user_b)
    )
  );

-- ───────────────────── 2. READ RECEIPTS / UNREAD ───────────────────────────
-- Replace the broad update policy with a safe RPC (so nobody can edit a message
-- body only mark the OTHER side's messages read).
DROP POLICY IF EXISTS "msg update read" ON public.messages;

CREATE OR REPLACE FUNCTION public.ebexta_mark_read(p_conversation uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.conversations c
                 WHERE c.id = p_conversation AND auth.uid() IN (c.user_a, c.user_b)) THEN
    RAISE EXCEPTION 'Not a participant';
  END IF;
  UPDATE public.messages
     SET read_at = now()
   WHERE conversation_id = p_conversation
     AND sender_id <> auth.uid()
     AND read_at IS NULL;
END; $$;

CREATE OR REPLACE FUNCTION public.ebexta_unread_count()
RETURNS int LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT COUNT(*)::int
  FROM public.messages m
  JOIN public.conversations c ON c.id = m.conversation_id
  WHERE auth.uid() IN (c.user_a, c.user_b)
    AND m.sender_id <> auth.uid()
    AND m.read_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.ebexta_mark_read(uuid)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_unread_count()    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_mark_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_unread_count()  TO authenticated;

-- ─────────────────── 3. SAFE NETWORK PROFILE VIEW ──────────────────────────
-- Tier 0/1 fields only NEVER exposes sender_email/phone. Inherits the
-- profiles "network read" RLS (own / admin / conversation / matched-intent).
DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = on) AS
SELECT id, company_name, mission, mode, website, created_at
FROM public.profiles;
GRANT SELECT ON public.network_profiles TO authenticated;

-- ─────────────────────── 4. TIERED DOSSIERS ────────────────────────────────
-- A requests EBEXTA to research member B; the admin delivers a verified dossier
-- that ONLY the requester can see.
CREATE TABLE IF NOT EXISTS public.dossier_requests (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status       TEXT DEFAULT 'pending',   -- pending | researching | delivered | declined
  created_at   TIMESTAMPTZ DEFAULT now(),
  handled_at   TIMESTAMPTZ,
  UNIQUE (requester_id, subject_id)
);
CREATE TABLE IF NOT EXISTS public.dossiers (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  requester_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (requester_id, subject_id)
);
ALTER TABLE public.dossier_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dossiers         ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "dreq read"   ON public.dossier_requests;
DROP POLICY IF EXISTS "dreq admin"  ON public.dossier_requests;
DROP POLICY IF EXISTS "dossier read" ON public.dossiers;
CREATE POLICY "dreq read"  ON public.dossier_requests FOR SELECT USING (auth.uid() = requester_id OR public.is_admin());
CREATE POLICY "dreq admin" ON public.dossier_requests FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "dossier read" ON public.dossiers FOR SELECT USING (auth.uid() = requester_id OR public.is_admin());

CREATE INDEX IF NOT EXISTS idx_dreq_status ON public.dossier_requests (status, created_at DESC);

-- A requests a dossier on B (idempotent re-requesting re-opens it as pending).
CREATE OR REPLACE FUNCTION public.ebexta_request_dossier(subject_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;
  IF subject_user = auth.uid() THEN RAISE EXCEPTION 'Cannot request your own dossier'; END IF;
  INSERT INTO public.dossier_requests (requester_id, subject_id, status)
  VALUES (auth.uid(), subject_user, 'pending')
  ON CONFLICT (requester_id, subject_id)
    DO UPDATE SET status = 'pending', created_at = now(), handled_at = NULL
  RETURNING id INTO rid;
  RETURN rid;
END; $$;

-- Admin delivers the researched dossier → unlocks it for the requester.
CREATE OR REPLACE FUNCTION public.ebexta_deliver_dossier(p_request_id uuid, p_content jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.dossier_requests;
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  SELECT * INTO r FROM public.dossier_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;
  INSERT INTO public.dossiers (requester_id, subject_id, content)
  VALUES (r.requester_id, r.subject_id, COALESCE(p_content, '{}'::jsonb))
  ON CONFLICT (requester_id, subject_id) DO UPDATE SET content = EXCLUDED.content, created_at = now();
  UPDATE public.dossier_requests SET status = 'delivered', handled_at = now() WHERE id = p_request_id;
END; $$;

CREATE OR REPLACE FUNCTION public.ebexta_set_dossier_status(p_request_id uuid, p_status text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  UPDATE public.dossier_requests SET status = p_status, handled_at = now() WHERE id = p_request_id;
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_request_dossier(uuid)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_deliver_dossier(uuid, jsonb)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_set_dossier_status(uuid, text)    FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_request_dossier(uuid)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_deliver_dossier(uuid, jsonb)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_set_dossier_status(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
