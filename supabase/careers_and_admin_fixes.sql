-- ============================================================================
-- EBEXTA · Careers Applications & Admin Full Control Schema Migration
-- ============================================================================
-- Safe & idempotent. Run this entire script in Supabase → SQL Editor → Run.
--
-- This script fixes:
-- 1. Persistent `career_applications` table with all required fields & indexes
-- 2. Strict RLS on `career_applications` (public insert, admin-only read/write/delete)
-- 3. Storage bucket and policies for private resume uploads
-- 4. Admin DELETE policies on `plan_requests`, `leads`, `scans`, `declared_intents`, `dossier_requests`
-- 5. Safe server-side admin deletion RPCs:
--    - ebexta_admin_delete_user(target uuid)
--    - ebexta_admin_delete_career_application(p_id uuid)
--    - ebexta_admin_delete_plan_request(p_id uuid)
--    - ebexta_admin_delete_lead(p_id uuid)
--    - ebexta_admin_delete_intent(p_id uuid)
--    - ebexta_admin_delete_dossier_request(p_id uuid)
--    - ebexta_admin_delete_row(p_table text, p_id uuid)  [Whitelisted fallback]
-- 6. Notifies PostgREST to immediately refresh its schema cache.
-- ============================================================================

-- ── 1. Ensure `is_admin()` helper exists ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_admin FROM public.profiles WHERE id = auth.uid()), false);
$$;

-- ── 2. Create `career_applications` table ──────────────────────────────────
CREATE TABLE IF NOT EXISTS public.career_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  full_name           TEXT NOT NULL,
  email               TEXT NOT NULL,
  phone               TEXT NOT NULL,
  location            TEXT,
  role                TEXT NOT NULL,
  employment_type     TEXT DEFAULT 'Full-time',
  linkedin_url        TEXT,
  portfolio_url       TEXT,
  resume_url          TEXT,
  resume_filename     TEXT,
  introduction        TEXT,
  relevant_experience TEXT,
  why_ebexta          TEXT,
  application_status  TEXT NOT NULL DEFAULT 'New',
  admin_notes         TEXT,
  CONSTRAINT check_application_status CHECK (
    application_status IN ('New', 'Reviewing', 'Shortlisted', 'Interview', 'Selected', 'Rejected')
  )
);

-- Indexes for lightning-fast admin queries, filtering, and sorting
CREATE INDEX IF NOT EXISTS idx_career_apps_created_at ON public.career_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_career_apps_status     ON public.career_applications (application_status);
CREATE INDEX IF NOT EXISTS idx_career_apps_role       ON public.career_applications (role);
CREATE INDEX IF NOT EXISTS idx_career_apps_email      ON public.career_applications (email);

-- Automatic updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_career_apps_updated_at ON public.career_applications;
CREATE TRIGGER trg_career_apps_updated_at
  BEFORE UPDATE ON public.career_applications
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at_timestamp();

-- ── 3. RLS for `career_applications` ─────────────────────────────────────────
ALTER TABLE public.career_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public applicants can insert applications" ON public.career_applications;
CREATE POLICY "Public applicants can insert applications"
  ON public.career_applications
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Admins can view all career applications" ON public.career_applications;
CREATE POLICY "Admins can view all career applications"
  ON public.career_applications
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can update career applications" ON public.career_applications;
CREATE POLICY "Admins can update career applications"
  ON public.career_applications
  FOR UPDATE
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admins can delete career applications" ON public.career_applications;
CREATE POLICY "Admins can delete career applications"
  ON public.career_applications
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- ── 4. Setup Storage Bucket `career-resumes` ────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'career-resumes',
  'career-resumes',
  false,
  10485760, -- 10MB limit
  ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];

-- Storage RLS: Public can upload resumes, only admins can view or delete them
DROP POLICY IF EXISTS "Anyone can upload a resume" ON storage.objects;
CREATE POLICY "Anyone can upload a resume"
  ON storage.objects
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (bucket_id = 'career-resumes');

DROP POLICY IF EXISTS "Only admins can access resumes" ON storage.objects;
CREATE POLICY "Only admins can access resumes"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'career-resumes' AND public.is_admin());

DROP POLICY IF EXISTS "Only admins can delete resumes" ON storage.objects;
CREATE POLICY "Only admins can delete resumes"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'career-resumes' AND public.is_admin());

-- ── 5. Add Missing Admin DELETE Policies on Existing Tables ─────────────────

-- Plan requests: Admin must be able to delete requests permanently
DROP POLICY IF EXISTS "admin delete reqs" ON public.plan_requests;
CREATE POLICY "admin delete reqs"
  ON public.plan_requests
  FOR DELETE
  TO authenticated
  USING (public.is_admin());

-- Leads: Admin must be able to delete leads
DROP POLICY IF EXISTS "leads delete" ON public.leads;
CREATE POLICY "leads delete"
  ON public.leads
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Scans: Admin must be able to delete scans
DROP POLICY IF EXISTS "scans delete" ON public.scans;
CREATE POLICY "scans delete"
  ON public.scans
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Declared intents: Admin must be able to delete intents
DROP POLICY IF EXISTS "intents delete" ON public.declared_intents;
CREATE POLICY "intents delete"
  ON public.declared_intents
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id OR public.is_admin());

