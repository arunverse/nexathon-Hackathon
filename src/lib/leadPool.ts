/**
 * EBEXTA SHARED LEAD POOL — reuse before you re-discover.
 * ---------------------------------------------------------------------------
 * If another user with a SIMILAR DESCRIPTION already found good leads, serve
 * those first. Zero API calls, and the leads are already proven.
 *
 * THE CONSTRAINT THAT MATTERS: reuse is keyed on need_categories — what the
 * matched company NEEDS — never on filters. A game-dev seller and a SaaS
 * seller both filtering "Technology, Bengaluru" have non-intersecting
 * categories, so they can never draw each other's leads. Getting this wrong
 * would recreate the exact bug we're fixing, one layer down.
 *
 * Requires supabase/description_first.sql.
 */

import { supabase } from './supabase'
import { categoryOverlap, scoreDescriptionMatch, type BuyerProfile } from './buyerProfile'
import type { ScannedLead, ScanFilters } from './scanEngine'

/** Category overlap floor for a pooled lead to even be considered. */
const MIN_CATEGORY_OVERLAP = 20
/** Description-similarity floor for actually serving it. */
const MIN_POOL_MATCH = 60

interface PoolRow {
  id: string
  company_name: string
  company_domain: string | null
  industry: string | null
  city: string | null
  location: string | null
  employee_count: number | null
  funding_stage: string | null
  mode_side: string | null
  need_summary: string | null
  need_categories: string[] | null
  source_description: string | null
  lead_data: ScannedLead
  times_served: number
}

export interface PooledLead {
  lead: ScannedLead
  poolId: string
  matchScore: number
}

// ─── Filter satisfaction ──────────────────────────────────────────────────────

function satisfiesFilters(row: PoolRow, filters: ScanFilters): boolean {
  const min = filters.employeeMin ?? 1
  const max = filters.employeeMax ?? 100_000
  if (row.employee_count != null && (row.employee_count < min * 0.6 || row.employee_count > max * 1.6)) return false

  const stages = filters.companyStages ?? []
  if (stages.length > 0 && row.funding_stage) {
    const stage = row.funding_stage.toLowerCase()
    if (!stages.some(s => stage.includes(s.toLowerCase()) || s.toLowerCase().includes(stage))) return false
  }

  const cities = (filters.cities ?? []).map(c => c.trim().toLowerCase()).filter(Boolean)
  const targetCountries: string[] = (() => {
    if (Array.isArray(filters.countries) && filters.countries.length > 0) return filters.countries.map(c => c.trim().toLowerCase())
    if (filters.country) return filters.country.split(',').map(c => c.trim().toLowerCase()).filter(Boolean)
    return []
  })()

  if (cities.length > 0) {
    const where = `${row.city ?? ''} ${row.location ?? ''}`.toLowerCase()
    if (!cities.some(c => where.includes(c))) return false
  } else if (targetCountries.length > 0) {
    const where = `${row.city ?? ''} ${row.location ?? ''}`.toLowerCase()
    // A pooled lead with no location recorded is allowed through — the
    // enrichment on it already passed geography once.
    if (where && !targetCountries.some(ctry => where.includes(ctry))) return false
  }

  return true
}

// ─── Read ─────────────────────────────────────────────────────────────────────

/**
 * Find pooled leads that genuinely fit this user's description.
 *
 * @param excludeCompanies companies this user has already been served
 */
