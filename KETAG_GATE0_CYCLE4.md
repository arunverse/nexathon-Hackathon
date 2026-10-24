# EBEXTA Gate 0 Validation Loop CYCLE 4 (deadline / decision cycle)

Run date: 2026-07-17 ~05:08 IST (~2 days after Cycle 3)
Exit condition: one non-network customer pays real money for a hand-verified lead batch.
Roles active: Finance, Sales, Founder. All other roles remain locked (Gate 1).

**This is the cycle Cycle 3 designated as the last one. Its job is not to re-run the roles it is to force the decision the gate exists to force. Read the DECISION section; the rest is bookkeeping.**

---

## CYCLE ACCOUNTING read this before treating the deadline as "hit"

The 4-cycle budget and the ~30-day deadline have **come apart**, and it matters for whether the kill condition should actually fire today.

- **Real Gate-0 cycles so far:** Jul 14 (Cycle 1), Jul 15 (Cycle 3). Cycle 2 was a 19-minute scheduling artifact that *explicitly disclaimed being consumed*. Jul 16 was an engineering-loop run (updated `LOOP_STATUS.md` at 19:21), not a Gate-0 cycle. So by honest count this is the **3rd–4th** real Gate-0 cycle file label says 4, consumed-ledger says 3.
- **Calendar:** we are on **day 3–4 of a ~30-day window.** Not day 30.
- **Root cause found this cycle:** the `ebexta-roles` scheduled task fires **daily** (`cron 0 5 * * *`). At a daily cadence, "4 cycles" is exhausted in 4 days, which contradicts the spec's own "~30 days." Cycle 2 predicted this exact collapse and Cycle 3 repeated the warning. It is now confirmed at the source.
- **Also found:** there are **two near-duplicate daily EBEXTA tasks** `ebexta-roles` (this one, 05:06) and `ebexta-gate-0--cycle-1` (05:08, described "Stops at cycle 4 if nobody has paid"). They overlap and will double-count cycles. This needs to be resolved or the count will never mean anything.

**Consequence:** firing the hard kill ("stop the product, decide pivot/kill") purely because 4 *daily* cycles elapsed would let a misconfigured scheduler override the real 30-day intent the precise error Cycle 2 flagged. So this cycle does **not** declare EBEXTA dead. It does what Cycle 3 instructed: **flags the deadline directly and puts the decision menu in Arun's hands now**, deliberately a beat early, so he decides on evidence instead of on a cron artifact.

---

## STATE CHECK what changed since Cycle 3 (Jul 15 → Jul 17)

**Engineering moved. Sales did not.** Verified directly:

- **Git:** the previously-uncommitted work is now committed (`d18b5b6`, "Add all project files"). New/updated app code since Cycle 3: `Invoices.tsx`, `UsageBanner.tsx`, `billingPeriod.ts`, demo pages, `PlanGate.tsx`, admin queue/layout, landing/login/signup, `grant_enterprise.sql`, fresh `dist/` builds. The engineering loop (`LOOP_STATUS.md`) ran Jul 16 19:21.
- **Razorpay:** still on **`rzp_test_...` keys.** No real money can move through the checkout today. Unchanged since Cycle 2.
- **Sales artifacts:** **zero.** No outreach sent, no prospect contacted, no reply, no CRM entry, no invoice for a real batch, no payment record anywhere in the workspace. Unchanged since Cycle 1.

**The pattern, stated plainly:** in every cycle of this gate, effort has gone into *product* billing, plan gates, admin tooling, demo experiences, invoices and **not once** into the single action Gate 0 requires: one message to one non-network stranger. That is not a side-observation. **That is exactly the behavior Gate 0 was built to detect and stop.**

---

## ROLE 1 FINANCE  *(dormant unchanged)*

Floor price stands: **≈ ₹8 (≈ $0.09) per hand-verified lead** (labelled assumptions, Cycle 1). In-app pricing sits far above it. **Economics are not the blocker and never were.** INBOX items 1–5 (real Gemini/Hunter/Supabase spend, per-lead verification minutes) remain unanswered; they only *refine* an already-usable floor. Not re-derived the rules forbid re-narrating a settled result.

## ROLE 2 SALES  *(parked 3rd+ consecutive cycle on the same unsent action)*

Shortlist, trial-batch message, and objection handling are drafted and ready in Cycle 1. Sending them is an irreversible third-party action one of the two explicit "park, never guess" exceptions so the loop has not sent and will not send them autonomously. **Not re-drafted.** Re-writing the same message a fourth time is the "burning cycles narrating its own blindness" the spec explicitly prohibits.

## ROLE 3 FOUNDER

**Has a non-network customer paid? No.**

