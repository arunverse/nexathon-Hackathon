# EBEXTA BUILD NOTES
*Last updated: June 17, 2026*

## CURRENT STATE: NEAR-COMPLETE

TypeScript: ✅ Zero errors  
Build: ✅ Clean (vite + tsc)  
Dev server: port 5000, strictPort  

---

## FILE MAP

### Core
- `src/App.tsx` all routes wired, ProtectedRoute on dashboard/scan paths
- `src/contexts/AuthContext.tsx` Supabase Auth, user session
- `src/components/auth/ProtectedRoute.tsx` redirects to /login if no session

### Lib
- `src/lib/scanEngine.ts` 6-stage pipeline (cache → Gemini → firmographic → intent → declared-intent → business-impact)
- `src/lib/emailGenerator.ts` Gemini 2.5 Flash email generation
- `src/lib/linkVerifier.ts` URL trust layer (format, fake-pattern, HEAD check)
- `src/lib/supabase.ts` createClient + smoke test
- `src/lib/gemini.ts` model wrappers

### Pages Onboarding
- `OnboardingProfile.tsx` company name, email, mission, stage, employee range
- `OnboardingFilters.tsx` industry, company size, revenue, service categories, budget, project duration, intent signals, DM roles/seniority, trust filters
- `OnboardingGeography.tsx` country, tech hubs, city quick-select, tech stack, mode toggle

### Pages Dashboard
- `IntelligenceHub.tsx` lead cards, STRONGLY RECOMMENDED strip, mode-aware header
- `LeadDetail.tsx` full panel: Why Matched, signals, contacts, data integrity HUD, business impact, export
- `NeuralEmailEditor.tsx` Generate (Gemini) + Send (Gmail mailto, opens once)
- `NeuralMatchReport.tsx` detailed match report
- `DeclaredIntentBoard.tsx` real Supabase CRUD, 30/60/90 day horizons
- `IntelligenceStats.tsx` real Supabase recharts dashboard
- `InboxSentiment.tsx` real sent outreach from Supabase
- `GlobalIntelligenceDiscovery.tsx` outreach campaign overview
- `Settings.tsx` profile, mode, CRM links, notifications
- `SignalWatch.tsx` NEW: watch keywords, get notified on Gemini-detected signals
- `DeepScanActive.tsx` 6-stage progress, real-time onProgress callbacks
- `NetworkStatusDashboard.tsx` node health (decorative)
- `ScanSettings.tsx`, `Billing.tsx`, `Invoices.tsx` secondary pages

---

## COLOR SYSTEM (60/30/10)
- 60%: `#09090B` base bg
- 30%: `#A0A0C0` text/structure, `#5A5A7A` muted
- 10%: `#7C5CFF` Electric Violet accent, `#9D7CFF` secondary
- Semantic ONLY on verification badges: `#10B981` emerald (VERIFIED), `#F59E0B` amber (PARTIAL), `#EF4444` red (MANUAL_REVIEW)

---

## SUPABASE SCHEMA

### Tables needed
```sql
-- profiles
id uuid PK, company_name, sender_email, mission, mode, created_at, updated_at

-- scans  
id uuid PK, user_id, filters jsonb, status, created_at

-- leads
id uuid PK, user_id, scan_id, company_name, industry, location, employee_count,
funding_stage, annual_revenue, website, linkedin_url, email, evidence_source_url,
recent_signals jsonb, stakeholders jsonb, intent_score, match_score, confidence_score,
verification_status, intent_flags jsonb, validation_errors jsonb, strongly_recommended,
trust_score, business_impact jsonb, link_status jsonb, created_at

-- cached_leads
id uuid PK, filter_hash, industry, location, employee_min, employee_max, leads jsonb,
generated_at, expires_at

-- declared_intents
id uuid PK, user_id, mode, requirement, industry_tags jsonb, budget_range,
timeline_days, expires_at, created_at

-- sent_emails
id uuid PK, user_id, lead_id, company_name, subject, body, sent_at, status

-- signal_watches
id uuid PK, user_id, keyword, industry, notes, active, created_at

-- signal_matches
id uuid PK, watch_id, user_id, company_name, signal_text, source_url, detected_at
```

### Run this migration in Supabase SQL Editor:
See `supabase_migration.sql` in project root.

---

## ABSOLUTE RULES (from build brief)
1. Never show a broken/fake/404 link next to a VERIFIED lead
2. Gmail send opens ONCE per click (no loop)
3. Never show AI placeholder or fake data
4. Only Gemini models: `gemini-2.5-flash-lite` (bulk), `gemini-2.5-flash` (email)
5. Every API call wrapped in try/catch
6. npm run dev must stay error-free

---

## COMPLETED TASKS
- [x] Auth (Supabase + ProtectedRoute)
- [x] Onboarding (3 steps, full filter set)
- [x] Scan engine (6 stages, intent formula, business impact)
- [x] linkVerifier.ts
- [x] All dashboard pages wired to real Supabase
- [x] Gmail send (opens once)
- [x] 60/30/10 color system enforced
- [x] Signal Watch page + routes
- [x] Supabase migration SQL

---

## KNOWN GAPS / FUTURE
- Link verification is client-side (CORS blocks HEAD requests to most domains) shows "unverified" rather than confirmed broken. This is correct behavior.
- Signal Watch scans run on-demand (no background cron yet would need Supabase Edge Function)
- Billing/Invoices are UI shells no Stripe integration yet
