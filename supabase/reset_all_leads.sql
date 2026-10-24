-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · RESET ALL LEADS wipe every lead/scan for a clean, original start
-- Run once in Supabase → SQL Editor. Safe to re-run.
--
-- ⚠️ DESTRUCTIVE. Deletes ALL users' leads, scans, outreach drafts, saved leads
-- and the shared scan cache. Profiles, chats, plans, credits and the
-- Verified-by-EBEXTA pool are KEPT.
--
-- Deletes in FOREIGN-KEY order (children first) deleting leads directly fails
-- with: violates foreign key constraint "outreach_lead_id_fkey".
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  -- 1. Children that reference leads -----------------------------------------
  IF to_regclass('public.outreach') IS NOT NULL THEN
    DELETE FROM public.outreach;
  END IF;

  IF to_regclass('public.saved_leads') IS NOT NULL THEN
    DELETE FROM public.saved_leads;
  END IF;

  -- verification_requests may carry a lead_id FK
  IF to_regclass('public.verification_requests') IS NOT NULL THEN
    DELETE FROM public.verification_requests;
  END IF;

  -- 2. Keep the Verified-by-EBEXTA pool, but release its link to the old leads
  --    (so the pool survives while the leads rows can be deleted).
  IF to_regclass('public.verified_leads') IS NOT NULL THEN
    BEGIN
      UPDATE public.verified_leads SET source_lead_id = NULL WHERE source_lead_id IS NOT NULL;
    EXCEPTION WHEN others THEN
      -- Column is NOT NULL or absent → drop the pool rows instead.
      DELETE FROM public.verified_leads;
    END;
  END IF;

  -- 3. The leads themselves, then the scans that produced them ---------------
  IF to_regclass('public.leads') IS NOT NULL THEN
    DELETE FROM public.leads;
  END IF;

  IF to_regclass('public.scans') IS NOT NULL THEN
    DELETE FROM public.scans;
  END IF;

  -- 4. Shared scan cache (so the next scan is genuinely fresh) ---------------
  IF to_regclass('public.cached_leads') IS NOT NULL THEN
    DELETE FROM public.cached_leads;
  END IF;
END $$;

-- Verify every count must be 0.
SELECT
  (SELECT count(*) FROM public.leads)        AS leads,
  (SELECT count(*) FROM public.scans)        AS scans,
  (SELECT count(*) FROM public.cached_leads) AS cached,
  (SELECT count(*) FROM public.outreach)     AS outreach;

-- ── OPTIONAL extras (run separately if you want a total reset) ──
-- DELETE FROM public.verified_leads;         -- wipe the verified pool too
-- DELETE FROM public.verified_contacts;      -- wipe verified contacts
-- DELETE FROM public.api_usage;              -- resets every user's used credits to 0
-- DELETE FROM public.system_logs;            -- clears the event log
