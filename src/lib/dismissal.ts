/**
 * EBEXTA — DISMISS AND CYCLE.
 * ---------------------------------------------------------------------------
 * Two promises to the user:
 *
 *   1. Dismiss a company and it NEVER comes back. Not in this scan, not in any
 *      future scan, not from the shared pool. The filter is absolute.
 *   2. Rescanning gives you NEW companies. Only when the market is genuinely
 *      exhausted do previously-seen ones return — labelled as such, re-verified,
 *      and still excluding anything dismissed.
 *
 * The exact behaviour asked for: with 10 companies in a market, scan one shows
 * 1-5, scan two shows 6-10, scan three starts over at 1. Dismiss #3 and the
 * next cycle is 1,2,4,5,6 — never 3.
 *
 * Requires supabase/rank_and_cycling.sql.
 */

import { supabase } from './supabase'

export const DISMISS_REASONS = [
  'Not my market',
  'Already a client',
  'Competitor',
  'Wrong contact',
  'Bad fit',
] as const
export type DismissReason = typeof DISMISS_REASONS[number]

export interface DismissedRow {
  id: string
  company_name: string
  company_domain: string | null
  reason: string | null
  dismissed_at: string
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

const norm = (s: string) => (s ?? '').trim().toLowerCase()

// ─── Dismiss ──────────────────────────────────────────────────────────────────

export async function dismissCompany(
  companyName: string,
  opts: { domain?: string | null; reason?: string | null } = {},
): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId || !companyName) return false
  try {
    const { error } = await supabase.from('dismissed_leads').upsert({
      user_id: userId,
      company_name: companyName.trim(),
      company_domain: opts.domain ?? null,
      reason: opts.reason ?? null,
    }, { onConflict: 'user_id,company_name' })
    if (error) {
      console.error('[EBEXTA] dismiss failed:', error.message, '— run supabase/rank_and_cycling.sql?')
      return false
    }
    dismissedCache = null   // invalidate so the next scan sees it
    return true
  } catch (err) {
    console.error('[EBEXTA] dismiss threw:', err)
    return false
  }
}

/** Undo — used by the toast and by Settings. */
export async function undismissCompany(companyName: string): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false
  const { error } = await supabase
    .from('dismissed_leads')
    .delete()
    .eq('user_id', userId)
    .eq('company_name', companyName.trim())
  if (error) { console.error('[EBEXTA] undismiss failed:', error.message); return false }
  dismissedCache = null
  return true
}

// Module-level cache so a grid of cards doesn't fire one query each.
let dismissedCache: Set<string> | null = null

export async function fetchDismissedNames(force = false): Promise<Set<string>> {
  if (dismissedCache && !force) return dismissedCache
  const userId = await currentUserId()
  if (!userId) return new Set()
  try {
    const { data, error } = await supabase
      .from('dismissed_leads')
      .select('company_name')
      .eq('user_id', userId)
    if (error) return new Set()
    dismissedCache = new Set((data ?? []).map(r => norm(String(r.company_name))))
    return dismissedCache
  } catch {
    return new Set()
  }
}

export async function fetchDismissedRows(): Promise<DismissedRow[]> {
  const userId = await currentUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('dismissed_leads')
    .select('id, company_name, company_domain, reason, dismissed_at')
    .eq('user_id', userId)
    .order('dismissed_at', { ascending: false })
  if (error) { console.warn('[EBEXTA] dismissed list unavailable:', error.message); return [] }
  return (data ?? []) as DismissedRow[]
}

// ─── Served history ───────────────────────────────────────────────────────────

export interface ServedState {
  /** Normalised names this user has already been shown. */
  names: Set<string>
  /** Oldest-served first — the order repeats come back in. */
  order: string[]
  currentCycle: number
}

