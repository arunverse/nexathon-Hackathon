# EBEXTA ARCHITECTURE.md

> Master blueprint. Single source of truth for how EBEXTA is built.
> Whenever code changes, this document must be updated in the same change.

---

## 1. System Overview

**EBEXTA** ("by Ebexta") is a **bilateral B2B lead-intelligence platform**. It matches
two sides of a market and only ever shows a user the *opposite* side:

- **Seeker** a business that *needs* a service → EBEXTA shows it **Providers**.
- **Provider** a business that *offers* a service → EBEXTA shows it **Seekers (clients)**.

The product's promise is **originality and verifiable trust**: every lead is backed
by real, public evidence (the pages the AI actually visited), and the best leads are
**human-verified by the EBEXTA admin team** and served from EBEXTA's own network before
any AI is spent.

It is delivered as a **single-page web application** (SPA) with a **serverless backend**
(Supabase). There is no custom application server all privileged logic runs in
Supabase Edge Functions and Postgres `SECURITY DEFINER` functions.

---

## 2. Business Architecture

| Actor | Description | Entry point |
|---|---|---|
| **Visitor** | Unauthenticated. Sees marketing + demo. | `/`, `/home` |
| **User (Seeker/Provider)** | Authenticated + active plan. Runs scans, gets leads, does outreach, chats. | `/dashboard` |
| **Admin** | `profiles.is_admin = true`. Monitors all users/leads, verifies leads, activates plans, delivers dossiers. | `/admin` |
| **EBEXTA team (ops)** | Humans who verify contacts and activate plans (sales-led, no self-serve billing). | Admin console |

**Revenue model:** sales-led. Users request a plan; the admin activates credits
manually after a session. Credits are consumed per AI call. No online payment processor
is wired (Razorpay was removed see `DECISIONS.md`).

**The originality flywheel (core moat):**
1. Users scan → leads land in the Admin **Leads Monitor**.
2. Admin verifies the good ones → they enter the **Verified-by-EBEXTA pool**.
3. The next user with similar filters is served those human-verified leads **first**,
   at near-zero API cost, with a "Verified by EBEXTA" badge.
4. Trust compounds; EBEXTA's Gemini bill drops while credit revenue stays full.

---

## 3. Technical Architecture (high level)

```
┌─────────────────────────────────────────────────────────────┐
│  BROWSER (Vercel-hosted static SPA)                          │
│  React 19 + Vite 8 + Tailwind v4 + React Router 7           │
│  Auth session (Supabase JS, localStorage)                 │
│  Per-mode lead cache (localStorage)                       │
│  Calls Supabase: PostgREST (RLS), RPC, Edge Functions     │
└───────────────┬─────────────────────────────┬───────────────┘
                │ HTTPS (anon key + JWT)        │ HTTPS (JWT)
                ▼                               ▼
┌───────────────────────────┐   ┌─────────────────────────────┐
│  SUPABASE POSTGREST + RLS │   │  SUPABASE EDGE FUNCTIONS     │
│  profiles, leads, scans │   │  (Deno, service-role key)   │
│  conversations/messages │   │  • gemini  → Gemini proxy   │
│  SECURITY DEFINER RPCs  │   │  • account → privileged     │
│  Storage (chat files)   │   │    profile writes / delete  │
└───────────────────────────┘   └───────────────┬─────────────┘
                                                 │ HTTPS (server key)
                                                 ▼
                                    ┌──────────────────────────┐
                                    │  GOOGLE GEMINI API        │
                                    │  + Google Search grounding│
                                    └──────────────────────────┘
```

**Golden rule:** the browser never holds a privileged secret. The Gemini key and the
Supabase service-role key live only in Edge Function secrets. The browser holds only
the public `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY`, and access is governed by RLS.

---

## 4. Frontend Architecture

