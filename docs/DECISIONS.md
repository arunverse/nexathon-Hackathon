# EBEXTA DECISIONS.md (Architecture Decision Record)

> Every significant decision. Do not undo these without a new ADR entry.
> Format: Decision · Problem · Options · Chosen · Reason · Tradeoffs · Impact · Owner · Date · Status.

---

### ADR-001 Serverless backend (Supabase), no custom API server
- **Problem:** need auth, DB, file storage, and privileged server logic without ops overhead.
- **Options:** custom Node/Express server; Firebase; Supabase.
- **Chosen:** Supabase (Postgres + Auth + Edge Functions + Storage).
- **Reason:** RLS gives per-row security at the DB; Edge Functions hold secrets; no server to run.
- **Tradeoffs:** logic split between RLS/RPC/Edge Fns; manual migration discipline required.
- **Impact:** all authz is RLS-first. **Status:** Active.

### ADR-002 Browser never holds a privileged secret
- **Chosen:** Gemini + service-role keys live only in Edge Function secrets; browser gets
  public URL + anon key; all AI via the `gemini` proxy.
- **Reason:** anon key is safe only with RLS; a leaked Gemini key is direct cost/abuse.
- **Status:** Active. **Rule:** never `VITE_`-prefix a server secret.

### ADR-003 RLS is the security boundary (UI gates are convenience)
- **Chosen:** every table owner-scoped via RLS; admin via `is_admin()` checked server-side.
- **Reason:** UI can be bypassed; the DB cannot. Closes IDOR.
- **Tradeoffs:** cross-user features need definer views/functions (e.g. `network_profiles`).
- **Status:** Active (enforced by `rls_lockdown.sql` + `privacy_hardening.sql`).

### ADR-004 Backend-first lead supply (verified pool before AI)
- **Problem:** Gemini grounding is expensive; users pay per credit.
- **Chosen:** serve human-verified pool leads first; live-generate only the shortfall;
  charge the user credits for pool leads anyway.
- **Reason:** cost decreases with usage; trust compounds; margin improves.
- **Tradeoffs:** requires admin verification labor; pool freshness must be managed.
- **Status:** Active. **Owner:** CTO.

### ADR-005 Evidence-first AI + real grounding URLs as evidence
- **Chosen:** enrichment prompt = "Lead Verification & Evidence Intelligence Engine";
  use the actual Google-visited URLs as evidence, distinct from funding; weak evidence →
  Manual Review; never fabricate contacts.
- **Reason:** originality/trust is the product; fabricated links destroy it.
- **Status:** Active.

### ADR-006 Pipeline score calibration into a band spread
- **Problem:** organic scores clustered at a flat "40" and looked fake.
- **Chosen:** keep rank, map scores onto a realistic band spread (~3 high/5 strong/4 mod/1–2 low
  per 14 leads); target ~14 leads so the requested ranges fit.
- **Tradeoffs:** scores are curved (not raw); more leads = more AI cost/latency.
- **Status:** Active.

### ADR-007 Remove Razorpay / go sales-led
- **Problem:** self-serve payments not on the critical path; unused code carried secrets.
- **Chosen:** remove Razorpay entirely; plan activation is manual by admin after a session.
- **Reason:** reduce attack surface + complexity; matches the actual GTM.
- **Status:** Active. Legacy `payments` table retained but unused.

### ADR-008 Remove unused integrations (Sentry/PostHog/Resend/Perplexity)
- **Chosen:** removed their keys/config (no code used them).
- **Reason:** honest egress map; `VITE_`-prefixed analytics keys were shipping as dead strings.
- **Status:** Active. If re-added, must go through an Edge Function with PII scrubbing.

### ADR-009 Mode single-source = `ebexta_scan_filters.mode`
- **Problem:** dashboard read `profiles.mode` while the scan wrote `ebexta_leads_<filters.mode>`;
  desync showed an empty "switch mode" screen.
- **Chosen:** dashboard + sidebar resolve mode from `ebexta_scan_filters` (what the scan used).
- **Status:** Active.

### ADR-010 Sticky local onboarding marker
- **Problem:** refresh re-triggered onboarding when the DB flag/company weren't set.
- **Chosen:** `ebexta_onboarded` localStorage marker + leads-cache signal, plus removing the
  `main.tsx` test redirect that forced every refresh to onboarding.
- **Status:** Active.

### ADR-011 Remove dev-admin email bypass before launch
- **Chosen:** admin = `profiles.is_admin` only; deleted `DEV_ADMIN_EMAILS`.
- **Reason:** a client-side email bypass is a backdoor; don't rely on tree-shaking.
- **Status:** Active.

### ADR-012 Security headers + strict CSP via `vercel.json`
- **Chosen:** CSP `script-src 'self'` (inline icon script externalized), HSTS, frame DENY, nosniff.
- **Status:** Active.

### ADR-013 Admin verify: draft autosave + delete-then-insert
- **Problem:** tab switches unmounted the admin screen (token refresh reset admin check);
  re-verify collided with the unique index.
- **Chosen:** only re-check admin on identity change; autosave verify drafts + reopen;
  delete-then-insert the pool row (collision-proof).
- **Status:** Active.

### ADR-014 Logo identity = "EBEXTA" wordmark with emerald G + K app-icon
- **Chosen:** readable wordmark (name = brand), emerald (verified) accent from the UI system;
  K monogram + verified dot for favicon/app icon.
- **Reason:** color psychology (green = verified/go, navy = trust); market analysis (peers use
  abstract network marks; a "verified name" lockup is distinct).
- **Status:** Active.
