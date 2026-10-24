# EBEXTA Production Hardening

Status of all 20 fixes, plus the deploy steps needed to keep every feature
working. **No existing feature output or UI was changed** this is all
under-the-hood plumbing, security plumbing, and SQL.

---

## ⚠️ REQUIRED before AI features work again (do these first)

S1 moved the Gemini key out of the browser into a Supabase Edge Function. Until
the function is live with the key, scanning / enrichment / email generation /
portfolio analysis will fail (by design the key can't be in the frontend).

1. **Set the secret** (server-side only):
   ```
   supabase secrets set GEMINI_API_KEY=<your key>
   # optional lock CORS to your domains:
   supabase secrets set ALLOWED_ORIGINS="http://localhost:4000,https://ebexta.ebexta.com"
   ```
2. **Deploy the function:**
   ```
   supabase functions deploy gemini
   ```
   For local dev: `supabase functions serve gemini --env-file supabase/functions/.env`
3. **Run the SQL** `supabase/production_hardening.sql` in the SQL Editor.
4. **Make yourself admin** uncomment + run in that file:
   `UPDATE profiles SET is_admin = true WHERE sender_email = 'arunchinnu2005@gmail.com';`
5. **Remove secret keys from the frontend `.env`** delete the `VITE_` prefix
   from every secret (`VITE_GEMINI_API_KEY`, `VITE_PERPLEXITY_API_KEY`,
   `VITE_SUPABASE_SERVICE_ROLE_KEY`, `VITE_RAZORPAY_KEY_SECRET`,
   `VITE_RESEND_API_KEY`). They are no longer referenced by the app. Keep only
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (those are public by design).

---

## SECURITY

| Fix | What was done | Where |
|-----|---------------|-------|
| **S1** API keys out of frontend | All Gemini calls now go through the `gemini` Edge Function (key in Supabase secrets). SDK + key removed from the bundle (verified: no key/endpoint/SDK in built JS). | `supabase/functions/gemini/`, `src/lib/geminiProxy.ts`, `gemini.ts`, `scanEngine.ts`, `leadIntel.ts`, `emailGenerator.ts`, `pitchPdf.ts`, `perplexity.ts` |
| **S2** Remove hardcoded creds | Deleted `arun`/`12345` admin login. Admin = `profiles.is_admin` via Supabase. `grep` for creds → **0 matches**. | `AuthContext.tsx`, `AdminRoute.tsx`, `ProfileMenu.tsx` + SQL |
| **S3** Rate limiting | Per-user/per-action limits in the Edge Function (scan 5/hr, discovery 15/hr, enrich 60/hr, email 20/hr) via `api_usage` counts. Verification requests capped 10/day/user. | `supabase/functions/gemini/index.ts`, `LeadDetail.tsx` |
| **S4** Input sanitization | `sanitizeText` (DOMPurify strip-all-HTML + trim + null-byte strip + length cap), `sanitizeTags`, `isEmail`, `isURL`, `sanitizeUrl`. Applied to intent posting, onboarding, signal watches. Normal text is unchanged; `<script>` is stripped. No raw `.rpc()`/`.sql()` string-interpolation exists. | `src/lib/sanitize.ts` + call sites |
| **S5** CORS lockdown | Edge Function echoes origin only if allowlisted (`ALLOWED_ORIGINS`), no `*`. | `supabase/functions/_shared/cors.ts` |
| **S6** Secure token storage | **Left as opt-in** to preserve your current "stay logged in across tabs" behavior. Switching to `sessionStorage`/PKCE would log users out on tab close flagged rather than forced. One-liner documented below. | (unchanged) |
| **S7** CSRF | Not applicable to the JWT model: every state-changing op requires the Supabase JWT (`functions.invoke` + RLS). No cookie sessions → no CSRF surface. | |
| **S8** Secrets out of git | `.gitignore` now blocks every `.env*` variant (except `.env.example`). `.env` was **never committed** (checked git history) no rotation needed. | `.gitignore` |
| **S9** RLS audit | All dev `USING (true)` policies dropped; replaced with per-user SELECT/INSERT(`WITH CHECK`)/UPDATE/DELETE + admin-aware reads via a `public.is_admin()` `SECURITY DEFINER` helper. `verified_leads`/`cached_leads` public read. | `supabase/production_hardening.sql` |
| **S10** RBAC | `AdminRoute` gates on `isAdmin` from Supabase (not a client flag); `ProfileMenu` only shows Admin Console to real admins; RLS enforces admin on the DB side independently. | `AuthContext.tsx`, `AdminRoute.tsx` + SQL |

### S6 opt-in (only if you want tokens cleared on tab close)
In `src/lib/supabase.ts`, pass a `storage` adapter backed by `sessionStorage` and
`flowType: 'pkce'`. Trade-off: users must re-login when they close the tab, and
the Google OAuth redirect must be retested. Left off to honor "don't change
current functionality."

---

## SCALABILITY

| Fix | What was done | Where |
|-----|---------------|-------|
| **C1** API cost control | Edge Function rejects at 900 calls/model/day (90% of 1000). Every call logged to `api_usage` server-side (single source of truth client double-logging removed). | `supabase/functions/gemini/index.ts` |
| **C2** Connection pooling | Confirmed single `supabase` client singleton, created once, shared by all imports. | `src/lib/supabase.ts` |
| **C3** Caching | `scans.filter_hash` column + index added (SQL). Existing `cached_leads` 7-day cache + verified-leads pool already serve as caches. **Did not** wire a new cache into the live scan flow (would change what results you get). | SQL |
| **C4** CDN / fonts | No code change (Vercel/Netlify/Cloudflare auto-CDN static assets). Fonts already use `preconnect` + `display=swap` (browser-cached). | |
| **C5** Horizontal scaling | Edge Functions are stateless by design; the `gemini` function keeps no cross-request mutable state. | |
| **C6** Indexing | All recommended indexes added (leads, scans, verification_requests, api_usage, declared_intents, profiles admin, etc.). | `supabase/production_hardening.sql` |
| **C7** localStorage not primary | Dashboards already read leads/scans from Supabase first; localStorage is an optimistic render cache + UI prefs only. Left unchanged (functionality preserved). | |
| **C8** Realtime cleanup | No `.subscribe()`/`.channel()` in the codebase (polling with proper `clearInterval` is used instead). Nothing to fix. | |
| **C9** Async queue | Scan concurrency is bounded by the per-user 5/hr Edge limit. Full queue **intentionally deferred to V2** (as the spec allows) rewriting the scan into a queue would change scan behavior/latency. | (deferred) |
| **C10** Memory leaks | Audited: every `setInterval` has `clearInterval`; both `addEventListener`s (`ProfileMenu`, `GlobalIntelligenceDiscovery`) have matching `removeEventListener`; no dangling subscriptions. | verified |

---

## Verify checklist mapping
- ✅ No API key in bundle verified against the freshly built entry chunk.
- ✅ `grep "12345|1506|arun|9380919019" src/` → 0 matches.
- ✅ Rate limiting Edge Function (429 on limit) + verification 10/day.
- ✅ `<script>` stripped by `sanitizeText`.
- ✅ CORS allowlist only, no wildcard.
- ✅ `.env` gitignored + never committed.
- ✅ Non-admin → `/admin` redirects (AdminRoute + RLS).
- ✅ RLS per-table policies in `production_hardening.sql`.
- ✅ Singleton client; indexes added; timers/listeners cleaned up.
- ✅ `tsc` + `vite build` zero errors.