export async function fetchPooledLeads(
  profile: BuyerProfile,
  scanCategories: string[],
  filters: ScanFilters,
  excludeCompanies: string[],
  limit: number,
): Promise<PooledLead[]> {
  if (limit <= 0 || scanCategories.length === 0) return []

  // We want companies on the OPPOSITE side to the user: a provider wants
  // companies that behave as seekers, and vice versa.
  const userMode = filters.mode ?? 'seeker'
  const wantSide = userMode === 'provider' ? 'seeker' : 'provider'

  try {
    const { data, error } = await supabase
      .from('lead_pool')
      .select('*')
      .eq('mode_side', wantSide)
      .overlaps('need_categories', scanCategories)
      .order('times_served', { ascending: true })   // spread usage around
      .limit(120)

    if (error) {
      // Table missing = SQL not run yet. Scan proceeds exactly as before.
      console.warn('[EBEXTA] lead_pool unavailable — skipping reuse:', error.message)
      return []
    }

    const seen = new Set(excludeCompanies.map(c => c.trim().toLowerCase()))
    const out: PooledLead[] = []

    for (const row of (data ?? []) as PoolRow[]) {
      if (seen.has(row.company_name.trim().toLowerCase())) continue
      if (!satisfiesFilters(row, filters)) continue

      // Two independent gates. Category overlap is cheap and coarse;
      // description similarity is what actually protects relevance.
      const overlap = categoryOverlap(scanCategories, row.need_categories ?? [])
      if (overlap < MIN_CATEGORY_OVERLAP) continue

      const match = scoreDescriptionMatch(row.need_summary ?? '', profile)
      if (match < MIN_POOL_MATCH) continue

      seen.add(row.company_name.trim().toLowerCase())
      out.push({
        poolId: row.id,
        matchScore: match,
        lead: {
          ...row.lead_data,
          need_summary: row.need_summary ?? undefined,
          description_match_score: match,
          source_description: row.source_description ?? undefined,
          from_pool: true,
        },
      })
      if (out.length >= limit) break
    }

    // Best matches first.
    out.sort((a, b) => b.matchScore - a.matchScore)
    return out
  } catch (err) {
    console.error('[EBEXTA] pool fetch failed (non-fatal):', err)
    return []
  }
}

/** Bump times_served for the pooled leads we actually handed over. */
export async function markPoolServed(poolIds: string[]): Promise<void> {
  if (poolIds.length === 0) return
  try {
    await supabase.rpc('ebexta_pool_served', { p_ids: poolIds })
  } catch (err) {
    console.warn('[EBEXTA] pool serve counter failed:', err)
  }
}

// ─── Write ────────────────────────────────────────────────────────────────────

function cityOf(location: string | undefined): string | null {
  if (!location) return null
  return location.split(',')[0]?.trim() || null
}

/**
 * Write freshly discovered leads into the pool so the next user with a similar
 * description reuses them instead of paying for discovery again.
 *
 * Only leads that passed the description gate go in — pooling a weak match
 * would propagate it to every future user.
 */
export async function writeToPool(
  leads: ScannedLead[],
  profile: BuyerProfile,
  scanCategories: string[],
  filters: ScanFilters,
): Promise<number> {
  const userMode = filters.mode ?? 'seeker'
  // Store from the matched company's perspective, not the user's.
  const modeSide = userMode === 'provider' ? 'seeker' : 'provider'

  const rows = leads
    .filter(l => l.need_summary && (l.description_match_score ?? 0) >= MIN_POOL_MATCH)
    .filter(l => !l.from_pool)   // don't rewrite what we just read
    .map(l => ({
      company_name: l.company_name,
      company_domain: l.website ? l.website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null,
      industry: l.industry ?? null,
      city: cityOf(l.location),
      location: l.location ?? null,
      employee_count: l.employee_count ?? null,
      funding_stage: l.funding_stage ?? null,
      mode_side: modeSide,
      need_summary: l.need_summary ?? null,
      need_categories: scanCategories,
      source_description: profile.core_service,
      lead_data: l,
      last_verified: new Date().toISOString(),
    }))

  if (rows.length === 0) return 0

  try {
    const { error } = await supabase
      .from('lead_pool')
      .upsert(rows, { onConflict: 'company_name,mode_side' })
    if (error) {
      console.warn('[EBEXTA] pool write failed (non-fatal):', error.message)
      return 0
    }
    return rows.length
  } catch (err) {
    console.error('[EBEXTA] pool write threw:', err)
    return 0
  }
}

/** Companies this user has already been shown — never serve the same twice. */
export async function alreadyServedCompanies(userId: string): Promise<string[]> {
  try {
    const { data } = await supabase
      .from('leads')
      .select('company_name')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(500)
    return (data ?? []).map(r => String(r.company_name ?? '')).filter(Boolean)
  } catch {
    return []
  }
}