- **Framework:** React 19.2, function components + hooks only (no class components except error boundaries if added).
- **Build:** Vite 8 (`@vitejs/plugin-react`), TypeScript 6 (`tsc -b && vite build`).
- **Styling:** Tailwind CSS v4 via `@tailwindcss/vite`; design tokens as CSS variables in `src/index.css` (`@theme`). Theme: "Intelligence Boutique" navy `#1D2636`, steel `#93A5B4`, emerald `#2D6A4F` (verified), cream surfaces, Geist/Geist Mono fonts.
- **Animation:** framer-motion 12.
- **Charts:** recharts 3 (Stats page).
- **Validation:** zod 4 (AI response schemas).
- **Sanitization:** dompurify 3 (`src/lib/sanitize.ts`).
- **Docs/exports:** jspdf 4 + docx 9 (dossier/pitch export).
- **Routing:** react-router-dom 7, `BrowserRouter`.

### Component hierarchy (top-down)

```
main.tsx
 └─ ThemeProvider
     └─ App (BrowserRouter)
         └─ AuthProvider
             └─ Layout
                 └─ Routes
                     ├─ Public: LandingPage, Login, Signup
                     ├─ ProtectedRoute → ChoosePlan
                     ├─ Gated (ProtectedRoute + PlanGate):
                     │    Welcome, Onboarding{Profile,Filters,Geography},
                     │    DeepScanActive (/scan),
                     │    IntelligenceHub (/dashboard) + Sidebar,
                     │    LeadDetail, Inbox, Stats, Intent, Discovery,
                     │    Settings, RenewPlan, Signals, Verified, Saved …
                     └─ AdminRoute → AdminLayout (Outlet)
                          └─ AdminOverview, Requests, Dossiers, Queue,
                             Users, Leads, VerifiedLeads, Api, Intents, Logs
```

### Module responsibilities (`src/`)

| Path | Responsibility |
|---|---|
| `main.tsx` | React root, mounts providers. |
| `App.tsx` | Route table + gate composition (`Gated = ProtectedRoute + PlanGate`). Config-error screen if env missing. |
| `contexts/AuthContext.tsx` | Session, user, `isAdmin`, profile bootstrap, sign-in/up/out. Single source of auth truth. |
| `contexts/ThemeContext.tsx` | Theme (light/dark) preference. |
| `components/auth/*` | `ProtectedRoute` (session gate), `PlanGate` (active-plan + onboarded gate), `AdminRoute` (is_admin gate). |
| `components/layout/Sidebar.tsx` | Dashboard nav, mode toggle, unread badge, mobile drawer. |
| `pages/*` | Route screens (public, onboarding, dashboard, admin). |
| `lib/scanEngine.ts` | **Core lead pipeline** backend-first fetch, two-pass grounded discovery + enrichment, scoring, calibration, persistence. |
| `lib/geminiProxy.ts` / `lib/gemini.ts` | Client → `gemini` Edge Function (grounded + non-grounded). |
| `lib/supabase.ts` | Supabase client (graceful when unconfigured). |
| `lib/adminLog.ts` | `api_usage` + `system_logs` writers (non-fatal). |
| `lib/sanitize.ts` | Input sanitization helpers (dompurify). |
| `lib/loadLeads.ts` | Per-mode localStorage lead cache reader. |
| `lib/plans.ts`, `billingPeriod.ts`, `senderProfile.ts`, `savedLeads.ts`, `urlUtils.ts`, `linkVerifier.ts` | Domain helpers. |

---

## 5. Backend Architecture

There is **no monolithic server**. The backend is Supabase:

1. **PostgREST + RLS** the browser queries tables directly with the anon key; every
   table has Row Level Security so users only see their own rows (admins see all). See
   `DATABASE.md` and `SECURITY.md`.
2. **SECURITY DEFINER RPC functions** privileged, checked operations callable via
   `supabase.rpc(...)`: `ebexta_request_plan`, `ebexta_activate_request`,
   `admin_update_profile`, `ebexta_admin_delete_user/row`, `ebexta_start_conversation`,
   `ebexta_mark_read`, `ebexta_matched_intents`, `ebexta_request_dossier`,
   `ebexta_deliver_dossier`, `ebexta_save_company_profile`, `ebexta_mark_onboarded`, etc.
