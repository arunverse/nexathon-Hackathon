-- ============================================================================
-- EBEXTA · Plan requests (sales-led activation no self-serve billing)
-- ----------------------------------------------------------------------------
-- Users don't pay online. When they pick a plan (new) or ask to renew / top up,
-- they submit a request with their company + personal details. The EBEXTA admin
-- sees it, arranges a session, and activates credits manually.
--
-- Objects:
--   plan_requests                 table of submitted requests
--   ebexta_request_plan(...)       user submits a request (also flags them 'pending' for new)
--   ebexta_activate_request(...)   admin activates a request → user goes 'active'
--   ebexta_set_request_status(...) admin marks contacted / declined
--
-- Ensure required profile columns exist
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_admin        BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS plan            TEXT DEFAULT 'starter',
  ADD COLUMN IF NOT EXISTS plan_status     TEXT DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS plan_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS plan_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS credit_limit    INTEGER DEFAULT 100,
  ADD COLUMN IF NOT EXISTS credits_reset_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarded       BOOLEAN DEFAULT false;

-- Ensure is_admin() helper function exists (required by RLS policies)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

CREATE TABLE IF NOT EXISTS public.plan_requests (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  kind          TEXT DEFAULT 'new',        -- new | renew
  plan          TEXT,                      -- requested plan key
  company_name  TEXT,
  website       TEXT,
  company_size  TEXT,
  industry      TEXT,
  contact_name  TEXT,
  contact_role  TEXT,
  contact_phone TEXT,
  message       TEXT,
  status        TEXT DEFAULT 'pending',    -- pending | contacted | activated | declined
  created_at    TIMESTAMPTZ DEFAULT now(),
  handled_at    TIMESTAMPTZ
);

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own requests read"  ON public.plan_requests;
DROP POLICY IF EXISTS "admin update reqs"  ON public.plan_requests;
-- Users read their own; admins read all. Inserts + status changes go through the
-- SECURITY DEFINER functions below (so plan_status can't be self-set).
CREATE POLICY "own requests read" ON public.plan_requests
  FOR SELECT USING (auth.uid() = user_id OR public.is_admin());
CREATE POLICY "admin update reqs" ON public.plan_requests
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_plan_requests_status  ON public.plan_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_plan_requests_user    ON public.plan_requests (user_id, created_at DESC);

-- ── User submits a request ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ebexta_request_plan(p_plan text, p_kind text, details jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE new_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not signed in'; END IF;

  INSERT INTO public.plan_requests (
    user_id, kind, plan, company_name, website, company_size, industry,
    contact_name, contact_role, contact_phone, message
  ) VALUES (
    auth.uid(),
    COALESCE(NULLIF(p_kind, ''), 'new'),
    p_plan,
    details->>'company_name', details->>'website', details->>'company_size', details->>'industry',
    details->>'contact_name', details->>'contact_role', details->>'contact_phone', details->>'message'
  ) RETURNING id INTO new_id;

  -- A brand-new request marks the user 'pending' (still gated until admin acts).
  IF COALESCE(NULLIF(p_kind, ''), 'new') = 'new' THEN
    UPDATE public.profiles SET plan = p_plan, plan_status = 'pending' WHERE id = auth.uid();
  END IF;

  RETURN new_id;
END; $$;

-- ── Admin activates a request → user gets access + credits ──────────────────
CREATE OR REPLACE FUNCTION public.ebexta_activate_request(p_request_id uuid, p_credit_limit int, p_days int DEFAULT 30)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.plan_requests;
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  SELECT * INTO r FROM public.plan_requests WHERE id = p_request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Request not found'; END IF;

  UPDATE public.profiles SET
    plan             = COALESCE(r.plan, plan),
    plan_status      = 'active',
    plan_started_at  = now(),
    plan_expires_at  = now() + (p_days || ' days')::interval,
    credit_limit     = p_credit_limit,
    credits_reset_at = now()
  WHERE id = r.user_id;

  -- A brand-new customer should see the Welcome/congrats screen → onboarding.
  BEGIN
    IF r.kind = 'new' THEN
      UPDATE public.profiles SET onboarded = false WHERE id = r.user_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN NULL;  -- onboarding_flag.sql not run yet
  END;

  UPDATE public.plan_requests SET status = 'activated', handled_at = now() WHERE id = p_request_id;
END; $$;

-- ── Admin marks a request contacted / declined ──────────────────────────────
CREATE OR REPLACE FUNCTION public.ebexta_set_request_status(p_request_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false) THEN
    RAISE EXCEPTION 'Forbidden: not an admin';
  END IF;
  UPDATE public.plan_requests
    SET status = p_status, handled_at = now()
    WHERE id = p_request_id;
END; $$;

REVOKE ALL ON FUNCTION public.ebexta_request_plan(text, text, jsonb)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_activate_request(uuid, int, int)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_set_request_status(uuid, text)          FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ebexta_request_plan(text, text, jsonb)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_activate_request(uuid, int, int)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_set_request_status(uuid, text)       TO authenticated;

NOTIFY pgrst, 'reload schema';

-- Verify:  SELECT * FROM public.plan_requests ORDER BY created_at DESC;
