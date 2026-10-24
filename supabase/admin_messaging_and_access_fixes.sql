-- ============================================================================
-- EBEXTA · Admin Messaging, Account Activation & Access Fixes
-- ----------------------------------------------------------------------------
-- Run once in the Supabase SQL editor. Completely idempotent & safe to re-run.
-- ============================================================================

-- 1. Ensure required profile columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plan_status     TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ DEFAULT (now() + INTERVAL '1 year'),
  ADD COLUMN IF NOT EXISTS credit_limit    INT DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS company_profile JSONB DEFAULT '{}'::jsonb;

-- 2. Auto-heal: Ensure all existing registered user accounts are unlocked & active
UPDATE public.profiles
SET 
  plan_status = 'active',
  plan_expires_at = COALESCE(plan_expires_at, now() + INTERVAL '1 year')
WHERE plan_status IS NULL 
   OR plan_status = 'none' 
   OR plan_status = 'pending'
   OR (plan_expires_at IS NOT NULL AND plan_expires_at < now());

-- 3. Set official EBEXTA Admin identity on admin accounts
UPDATE public.profiles
SET 
  company_name = 'EBEXTA Admin',
  is_admin = true,
  plan = 'enterprise',
  plan_status = 'active',
  plan_expires_at = now() + INTERVAL '100 years'
WHERE sender_email IN ('arunchinnu2005@gmail.com', 'arunchinn2005@gmail.com')
   OR is_admin = true;

-- 4. RPC: Admin Direct Message to User
-- Allows the admin to send a direct message into any user's inbox & notification center.
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

  IF p_user_id IS NULL OR p_user_id = me THEN
    RAISE EXCEPTION 'Invalid recipient user';
  END IF;

  IF p_body IS NULL OR trim(p_body) = '' THEN
    RAISE EXCEPTION 'Message body cannot be empty';
  END IF;

  -- Ensure consistent ordering of conversation participants
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

-- 5. RPC: Admin Activate or Extend User Access (1-Click)
CREATE OR REPLACE FUNCTION public.ebexta_admin_activate_user(
  p_user_id uuid, 
  p_days int DEFAULT 365, 
  p_credit_limit int DEFAULT 1000
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me uuid := auth.uid();
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = me), false) THEN
    RAISE EXCEPTION 'Forbidden: only an admin can activate user access';
  END IF;

  UPDATE public.profiles
  SET 
    plan_status = 'active',
    plan_expires_at = now() + (COALESCE(p_days, 365) || ' days')::interval,
    credit_limit = COALESCE(p_credit_limit, credit_limit, 1000)
  WHERE id = p_user_id;
END;
$$;

-- 6. Permissions
REVOKE ALL ON FUNCTION public.ebexta_admin_send_message(uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_activate_user(uuid, int, int) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_activate_user(uuid, int, int) TO authenticated;

-- 7. Ensure RLS policies on messages & conversations allow participants and admins
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "conv participants read" ON public.conversations;
CREATE POLICY "conv participants read" ON public.conversations FOR SELECT TO authenticated
  USING (auth.uid() IN (user_a, user_b) OR public.is_admin());

DROP POLICY IF EXISTS "conv participants insert" ON public.conversations;
CREATE POLICY "conv participants insert" ON public.conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (user_a, user_b) OR public.is_admin());

DROP POLICY IF EXISTS "conv participants update" ON public.conversations;
CREATE POLICY "conv participants update" ON public.conversations FOR UPDATE TO authenticated
  USING (auth.uid() IN (user_a, user_b) OR public.is_admin());

DROP POLICY IF EXISTS "msg participants read" ON public.messages;
CREATE POLICY "msg participants read" ON public.messages FOR SELECT TO authenticated
  USING (
    public.is_admin() OR
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = messages.conversation_id AND auth.uid() IN (c.user_a, c.user_b)
    )
  );

DROP POLICY IF EXISTS "msg participants insert" ON public.messages;
CREATE POLICY "msg participants insert" ON public.messages FOR INSERT TO authenticated
  WITH CHECK (
    public.is_admin() OR
    (
      sender_id = auth.uid() AND
      EXISTS (
        SELECT 1 FROM public.conversations c
        WHERE c.id = conversation_id AND auth.uid() IN (c.user_a, c.user_b)
      )
    )
  );

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