3. **Edge Functions (Deno)** hold server secrets:
   `gemini` the only path to the Gemini API. Enforces JWT auth, per-user credit
     limit + monthly reset, per-action rate limits, daily model cap, CORS allowlist.
     Returns `{ text, tokensUsed, sources }` (grounding sources).
   `account` privileged profile writes (`redeem_coupon`, `admin_update`,
     `delete_account`). JWT + is_admin checks.
   `_shared/cors.ts` shared CORS helper.
4. **Storage** private `chat-attachments` bucket (participant-scoped RLS, signed URLs,
   10 MB + MIME allowlist).

---

## 6. Routing Architecture

Defined in `src/App.tsx`. Gate composition:

- `ProtectedRoute` → requires a Supabase session, else `→ /login?next=…`.
- `PlanGate` → requires `plan_status ∈ {active, trial}` (not expired) else `→ /choose-plan`;
  and `onboarded` else `→ /welcome`. Granted emails bypass. Sticky local `ebexta_onboarded`
  marker prevents refresh from re-triggering onboarding.
- `Gated = ProtectedRoute + PlanGate`.
- `AdminRoute` → requires `profiles.is_admin = true`.

| Route | Component | Gate |
|---|---|---|
| `/`, `/home` | LandingPage | public |
| `/login`, `/signup` | Login, Signup | public |
| `/choose-plan` | ChoosePlan | ProtectedRoute |
| `/welcome` | Welcome | Gated |
| `/onboarding`, `/onboarding/filters`, `/onboarding/geography` | Onboarding* | Gated |
| `/scan` | DeepScanActive | Gated |
| `/dashboard` | IntelligenceHub | Gated |
| `/dashboard/lead/:id` (+ `/report`, `/email`) | LeadDetail, NeuralMatchReport, NeuralEmailEditor | Gated |
| `/dashboard/inbox` | InboxSentiment | Gated |
| `/dashboard/stats` | IntelligenceStats | Gated |
| `/dashboard/intent` | DeclaredIntentBoard | Gated |
| `/dashboard/discovery` | GlobalIntelligenceDiscovery (Outreach) | Gated |
| `/dashboard/settings` | Settings | Gated |
| `/dashboard/renew` | RenewPlan | Gated |
| `/dashboard/signals` | SignalWatch | Gated |
| `/dashboard/verified` | VerifiedContactsPage | Gated |
| `/dashboard/saved` | SavedLeads | Gated |
| `/dashboard/billing`, `/dashboard/invoices` | → redirect to `/dashboard/renew` | |
| `/admin` (+ nested) | AdminLayout + pages | AdminRoute |
| `*` | → `/` | |

---

## 7. State Management

- **No Redux/Zustand.** State is local (`useState`/`useReducer`) + React context for
  cross-cutting concerns (`AuthContext`, `ThemeContext`).
- **Server state** is read on demand via Supabase (no global cache library).
- **Client persistence (localStorage):**
  Supabase auth session (managed by supabase-js).
  `ebexta_leads_seeker` / `ebexta_leads_provider` per-mode lead cache (the dashboard's primary source of truth for what's shown).
  `ebexta_scan_filters` the current scan mode + filters (the authoritative "mode" the dashboard/sidebar read).
  `ebexta_onboarded` sticky "onboarding done" marker.
  `ebexta_email_<leadId>` outreach drafts.
  `ebexta_admin_verify_draft_<leadId>` / `ebexta_admin_verify_open` admin verify autosave + reopen.
- On sign-out and account deletion, **all `ebexta_*` keys are wiped** (privacy).

---

## 8. AI Architecture

See `PROMPTS.md` for the full prompt catalogue. Summary:

- **All Gemini traffic** goes through the `gemini` Edge Function (`callGeminiProxy`). The
  browser never sees the key.
