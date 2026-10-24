# EBEXTA DATABASE.md

> Complete database documentation. Postgres on Supabase.
> Source of truth = the SQL files in `supabase/*.sql`. This doc summarizes them;
> when a migration changes, update this file in the same change.

---

## 1. Overview

- **Engine:** PostgreSQL (Supabase managed), TLS-enforced, no public unauthenticated port.
- **Access:** browser → PostgREST with the anon key, governed by **Row Level Security (RLS)**.
- **Privileged writes:** only via `SECURITY DEFINER` RPC functions or Edge Functions (service role).
- **Migrations:** plain `.sql` files run manually in the Supabase SQL Editor (no migration
  tool wired). Order matters see §11. Each ends with `NOTIFY pgrst, 'reload schema';`.

---

## 2. ER Diagram (logical)

```
auth.users (Supabase)
   │ 1:1 (id)
   ▼
profiles ──1:N──► scans ──1:N──► leads ──1:N──► outreach
   │                                   │
   │                                   └──1:N──► saved_leads
   ├──1:N──► declared_intents
   ├──1:N──► signal_watches ──match──► signal_matches
   ├──1:N──► verification_requests
   ├──1:N──► verified_contacts
   ├──1:N──► plan_requests
   ├──1:N──► api_usage
   ├──1:N──► system_logs
   ├──1:N──► payments               (legacy, unused)
   └──1:N──► conversations(user_a/user_b) ──1:N──► messages

verified_leads      (admin-curated pool; source_lead_id → leads, nullable)
cached_leads        (shared scan cache keyed by filter_hash)
dossier_requests ──► dossiers   (requester_id/subject_id → auth.users)
network_profiles    (VIEW over profiles safe columns only)
storage.objects     (chat-attachments bucket)
```

---

## 3. Tables (columns, keys, purpose)

> Column lists reflect the cumulative migrations. Types are the effective Postgres types.

### `profiles` (1:1 with `auth.users`)
Central user record. Source: `migrations.sql`, `plan_gate.sql`, `secure_profiles.sql`,
`company_profiles.sql`, `onboarding_flag.sql`, `admin_rpc.sql`, `verified_badge.sql`, etc.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | = `auth.users.id` |
| `company_name` | text | user-editable |
| `sender_email` | text | work email; user-editable |
| `website` | text | user-editable |
| `mission` | text | offering/need (≤1500 chars); user-editable |
| `mode` | text | `seeker`/`provider`; user-editable |
| `company_profile` | jsonb | self-service dossier (12 fields) |
| `plan` | text | tier key |
| `plan_status` | text | `none`/`pending`/`trial`/`active`/`expired` |
| `plan_started_at`, `plan_expires_at`, `plan_valid_until` | timestamptz | plan window |
| `credit_limit` | int | monthly AI ceiling (admin-set) |
| `credits` | int | balance (legacy/coupon) |
| `credits_reset_at` | timestamptz | monthly reset anchor |
| `is_admin` | bool | admin flag (service-role writable only) |
| `is_blocked` | bool | blocks AI use |
| `onboarded` | bool | onboarding complete |
| `updated_at`, `created_at` | timestamptz | |

**Privileged columns** (`is_admin, credits, credit_limit, is_blocked, plan, credits_reset_at, plan_valid_until`) UPDATE revoked from clients (`secure_profiles.sql`); writable only by service role / definer RPCs. User-writable columns: `company_name, sender_email, mission, mode, website, updated_at`.

### `scans`
| Column | Type | Notes |
|---|---|---|
| `id` uuid PK, `user_id` uuid FK→auth.users | | |
| `filters` jsonb, `status` text, `mode` text | | scan parameters + result mode |
| `created_at` timestamptz | | |

### `leads`
Generated + persisted leads (also the admin Leads Monitor source). Columns (from
`fix_lead_saving.sql` which is authoritative):
`id, user_id, scan_id, company_name, industry, location, employee_count, funding_stage,
annual_revenue, website, linkedin_url, email, intent_score, match_score, confidence_score,
verification_status, is_strongly_recommended, trust_score, intent_flags(jsonb),
validation_errors(jsonb), stakeholders(jsonb), description, company_linkedin,
company_twitter, requirement_theme, turnover, revenue_growth, funding_details,
funding_source_url, investment_history, big_projects(jsonb), match_reason(jsonb),
contacts(jsonb), company_stage, company_contact(jsonb), score_breakdown(jsonb),
evidence_source_url, ebexta_verified(bool), verified_at, created_at`.

### `outreach`
Generated outreach emails. `id, user_id, lead_id (FK→leads), … , created_at`.
(FK `outreach_lead_id_fkey` children must be deleted before leads; see `reset_all_leads.sql`.)

### `saved_leads`
Bookmarked leads. `id, user_id, lead_data(jsonb)/lead_id, created_at`.

### `declared_intents`
Publicly-declared needs (drives Signal↔Intent matching). `id, user_id, mode, requirement,
industry_tags(text[]), budget_range, expires_at, created_at`.