Nothing about the answer is technical, financial, or product-shaped. It is a single unsent message. Three-plus cycles of building payment rails, admin panels, and demo flows have not changed it and cannot change it. **This is the decision point.**

---

## THE FORCED DECISION Arun picks one

The gate's rule on a failed Gate 0 is: *it stops, and forces a decision pivot the offer, pivot the ICP, or kill it.* Here is that decision, made concrete. Pick one:

**A Send the message (the gate isn't failed, it's untested).**
The honest read is that Gate 0 has not actually been *run* yet the product was built around it, but the one experiment it asks for (contact a stranger, offer a hand-verified batch) has never been executed. If there's any belief left in the offer, the correct move is not to pivot or kill on zero data it's to send **one** message from Cycle 1's draft to **one** shortlisted non-network prospect (LeadRoad / Bud India / Cubikey, or a boutique agency you have no prior tie to) **today**, and let a real reply decide. Payment can be a manual UPI/bank transfer for one batch no live Razorpay keys required. *This is the recommended option, because you cannot pivot or kill responsibly on an experiment you never started.*

**B Pivot the offer.** Keep the ICP, change what's sold: e.g. a recurring "verified list subscription" instead of one-off batches, or a "verify *your* existing list" service (they bring the leads, you hand-verify) lower trust barrier, uses the same Hunter-in-the-loop differentiator. Choose this only if you've concluded the *one-off batch* framing is the problem, not the outreach.

**C Pivot the ICP.** Keep the offer, change the buyer: away from tiny agencies toward someone who feels the pain harder e.g. solo B2B SaaS founders doing their own outbound, or recruiters paying per-contact already. Choose this only if you believe the shortlisted agencies won't pay regardless.

**D Kill it.** Stop EBEXTA as a paid product. Choose this only if, sitting with it honestly, you don't want to send even one message because that unwillingness *is* the answer, and it's better named now than after another month of building.

**What the loop will not let you do:** option "E build more product and re-run the gate next week." Every cycle so far has quietly chosen E. That is the one path the gate exists to close.

---

## STOP DIRECTIVE (for the loop, not for Arun)

This gate has now produced 3–4 substantively identical "still blocked on one human action" reports. The spec: *"The loop tells you what it's missing twice. Then it shuts up and stops."* We are past twice.

**Effective now, the autonomous loop halts.** Any subsequent automated run **must not** generate a "Cycle 5" that re-narrates this. It must read this file, confirm nothing in the DECISION has been actioned (no outreach log, no payment, no decision note from Arun), print a single line `HALTED awaiting Arun's Gate-0 decision (see EBEXTA_GATE0_CYCLE4.md)` and exit. It resumes only when Arun has either (a) sent outreach, (b) logged a pivot/kill decision, or (c) fixed the cadence and explicitly restarted the gate.

---

## INBOX what Arun must do (in order)

1. **Make the call above (A / B / C / D).** One line back is enough. Recommended: **A send one message today.**
2. **Stop the daily re-fire.** The loop is set to run *every day*; that's what collapsed 4 cycles into 4 days. Either reschedule `ebexta-roles` to **weekly** (so 4 cycles ≈ 30 days as intended) or **pause it** until you've actioned #1. *(The loop did not change your schedule itself that's your lever to pull.)*
3. **Delete or merge the duplicate task.** `ebexta-roles` and `ebexta-gate-0--cycle-1` are both firing daily and both running Gate 0. Keep one.
4. *(Only if you pick A and want self-serve payment)* swap Razorpay to `rzp_live_...` keys but note a single batch can be sold on manual UPI with zero code, so this is not on the critical path.

Carried-forward Finance inbox (non-blocking, refines the floor only): real Gemini/Hunter/Supabase spend, and minutes per hand-verification.

<run-summary>Cycle 4 (deadline cycle) of EBEXTA Gate 0: still no payment and the core finding across all cycles still not one outreach message sent to a real prospect; Razorpay remains on test keys. The only thing that moved since Cycle 3 was more engineering (git commit of all files, new billing/invoice/demo code, an engineering-loop run Jul 16), which is exactly the product-building-instead-of-selling pattern Gate 0 exists to catch. Found the root cause of the cycle/deadline mismatch: the task fires DAILY and there's a duplicate EBEXTA task, collapsing the "4 cycles / ~30 days" budget into ~4 days so I did not fire a premature day-3 kill. Instead, per Cycle 3's hand-off, I put the forced decision in front of Arun (A: send one message today [recommended] / B: pivot offer / C: pivot ICP / D: kill), halted the loop from re-narrating, and asked him to switch the schedule to weekly or pause it and de-duplicate the two tasks. Full report saved to EBEXTA_GATE0_CYCLE4.md.</run-summary>
