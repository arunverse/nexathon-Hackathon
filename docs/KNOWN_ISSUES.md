# EBEXTA KNOWN_ISSUES.md

> Living list. Bugs, tech debt, bottlenecks, risks. Update as items open/close.
> Fields: Item · Type · Risk · Priority · Owner · Expected fix.

## Open High priority
| # | Item | Type | Risk | Fix |
|---|---|---|---|---|
| 1 | **No automated tests** (unit/integration/E2E). | Tech debt | High | Add Vitest + Playwright (PHASES Phase 3). |
| 2 | **Manual SQL migrations, no runner** ordering/drift risk; security finals must run last. | Ops risk | High | Adopt a migration tool or a single ordered bootstrap script. |
| 3 | **No CI gate** (typecheck/lint/build not enforced before deploy). | Ops risk | High | GitHub Action `npm ci && npm run build && npm run lint`. |
| 4 | **No error tracking / alerting** (Sentry removed). | Observability | High | Add server-side error tracker via Edge Fn or Supabase logs + alerts. |

## Open Medium priority
| # | Item | Type | Risk | Fix |
|---|---|---|---|---|
| 5 | **`cached_leads` is world-readable** to authenticated users (shared cache holds other users' scanned contacts). Intended for cache reuse but a cross-user PII read. | Security | Medium | Route reads through a definer function keyed by `filter_hash`, or key the cache per-user. |
| 6 | **No app-wide React error boundary** a render error can blank a screen. | Reliability | Medium | Add an ErrorBoundary wrapper with a recovery UI. |
| 7 | **Server secrets present in the local `.env`** (`SUPABASE_SERVICE_ROLE_KEY`, `GEMINI_API_KEY`) not bundled (no `VITE_`), but should live only in Supabase secrets. | Hygiene | Medium | Remove from frontend `.env`. |
| 8 | **Scan latency/cost** ~14–16 grounded calls per scan (1–3 min, higher credit burn); free-tier quota exhausts fast. | Cost/UX | Medium | Per-company enrichment cache; smaller top-up size; paid Gemile tier. |
| 9 | **Grounding evidence URLs are Google redirect links** (`vertexaisearch…`) functional but not the clean source domain. | UX | Medium | Display source title instead of raw URL. |

## Open Low priority
| # | Item | Type | Risk | Fix |
|---|---|---|---|---|
| 10 | **Single admin role** (`is_admin` boolean) no granular RBAC. | Scalability | Low | Introduce roles/permissions when the ops team grows. |
| 11 | **Legacy `payments` table + stale Razorpay docs** remain. | Cleanup | Low | Drop table + remove `DEPLOY_RAZORPAY.md` when convenient. |
| 12 | **Logo wordmark uses live text** (Geist→Inter→Arial fallback) substitutes fonts outside the app. | Design | Low | Convert letters to vector paths for portable assets. |
| 13 | **Verified pool has no freshness/expiry** stale contacts risk over time. | Data quality | Low | Auto-expire (60–90d) + re-verify queue (PHASES Phase 4). |

## Resolved (recent)
- Seeker/Provider mode desync → dashboard/sidebar read `ebexta_scan_filters.mode`.
- Refresh → onboarding → removed `main.tsx` test redirect + sticky `ebexta_onboarded`.
- Silent lead-save failure → `fix_lead_saving.sql` (columns aligned).
- Plan request FK violation → profile always ensured + `fix_plan_requests_fk.sql`.
- Admin verify lost on tab switch / duplicate pool rows → identity-only admin re-check +
  draft autosave/reopen + delete-then-insert.
- Cross-user profile over-exposure (IDOR) → `rls_lockdown.sql` + `privacy_hardening.sql`.
- Unrestricted chat uploads → `storage_hardening.sql` + client validation.
- Flat "40" intent scores → richer signal scoring + calibration.
