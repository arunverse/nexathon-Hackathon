/**
 * EBEXTA Admin Console — non-component helpers.
 * (Kept separate from shared.tsx so React Fast Refresh works.)
 */

// ── Time helpers ────────────────────────────────────────────────────────────────

export function hoursAgo(dateStr: string): number {
  return (Date.now() - new Date(dateStr).getTime()) / 3600000
}

export function timeAgoLabel(dateStr: string): string {
  const hrs = hoursAgo(dateStr)
  if (hrs < 1) {
    const mins = Math.max(0, Math.floor(hrs * 60))
    return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  }
  if (hrs < 24) {
    const h = Math.floor(hrs)
    return `${h} hour${h !== 1 ? 's' : ''} ago`
  }
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

export function startOfTodayIso(): string {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d.toISOString()
}

export function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86400000).toISOString()
}

export function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

// ── Status helpers ──────────────────────────────────────────────────────────────

export function verificationTone(status: string | null | undefined): 'green' | 'amber' | 'red' | 'neutral' {
  if (status === 'VERIFIED') return 'green'
  if (status === 'PARTIALLY_VERIFIED') return 'amber'
  if (status === 'MANUAL_REVIEW_NEEDED') return 'red'
  return 'neutral'
}

// ── Lead link counting (quality-control metric for Task 1 verification) ─────────

interface LinkishLead {
  website?: string | null
  linkedin_url?: string | null
  company_linkedin?: string | null
  evidence_source_url?: string | null
  funding_source_url?: string | null
  contacts?: Array<{ linkedInUrl?: string | null; sourceUrl?: string | null }> | null
}

/** Count non-empty verified links on a lead row (company + contact links). */
export function validLinkCount(lead: LinkishLead): number {
  let n = 0
  const has = (v: string | null | undefined) => !!v && v.trim().length > 4
  if (has(lead.website)) n++
  if (has(lead.linkedin_url) || has(lead.company_linkedin)) n++
  if (has(lead.evidence_source_url) || has(lead.funding_source_url)) n++
  for (const c of lead.contacts ?? []) {
    if (has(c?.linkedInUrl)) n++
    if (has(c?.sourceUrl)) n++
  }
  return n
}
