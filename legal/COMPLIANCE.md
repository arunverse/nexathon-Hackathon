# EBEXTA Compliance Overview

> Maps each required control to its status and where it lives in the product.
> Not legal advice have counsel review the public-facing policies (India / DPDP Act 2023).
> Last updated: 23 July 2026.

| # | Requirement | Status | Where / How |
|---|---|---|---|
| 1 | Clear Privacy Policy | ✅ Done | `legal/PRIVACY_POLICY.md`, served at **/privacy** |
| 2 | Terms of Service | ✅ Done | `legal/TERMS_AND_CONDITIONS.md`, served at **/terms** |
| 3 | Explicit consent at registration | ✅ Done | Required checkbox in `Signup.tsx` (blocks email + Google signup until ticked; links to /terms, /privacy, /refund) |
| 4 | Data / account deletion requests | ✅ Done | Settings → Danger Zone → `account` Edge Fn `delete_account` (wipes rows via FK CASCADE + auth user + local storage). Privacy Policy §9 documents it. |
| 5 | Secure password storage (never plaintext) | ✅ Done | Supabase Auth **bcrypt**; app never stores/logs/returns plaintext (SECURITY.md §1/§7) |
| 6 | Encryption in transit & at rest | ✅ Done | TLS on all Supabase/Vercel/AI traffic (in transit); Supabase-managed encryption at rest |
| 7 | Role-based access control (internal users) | ✅ Done (basic) | `profiles.is_admin` role + `AdminRoute` (UI) + `is_admin()` server checks in every privileged RPC/Edge Fn + column-locked profile writes. Two roles today: User, Admin. |
| 8 | Audit logs for administrative actions | ✅ Done | `logAdminAction()` → `system_logs` (event_type `admin_action`), attributed to the acting admin. Wired into: verify lead, activate plan, set request status, update user profile/credits, delete row, delete user. |
| 9 | Data retention & deletion policy | ✅ Done | `legal/DATA_RETENTION_POLICY.md` |
| 10 | Data-breach response process | ✅ Done | `legal/DATA_BREACH_RESPONSE.md` |

## What each user sees / can do
- **Consent:** cannot create an account without actively agreeing to the policies.
- **Access/edit:** profile + company profile editable in Settings.
- **Delete:** one-click account deletion in Settings (irreversible).
- **Policies:** always available at /terms, /privacy, /refund.

## Residual items to strengthen (tracked in docs/KNOWN_ISSUES.md)
- Admin audit logging is currently **client-initiated**. For tamper-proof logging, move the
  audit insert **server-side into the RPCs/Edge Functions** (a follow-up SQL migration).
- RBAC is a single admin flag; introduce granular roles when the ops team grows.
- Add automated retention purges (cron) for expired cached data + old logs.

## To do before public launch
- [ ] Lawyer review of Terms / Privacy / Refund (India / DPDP).
- [ ] Appoint a named Grievance Officer (DPDP) and confirm escalation path.
- [ ] Confirm registered entity name + jurisdiction city in the policies.
- [ ] Verify Supabase's data-processing terms + region for your DPDP posture.
