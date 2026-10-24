/**
 * Date presentation helpers shared across the Company Memory UI.
 * Kept out of the component files so fast-refresh stays intact.
 */

export function formatDate(d: string | null | undefined): string {
  if (!d) return '—'
  const t = Date.parse(d)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export function relativeDate(d: string | null | undefined): string {
  if (!d) return ''
  const t = Date.parse(d)
  if (!Number.isFinite(t)) return ''
  const days = Math.floor((Date.now() - t) / 86400000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 30) return `${days} days ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months} month${months > 1 ? 's' : ''} ago`
  const years = Math.floor(months / 12)
  return `${years} year${years > 1 ? 's' : ''} ago`
}
