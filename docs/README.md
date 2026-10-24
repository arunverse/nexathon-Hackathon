# EBEXTA Documentation Index

> This `docs/` folder is the **single source of truth** for EBEXTA and is considered part
> of the application. Whenever code, database, APIs, or architecture change, the matching
> document(s) and `CHANGELOG.md` must be updated **in the same change**. A task is not done
> until the docs reflect reality.

## What EBEXTA is
A bilateral B2B lead-intelligence platform: it matches Seekers with Providers, shows each
side only the *opposite* side, and backs every lead with real public evidence with the
best leads human-verified by the EBEXTA team and served from EBEXTA's own network first.

## Read in this order
1. **ARCHITECTURE.md** system, frontend/backend, routing, AI, request lifecycle.
2. **DATABASE.md** tables, RLS, functions, triggers, migrations, run order.
3. **SECURITY.md** auth, RLS, secrets, OWASP, checklists.
4. **API.md** PostgREST, RPCs, Edge Functions.
5. **PROMPTS.md** every AI prompt + guardrails.
6. **ERROR_HANDLING.md** every failure mode + response.
7. **DEPLOYMENT.md** run, build, deploy, rollback, recover.
8. **TESTING.md** strategy + manual checklists + regression watch-list.
9. **PHASES.md** roadmap.
10. **DECISIONS.md** architecture decision record (don't undo without a new ADR).
11. **CODE_STANDARDS.md** conventions.
12. **PROJECT_RULES.md** non-negotiable rules.
13. **KNOWN_ISSUES.md** bugs, tech debt, risks.
14. **CHANGELOG.md** every change, newest first.

## Fast facts
- **Stack:** React 19 + Vite 8 + TS 6 + Tailwind v4 + React Router 7; Supabase (Postgres/Auth/
  Edge Functions/Storage); Google Gemini (grounded) via an Edge Function proxy.
- **Hosting:** Vercel (static SPA, `master` branch); backend on Supabase.
- **Secrets:** browser holds only public Supabase URL + anon key; Gemini + service-role keys
  live only in Edge Function secrets.
- **Security boundary:** Row Level Security (owner-scoped) + `is_admin()` server checks.
- **Run migrations** in `DATABASE.md` §11 order; security finals (`privacy_hardening`,
  `rls_lockdown`, `storage_hardening`) **last**.

## Maintenance rule
> Documentation must be detailed enough that a senior engineer who has never seen this
> project can understand, maintain, extend, secure, deploy, and scale it without asking a
> single question. If a change makes any doc inaccurate, fix the doc in the same change.