-- Dossier requests: Admin must be able to delete dossier requests
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dossier_requests') THEN
    DROP POLICY IF EXISTS "dossier_req delete" ON public.dossier_requests;
    CREATE POLICY "dossier_req delete"
      ON public.dossier_requests
      FOR DELETE
      TO authenticated
      USING (auth.uid() = requester_id OR public.is_admin());
  END IF;
END $$;

-- ── 6. Explicit Server-Side Admin Deletion & Mutation Functions ─────────────

-- A. Delete Career Application
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_career_application(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  DELETE FROM public.career_applications WHERE id = p_id;
END;
$$;

-- B. Update Career Application Status & Notes
CREATE OR REPLACE FUNCTION public.ebexta_admin_update_career_application(
  p_id uuid,
  p_status text,
  p_notes text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;

  UPDATE public.career_applications
  SET
    application_status = COALESCE(NULLIF(p_status, ''), application_status),
    admin_notes = COALESCE(p_notes, admin_notes),
    updated_at = now()
  WHERE id = p_id;
END;
$$;

-- C. Delete Plan Request
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_plan_request(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  DELETE FROM public.plan_requests WHERE id = p_id;
END;
$$;

-- D. Delete Lead
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_lead(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  DELETE FROM public.leads WHERE id = p_id;
END;
$$;

-- E. Delete Declared Intent
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_intent(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  DELETE FROM public.declared_intents WHERE id = p_id;
END;
$$;

-- F. Delete Dossier Request
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_dossier_request(p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dossier_requests') THEN
    DELETE FROM public.dossier_requests WHERE id = p_id;
  END IF;
END;
$$;

-- G. Safe Admin User Deletion (Cascades all dependent records and removes auth user)
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_user(target uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;
  IF target = auth.uid() THEN
    RAISE EXCEPTION 'Cannot delete your own admin account';
  END IF;

  -- Delete all dependent data in order of foreign key dependency
  DELETE FROM public.messages              WHERE sender_id = target;
  DELETE FROM public.conversations         WHERE user_a = target OR user_b = target;
  
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dossiers') THEN
    DELETE FROM public.dossiers            WHERE requester_id = target OR subject_id = target;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'dossier_requests') THEN
    DELETE FROM public.dossier_requests    WHERE requester_id = target OR subject_id = target;
  END IF;

  DELETE FROM public.plan_requests         WHERE user_id = target;
  DELETE FROM public.verification_requests WHERE user_id = target;
  DELETE FROM public.verified_contacts     WHERE user_id = target;
  DELETE FROM public.declared_intents      WHERE user_id = target;
  DELETE FROM public.saved_leads           WHERE user_id = target;
  DELETE FROM public.outreach              WHERE user_id = target;
  DELETE FROM public.leads                 WHERE user_id = target;
  DELETE FROM public.scans                 WHERE user_id = target;
  DELETE FROM public.payments              WHERE user_id = target;
  DELETE FROM public.api_usage             WHERE user_id = target;
  DELETE FROM public.system_logs           WHERE user_id = target;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reviews') THEN
    DELETE FROM public.reviews             WHERE user_id = target;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'support_tickets') THEN
    DELETE FROM public.support_tickets     WHERE user_id = target;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_credits') THEN
    DELETE FROM public.user_credits        WHERE user_id = target;
  END IF;

  -- Delete public profile
  DELETE FROM public.profiles              WHERE id = target;

  -- Delete auth user login
  BEGIN
    DELETE FROM auth.users WHERE id = target;
  EXCEPTION WHEN others THEN
    NULL;
  END;
END;
$$;

-- H. Whitelist-enforced fallback function for legacy callers (matches exact signature)
CREATE OR REPLACE FUNCTION public.ebexta_admin_delete_row(p_table text, p_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Forbidden: not an administrator';
  END IF;

  IF p_table NOT IN (
    'career_applications', 'plan_requests', 'leads', 'declared_intents',
    'verification_requests', 'verified_contacts', 'dossier_requests',
    'dossiers', 'saved_leads', 'outreach', 'scans', 'system_logs',
    'api_usage', 'conversations', 'messages', 'reviews', 'support_tickets'
  ) THEN
    RAISE EXCEPTION 'Table not allowed: %', p_table;
  END IF;

  EXECUTE format('DELETE FROM public.%I WHERE id = $1', p_table) USING p_id;
END;
$$;

-- ── 7. Permissions & Schema Cache Reload ───────────────────────────────────
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_career_application(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_update_career_application(uuid, text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_plan_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_lead(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_intent(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_dossier_request(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_user(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ebexta_admin_delete_row(text, uuid) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_career_application(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_update_career_application(uuid, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_plan_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_lead(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_intent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_dossier_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_user(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.ebexta_admin_delete_row(text, uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
