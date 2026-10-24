-- ============================================================================
-- EBEXTA Reviews
-- Users leave one review of their EBEXTA experience (star rating + words).
-- Reviews are owned by the user (they can read/edit their own) and fully
-- visible to admins in the console. Run this once in the Supabase SQL editor.
-- ============================================================================

create table if not exists public.reviews (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  rating       int  not null check (rating between 1 and 5),
  title        text,
  body         text,
  display_name text,               -- name to show (captured at submit time)
  company      text,               -- optional company for context
  status       text not null default 'published'
               check (status in ('published', 'hidden')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- One review per user resubmitting updates the same row (upsert on user_id).
create unique index if not exists uniq_review_per_user on public.reviews(user_id);
create index if not exists idx_reviews_created on public.reviews(created_at desc);

alter table public.reviews enable row level security;

-- Clean re-run
drop policy if exists reviews_select_own   on public.reviews;
drop policy if exists reviews_insert_own   on public.reviews;
drop policy if exists reviews_update_own   on public.reviews;
drop policy if exists reviews_admin_select on public.reviews;
drop policy if exists reviews_admin_update on public.reviews;

-- Owner: read / write only their own review
create policy reviews_select_own on public.reviews
  for select using (auth.uid() = user_id);
create policy reviews_insert_own on public.reviews
  for insert with check (auth.uid() = user_id);
create policy reviews_update_own on public.reviews
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Admin: see and moderate every review (is_admin() defined in rls_lockdown.sql)
create policy reviews_admin_select on public.reviews
  for select using (public.is_admin());
create policy reviews_admin_update on public.reviews
  for update using (public.is_admin()) with check (public.is_admin());

-- Keep updated_at fresh on edits
create or replace function public.touch_reviews_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists trg_reviews_touch on public.reviews;
create trigger trg_reviews_touch before update on public.reviews
  for each row execute function public.touch_reviews_updated_at();

-- ----------------------------------------------------------------------------
-- OPTIONAL: uncomment to surface published reviews as public testimonials on
-- the landing page (exposes rating / body / display_name to anonymous readers).
-- Leave commented to keep reviews visible to owners + admins only.
-- ----------------------------------------------------------------------------
-- drop policy if exists reviews_public_published on public.reviews;
-- create policy reviews_public_published on public.reviews
--   for select using (status = 'published');
