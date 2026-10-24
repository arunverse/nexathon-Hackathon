-- ═════════════════════════════════════════════════════════════════════════════
-- EBEXTA CONSOLE DIAGNOSIS FIXES
--
-- Run this once in Supabase → SQL Editor → New query → Run.
-- Safe to re-run: every statement is idempotent.
-- ═════════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. NEVER-EMPTY SCAN weak matches are labelled, not hidden
--
-- A lead that scored 40-59 on description match, or that was released from the
-- reserve to avoid returning an empty scan. It reaches the user, but its card
-- says "Loosely matched". Persisted so the label survives a page reload.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.leads
  add column if not exists loosely_matched boolean not null default false;


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. PROFILES RLS the 403s
--
-- Every signed-in user must be able to read and update their OWN profile row,
-- and nobody else's. If this policy is missing, `select * from profiles`
-- returns 403 for everyone and the app cascades errors from there.
--
-- Admins keep full read access via the existing is_admin path (left untouched).
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. CREDITS FALLBACK the app reads the table when the function is down
--
-- The client can READ its own balance so the meter is never blank. It can
-- never WRITE one: there is no insert/update/delete policy here, so the only
-- thing that can move a balance is the Edge Function's service role.
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.user_credits enable row level security;

drop policy if exists "user_credits_select_own" on public.user_credits;
create policy "user_credits_select_own"
  on public.user_credits for select
  to authenticated
  using (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. VERIFY run these and read the output
-- ─────────────────────────────────────────────────────────────────────────────
-- Expect a row for profiles_select_own:
--   select policyname, cmd from pg_policies
--   where schemaname = 'public' and tablename = 'profiles';
--
-- Expect loosely_matched to be listed:
--   select column_name from information_schema.columns
--   where table_name = 'leads' and column_name = 'loosely_matched';
