-- ============================================================================
-- EBEXTA · Admin Inbox Delivery & Network Profiles View Fix
-- ----------------------------------------------------------------------------
-- Fixes:
-- 1. Prevent self-conversations (user_a = user_b)
-- 2. Clean up existing self-conversations
-- 3. Extend network_profiles view so admin is visible to conversation partners
-- 4. Fix conversations INSERT RLS so admin can message any user
--
-- Run once in Supabase SQL editor. Idempotent & safe to re-run.
-- ============================================================================

-- 1. Remove any self-conversations (user_a = user_b) that may have been created by a bug
DELETE FROM public.conversations WHERE user_a = user_b;

-- 2. Add constraint to prevent future self-conversations
ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_no_self_chat;
ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_no_self_chat CHECK (user_a <> user_b);

-- 3. Update ebexta_admin_send_message to block self-sends at DB level
CREATE OR REPLACE FUNCTION public.ebexta_admin_send_message(p_user_id uuid, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
  a uuid;
  b uuid;
  cid uuid;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = me), false) THEN
    RAISE EXCEPTION 'Forbidden: only an admin can send admin direct messages';
  END IF;

  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'Invalid recipient user: p_user_id is NULL';
  END IF;

  IF p_user_id = me THEN
    RAISE EXCEPTION 'Invalid recipient: cannot send a message to yourself';
  END IF;

  IF p_body IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'Message body cannot be empty';
  END IF;

  a := LEAST(me, p_user_id);
  b := GREATEST(me, p_user_id);

  SELECT id INTO cid FROM public.conversations WHERE user_a = a AND user_b = b;
  IF cid IS NULL THEN
    INSERT INTO public.conversations (user_a, user_b, last_message, last_message_at)
    VALUES (a, b, trim(p_body), now())
    RETURNING id INTO cid;
  ELSE
    UPDATE public.conversations
    SET last_message = trim(p_body), last_message_at = now()
    WHERE id = cid;
  END IF;

  INSERT INTO public.messages (conversation_id, sender_id, body)
  VALUES (cid, me, trim(p_body));

  RETURN cid;
END;
$$;

-- 4. Extend network_profiles view so users who share a conversation with admin
--    can see admin's profile card in Inbox sidebar.
DROP VIEW IF EXISTS public.network_profiles;
CREATE VIEW public.network_profiles WITH (security_invoker = off) AS
SELECT
  p.id,
  p.company_name,
  p.sender_email,
  p.mission,
  p.mode,
  p.website,
  p.company_profile,
  p.created_at,
  p.is_admin
FROM public.profiles p
WHERE
  auth.uid() = p.id
  OR public.is_admin()
  OR EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE auth.uid() IN (c.user_a, c.user_b)
      AND p.id    IN (c.user_a, c.user_b)
      AND c.user_a <> c.user_b
  )
  OR EXISTS (
    SELECT 1
    FROM public.signal_watches sw
    JOIN public.declared_intents di
      ON di.user_id = p.id
     AND (di.expires_at IS NULL OR di.expires_at > now())
     AND (
          di.requirement ILIKE '%' || sw.keyword || '%'
       OR EXISTS (SELECT 1 FROM unnest(COALESCE(di.industry_tags,'{}')) t
                  WHERE t ILIKE '%' || sw.keyword || '%')
     )
    WHERE sw.user_id = auth.uid() AND sw.active IS TRUE
  );

ALTER VIEW public.network_profiles OWNER TO postgres;
REVOKE ALL ON public.network_profiles FROM anon;
GRANT SELECT ON public.network_profiles TO authenticated;

-- 5. Fix conversations INSERT RLS so admin can create conversations with any user
DROP POLICY IF EXISTS "conv participants insert" ON public.conversations;
CREATE POLICY "conv participants insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IN (user_a, user_b)
    AND user_a <> user_b
  );

DROP POLICY IF EXISTS "conv admin insert" ON public.conversations;
CREATE POLICY "conv admin insert" ON public.conversations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin() AND user_a <> user_b);

DROP POLICY IF EXISTS "conv participants update" ON public.conversations;
CREATE POLICY "conv participants update" ON public.conversations
  FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_a, user_b) OR public.is_admin());

-- 6. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
