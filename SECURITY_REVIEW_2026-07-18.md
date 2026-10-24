# NEXA / EBEXTA Security Review (attacker perspective)

**Date:** 2026-07-18
**Scope:** React + Vite frontend, Supabase (Postgres + RLS + Storage), two Edge Functions (`gemini`, `account`), Vercel deployment.
**Method:** Static review of every trust boundary against the 7 requested attack paths. No tests were run against the live database several findings depend on which SQL migrations were actually applied in production and must be verified there (see F2).

## How this app is defended (so the findings make sense)

The browser ships the Supabase **anon key** and can run **any query it wants** against the API. Nothing the frontend does (hiding buttons, `AdminRoute`, `PlanGate`) is a security control an attacker uses the anon key + their own login token and calls the API directly. The real controls are: **Row Level Security (RLS) policies**, **column-level GRANTs** on `profiles`, **`SECURITY DEFINER` functions that self-check `is_admin()`**, and **JWT verification inside the Edge Functions**. The review focused there.

Overall this is a **well-hardened build** clear IDOR and PII audit passes, server-side JWT checks, no secrets in the bundle, a strong CSP. The issues below are a small number of concrete holes plus one systemic risk.

---

## Findings (ranked; unauthorized-access first, then abuse/logic)

### F1 · CRITICAL Any user can grant themselves a free Enterprise plan
**Path:** privilege escalation / business logic · **Confirmed in code.**

