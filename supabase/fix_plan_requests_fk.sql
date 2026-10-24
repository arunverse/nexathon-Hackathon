-- ═══════════════════════════════════════════════════════════════════════════
-- EBEXTA · FIX "plan_requests_user_id_fkey" violation v2 (abort-proof)
-- Run once in Supabase → SQL Editor. Idempotent. Run top to bottom.
--
-- WHY v1 DIDN'T WORK: it tried to create a trigger on auth.users BEFORE the
-- foreign-key fix. Supabase often blocks that ("must be owner of relation
-- users"), which aborted the whole script so the FK was never repaired and
-- the same error kept appearing. The FK fix now runs FIRST, and the trigger is
-- wrapped so it can never abort anything.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── STEP 0 · DIAGNOSTIC what does the constraint actually point at? ───────
SELECT
  tc.constraint_name,
  kcu.column_name              AS local_column,
  ccu.table_schema || '.' || ccu.table_name AS references_table,
  ccu.column_name              AS references_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'plan_requests';

-- ── STEP 1 · Backfill a profile for every auth user missing one ────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS mode         TEXT DEFAULT 'seeker',
  ADD COLUMN IF NOT EXISTS plan         TEXT,
  ADD COLUMN IF NOT EXISTS credits      INTEGER;

INSERT INTO public.profiles (id, sender_email, mode, plan, credits)
SELECT u.id, u.email, 'seeker', 'starter', 20
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
ON CONFLICT (id) DO NOTHING;

-- ── STEP 2 · THE ACTUAL FIX repoint the FK at auth.users ─────────────────
-- Clear any orphan rows first, otherwise ADD CONSTRAINT is rejected.
DELETE FROM public.plan_requests
WHERE user_id IS NOT NULL
  AND user_id NOT IN (SELECT id FROM auth.users);

ALTER TABLE public.plan_requests
  DROP CONSTRAINT IF EXISTS plan_requests_user_id_fkey;

ALTER TABLE public.plan_requests
  ADD CONSTRAINT plan_requests_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

NOTIFY pgrst, 'reload schema';

-- ── STEP 3 · Auto-create profiles on signup (optional, never aborts) ───────
DO $outer$
BEGIN
  CREATE OR REPLACE FUNCTION public.handle_new_user()
  RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $fn$
  BEGIN
    INSERT INTO public.profiles (id, sender_email, mode, plan, credits)
    VALUES (NEW.id, NEW.email, 'seeker', 'starter', 20)
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
  END; $fn$;

  DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
  CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
EXCEPTION WHEN insufficient_privilege OR others THEN
  RAISE NOTICE 'Skipped auth.users trigger (no permission) the app creates profiles client-side.';
END $outer$;

-- ── VERIFY both must be 0, and the FK must now reference auth.users ──────
SELECT
  (SELECT count(*) FROM auth.users u
     LEFT JOIN public.profiles p ON p.id = u.id
   WHERE p.id IS NULL) AS users_without_profile,
  (SELECT count(*) FROM public.plan_requests pr
   WHERE pr.user_id IS NOT NULL
     AND pr.user_id NOT IN (SELECT id FROM auth.users)) AS orphan_requests;
