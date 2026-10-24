/**
 * Billing-period helpers.
 *
 * A monthly plan should give the user a fresh allowance every month, resetting
 * on the ANNIVERSARY of when they started the plan (the `credits_reset_at`
 * anchor set at purchase), not on the calendar 1st. This is computed lazily at
 * read-time so no scheduled job / cron is needed — the moment a new monthly
 * period begins, usage before it simply stops being counted.
 *
 * The same logic is mirrored server-side in supabase/functions/gemini/index.ts
 * (kept in sync by hand, since Edge Functions can't import from src).
 */

/** Add `m` whole months to `d`, clamping the day to the target month's length. */
export function addMonths(d: Date, m: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + m)
  const daysInMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, daysInMonth))
  return r
}

/**
 * Start of the user's CURRENT billing period.
 * - With an anchor (they have/had a plan): the most recent monthly anniversary
 *   of the anchor at or before `now`.
 * - Without an anchor (free/starter): the calendar month start.
 */
export function currentPeriodStart(anchorISO?: string | null, now: Date = new Date()): Date {
  if (!anchorISO) return new Date(now.getFullYear(), now.getMonth(), 1)
  const anchor = new Date(anchorISO)
  if (isNaN(anchor.getTime())) return new Date(now.getFullYear(), now.getMonth(), 1)
  if (anchor >= now) return anchor
  let months = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth())
  let cand = addMonths(anchor, months)
  if (cand > now) { months -= 1; cand = addMonths(anchor, months) }
  return cand
}

/** When the user's credits next reset (start of the following period). */
export function nextResetDate(anchorISO?: string | null, now: Date = new Date()): Date {
  return addMonths(currentPeriodStart(anchorISO, now), 1)
}
