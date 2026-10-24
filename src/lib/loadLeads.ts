/**
 * Single source of truth for reading the user's cached leads.
 *
 * Leads are cached per-mode in localStorage (`ebexta_leads_seeker` /
 * `ebexta_leads_provider`) by the scan. Older pages read the legacy
 * `ebexta_scan_results` key or the DB `leads` table (which can be empty), so
 * they wrongly showed "run a scan first". Everything should read through here.
 */

function parse(raw: string | null): unknown[] {
  if (!raw) return []
  try { const v = JSON.parse(raw); return Array.isArray(v) ? v : [] } catch { return [] }
}

/** Preferred mode from the saved scan filters (falls back to seeker). */
export function cachedMode(): 'seeker' | 'provider' {
  try {
    const f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
    return f?.mode === 'provider' ? 'provider' : 'seeker'
  } catch { return 'seeker' }
}

/**
 * Return the cached leads to display + which mode they belong to.
 * Prefers the current mode's cache, then the other mode, then the legacy key —
 * so Stats / Outreach never falsely claim there are no leads.
 */
export function getCachedLeads<T = Record<string, unknown>>(): { leads: T[]; mode: 'seeker' | 'provider' } {
  const mode = cachedMode()
  const other = mode === 'seeker' ? 'provider' : 'seeker'
  const primary = parse(localStorage.getItem(`ebexta_leads_${mode}`))
  if (primary.length) return { leads: primary as T[], mode }
  const secondary = parse(localStorage.getItem(`ebexta_leads_${other}`))
  if (secondary.length) return { leads: secondary as T[], mode: other }
  const legacy = parse(localStorage.getItem('ebexta_scan_results'))
  return { leads: legacy as T[], mode }
}
