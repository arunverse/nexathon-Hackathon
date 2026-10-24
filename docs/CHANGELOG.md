# EBEXTA CHANGELOG.md

> Every code / DB / API / architecture / dependency change. Newest first.
> Format: `## [date] title` + bullets tagged (feat/fix/security/db/docs/chore).
> Going forward: no change ships without a CHANGELOG entry.

---

## [2026-07-22] White-label AI: remove "Gemini" from the UI
- chore(brand): replaced all user-visible "Gemini" strings with "EBEXTA" email
  generator spinner/tooltip, Signal Watch copy, Onboarding filters copy, scan quota
  error, Admin API subtitle/empty-state, and the model meters ("EBEXTA Lite/Pro").
- chore(brand): console/thrown-error strings genericized (`[Gemini]`→`[EBEXTA]`,
  proxy/email errors). Comments + internal identifiers left as-is (stripped/minified
  out of the production bundle).
- note: the Edge Function endpoint name (`/functions/v1/gemini`) and model IDs sent in
  request bodies are still visible in the Network tab; fully hiding them needs an
  Edge-Function rename + server-side model mapping (optional follow-up).

## [2026-07-22] Documentation suite
- docs: added `docs/` single source of truth ARCHITECTURE, DATABASE, SECURITY,
  ERROR_HANDLING, PHASES, PROMPTS, API, TESTING, DEPLOYMENT, DECISIONS, CODE_STANDARDS,
  PROJECT_RULES, KNOWN_ISSUES, CHANGELOG, README.
- docs: grounded entirely in the current code, migrations, and Edge Functions.

## [prior] Responsive QA pass
- fix(responsive): admin console → off-canvas drawer + hamburger; content `md:ml-[220px]`.
- fix(responsive): Stats page width made responsive; all `grid-cols-12`/`col-span` stack < lg.
- fix(responsive): Discovery two-sidebar layout stacks; removed `w-full` + `ml-[240px]` overflow.
- fix(responsive): admin/dashboard KPI grids given responsive prefixes; `p-8 → p-4 md:p-8`;
  mobile hamburger clearance on page headers.
- fix(responsive): Lead Detail business-impact metrics/deal-size/justification wrap+shrink guards.

## [prior] Branding
- feat(brand): new EBEXTA wordmark identity (emerald "G"), K app-icon + favicon; sidebar mark;
  replaced default template favicon; `theme-color` + real title/description.

## [prior] Admin verification & data flow
- feat(admin): verification persists stamps the lead (`ebexta_verified`), badge in monitor,
  reopen prefilled, partial-person merge, last-saved timestamp.
- fix(admin): collision-proof pool save (delete-then-insert on `source_lead_id`).
- fix(auth): admin screen no longer unmounts on tab-refocus (re-check only on identity change).
- db: `verified_badge.sql` (ebexta_verified/verified_at cols, unique index, admin update policy).
- fix(auth): profile row always ensured on auth → `plan_requests` FK violation gone;
  db: `fix_plan_requests_fk.sql`, `fix_lead_saving.sql`.
- feat(plan): pending screen polls live → activation moves user to Welcome without re-login.
- feat(ui): reusable `PhoneField` with country code (+91 default).

## [prior] Lead pipeline: backend-first + evidence-first
- feat(scan): serve verified pool first; live-generate only the shortfall; charge credits for pool leads.
- feat(scan): evidence-first enrichment prompt; real Google grounding URLs as evidence
  (distinct from funding); Manual Review on weak evidence.
- feat(scan): pipeline calibration into band spread (~14 leads target).
- fix(scan): Generate More respects `excludeCompanies` (no duplicates); clearer quota errors.
- feat(onboarding): company description limit 500 → 1500 (all save paths).

## [prior] Security hardening (pre-launch)
- security: removed dev-admin email bypass (`is_admin` only); removed `main.tsx` test redirect.
- security(headers): CSP `script-src 'self'` (externalized inline script), HSTS, frame DENY, nosniff.
- security(edge): CORS allowlist (never `*`); error responses generic + `cid`, detail server-side.
- security(db): `rls_lockdown.sql` (owner-scoped RLS, closes IDOR), `privacy_hardening.sql`
  (profiles cross-user via definer view only), `storage_hardening.sql` (upload limits).
- security: removed unused Razorpay + Sentry/PostHog/Resend/Perplexity keys/code.

## [prior] Core product
- feat: bilateral matching, two-pass grounded scan, dashboard, lead detail, inbox chat,
  signals, dossiers, admin console, plan-request flow, onboarding, verified pool.

> Note: entries above "[2026-07-22]" summarize development history reconstructed from the
> codebase and prior work; going forward each change adds a precise dated entry.
