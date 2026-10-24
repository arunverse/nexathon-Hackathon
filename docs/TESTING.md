# EBEXTA TESTING.md

> Testing handbook. **Current state: no automated test suite exists** (this is the top
> technical-debt item see `KNOWN_ISSUES.md`). This document defines the strategy and the
> manual checklists in use today, and the target automated coverage.

---

## Testing strategy (target)

| Layer | Tool (recommended) | Scope |
|---|---|---|
| Unit | Vitest | Pure logic: `scanEngine` scoring/calibration, `sanitize`, `urlUtils`, `billingPeriod`, `loadLeads`. |
| Integration | Vitest + Supabase test project | RPC auth (is_admin gates), RLS ownership, Edge Function contracts. |
| E2E | Playwright | Auth → plan gate → onboarding → scan → dashboard → lead detail → admin verify. |
| Responsive | Playwright viewports | 320 → 2560px, key screens. |
| Accessibility | axe-core | Contrast, roles, keyboard nav. |
| Security | manual + scripts | RLS ownership (cross-user reads must fail), IDOR, CORS. |

## Current QA = manual. Release checklist

- [ ] `npm run build` passes (typecheck clean).
- [ ] Login (email + Google), signup → profile row created.
- [ ] Plan request → admin activate → user lands on Welcome live (no re-login).
- [ ] Onboarding as Provider → scan → dashboard shows **seeker** leads (opposite side).
- [ ] Onboarding as Seeker → scan → dashboard shows **provider** leads.
- [ ] Refresh on `/dashboard` stays on dashboard (not onboarding).
- [ ] Lead detail: evidence links present + distinct from funding; scores spread across bands.
- [ ] Generate More returns NEW companies (no duplicates).
- [ ] Admin Leads Monitor shows new leads; verify a lead → sticks (badge) + reopen prefilled.
- [ ] Inbox chat works both directions; attachment upload respects 10 MB + type.
- [ ] Account deletion wipes data + local storage.

## Regression watch-list (bugs that recurred verify each release)

- Seeker/Provider mode desync (dashboard/sidebar read `ebexta_scan_filters.mode`).
- Refresh → onboarding (must NOT happen; sticky `ebexta_onboarded`).
- Admin verify form lost on tab switch (draft autosave + reopen must hold).
- Duplicate `verified_leads` (delete-then-insert on `source_lead_id`).
- Plan request FK violation (profile always ensured).
- Silent lead-save failure (columns must match `fix_lead_saving.sql`).

## Responsive tests

Viewports: 320, 360, 375, 390, 412, 768, 1024, 1280, 1440, 1920, 2560.
Screens: Landing, Login, Onboarding, Dashboard, Lead Detail, Inbox, Stats, Admin (all).
Check: no horizontal scroll, no overlap/clip, drawers work, tables scroll, grids stack.

## Security tests (manual, per release)

- As a normal user: `select * from leads/profiles/api_usage` returns ONLY own rows.
- Attempt admin RPC as non-admin → `Forbidden`.
- Upload HTML/SVG or >10 MB to chat → rejected.
- Confirm no `VITE_`-prefixed server secret in the built bundle.

## Performance / load / stress (target)

- Scan latency budget: two-pass grounded ≈ 1–3 min at ~14 leads (documented tradeoff).
- Load test PostgREST reads + `gemini` rate limits before a large launch.

## Browser / mobile testing

- Chrome, Safari, Firefox, Edge (desktop) + iOS Safari + Android Chrome.
- Test in Incognito to avoid browser-extension console noise (not app errors).