### `signal_watches` / `signal_matches`
Watched keywords + matched intents. Owner-scoped (`user_id`).

### `verification_requests`
User requests a human-verified contact. `id, user_id, lead_id?, status, verified_*`.
User reads/creates own; **only admin updates** (delivers verification).

### `verified_contacts`
Admin-delivered verified contacts pool. Owner reads; admin writes.

### `verified_leads` (Verified-by-EBEXTA pool)
Admin-curated leads served first to matching scans.
`id, source_lead_id (→leads, nullable, UNIQUE partial index), company_name, industry, city,
location, employee_count, funding_stage, service_categories(text[]), mode_side, lead_data(jsonb),
verified_stakeholders(jsonb), verified_at`.

### `cached_leads`
Shared scan cache. `filter_hash (key), industry, location, employee_min/max, leads(jsonb),
generated_at, expires_at (7 days)`. **World-readable to authenticated** (by design see KNOWN_ISSUES).

### `plan_requests`
Sales-led plan requests. `id, user_id (FK→auth.users ON DELETE CASCADE), kind, plan,
company_name, website, company_size, industry, contact_name, contact_role, contact_phone,
message, status, created_at, handled_at`.

### `conversations` / `messages` (chat)
`conversations(id, user_a, user_b [both FK→auth.users ON DELETE CASCADE], last_message_at,
UNIQUE(user_a,user_b))`. `messages(id, conversation_id, sender_id FK→auth.users CASCADE, body,
attachment_url/name/type, read_at, created_at)`.

### `dossier_requests` / `dossiers`
`requester_id, subject_id (both FK→auth.users CASCADE), status, content(jsonb), created_at, handled_at`.

### `api_usage`
AI usage meter (drives credit counting + admin cost tracking).
`id, user_id, action, model, tokens_used, calls, created_at`. INSERT self-only; no UPDATE/DELETE.

### `system_logs`
App event log. `id, user_id, event_type, message, metadata(jsonb), created_at`.

### `payments`
Legacy (Razorpay removed). Retained for FK/history; unused.

---

## 4. Views

- **`network_profiles`** cross-user-safe projection of `profiles`. **Final authoritative
  definition:** `privacy_hardening.sql` makes it `security_invoker = off` (definer) exposing
  only `id, company_name, sender_email, mission, mode, website, company_profile, created_at`,
  with the connection check (own / admin / conversation partner / matched-intent) in its
  WHERE clause. Earlier files (`chat_and_signals.sql`, `network_profiles_v2.sql`,
  `chat_v2_and_dossiers.sql`) also define it **`privacy_hardening.sql` must run last.**

---

## 5. Functions (SECURITY DEFINER RPCs)

| Function | Purpose | Authorization |
|---|---|---|
| `is_admin()` | boolean helper used by policies | reads `profiles.is_admin` for `auth.uid()` |
| `handle_new_user()` (trigger) | create profile on signup | definer |
| `ebexta_start_trial()`, `ebexta_set_plan()` | plan gate helpers | self |
| `ebexta_request_plan(plan,kind,details)` | create plan request; set `plan_status=pending` | `auth.uid()` |
| `ebexta_activate_request(id,limit,days)` | activate a request → active plan + credits | `is_admin()` |
| `ebexta_set_request_status(id,status)` | update request status | `is_admin()` |
| `admin_update_profile(user,updates)` | admin edits plan/credits/limit/block/reset | `is_admin()` + column whitelist |
| `ebexta_admin_delete_user(uuid)` | wipe a user + all data + login | `is_admin()`, not self |
| `ebexta_admin_delete_row(table,id)` | delete a row in a whitelisted table | `is_admin()` + `%I`/`$1` |
| `ebexta_mark_onboarded()` | set `onboarded=true` | self |
| `ebexta_save_company_profile(jsonb)` | save `company_profile` | self |
| `ebexta_start_conversation(other)` | create/fetch a conversation | self, canonical ordering |
| `ebexta_mark_read(conversation)` | mark partner messages read | participant |
| `ebexta_unread_count()` | unread count | self |
| `ebexta_matched_intents()` | intents matching the caller's watches (safe columns) | definer, `di.user_id <> auth.uid()` |
| `ebexta_request_dossier(subject)` | request a dossier | self, not own |
| `ebexta_deliver_dossier(req,content)` | deliver dossier | `is_admin()` |
| `ebexta_set_dossier_status(req,status)` | update dossier status | `is_admin()` |

---

## 6. Triggers

- `on_auth_user_created` on `auth.users` AFTER INSERT → `handle_new_user()` (creates profile).
  *May be blocked by Supabase permissions; the client also ensures the profile.*
- `tg_touch_conversation` on `messages` → bumps `conversations.last_message_at`.

---

## 7. Edge Functions

| Function | Runtime | Secrets | Summary |
|---|---|---|---|
| `gemini` | Deno | `GEMINI_API_KEY`, service role, `ALLOWED_ORIGINS` | JWT auth, credit/rate/daily caps, Gemini proxy, returns grounding sources, logs `api_usage`. |
| `account` | Deno | service role, `ALLOWED_ORIGINS` | `redeem_coupon`, `admin_update` (is_admin), `delete_account` (cascade + auth delete). |
| `_shared/cors.ts` | | | CORS helper. |

