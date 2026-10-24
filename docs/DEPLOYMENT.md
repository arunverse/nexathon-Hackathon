# EBEXTA DEPLOYMENT.md

> How to run, build, deploy, monitor, and recover EBEXTA.

---

## Local development

```bash
npm install
# .env (gitignored) see .env.example:
#   VITE_SUPABASE_URL=...       (public)
#   VITE_SUPABASE_ANON_KEY=...  (public)
npm run dev        # Vite dev server on http://localhost:4000 (strict port, host: true)
```
Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) are only needed by Edge
Functions, not the frontend. Keep them out of the frontend build.

## Environment variables

| Var | Scope | Where set |
|---|---|---|
| `VITE_SUPABASE_URL` | client | Vercel env (Production) + local `.env` |
| `VITE_SUPABASE_ANON_KEY` | client | Vercel env + local `.env` |
| `GEMINI_API_KEY` | server | Supabase → Edge Functions → Secrets |
| `ALLOWED_ORIGINS` | server | Supabase secret (include `https://www.<prod-domain>`) |
| `SUPABASE_SERVICE_ROLE_KEY` | server | auto-injected into Edge Functions |

> Adding Vercel env vars requires a **redeploy** to take effect.

## Build process

```bash
npm run build      # tsc -b  (typecheck) && vite build  → dist/
npm run preview    # serve the production build locally
```
`vite.config.ts`: port 4000, `outDir: dist`, `emptyOutDir: false`.

## Production build / hosting (Vercel)

- Static SPA hosted on Vercel. `vercel.json`:
  Rewrite `/(.*) → /index.html` (SPA routing).
  Security headers: CSP, HSTS (1y), X-Frame-Options DENY, X-Content-Type-Options nosniff,
    Referrer-Policy, Permissions-Policy.
- Git: remote `github.com/arunverse/ebexta-app`. **Vercel builds the `master` branch.**
  Local work is on `main`; push with:
  ```bash
  git push origin main:master --force
  ```
- Env vars must be set in Vercel (Production) **and** a redeploy triggered.

## Supabase setup

1. Create project; note the URL + anon key + service role key.
2. Run the SQL migrations in the documented order (`DATABASE.md` §11) **security finals last**.
3. Deploy Edge Functions (`gemini`, `account`) paste/deploy in the dashboard or via CLI.
4. Set secrets: `GEMINI_API_KEY`, `ALLOWED_ORIGINS`.
5. Configure Auth: enable email + Google OAuth; add redirect URLs for the prod domain;
   set rate limits.
6. Create the `chat-attachments` bucket (via `chat_v2_and_dossiers.sql`) + `storage_hardening.sql`.
7. Grant admin: `make_admin.sql`.

## Edge Functions

- `gemini` and `account` (Deno). Re-deploy after any change to CORS/error handling/logic.
- They read secrets at runtime, so a secret change (e.g. `ALLOWED_ORIGINS`) takes effect
  without redeploying the function.

## CI/CD

- **Current:** Vercel auto-build on push to `master`. No test/lint gate.
- **Recommended:** GitHub Action running `npm ci && npm run build` (typecheck) + `npm run lint`
  before allowing deploy (see `PHASES.md` Phase 3).

## Rollback

- **Frontend:** Vercel → Deployments → promote a previous successful deployment.
- **Backend logic:** re-deploy the previous Edge Function code; migrations are additive —
  reversing a schema change requires a compensating SQL script.

## Monitoring / health checks / logging

- Supabase logs (Edge Functions, Postgres). Admin console: Overview, API & Cost, System Logs.
- `system_logs` + `api_usage` tables. **Gap:** no uptime/error alerting yet.

## Caching / performance

- Vercel CDN for static assets. Client localStorage lead cache. Shared `cached_leads` (7-day).

## Backup / recovery

- Supabase automated backups; PITR on paid tiers. Export `verified_leads` regularly.
- Recovery runbook: `DATABASE.md` §14.

## Versioning / release workflow

1. Make change on `main`; run `npm run build` (typecheck must pass).
2. Update the relevant `docs/*.md` + `CHANGELOG.md`.
3. Commit; `git push origin main:master --force`.
4. If Edge Functions/SQL changed: deploy functions / run migrations.
5. Verify on the live domain (Incognito to avoid extension noise).
