# EBEXTA SECURITY.md

> Enterprise security documentation. Reflects the current implemented state.
> Update in the same change whenever auth, RLS, secrets, or Edge Functions change.

---

## 1. Authentication

- **Provider:** Supabase Auth (GoTrue). Email+password and Google OAuth.
- **Passwords:** hashed by Supabase with **bcrypt**. The app never stores, logs, returns,
  or transmits a plaintext password anywhere except the `supabase.auth` call.
- **Sessions:** JWT access token (default 1h) + refresh token, persisted in `localStorage`
  by supabase-js. `AuthContext` re-checks admin status only when identity changes (not on
  token refresh) to avoid remounting the UI.
- **Sign-out:** `supabase.auth.signOut()` revokes the refresh token and the app wipes all
  `ebexta_*` localStorage keys.
- **Profile bootstrap:** ensured on every auth event (client `createProfileIfNotExists`)
  and via the `handle_new_user` DB trigger both idempotent, so a missing profile (which
  breaks foreign keys like `plan_requests`) cannot occur.

## 2. Authorization

Three enforced layers:
1. **UI gates:** `ProtectedRoute` (session), `PlanGate` (active plan + onboarded),
   `AdminRoute` (`is_admin`). UI gates are convenience only not the security boundary.
2. **Row Level Security (RLS):** the real boundary. Every table scoped to `auth.uid()` or
   `is_admin()`. See `DATABASE.md` §9 and `rls_lockdown.sql`.
3. **Column-level grants:** `secure_profiles.sql` REVOKEs UPDATE on privileged profile
   columns; only the service role writes them.

## 3. Admin Permissions & Role Hierarchy

```
Visitor  <  User (Seeker/Provider)  <  Admin (profiles.is_admin=true)
```
- Admin is a **database flag**, not a client email list (the old `DEV_ADMIN_EMAILS` bypass
  was removed before launch). Set via `make_admin.sql`.
- Every privileged admin operation checks `is_admin()` **server-side** (in the RPC/Edge
  Function), independent of the UI.

## 4. RLS Policies

Authoritative set applied by `rls_lockdown.sql` (owner-or-admin), `privacy_hardening.sql`
(profiles cross-user via definer view only), `verified_badge.sql` (admin can stamp leads),
`chat_and_signals.sql`/`chat_v2_and_dossiers.sql` (participant-scoped chat + storage).
Full table: `DATABASE.md`.

## 5. JWT Lifecycle

Issue (login) → attached automatically by supabase-js to every PostgREST/RPC/Edge call →
verified server-side (`admin.auth.getUser(token)` in Edge Functions; `auth.uid()` in RLS) →
refreshed silently (~1h) → revoked on sign-out. Access tokens are stateless (cannot be
individually blacklisted; short expiry is the mitigation).

## 6. Session Handling

localStorage-persisted session (SPA default). XSS surface is minimized: no
`dangerouslySetInnerHTML`, no `eval`/`new Function`, React auto-escaping, and a strict CSP
(`script-src 'self'`). Sign-out clears all app data.

## 7. Password Handling

Only ever passed to `supabase.auth.signUp/signInWithPassword`. Signup enforces min 8 chars
+ confirmation client-side; Supabase enforces server-side policy and bcrypt hashing.

## 8. OAuth

Google via `supabase.auth.signInWithOAuth`. Redirect URLs must be allow-listed in the
Supabase Auth config for the production domain.

## 9. API Security

- **Edge Functions** require a valid Supabase JWT (`Unauthorized` 401 otherwise).
- **CORS** restricted to an allowlist (never `*`); origin echoed only if allow-listed.
- **Rate limiting:** `gemini` enforces per-user per-action limits (scan/discovery/enrich/email),
  a per-user monthly credit limit (with anniversary reset), and a global daily model cap.
- **Auth endpoints** (login/signup/reset/OTP): rate-limited by Supabase Auth (configure in
  the Supabase dashboard).

## 10. Environment Variables & Secrets

| Secret | Where | Exposure |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | client build | Public by design (safe only because RLS is enforced). |
| `SUPABASE_SERVICE_ROLE_KEY` | Edge Function secret | Never in client. Bypasses RLS. |
| `GEMINI_API_KEY` | Edge Function secret | Never in client. |
| `ALLOWED_ORIGINS` | Edge Function secret | CORS allowlist. |

- `.env` is gitignored (all variants); only `.env.example` files are tracked.
- Git history is clean of real secrets (audited).
- **Rule:** never prefix a server secret with `VITE_` (that ships it to the browser).
- **Rotation:** any secret pasted in chat/screenshots is considered burned rotate the
  Gemini key and regenerate the anon key if needed.

## 11. Prompt Injection Protection