CORS: allowlist with production domains baked in (`webexta.com`, `www.webexta.com`,
`ebexta.ebexta.com`, localhost) extendable via `ALLOWED_ORIGINS`; never `*`.

---

## 8. Storage Buckets

- **`chat-attachments`** (private). RLS: only conversation participants may upload/read
  (folder = conversationId). Signed URLs (1h). `storage_hardening.sql`: 10 MB
  `file_size_limit` + MIME allowlist (images, pdf, text, Office docs no HTML/SVG).

---

## 9. Row Level Security (current, authoritative)

**Authoritative lockdown:** `rls_lockdown.sql` drops ALL policies on user-owned tables and
recreates owner-or-admin scoped ones:

- `profiles`: SELECT `auth.uid()=id OR is_admin()`; write self (column grants restrict privileged columns).
- `scans, leads, outreach, declared_intents, saved_leads`: SELECT self/admin; ALL write self.
- `verification_requests`: SELECT self/admin; INSERT self; UPDATE admin-only.
- `api_usage, system_logs`: SELECT self/admin; INSERT self-only; no UPDATE/DELETE.
- `verified_contacts`: SELECT self/admin; write admin-only.
- `signal_watches, signal_matches`: owner-scoped.
- `verified_leads`: public read (intended); admin write. `leads admin update` policy
  (`verified_badge.sql`) lets admins stamp any lead verified.
- `cached_leads`: public read to authenticated (intended shared cache flagged risk).
- `conversations/messages`: participant-scoped; `messages` UPDATE via `ebexta_mark_read` RPC only.

> **Historical hazard:** `restore_working_rls.sql`, `fix_migration.sql`, `admin_migration.sql`
> created `USING (true)` open policies. `rls_lockdown.sql` supersedes them and MUST be run
> last. See `SECURITY.md` and `DECISIONS.md`.

---

## 10. Indexes

Defined across migrations (e.g. `idx_conv_a/idx_conv_b` on conversations,
`idx_profiles_admin` partial on `is_admin`, `idx_dreq_status`,
`uniq_verified_source_lead` UNIQUE partial on `verified_leads.source_lead_id`).
Add covering indexes for high-traffic filters (`leads.user_id, scan_id`, `api_usage.user_id, created_at`).

---

## 11. Migration History & Run Order

Migrations are `.sql` files applied manually. **Recommended order** (later files supersede earlier):

1. `migrations.sql` → base tables.
2. `upgrade_v2.sql`, `admin_migration.sql`, `payments_migration.sql`,
   `verified_contacts_migration.sql`, `network_intents_migration.sql`, `fix_migration.sql`.
3. `production_hardening.sql` (defines `is_admin()`, proper RLS).
4. Feature migrations: `plan_gate.sql`, `plan_requests.sql`, `onboarding_flag.sql`,
   `company_profiles.sql`, `chat_and_signals.sql`, `chat_v2_and_dossiers.sql`,
   `network_profiles_v2.sql`, `billing_history.sql`, `user_credit_limits.sql`,
   `admin_rpc.sql`, `admin_full_control.sql`, `admin_account_controls.sql`,
   `secure_profiles.sql`.
5. **Security finals (run last, in this order):** `privacy_hardening.sql`,
   `rls_lockdown.sql`, `storage_hardening.sql`.
6. Fixes as needed: `fix_lead_saving.sql`, `fix_plan_requests_fk.sql`, `verified_badge.sql`.
7. Admin bootstrap: `make_admin.sql` / `grant_enterprise.sql` / `RECOVER_ADMIN.sql`.

**Operational scripts (not schema):** `reset_all_leads.sql` (wipe leads),
`SECURITY_FIXES_2026-07-18.sql`.

> ⚠️ There is no automated migration runner. This ordering is the contract. See
> `KNOWN_ISSUES.md` (migration drift is the #1 operational risk).

---

## 12. Query Optimization

- Prefer explicit column selects over `select('*')` on wide tables.
- The admin Leads Monitor caps at 500 rows; paginate for scale.
- Credit counting uses `count(*, { head: true })` on `api_usage` since the reset anchor.

## 13. Backup Strategy

- Supabase automated daily backups (managed). PITR available on paid tiers.
- `verified_leads` is the crown-jewel data export periodically (it's the moat).

## 14. Restore Strategy

- Restore via Supabase dashboard (point-in-time or daily snapshot).
- After restore: re-run `privacy_hardening.sql` + `rls_lockdown.sql` + `storage_hardening.sql`
  to guarantee RLS state; re-run `make_admin.sql` for admin accounts.

## 15. Performance Improvements (backlog)

- Add composite indexes for `leads(user_id, scan_id)`, `api_usage(user_id, model, created_at)`.
- Move `cached_leads` reads behind a definer function keyed by `filter_hash` (removes the
  cross-user PII read while keeping the cache).
- Consider archiving old `scans`/`leads` beyond N months.
