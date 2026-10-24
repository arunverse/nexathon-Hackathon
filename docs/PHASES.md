# EBEXTA PHASES.md

> Roadmap. Each phase: Goals · Features · Dependencies · Risks · Success criteria · QA · Deploy.
> Status reflects the current implemented state.

---

## Phase 1 Core MVP  ✅ (done)
- **Goals:** prove bilateral matching + AI lead discovery.
- **Features:** auth, onboarding, two-pass grounded scan, lead cards + detail, per-mode cache.
- **Dependencies:** Supabase, Gemini proxy.
- **Risks:** AI cost/quality. **Success:** a scan returns real, opposite-side leads with evidence.

## Phase 2 Product Stability  ✅ (largely done)
- **Goals:** eliminate the recurring bugs; make it usable end-to-end.
- **Features:** mode single-source, sticky onboarding, generate-more dedupe, calibrated scores,
  responsive pass (320–2560px), lead-detail wrap fixes.
- **Risks:** regressions. **Success:** regression watch-list (TESTING.md) all pass.
- **QA:** manual release checklist.

## Phase 3 Production Ready  ◐ (in progress)
- **Goals:** secure, documented, deployable with confidence.
- **Features:** RLS lockdown, privacy hardening, storage hardening, security headers/CSP,
  error redaction, PII deletion, **this documentation suite**.
- **Pending:** automated CI (typecheck+lint+build gate), automated tests, error tracker/alerting.
- **Risks:** manual migration drift; no test safety net.
- **Success:** SECURITY.md checklist green; CI gate live; smoke E2E passes.

## Phase 4 Enterprise
- **Goals:** the originality moat at scale + admin efficiency.
- **Features:** verified-pool freshness (auto-expire + re-verify queue), verification levels &
  provenance display, evidence receipts (title + "what this proves"), audit trail UI, RBAC beyond
  single admin flag, SSO for teams.
- **Risks:** verification labor. **Success:** most served leads are pool-sourced + human-verified.

## Phase 5 Scale
- **Goals:** handle many users cheaply.
- **Features:** per-company enrichment cache (dedupe across users), covering indexes,
  pagination on admin lists, `cached_leads` behind a definer function, cron/queue for scans.
- **Success:** AI cost per active user trends down; p95 read latency within budget.

## Phase 6 Automation
- **Goals:** reduce manual ops.
- **Features:** automated plan activation options, scheduled verified-pool refresh, key rotation,
  dependency + secret scanning in CI, automated backups verification.

## Phase 7 AI Optimization
- **Goals:** better leads, lower cost.
- **Features:** confidence-weighted scoring, model routing by task, prompt A/B, hallucination
  metrics, evidence-quality scoring, retrieval cache.

## Phase 8 Global Platform
- **Goals:** multi-region, multi-currency, multi-language.
- **Features:** locale-aware currency/figures, region data residency, i18n, marketplace of
  verified networks.

---

### Cross-phase QA / Testing / Deployment requirements
- Every phase: `npm run build` green, docs updated, CHANGELOG entry, release checklist passed.
- Security migrations (`privacy_hardening`, `rls_lockdown`, `storage_hardening`) re-verified after any DB change.
