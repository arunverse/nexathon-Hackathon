# EBEXTA ERROR_HANDLING.md

> Every failure mode and how the system responds. Update when handling changes.

---

## Principles

1. **Never leak internals to the client.** Edge Functions log full detail server-side with
   a correlation id (`cid`) and return a generic message + `cid`.
2. **Degrade gracefully.** Non-fatal paths (lead persistence, logging) never block the user;
   the app keeps working from localStorage.
3. **Surface the real reason when actionable.** Quota/rate-limit/config errors get specific,
   user-facing messages.

---

## Frontend errors

- **Config missing:** if `VITE_SUPABASE_URL`/`ANON_KEY` are absent, `App.tsx` renders a
  full-screen "Configuration error" instead of a blank/broken UI.
- **Auth failures:** Login/Signup catch and show `error.message` (Supabase messages are safe/generic).
- **Route guards:** no session → `/login?next=…`; no plan → `/choose-plan`; not onboarded → `/welcome`.
- **Error boundaries:** *not yet implemented app-wide* recommended (see `KNOWN_ISSUES.md`).

## Backend / Edge Function errors

- `gemini`: 401 (no/invalid JWT), 403 `ACCOUNT_BLOCKED`, 429 `QUOTA_EXCEEDED`/rate/daily,
  500 (`GEMINI_API_KEY missing`), 502 `UPSTREAM` (generic + `cid`; Google's raw error logged server-side).
- `account`: 401, 403 (Forbidden / not admin), 400 (generic + `cid`).

## Database errors

- RLS denials return empty result sets (not errors) the UI treats "no rows" as empty state.
- FK violations (e.g. missing profile → `plan_requests`) fixed structurally (profile always ensured;
  `fix_plan_requests_fk.sql`). Deletes must respect FK order (`reset_all_leads.sql`).
- Lead save is **non-fatal** logged loudly (`console.error` with cid-style context); leads
  still render from localStorage. Missing columns were the silent-save bug (`fix_lead_saving.sql`).

## Authentication / Authorization errors

- Expired/invalid JWT → 401 → client redirect to login.
- Insufficient role → RPC/Edge `Forbidden`; UI never shows admin controls to non-admins.

## AI errors

- Grounded call retries (503/500/429/timeout, backoff); daily-quota 429 is fatal.
- Grounded failure → non-grounded fallback → salvage to MIN_LEADS (never silently return < MIN_LEADS).
- `DeepScanActive`/`Generate More` translate quota errors to "Daily AI limit reached try
  again after the reset" instead of a misleading "nothing found".
- Malformed JSON from the model → `extractJson` throws → retried; persistent failure → salvage.

## Network / offline

- Supabase calls fail → caught per-call; the dashboard falls back to the localStorage lead cache.
- No dedicated offline mode; the app requires connectivity for scans/auth.

## Validation errors

- AI output: zod (`RawLeadSchema`) invalid leads dropped/salvaged.
- Forms: client-side required checks (plan request, signup); phone normalized.
- URLs: `linkVerifier`/`urlUtils` reject fake/placeholder links.

## Null handling

- Optional lead fields default (`?? null` / zod defaults); UI uses `?.`/`??` and empty-state fallbacks.
- Missing profile row is prevented (always ensured on auth).

## Retry / fallback / recovery logic

- **Retry:** grounded AI calls (scanEngine); enrichment second-chance pass.
- **Fallback:** verified pool → cache → grounded → non-grounded → salvage.
- **Recovery:** admin verify drafts autosave + reopen; sticky onboarding marker; profile backfill SQL.

## Loading / empty / error states

- Loading: spinners/skeletons (dashboard KPI skeletons, page spinners).
- Empty: explicit empty states ("No leads yet run a scan", "No verified leads yet", etc.).
- Error: inline messages; toast confirmations for admin actions.

## Monitoring / crash recovery / logging strategy

- `system_logs` (events) + `api_usage` (AI calls) in Postgres.
- Edge Function logs in Supabase (server-side, cid-correlated).
- **Gap:** no external error tracker (Sentry removed as unused) or alerting see `KNOWN_ISSUES.md`.
