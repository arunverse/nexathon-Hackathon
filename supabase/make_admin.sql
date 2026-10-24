-- ============================================================================
-- EBEXTA · Grant yourself real admin rights
-- ----------------------------------------------------------------------------
-- The admin panel writes credit limits / plans / blocks through the `account`
-- Edge Function, which authorizes by checking profiles.is_admin = true in the
-- DATABASE. The frontend "dev admin" bypass only lets you SEE the panel it
-- does NOT make the server trust you. Until this flag is set, every admin save
-- (like changing a credit limit) is rejected with "Forbidden" and nothing
-- persists so users keep their old limit.
--
-- Run this ONCE in the Supabase SQL editor. Replace the email if different.
-- ============================================================================

-- Make sure the column exists (older projects may not have it).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Flip the flag for your account.
UPDATE public.profiles
SET is_admin = true
WHERE id = (SELECT id FROM auth.users WHERE lower(email) = lower('arunchinnu2005@gmail.com'));

-- Verify (should return your row with is_admin = t):
SELECT p.id, u.email, p.is_admin, p.plan, p.credit_limit
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE lower(u.email) = lower('arunchinnu2005@gmail.com');
