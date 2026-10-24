/**
 * EBEXTA CSV Export — 26-column rich lead export
 *
 * Replaces the inline 5-column export that only produced PARTIALLY_VERIFIED rows.
 * This export includes all grounded fields: contacts, funding, links, signals, etc.
 */

import type { ScannedLead } from './scanEngine'
import { logSystemEvent } from './adminLog'
import { isValidEmail } from './linkVerifier'
import { isLikelyFakeLinkedIn, isSafePublicUrl } from './urlUtils'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Sanitize a value for safe CSV export by escaping spreadsheet formula injection vectors.
 * If the value starts with '=', '+', '-', '@', tab, or carriage return, it is prefixed with a single quote.
 */
export function sanitizeForCsv(value: string | number | null | undefined): string {
  if (value == null || value === '') return ''
  let str = String(value)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`
  }
  return str
}

/**
 * Wrap a value in double-quotes and escape any internal quotes.
 * Always-quote strategy: guarantees Excel parses each cell correctly
 * regardless of regional delimiter settings.
 */
export function csvCell(value: string | number | null | undefined): string {
  if (value == null || value === '') return '""'
  const sanitized = sanitizeForCsv(value)
  const str = sanitized.replace(/"/g, '""')
  return `"${str}"`
}

/** Join an array to a semicolon-delimited string for a single CSV cell. */
export function arrCell(arr: string[] | null | undefined): string {
  if (!arr || arr.length === 0) return '""'
  return csvCell(arr.join('; '))
}

// ─── Column definitions ───────────────────────────────────────────────────────

export const COLUMNS = [
  'Company',
  'Website',
  'Industry',
  'Location',
  'Employee Count',
  'Company Stage',
  'Intent Score',
  'Match Score',
  'Confidence Score',
  'Verification Status',
  'Intent Flags',
  'Requirement Theme',
  'Primary Contact',
  'Contact Role',
  'Contact Email',
  'Email Status',
  'Contact LinkedIn',
  'Company LinkedIn',
  'Company Twitter',
  'Reachability',
  'Reachability Evidence',
  'Service-Need Fit',
  'Service-Need Evidence',
  'Lead Status',
  'Lead Notes',
  'Follow-Up Date',
  'Turnover',
  'Revenue Growth',
  'Funding Details',
  'Funding Source URL',
  'Investment History',
  'Big Projects',
  'Match Reasons',
  'Evidence Source URL',
] as const

// ─── Main export function ─────────────────────────────────────────────────────

export function exportLeadsToCSV(leads: ScannedLead[], filename = 'ebexta-leads.csv'): void {
  // Fire-and-forget audit trail — never blocks or breaks the export
  void logSystemEvent({
    eventType: 'export',
    message: `CSV export — ${leads.length} leads`,
    metadata: { filename, leadCount: leads.length },
  })

  // Always quote every header — prevents Excel from mis-splitting multi-word names
  const headerRow = COLUMNS.map(col => `"${col}"`).join(',')

  const rows = leads.map(lead => {
    // Primary contact — from rich contacts first, fall back to stakeholders
    const primaryContact = lead.contacts?.find(c => c.isPrimary) ?? lead.contacts?.[0]
    const primaryStakeholder = lead.stakeholders?.[0]

    const contactName = primaryContact?.name ?? primaryStakeholder?.name ?? ''
    const contactRole = primaryContact?.role ?? primaryStakeholder?.title ?? ''

    // Determine real email and validate
    const rawEmail = primaryContact?.email ?? primaryStakeholder?.email ?? lead.email ?? lead.company_contact?.email ?? ''
    const rawLinkedIn = primaryContact?.linkedInUrl ?? primaryStakeholder?.linkedin_url ?? lead.linkedin_url ?? lead.company_linkedin ?? ''
    const contactLinkedIn = (rawLinkedIn && !isLikelyFakeLinkedIn(rawLinkedIn)) ? rawLinkedIn : ''

    const hasValidEmail = Boolean(rawEmail && isValidEmail(rawEmail))
    const contactEmail = hasValidEmail
      ? rawEmail
      : contactLinkedIn
        ? 'Email not found (LinkedIn available)'
        : 'Email not found'

    const emailStatus = hasValidEmail
      ? (lead.email_status === 'verified' || primaryContact?.verification_level === 'verified' ? 'Verified' : 'Unverified')
      : contactLinkedIn
        ? 'Not published (LinkedIn outreach available)'
        : 'Not published'

    const rawWebsite = lead.website ?? ''
    const safeWebsite = rawWebsite && isSafePublicUrl(rawWebsite) ? rawWebsite : (rawWebsite ? 'Website not verified' : '')

    const reachabilityLevel = lead.reachability?.reachability_level ?? 'Moderate'
    const reachabilityEvidence = lead.reachability?.direct_reach_factors?.join('; ') ?? lead.reachability?.rationale ?? ''
    const serviceNeedFit = lead.service_need_evidence?.service_fit_level ?? 'Moderate'
    const serviceNeedEvidence = lead.service_need_evidence?.buyer_intent_signals?.join('; ') ?? lead.service_need_evidence?.summary ?? ''
    const leadStatus = lead.action_status?.status ?? 'New'
    const leadNotes = lead.action_status?.notes ?? ''
    const followUpDate = lead.action_status?.follow_up_date ?? ''

    // Match reasons: from rich match_reason first, then business_impact.match_reasons
    const matchReasons = lead.match_reason ?? lead.business_impact?.match_reasons ?? []

    const cells = [
      csvCell(lead.company_name),
      csvCell(safeWebsite),
      csvCell(lead.industry),
      csvCell(lead.location),
      csvCell(lead.employee_count),
      csvCell(lead.company_stage ?? lead.funding_stage),
      csvCell(lead.intent_score),
      csvCell(lead.match_score),
      csvCell(lead.confidence_score),
      csvCell(lead.verification_status),
      arrCell(lead.intent_flags),
      csvCell(lead.requirement_theme),
      csvCell(contactName),
      csvCell(contactRole),
      csvCell(contactEmail),
      csvCell(emailStatus),
      csvCell(contactLinkedIn),
      csvCell(lead.company_linkedin ?? lead.linkedin_url),
      csvCell(lead.company_twitter),
      csvCell(reachabilityLevel),
      csvCell(reachabilityEvidence),
      csvCell(serviceNeedFit),
      csvCell(serviceNeedEvidence),
      csvCell(leadStatus),
      csvCell(leadNotes),
      csvCell(followUpDate),
      csvCell(lead.turnover ?? lead.annual_revenue),
      csvCell(lead.revenue_growth),
      csvCell(lead.funding_details),
      csvCell(lead.funding_source_url ?? lead.evidence_source_url),
      csvCell(lead.investment_history),
      arrCell(lead.big_projects),
      arrCell(matchReasons),
      csvCell(lead.evidence_source_url),
    ]

    return cells.join(',')
  })

  // \r\n line endings = Excel/Windows standard
  // UTF-8 BOM (\uFEFF) = tells Excel this is UTF-8, not ANSI — without it headers render as garbage
  const csv = [headerRow, ...rows].join('\r\n')
  const BOM = '\uFEFF'
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