`plan_gate.sql` creates `ebexta_set_plan(text,int)` as `SECURITY DEFINER`, `GRANT EXECUTE ... TO authenticated`, and the body only checks `auth.uid() IS NOT NULL`. `PlanGate.tsx` unlocks the whole app when `plan_status IN ('active','trial')`. Nothing revokes the function (the file's own comment says "Before going live, either drop `ebexta_set_plan` or restrict it otherwise a user could self-activate without paying").

**What an attacker does:** signs up (signup is open), then from the browser console:
```js
await supabase.rpc('ebexta_set_plan', { p_plan: 'enterprise', p_days: 3650 })
```
Instantly `plan_status='active'`, Enterprise, for 10 years. `ebexta_start_trial()` is the same story (self-serve trial, repeatable after expiry). Both also set `credits_reset_at=now()`, which resets the Gemini usage window each call.

**Damage:** 100% of subscription revenue bypassed every user takes the top tier for free, and resets their AI quota at will. The sales-led flow (`ebexta_request_plan`, which correctly sets `plan_status='pending'`) is completely sidestepped.

**Fix (in `SECURITY_FIXES_2026-07-18.sql`, F1):** `DROP FUNCTION ebexta_set_plan(text,int)` and `ebexta_start_trial()`. Billing is now admin-activated via `ebexta_activate_request`, so neither is needed. A safe one-trial-ever version is included commented-out if you want self-serve trials back.

---

### F2 · HIGH (VERIFY IN PROD) Cross-user data exposure depends on which SQL files were run
**Path:** IDOR / data access · **Conditional verify against the live DB now.**

These are manually-run scripts with no migration runner enforcing order or completeness. Multiple older "dev" files create **fully open** policies:
`restore_working_rls.sql` (`profiles read all`, `leads read all`, `api_usage insert all WITH CHECK(true)` …), `fix_migration.sql`, `admin_migration.sql`, `upgrade_v2.sql`, `verified_contacts_migration.sql`, `migrations.sql`.

RLS policies are **OR-additive**: a single surviving `USING(true)` policy nullifies every owner-scoped one. `rls_lockdown.sql` (newest) and `production_hardening.sql` remove them **but only if they were the last scripts run.** If the DB was left after a dev script, or a dev script was re-run later, then **any logged-in user can read every user's profiles, leads, scans, outreach, intents, verification requests, usage and logs**, and insert `api_usage` rows under another user's id to burn their credits.

**What an attacker does (if unpatched):** `await supabase.from('profiles').select('*')` → dumps every user's row; `await supabase.from('leads').select('*')` → the entire lead database.

**Damage:** full customer-data breach (PII + proprietary lead intel).

**Fix:** run the audit query in `SECURITY_FIXES_2026-07-18.sql` (F5) it must return **zero** rows. If it returns any, re-run `rls_lockdown.sql` immediately. Then **delete the dev SQL files** listed above so they can't be re-applied, and move to an ordered migration process (e.g. Supabase CLI `supabase/migrations/`). The same section verifies the `profiles` column-level lockdown that stops a user writing their own `is_admin`/`credits`/`plan`.

---

### F3 · MEDIUM `network_profiles` view leaks every intent-poster's email
**Path:** IDOR / PII exposure · **Confirmed in code (`privacy_hardening.sql`).**

The current view (definer, exposes `sender_email` + `company_profile`) grants a row to the caller if they hold **any** active `signal_watch` and the target posted **any** `declared_intent` there is **no keyword match** between watch and intent. The matching *function* `ebexta_matched_intents()` does it right; the *view* does not.

**What an attacker does:** create one active signal watch (normal feature), then `await supabase.from('network_profiles').select('id,company_name,sender_email')` → harvests the email + company of **every user who has posted an intent**.

**Damage:** bulk PII / email harvesting of the active user base (spam, phishing, competitor poaching).

**Fix (F2 in the SQL file):** view rebuilt so the intent branch actually matches the watcher's keyword against the poster's `requirement`/`industry_tags`, mirroring `ebexta_matched_intents()`.

---

### F4 · MEDIUM Coupon redemption: reusable + resets the billing window
**Path:** feature abuse / business logic · **Confirmed in code (`account/index.ts`).**

`redeem_coupon` had no single-use check and **overwrote** `credit_limit` while setting `credits_reset_at=now()`. Re-calling it repeatedly resets the Gemini usage window → unlimited API calls; there's also no rate limit on redemption attempts (brute-forceable). The code `Ebexta@2026` lives server-side only (good not in the bundle), but it's weak and, once leaked, was infinitely reusable.

**Fix (applied to `account/index.ts` + F3 in the SQL file):** new `coupon_redemptions` table enforces one redemption per (user, code); credits now **increment the cap** instead of overwriting it; `credits_reset_at` is **never** touched. Fails closed if the table is missing. *Also recommended:* replace the hardcoded coupon with a DB table of codes with expiry/quantity, and add attempt throttling.

---

### F5 · LOW `cached_leads` open insert (cache poisoning / storage fill)
`cached_leads` has `INSERT WITH CHECK(true)` and public read, and isn't covered by `rls_lockdown.sql`. Any client can inject fake rows into the shared discovery cache or bloat storage. **Fix (F4 in the SQL file):** insert restricted to authenticated callers, stamped with `created_by`.

### F6 · LOW Global (not per-user) daily AI cost cap
`gemini/index.ts` `DAILY_MODEL_CAP = 5000` is global across all users. Within their own per-user hourly limits, a few high-limit users can exhaust the whole app's daily AI budget and deny service to everyone else. **Fix:** add a per-user daily spend cap alongside the global one.

### F7 · INFORMATIONAL minor
- `PlanGate.GRANTED_EMAILS` has a typo (`arunchinn2005` vs `arunchinnu2005`) a client-side convenience only; real access is DB-driven, so no security impact.
- `handle_new_user` grants 20 credits while `createProfileIfMissing` inserts 10 client-side redundant/inconsistent, not a security issue.

---

## Checked and found solid (no action needed)

- **Auth bypass:** both Edge Functions verify the JWT server-side via `admin.auth.getUser(token)` (validates signature + expiry) and reject missing/invalid tokens with 401. No unauthenticated path except `OPTIONS`.
- **Signup → admin escalation:** `handle_new_user` does **not** copy `is_admin`/role from user metadata. No self-service admin.
- **Admin RPCs:** every privileged `SECURITY DEFINER` function (`admin_update_profile`, `ebexta_activate_request`, `ebexta_admin_delete_user`, `ebexta_admin_delete_row`, dossier RPCs) re-checks `is_admin()` in the body and raises on failure. `ebexta_admin_delete_row` uses a table whitelist + `%I` quoting (no SQL injection).
- **Privilege escalation via profile writes:** `secure_profiles.sql` REVOKEs blanket UPDATE and GRANTs only harmless columns `is_admin`/`credits`/`plan`/`credit_limit` are service-role-only. (Verify it's live via F5.)
- **`isAdmin` (client):** derived solely from `profiles.is_admin` read from the DB; spoofing React state only reveals the admin UI shell, not data (RLS/RPCs still enforce).
- **XSS:** no `dangerouslySetInnerHTML` / `innerHTML` / `eval` in the frontend; React auto-escapes; CSP is `script-src 'self'` (no unsafe-inline for scripts).
- **Secrets:** service-role and Gemini keys are absent from the built `dist/` bundle and never referenced in `src/`; only the anon key ships (safe by design). No `.env`/`.git`/sourcemaps in `dist/`. `.env` is gitignored.
- **Chat/attachments:** messages and the storage bucket are participant-scoped; bucket is private with a 10 MB cap and a MIME allowlist that excludes SVG/HTML (no stored-XSS via upload).
- **Rate limiting:** `gemini` enforces per-user, per-action hourly limits + credit_limit + blocked-user check.
- **Deployment headers:** HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy, strong CSP.

---

## Do this now (in order)

1. **F2 verify:** run the audit query in `supabase/SECURITY_FIXES_2026-07-18.sql` (F5 section). If it returns rows, re-run `rls_lockdown.sql` you have a live data-exposure.
2. **Run** `supabase/SECURITY_FIXES_2026-07-18.sql` in the Supabase SQL Editor (fixes F1, F3, F4-table, F5).
3. **Deploy** the updated `account` function: `supabase functions deploy account` (F4 code fix; run step 2 first so the table exists).
4. **Delete** the dev SQL files that create `USING(true)` policies (F2) so they can't be re-applied.

*Note: I can edit files here but cannot run SQL against your live Supabase or deploy functions steps 1–3 are yours to run.*
