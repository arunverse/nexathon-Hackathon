# EBEXTA Gate 0 Validation Loop CYCLE 1 of 4

Run date: 2026-07-14
Exit condition: one non-network customer pays real money for a hand-verified lead batch.
Roles run: Finance, Sales, Founder only. Product/design/marketing/engineering/legal remain locked.

---

## ROLE 1 FINANCE

**No real usage numbers were found in the repo** (no billing export, no `api_usage` dump, no Hunter.io invoice). This model is built on labelled assumptions from current public pricing + what the code actually does. Real inputs needed are listed in the INBOX below once supplied, this role stops running per the gate rules.

### What the code actually does (verified, not assumed)
- One scan = 1 Gemini "discovery" call (grounded) that returns 8 company names, then 8 separate Gemini "enrich" calls (grounded), one per company. Source: `src/lib/scanEngine.ts` (`discoverNames`, `enrichOne`, hardcoded "find 8 REAL companies").
- Model used: `gemini-flash-lite-latest`, routed through the `gemini` Supabase Edge Function with Google Search grounding on. Priced here as Gemini 2.5 Flash-Lite family (closest published tier).
- Hunter.io is **not API-integrated anywhere in the codebase.** The only reference is in `src/pages/admin/AdminQueue.tsx`: a copy button that says "(paste into Hunter.io)" i.e. a human admin manually pastes the company domain into the Hunter.io web UI. This confirms the differentiator Sales is asked to sell (a human in the loop) is real, not aspirational.
- Credits in the app (`profiles.credit_limit`, checked in `gemini/index.ts`) are consumed **1 credit per Gemini call**, not 1 credit per lead. A scan of 8 leads burns 9 credits before any retries.

### Assumptions (LABELLED replace with real numbers when available)
| # | Assumption | Value | Why |
|---|---|---|---|
| A1 | Gemini 2.5 Flash-Lite token price | $0.10 / 1M input, $0.40 / 1M output | Google AI current published pricing, Jul 2026 |
| A2 | Google Search grounding price | $35 / 1,000 grounded requests (2.5-family rate) | Google AI current published pricing; assumes EBEXTA is past the shared 1,500/day free quota at real volume |
| A3 | Tokens per discovery call | ~1,000 in / ~500 out | Estimated from the actual prompt length in `scanEngine.ts`; not measured |
| A4 | Tokens per enrich call | ~1,500 in / ~600 out | Estimated from the actual enrichment JSON schema in `scanEngine.ts`; not measured |
| A5 | Retry/failure overhead | 1.3x on grounded call count | Code has retry-once-on-failure + a second enrichment pass for failed leads; real failure rate unknown |
| A6 | Hunter.io plan | Starter, $49/mo = 2,000 unified credits | Cheapest paid plan; Arun's actual plan (if any) unknown |
| A7 | Hunter.io credits per lead | 1.5 (1 domain search + 0.5 verify) | Hunter's published unified-credit model |
| A8 | Supabase marginal cost per lead | ~$0 | Current volume is almost certainly inside the free tier (500K edge function calls/mo, 500MB DB); this is a fixed/sunk cost, not a per-lead variable one, until volume is much higher |
| A9 | FX rate | ₹88 = $1 | Approximate, not fetched live round-trip if precision matters |

### Arithmetic cost to produce ONE verified lead
Per scan (8 leads, 9 grounded Gemini calls before retries):
- Grounded calls with retry overhead: 9 × 1.3 ≈ 12 calls → 12 × $0.035 = **$0.42** (grounding)
- Token cost: ~16,900 input tokens ($0.0017) + ~6,890 output tokens ($0.0028) ≈ **$0.0045**
- **Gemini cost per scan ≈ $0.4245 → per lead ≈ $0.053**

Per lead, Hunter.io: 1.5 credits × ($49 / 2,000 credits) = **$0.037**

Supabase marginal: **≈ $0.00** (fixed cost, not allocated per-lead at current volume)

**Total variable cost per verified lead ≈ $0.09 (≈ ₹8)**

### Floor price
**≈ ₹8 (≈ $0.09) per hand-verified lead.** Below this, EBEXTA loses money on the marginal lead, before counting Arun's own verification time, Supabase's fixed monthly fee, or any Hunter.io/Gemini plan minimums.

**Cross-check against existing in-app pricing:** the current credit packs (₹499/100, ₹999/200, ₹1,999/400 → ~₹5/credit) already price a full 9-credit scan at ~₹45 in retail-equivalent terms well above the ₹8 raw-compute floor. This means **the constraint on Gate 0 is not unit economics it's finding a payer.** Finance is not the blocker. Sales is.

**Not included, and it should weigh on final pricing:** Arun's own time spent manually pasting domains into Hunter.io and eyeballing results. That's the entire "hand-verified" differentiator and it isn't free. No time-per-lead estimate exists yet see INBOX.