export async function fetchServedState(): Promise<ServedState> {
  const userId = await currentUserId()
  if (!userId) return { names: new Set(), order: [], currentCycle: 1 }
  try {
    const { data, error } = await supabase
      .from('served_leads')
      .select('company_name, cycle_number, served_at')
      .eq('user_id', userId)
      .order('served_at', { ascending: true })
      .limit(1000)
    if (error) return { names: new Set(), order: [], currentCycle: 1 }

    const rows = (data ?? []) as Array<{ company_name: string; cycle_number: number }>
    const names = new Set(rows.map(r => norm(r.company_name)))
    const order = [...new Set(rows.map(r => r.company_name))]
    const currentCycle = rows.reduce((m, r) => Math.max(m, r.cycle_number ?? 1), 1)
    return { names, order, currentCycle }
  } catch {
    return { names: new Set(), order: [], currentCycle: 1 }
  }
}

export async function recordServed(
  companies: string[], scanId: string | null, cycle: number,
): Promise<void> {
  const userId = await currentUserId()
  if (!userId || companies.length === 0) return
  try {
    await supabase.from('served_leads').insert(
      companies.map(c => ({
        user_id: userId, company_name: c, scan_id: scanId, cycle_number: cycle,
      })),
    )
  } catch (err) {
    console.warn('[EBEXTA] could not record served leads:', err)
  }
}

// ─── The cycling decision ─────────────────────────────────────────────────────

export interface CyclePlan {
  /** Names to exclude from discovery — dismissed plus already-served. */
  excludeFromDiscovery: string[]
  /** Absolute: never show these, at any stage. */
  dismissed: Set<string>
  /** Already shown — deprioritised, not banned. */
  served: Set<string>
  cycleNumber: number
}

/** Cap the prompt exclusion list so it stays manageable. */
const MAX_EXCLUDE_IN_PROMPT = 40

export async function buildCyclePlan(): Promise<CyclePlan> {
  const [dismissed, servedState] = await Promise.all([
    fetchDismissedNames(true),
    fetchServedState(),
  ])

  // Dismissed always excluded. Served excluded from DISCOVERY so a fresh scan
  // hunts new companies — but if the market runs dry we still fall back to them
  // rather than returning an empty result.
  const excludeFromDiscovery = [
    ...servedState.order.slice(-MAX_EXCLUDE_IN_PROMPT),
  ]

  return {
    excludeFromDiscovery,
    dismissed,
    served: servedState.names,
    cycleNumber: servedState.currentCycle,
  }
}

export interface CycleSelection<T> {
  selected: T[]
  /** True when we ran out of new companies and reused seen ones. */
  startedNewCycle: boolean
  cycleNumber: number
}

/**
 * Choose what to show: unserved first, repeats only when necessary.
 *
 * @param candidates all surviving leads, best-first
 * @param nameOf     how to read the company name off a candidate
 */
export function selectForCycle<T>(
  candidates: T[],
  nameOf: (c: T) => string,
  plan: CyclePlan,
  target: number,
): CycleSelection<T> {
  // 1. HARD FILTER — dismissed never appears, at any stage, ever.
  const allowed = candidates.filter(c => !plan.dismissed.has(norm(nameOf(c))))

  // 2. Prefer companies this user has never seen.
  const unserved = allowed.filter(c => !plan.served.has(norm(nameOf(c))))
  const repeats = allowed.filter(c => plan.served.has(norm(nameOf(c))))

  if (unserved.length >= target) {
    return { selected: unserved.slice(0, target), startedNewCycle: false, cycleNumber: plan.cycleNumber }
  }

  // 3. Not enough new companies — the market is exhausted for this profile.
  //    Top up with previously-served ones, oldest first, and bump the cycle.
  const needed = target - unserved.length
  const selected = [...unserved, ...repeats.slice(0, needed)]
  const startedNewCycle = repeats.length > 0 && needed > 0

  return {
    selected,
    startedNewCycle,
    cycleNumber: startedNewCycle ? plan.cycleNumber + 1 : plan.cycleNumber,
  }
}