- **Two-pass discovery** (`scanEngine.ts`):
  1. **Pass 1 names only** (1 grounded call): discover up to 16 real company names.
  2. **Pass 2 per-company enrichment** (1 grounded call each, batched): full verified
     detail + contacts + evidence for each company.
- **Grounding = Google Search tool.** The real URLs Gemini visited
  (`groundingMetadata.groundingChunks[].web.uri`) are captured server-side and returned
  as the lead's **evidence links** genuine proof, distinct from the funding URL.
- **Evidence-first system prompt:** the enrichment prompt instructs Gemini to behave as
  EBEXTA's "Lead Verification & Evidence Intelligence Engine" no evidence = invalid;
  never match on industry alone; never fabricate contacts; flag weak evidence as
  `manualReview` (→ Manual Review status).
- **Scoring:** signal-keyword scoring across all enriched fields + Gemini's own grounded
  `intentScore` floor + attribute-based discovery baseline. Final set is **calibrated**
  into a realistic band spread (~3 high / 5 strong / 4 moderate / 1–2 low per 14 leads).
- **Models:** `gemini-flash-latest` and `gemini-flash-lite-latest` (allowlisted in the Edge Function).

---

## 9. Authentication Flow

1. User signs up/in via `supabase.auth` (email+password or Google OAuth).
2. `AuthContext.onAuthStateChange` fires; a `profiles` row is ensured (client
   `createProfileIfNotExists` + DB `handle_new_user` trigger, both idempotent).
3. `ProtectedRoute` reads the session; no session → `/login?next=…`.
4. Supabase issues a JWT (default 1h) + refresh token; stored in localStorage by
   supabase-js. Sign-out revokes the refresh token and wipes `ebexta_*` keys.

Full detail + JWT lifecycle: `SECURITY.md`.

## 10. Authorization Flow

- **Row level:** every request carries the JWT; Postgres RLS restricts rows to
  `auth.uid()` (or `is_admin()`).
- **Column level:** `secure_profiles.sql` REVOKEs UPDATE on privileged columns
  (`is_admin`, `credits`, `credit_limit`, `plan`, `is_blocked`, …) only the service
  role (Edge Functions / RPCs) can write them.
- **Cross-user reads** flow only through the `network_profiles` definer view (safe
  columns) and `ebexta_matched_intents()` never the raw `profiles` row.
- **Admin actions** are gated twice: `AdminRoute` (UI) + `is_admin()` inside every
  privileged RPC/Edge Function (server).

---

## 11. Request Lifecycle (example: a scan)

```
User clicks "Run Scan" (DeepScanActive)
  → read ebexta_scan_filters (mode + filters)
  → runScan(filters) [scanEngine.ts]
     1. fetchEbextaVerifiedLeads()  → Supabase (verified pool, opposite side)   [0 AI cost]
     2. if pool covers TARGET(14) → done; else compute shortfall
     3. checkCache()               → cached_leads (shared 7-day cache)
     4. discoverTwoPass():
          Pass 1 discoverNames()   → gemini Edge Fn (grounded)   → 16 names
          Pass 2 enrichOne() ×N    → gemini Edge Fn (grounded)   → detail + evidence
     5. scoreLeads() → matchDeclaredIntents() → merge pool + generated
     6. calibratePipeline() → band spread
     7. logApiUsage() per pool lead (credit charge)
     8. persist scans + leads rows (Supabase, RLS)  [non-fatal]
     9. write ebexta_leads_<mode> (localStorage)
  → navigate /dashboard → IntelligenceHub reads ebexta_leads_<mode>
```

Every `gemini` call inside: JWT verified → credit limit checked → rate limit checked →
daily cap checked → Gemini called → `api_usage` row logged (server-side).

---

## 12. API Architecture

Three API surfaces (full spec in `API.md`):
1. **PostgREST** (auto-generated REST over tables, governed by RLS).
2. **RPC** (`supabase.rpc('fn', args)` → `SECURITY DEFINER` Postgres functions).
3. **Edge Functions** (`supabase.functions.invoke('gemini'|'account', …)`).

