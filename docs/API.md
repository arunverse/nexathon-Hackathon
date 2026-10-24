# EBEXTA API.md

> All API surfaces. EBEXTA has no custom REST server; APIs are Supabase PostgREST,
> RPC functions, and Edge Functions. Update when any of these change.

---

## Conventions

- **Base:** `https://<project>.supabase.co`
- **Auth:** every call carries `apikey: <anon>` and, when signed in,
  `Authorization: Bearer <jwt>` (added automatically by supabase-js).
- **Access control:** enforced by RLS (tables) or `is_admin()`/`auth.uid()` (RPCs/Edge Fns).

---

## A. PostgREST (auto REST over tables)

Accessed via the supabase-js client, e.g. `supabase.from('leads').select(...)`.
Every table is RLS-governed (`DATABASE.md` §9). Clients may only read/write their own rows;
admins read all. No manual endpoint definitions the contract IS the RLS policy + columns.

Common operations:
| Table | Read | Write |
|---|---|---|
| `profiles` | self (+ admin) | self, non-privileged columns only |
| `leads`, `scans`, `outreach`, `saved_leads`, `declared_intents` | self (+ admin) | self |
| `verification_requests` | self (+ admin) | INSERT self; UPDATE admin |
| `verified_leads` | all authenticated | admin |
| `network_profiles` (view) | connected users (safe columns) | |
| `api_usage`, `system_logs` | self (+ admin) | INSERT self |

---

## B. RPC Functions (`supabase.rpc(name, args)`)

All are `SECURITY DEFINER`, `EXECUTE` granted to `authenticated`, and perform their own
authorization. See `DATABASE.md` §5 for the full list. Key ones:

### `ebexta_request_plan(p_plan text, p_kind text, details jsonb) → uuid`
- **Purpose:** submit a sales-led plan request; sets `plan_status='pending'`.
- **Auth:** `auth.uid()` required. **Errors:** `Not signed in`.

### `ebexta_activate_request(p_request_id uuid, p_credit_limit int, p_days int) → void`
- **Purpose:** admin activates a request → active plan + credits.
- **Auth:** `is_admin()`. **Errors:** `Forbidden`, `Request not found`.

### `admin_update_profile(target_user uuid, updates jsonb) → void`
- **Purpose:** admin edits `plan/credits/credit_limit/is_blocked/credits_reset_at/plan_valid_until`.
- **Auth:** `is_admin()` + column whitelist. **Errors:** `Forbidden`.

### `ebexta_admin_delete_user(uuid)` / `ebexta_admin_delete_row(text, uuid) → void`
- **Purpose:** wipe a user + data; delete one whitelisted row.
- **Auth:** `is_admin()`; delete_row uses `%I`+`$1`; not-self guard on delete_user.

### `ebexta_start_conversation(other uuid) → uuid`, `ebexta_mark_read(conversation uuid)`, `ebexta_unread_count() → int`
- Chat. Participant/self-scoped.

### `ebexta_matched_intents() → table`
- Intents (from other users) matching the caller's active watches. Safe columns only.

### `ebexta_request_dossier(subject uuid) → uuid`, `ebexta_deliver_dossier(req uuid, content jsonb)`, `ebexta_set_dossier_status(req uuid, status text)`
- Dossier flow. Request = self; deliver/status = admin.

### `ebexta_save_company_profile(jsonb)`, `ebexta_mark_onboarded()`
- Self-service profile + onboarding flag.

---

## C. Edge Functions

### `POST /functions/v1/gemini`
- **Purpose:** the ONLY path to Gemini. Grounded/non-grounded generation.
- **Auth:** Bearer JWT (required). **CORS:** allowlist.
- **Body:** `{ action: 'discovery'|'scan'|'enrich'|'email', prompt: string, grounded?: boolean, model?: 'gemini-flash-latest'|'gemini-flash-lite-latest' }`.
- **Response:** `{ text: string, tokensUsed: number, sources: {uri,title}[] }`.
- **Checks (in order):** JWT → `is_blocked` → monthly credit limit (anniversary reset) →
  per-action rate limit → daily model cap → Gemini call → log `api_usage`.
- **Errors:** `401 Unauthorized`; `403 ACCOUNT_BLOCKED`; `429 QUOTA_EXCEEDED` /
  rate-limit / daily-cap; `500 GEMINI_API_KEY missing`; `502 UPSTREAM` (generic + `cid`,
  detail server-side only). Quota errors carry the phrase the client detects.
- **Rate limits:** scan 40/h, discovery 120/h, enrich 600/h, email 120/h; daily model cap 5000.

### `POST /functions/v1/account`
- **Purpose:** privileged profile ops.
- **Auth:** Bearer JWT; `admin_update` also requires `is_admin()`.
- **Actions:**
  `redeem_coupon { code }` → grants credits (server-side coupon table).
  `admin_update { targetUserId, patch }` → whitelisted profile fields.
  `delete_account` → wipes caller's rows + auth user (irreversible).
- **Response:** `{ success: true }` or `{ error, cid }` (generic, detail server-side).

---

## Versioning & Future Changes

- No API version prefix today (single client + backend, deployed together).
- Backward compatibility rule: never remove/rename a table column, RPC arg, or Edge action
  that the deployed client uses without a coordinated client change (see `PROJECT_RULES.md`).
- Future: add pagination params to admin list reads; add a versioned Edge Function if a
  breaking response-shape change is needed.