- User free-text (mission, keywords, filters) is inserted into prompts but the AI's job is
  **verification/discovery**, and its output is **schema-validated (zod)** and
  **link-validated** before use so injected instructions cannot change what the app does
  with the output. Contacts/links that don't validate are dropped.
- No user input is ever executed as code or SQL.

## 12. SQL Injection Protection

- Client never writes raw SQL all access is PostgREST (parameterized) or RPC.
- The only dynamic SQL (`ebexta_admin_delete_row`) uses `format('… %I …', table) USING $1`
  (identifier-quoted + parameterized) and is admin-gated + table-whitelisted.

## 13. XSS Protection

- React auto-escapes. No `dangerouslySetInnerHTML`/`innerHTML`/`eval`/`document.write`.
- CSP: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; …`.
- User text passes through `sanitize.ts` (dompurify) before storage where relevant.

## 14. CSRF Protection

- No cookie-based auth → classic CSRF not applicable (JWT sent via `Authorization` header,
  not auto-attached cookies). CORS allowlist further limits cross-origin calls.

## 15. File Upload Security

- Private bucket, participant-scoped RLS, signed URLs (1h), served from `*.supabase.co`
  (different origin → no same-domain script execution).
- Server-enforced 10 MB cap + MIME allowlist (`storage_hardening.sql`); HTML/SVG excluded.
- Client validates size/type and sanitizes the filename (strips path separators).

## 16. Input Validation & Output Sanitization

- AI responses: **zod schemas** (`scanEngine.ts`).
- URLs: `urlUtils.ts` / `linkVerifier.ts` (drop fake/placeholder/`Not publicly listed`).
- Text: `sanitize.ts` with length caps.
- Phone: normalized `+CC number` via `PhoneField`.

## 17. Logging & Audit Trail

- `system_logs` (scan/error/login/verification/export events) + `api_usage` (per AI call).
- Edge Functions log full upstream errors **server-side only** with a correlation id (`cid`);
  the client receives a generic message + `cid` (no stack traces / DB details / keys).

## 18. Monitoring / Abuse / Bot Detection

- Admin API & Cost page tracks spend and usage per user/model.
- Credit limits + rate limits + daily cap bound abuse and cost.
- **Gap:** no dedicated bot/abuse detection or alerting yet (see `KNOWN_ISSUES.md`).

## 19. Compliance

- PII deletion: Settings → Danger Zone → `account.delete_account` wipes all rows
  (FK CASCADE) + auth user + local storage. Supports DPDP/GDPR erasure.
- Data map + third-party egress documented in `ARCHITECTURE.md` §14/§17.

## 20. OWASP Top 10 Checklist

| # | Risk | Status |
|---|---|---|
| A01 Broken Access Control | ✅ RLS owner-scoped + admin `is_admin()` server checks; IDOR closed by `rls_lockdown.sql`. |
| A02 Cryptographic Failures | ✅ TLS everywhere; bcrypt passwords (Supabase). |
| A03 Injection | ✅ Parameterized/PostgREST; `%I`/`$1` in the one dynamic SQL. |
| A04 Insecure Design | ✅ Backend-first, evidence-first, gated flows. |
| A05 Security Misconfiguration | ✅ Security headers + CSP; ⚠️ manual migration ordering risk. |
| A06 Vulnerable Components | ⚠️ No automated dependency scanning yet. |
| A07 Auth Failures | ✅ Supabase Auth + rate limits + no dev bypass. |
| A08 Data Integrity | ✅ zod-validated AI output; idempotent writes. |
| A09 Logging/Monitoring | ⚠️ Basic logs; no alerting. |
| A10 SSRF | ✅ No user-controlled server-side fetch (Gemini URL is fixed). |

## 21. Security Checklist (pre-release)

- [ ] `privacy_hardening.sql` + `rls_lockdown.sql` + `storage_hardening.sql` run (in order, last).
- [ ] `make_admin.sql` run for the admin account.
- [ ] Edge Functions deployed with current CORS + error redaction; `ALLOWED_ORIGINS` includes prod domain.
- [ ] Vercel env vars set + redeploy; security headers live.
- [ ] No `VITE_`-prefixed server secret; `.env` gitignored.
- [ ] Gemini key rotated if ever exposed.
- [ ] Supabase Auth rate limits + OAuth redirect URLs configured.

## 22. Disaster Recovery

See `DATABASE.md` §14 + `DEPLOYMENT.md`. Priorities: restore Supabase snapshot →
re-apply security migrations → re-grant admin → export/verify `verified_leads`.

## 23. Future Security Improvements

- Automated dependency + secret scanning in CI.
- Abuse/bot detection + alerting on `api_usage` spikes.
- httpOnly-cookie auth to shrink the localStorage-token XSS surface.
- Automated Gemini key rotation.
- Move `cached_leads` behind a definer function (remove cross-user PII read).
