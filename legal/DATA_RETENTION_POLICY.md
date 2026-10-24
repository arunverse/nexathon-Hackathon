# EBEXTA Data Retention & Deletion Policy

**Effective date:** 23 July 2026 · Operated by **Ebexta**.
> Founder-prepared draft, not legal advice. Confirm periods with counsel (DPDP Act 2023).

This policy states how long EBEXTA keeps personal and business data and how it is deleted.
It is written to apply to any current or future data the Service processes.

## 1. Principles
- We keep data only as long as needed for the purpose it was collected, to run the Service,
  or to meet a legal/accounting obligation then we delete or anonymise it.
- Users can delete their account and data at any time (Settings → Danger Zone).

## 2. Retention schedule
| Data | Retained for | On deletion |
|---|---|---|
| Account & profile (email, company, mission, phone) | While the account is active | Deleted on account deletion (auth user + profile) |
| Generated leads & scans | While the account is active, or until the user deletes them / runs a new scan | Removed on account deletion (FK cascade) |
| Chat messages & attachments | While the account is active | Removed on account deletion (cascade); attachments purged from storage |
| Plan/dossier requests | While the account is active + as needed for billing/dispute records | Removed on account deletion (cascade) |
| Shared scan cache (`cached_leads`) | Up to **7 days**, then expires | Auto-expires; purge on request |
| Usage records (`api_usage`) | Retained for billing, abuse-prevention, and reporting (recommended **12–24 months**) | Anonymised/removed per schedule; removed on account deletion |
| System & admin audit logs (`system_logs`) | Retained for security/audit (recommended **12–24 months**) | Purged per schedule |
| Backups | Per provider's backup cycle (Supabase) | Rotated out on the provider's schedule |

## 3. Account & data deletion
- **User-initiated:** Settings → Danger Zone → *Delete account*. This calls the `account`
  Edge Function `delete_account`, which removes the user's rows across all data tables
  (foreign-key CASCADE), deletes the auth login, and clears local device storage. Irreversible.
- **Individuals in leads:** business contacts may request removal of their data via the
  privacy contact (Privacy Policy §12); verified requests are actioned as required by law.
- **Admin-initiated:** an admin may delete a user + all their data via a secured, audited
  action (`ebexta_admin_delete_user`), logged to the admin audit trail.

## 4. Anonymisation
Where we need to keep aggregate/statistical records (e.g. usage totals) beyond the personal
retention period, we remove or hash identifiers so the record can no longer identify a person.

## 5. Backups & legal holds
Data deleted from live systems may persist in encrypted backups until they rotate out on the
provider's normal cycle. We may retain specific data longer where required by a legal hold,
investigation, or statutory obligation.

## 6. Review
This policy is reviewed periodically and updated as the Service and law evolve.
Contact: your EBEXTA representative (the team member who handled your plan request).