---

## 13. Deployment Architecture

- **Frontend:** Vercel (static SPA). `vercel.json` = SPA rewrite to `/index.html` +
  security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy).
- **Backend:** Supabase (managed Postgres + Auth + Edge Functions + Storage).
- **Git:** remote `github.com/arunverse/ebexta-app`; Vercel builds the `master` branch;
  push via `git push origin main:master`.
- **Env:** Vercel env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`); Supabase
  secrets (`GEMINI_API_KEY`, `ALLOWED_ORIGINS`, service role auto-injected).

Full runbook: `DEPLOYMENT.md`.

---

## 14. Third-Party Integrations

| Service | Purpose | Where the secret lives | Data sent |
|---|---|---|---|
| **Supabase** | Auth, Postgres, Edge Functions, Storage | Client: public URL+anon; Server: service role | All app data |
| **Google Gemini + Search** | Lead discovery/enrichment grounding | Edge Function secret `GEMINI_API_KEY` | Business mission + company names (never user account email) |
| **Google OAuth** | Social sign-in | Supabase Auth config | Email, name, avatar |
| **Vercel** | Static hosting/CDN | | |

*Not integrated:* Razorpay (removed), Resend/Sentry/PostHog/Perplexity (keys were removed as unused see `DECISIONS.md`).

---

## 15. Build Pipeline

`npm run build` → `tsc -b` (typecheck, project references: `tsconfig.app.json`,
`tsconfig.node.json`) → `vite build` → `dist/`. Vercel runs this on push to `master`.
`emptyOutDir: false` (avoids EPERM on locked files).

---

## 16. Dependency Graph (key edges)

```
App → AuthContext → supabase.ts
pages/* → lib/* → geminiProxy → supabase.functions('gemini')
scanEngine → geminiProxy, gemini, urlUtils, linkVerifier, adminLog, supabase
LeadCard/LeadDetail → scanEngine types, savedLeads, leadIntel
admin/* → supabase (RLS-gated reads), adminActions (RPCs)
```

---

## 17. Data Flow (summary)

- **PII in:** signup email/password (→ Supabase Auth, bcrypt); company profile,
  mission, work email, phone (→ `profiles`, `plan_requests`); chat messages/attachments.
- **PII stored:** Postgres (`profiles`, `leads`, `plan_requests`, `messages`, …) +
  localStorage (cached leads, filters).
- **PII egress:** only Supabase + Google (mission + company names). No analytics/email/payment egress.
- Full map: `SECURITY.md` §Data Flow.

---

## 18. Scalability Strategy

- **Reads** scale with Supabase/PostgREST + indexes (see `DATABASE.md`).
- **AI cost** is bounded by: backend-first serving (verified pool before Gemini),
  shared `cached_leads` (7-day), per-user credit limits, per-action rate limits, and a
  daily model cap in the Edge Function.
- **Stateless frontend** → CDN-scalable via Vercel.
- **The verified pool** turns AI cost into a decreasing function of usage over time.

---

## 19. Performance Strategy

- Per-mode localStorage cache → instant dashboard load, no refetch.
- Grounded enrichment batched (1 company/call with pacing) to stay under free-tier RPM.
- GPU-isolated CSS backgrounds, `transform: translateZ(0)`, reduced blur; framer-motion
  used sparingly. Responsive grids avoid layout thrash.

---

## 20. Future Architecture Considerations

- Move server secrets fully out of the local `.env` into Supabase secrets only.
- Add a proper CI pipeline (typecheck + lint + build gate) see `DEPLOYMENT.md`.
- Consider a queue/cron for verified-pool freshness (auto-expire + re-verify).
- Introduce automated tests (currently none see `TESTING.md`, `KNOWN_ISSUES.md`).
- Consider server-rendered auth (httpOnly cookies) to reduce the localStorage-token XSS surface.
- Key rotation automation for the Gemini key.
