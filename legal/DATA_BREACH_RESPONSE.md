# EBEXTA Data Breach Incident Response Plan

**Effective date:** 23 July 2026 · Operated by **Ebexta**.
> Founder-prepared draft, not legal advice. Under India's DPDP Act 2023, notifiable personal-
> data breaches must be reported to the Data Protection Board and affected persons confirm
> exact timelines and format with counsel and keep this plan current.

A **personal data breach** = any unauthorised access, disclosure, alteration, loss, or
destruction of personal data (e.g. leaked credentials, exposed database, stolen laptop with
access, a bug exposing one user's data to another).

## 1. Roles
- **Incident Lead** the EBEXTA representative / founder who coordinates the response.
- **Technical Responder** whoever can access Supabase/Vercel to contain and investigate.
- **Grievance/Privacy Contact** handles user and regulator communication.
(One person may hold several roles in a small team; name them internally.)

## 2. Response steps (run in order)

**Step 1 Detect & record (immediately).**
Log the time, who reported it, and what was observed. Start an incident record with a unique
ID. Preserve evidence (logs, screenshots) do not delete anything.

**Step 2 Contain (within hours).**
- Revoke/rotate exposed secrets immediately (Gemini key, Supabase service-role key, reset
  affected passwords, invalidate sessions).
- Close the hole: disable the affected function/endpoint, tighten the RLS policy, or take the
  feature offline. Re-run `privacy_hardening.sql` / `rls_lockdown.sql` if RLS is implicated.
- Block the offending access (IP, account) where possible.

**Step 3 Assess (within 24 hours).**
Determine: what data, whose data, how many people, how it happened, and whether data was
actually accessed/exfiltrated or merely exposed. Classify severity (low / medium / high /
critical) based on sensitivity and scale.

**Step 4 Notify.**
- **Regulator (DPDP Data Protection Board):** if the breach is notifiable, report within the
  timeframe required by law. [Confirm exact deadline + format with counsel.]
- **Affected individuals/users:** notify without undue delay in clear language what
  happened, what data, what they should do (e.g. reset password), and how to reach us.
- **Sub-processors:** coordinate with Supabase/Google/Vercel if their systems are involved.
- Keep all notifications factual; do not speculate publicly.

**Step 5 Eradicate & recover.**
Fix the root cause, deploy the patch, restore from a clean backup if needed, and verify the
fix (re-test the exact vector). Confirm security migrations and headers are in place.

**Step 6 Post-incident review (within 1–2 weeks).**
Write a blameless postmortem: timeline, root cause, impact, what worked, what didn't, and
concrete preventive actions with owners. Update code, policies, and this plan.

## 3. Communication templates (fill at time of incident)
- **User notice:** "We're writing to inform you of a security incident affecting [data]. On
  [date] we discovered [what]. We have [contained it / rotated keys]. We recommend you [action].
  We're sorry reach us at [your EBEXTA representative]."
- **Internal alert:** incident ID, severity, systems affected, current status, next update time.

## 4. Prevention (standing controls)
RLS owner-scoping, least-privilege secrets, CSP + security headers, rate/credit limits,
generic client errors (no internal detail), audit logs, dependency hygiene, and periodic
review of the SECURITY.md checklist.

## 5. Contacts
Report a suspected incident immediately to your EBEXTA representative (the team member who
handled your plan request), who will trigger this plan and escalate to the Incident Lead and,
if needed, external security/legal experts with whom you should cooperate until resolved.
