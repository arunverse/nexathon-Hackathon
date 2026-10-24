-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · Verified badge plumbing admin verification must STICK and show up
-- Run once in Supabase → SQL Editor. Idempotent.
--
-- FIXES:
--  1. Admin verification never marked the ORIGINAL lead, so the Leads Monitor
--     looked untouched and the work had to be redone.
--  2. Admins couldn't UPDATE another user's lead row (RLS only allowed the
--     owner), so flagging it silently failed.
--  3. Re-verifying created DUPLICATE verified_leads rows.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Flag on the user's own lead → drives the "Verified by EBEXTA" badge.
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS ebexta_verified BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at    TIMESTAMPTZ;

-- 2. Link + de-dupe the pool (one verified row per source lead).
ALTER TABLE public.verified_leads
  ADD COLUMN IF NOT EXISTS source_lead_id UUID;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_verified_source_lead
  ON public.verified_leads (source_lead_id)
  WHERE source_lead_id IS NOT NULL;

-- 3. Let admins update ANY lead (to stamp it verified). Owners keep their own
--    write policy; this is an ADDITIONAL admin-only update path.
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads admin update" ON public.leads;
CREATE POLICY "leads admin update" ON public.leads
  FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());

NOTIFY pgrst, 'reload schema';

-- Verify (as admin, after verifying a lead in the panel):
--   SELECT company_name, ebexta_verified, verified_at, verification_status
--   FROM public.leads WHERE ebexta_verified = true;
