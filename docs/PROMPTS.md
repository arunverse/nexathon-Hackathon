# EBEXTA PROMPTS.md

> Every AI prompt, its purpose, contract, and guardrails.
> All prompts are built in `src/lib/scanEngine.ts` (discovery/enrichment) and
> `src/lib/emailGenerator.ts` (outreach). All execute via the `gemini` Edge Function.

---

## Global rules (apply to all prompts)

- **Transport:** `callGeminiProxy(prompt, { action, grounded, model })` → `gemini` Edge Fn.
  The browser never holds the key.
- **Models:** `gemini-flash-latest` (grounded, stronger) and `gemini-flash-lite-latest`
  (cheaper). Allowlisted server-side.
- **Grounding:** `grounded: true` enables the Google Search tool. The real visited URLs
  (`groundingMetadata.groundingChunks[].web.uri`) are returned and used as **evidence links**.
- **Temperature:** grounded calls use `0.1` (low, factual). Non-grounded default.
- **Output parsing:** responses are stripped of markdown fences and the first JSON
  array/object is extracted, then **validated with zod** (`RawLeadSchema`, `StakeholderSchema`).
- **Hallucination prevention:** "NULL is better than fake"; links validated
  (`urlUtils`/`linkVerifier`) and dropped if placeholder/fake; contacts named
  "Not publicly listed" are rejected; funding URL is kept distinct from evidence.
- **Retry/fallback:** grounded call retries on 503/500/429/timeout (with backoff); a
  daily-quota 429 is fatal (no retry). On grounded failure, a non-grounded fallback runs.

---

## Prompt 1 Discovery (names only)

- **Function:** `discoverNames()` (`scanEngine.ts`).
- **Business goal:** cheaply find up to 16 real counterpart companies (opposite side).
- **Action:** `discovery`, `grounded: true`.
- **System framing:** "You are EBEXTA Brain, a Precision Market Intelligence Engine." +
  the **matching rule** (Seeker→Providers / Provider→Seekers, exclude competitors) +
  filter context (mission, location, employees, stage, industries, tech, service categories,
  intent-signal priorities) + exclusion list (already-found companies).
- **Output:** JSON array of `{ companyName, whyMatch }`.
- **Validation:** array required; names trimmed; length > 1.
- **Fallback:** non-grounded discovery with the same prompt.

## Prompt 2 Per-company Enrichment (the core, evidence-first)

- **Function:** `enrichOne()` (`scanEngine.ts`).
- **Business goal:** produce ONE fully-verified lead with contacts + real evidence.
- **Action:** `enrich`, `grounded: true`.
- **System prompt (verbatim intent):** "You are EBEXTA's **Lead Verification & Evidence
  Intelligence Engine**. Your job is NOT to generate leads it is to VERIFY one company
  with public evidence." Rules embedded:
  Evidence-first: no public evidence → **INVALID**.
  Never recommend on industry alone.
  Prefer OFFICIAL sources; cite multiple independent sources.
  Return ALL relevant evidence links.
  Weak/incomplete evidence → set `manualReview: true` + reason (→ Manual Review status).
  Contacts: never fabricate; only real people from official/verified sources; else empty.
- **Then:** company research prompt + matching rule + roles rule + currency rule
  (report funding in the source's own currency) + a strict JSON schema.
- **Output JSON (key fields):** `companyName, isCompetitor, competitorReason, manualReview,
  manualReviewReason, website, companyLinkedIn, description, industry, location,
  employeeCount, companyStage, intentScore, intentFlags[], requirementTheme, matchReason[],
  fundingDetails, turnover, bigProjects[], investmentHistory, revenueGrowth,
  fundingSourceUrl, evidenceSourceUrl, evidenceSources[], companyContact{email,phone,address,sourceUrl},
  contacts[{name, role, authorityType, email, linkedInUrl, sourceUrl, verificationLogic, isPrimary, roleJustification}]`.
- **Security rules in prompt:** never invent URLs/people; sourceUrl must be the real page.
- **Evidence handling:** the model's `evidenceSources` are **merged with the real Google
  grounding URLs** (`attachGroundingEvidence`), deduped, and kept **distinct from the funding URL**.
- **Competitor filter:** `isCompetitor: true` leads are discarded (opposite-side rule).
- **Retry:** up to 3 grounded attempts; then one non-grounded fallback; then salvage to MIN_LEADS.

## Prompt 3 Legacy single-call discovery (fallback safety net)

- **Function:** `discoverWithGrounding()`.
- **Purpose:** if the two-pass path fully fails, one grounded call returns ~5 enriched
  companies. Same schema, lower quality; used only as a last resort.

## Prompt 4 Signal Watch scan

- **Location:** `SignalWatch.tsx` (per-keyword grounded search for intent signals).
- **Purpose:** find companies showing intent for a watched keyword (job posts, news, funding).
- **Action:** grounded discovery; results surface in the user's Signals.

## Prompt 5 Outreach email generation

- **Function:** `emailGenerator.ts`.
- **Business goal:** draft a personalized outreach email for a specific lead.
- **Action:** `email`.
- **Input:** lead + sender profile + tone. **Output:** subject + body.
- **Guardrails:** grounded facts from the lead only; no fabricated claims; user reviews/edits
  before sending (drafts autosave to `ebexta_email_<leadId>`).

---

## Scoring (deterministic, not a prompt)

Intent score = keyword-signal points (funding +30, hiring +20, product +20, expansion +15,
tech migration +15, website +10, decision-maker +10, industry +10, service +10, email +5,
risk −30) across ALL enriched fields, floored by Gemini's grounded `intentScore`, with an
attribute-based discovery baseline (45–62), then **calibrated** into a band spread. See the
Intent Score rubric and `ARCHITECTURE.md` §8.

## Known Limitations

- Grounding URLs are Google redirect links (`vertexaisearch…`) that resolve to the source.
- Free-tier Gemini limits → larger scans consume quota fast (quota errors surfaced clearly).
- Currency/figure accuracy depends on source quality (mitigated by evidence-first + manual review).

## Future Improvements

- Show evidence links with page title + "what this proves" on the lead card.
- Add a confidence-weighted blend of model score vs keyword score.
- Cache per-company enrichment to avoid re-enriching the same company across users.