### INBOX missing inputs (put these in front of Arun)
1. Actual Gemini token usage pull from `api_usage` table or Google AI Studio billing dashboard, if any calls have been made yet.
2. Actual Hunter.io plan/spend, if Arun already has an account.
3. Actual Supabase plan (Free vs Pro) and current monthly spend.
4. How many minutes does one hand-verification (domain → Hunter.io → confirm) actually take Arun?
5. Confirm the 8-leads-per-scan default hasn't changed since `scanEngine.ts` was last touched (Jul 13).

---

## ROLE 2 SALES

**Single objective: one non-network customer paying real money.**

### Why this differentiator, not the AI pipeline
"AI-scored leads" is now table stakes every competitor (Apollo, Clay, Cognism, the dozens of Clutch-listed Indian lead-gen shops) claims it. What none of them do at EBEXTA's price point is put a human eye on each contact before it ships. The pitch is: *"I personally verify every contact in this batch before you get it not an algorithm's confidence score."*

### Shortlist realistic non-network prospects
| Prospect type | Why they fit | Example / where to find them |
|---|---|---|
| Small outbound/lead-gen agencies (2–15 people) | They resell verified contact lists as their core product they buy exactly what EBEXTA sells, in bulk, repeatedly, and already have budget for it | LeadRoad, Bud India (Bengaluru), Cubikey all small, Clutch-listed, India-based outbound shops (per Clutch.co rankings, Jul 2026) |
| Boutique web/app dev or design agencies (5–20 people) chasing new clients | Chronically underinvest in outbound; a 20-lead hand-verified batch is a cheap, low-commitment first purchase vs. a $4,500/mo retainer agency | Search Clutch.co "web development India" for 5–20 person shops with no in-house sales hire |
| Recruitment/staffing boutiques | Need verified company + DM contact lists for both client and candidate sourcing; used to paying per-lead already (job board / LinkedIn Recruiter costs) | Local staffing agencies serving IT/startups in Bangalore, Pune, Hyderabad |
| Solo B2B SaaS founders doing their own outbound (pre-Series A, no SDR yet) | Won't pay for a full SDR agency retainer but will pay for a one-off proof-of-concept batch | Indie Hackers / early-stage SaaS Slack & Discord communities, Bangalore startup WhatsApp groups Arun isn't already in |

Note: the first two rows are Clutch-sourced real company names, not Arun's contacts confirm non-network status before outreach.

### Drafted outreach message
Subject: *A hand-verified lead batch, not another AI list*

> Hi [Name],
>
> I run EBEXTA we do B2B lead matching, but with one difference: every contact in the batch is checked by a person before it ships, not just scored by a model. Domain, decision-maker, and email get verified by me directly (I use Hunter.io for the final email check) before anything reaches you.
>
> I'd like to send you a small trial batch 10 hand-verified leads matched to [their ICP], no charge for the first 5 so you can see the verification quality yourself. If it's useful, the rest of the batch is ₹[X].
>
> Would a 10-lead sample this week be useful?
>
> Arun, EBEXTA

### Likely objections and answers
- *"How is this different from Apollo/Clay?"* → Those score and estimate. I personally check each contact before you get it false positives cost you a burned outreach attempt, and that's what I'm removing.
- *"Why should I trust a one-person shop?"* → You're not trusting a black box; you're trusting a specific verification step you can audit I'll show you the Hunter.io confirmation for every contact in the batch.
- *"Price seems high for a spreadsheet."* → You're not paying for the spreadsheet, you're paying for me removing the 20% of "leads" that are dead emails or wrong titles before they cost you a rep's time.
- *"Can you guarantee accuracy?"* → I guarantee every contact was checked by a person, not that every company will respond no one can promise that.

### Single next concrete action for Arun
**Pick 3 names from the shortlist above (confirm none are existing contacts), and send the trial-batch message to the first one this week.** Everything downstream pricing, batch size, payment method is negotiable after the first reply; getting the first message sent to a genuine stranger is the only thing that moves Gate 0.

Nothing above was sent. This is drafted for Arun's review and manual send.

---

## ROLE 3 FOUNDER

**Has a non-network customer paid? No.**

**What's blocking it:** no outreach has been sent yet. There is no evidence in the repo, in scheduled-task history, or in any file that a prospect has even been contacted Gate 0 is currently blocked purely on Arun not having sent the first message from a real stranger. This is not a product gap, not a pricing gap (Finance shows huge margin room above the ₹8 floor), and not a technical gap (the scan pipeline works per `BUILD_NOTES.md`).

**What changes next cycle:** Cycle 2 checks whether Arun sent the drafted message to at least one of the three shortlisted prospects. If yes, Sales shifts to handling the reply/objection and closing payment. If no, Cycle 2 repeats this exact ask with a lower-friction version (e.g. a single free-sample DM instead of a paid pitch) to reduce the activation barrier further.

<run-summary>Cycle 1 of EBEXTA Gate 0: built a labelled-assumption cost model (~₹8/lead floor, well under existing in-app credit pricing economics aren't the blocker), drafted a shortlist of 4 non-network prospect types with a trial-batch outreach message, objections, and one next action. No customer has paid yet; nothing was sent to any real prospect. Full report saved to EBEXTA_GATE0_CYCLE1.md.</run-summary>
