/**
 * EBEXTA — DO THEY ALREADY RANK?
 * ---------------------------------------------------------------------------
 * The bug this fixes: an SEO agency was served Furnishka at 97% buying intent.
 * Furnishka ranks #1 organically for its own category AND runs paid ads — it is
 * the single most search-visible company in that market, and therefore the last
 * business on earth that needs SEO.
 *
 * Two failures combined:
 *   1. INVERSE_RANK only ASKED the model to skip top results. Nothing verified
 *      rank. An instruction is not a check.
 *   2. The 97% came from funding +30, hiring +20, expansion +15 — momentum
 *      signals that say a company is doing well, not that it needs SEO.
 *
 * This module fixes (1) by actually looking. scanEngine applies (2) by refusing
 * to call a lead HIGH INTENT on momentum alone.
 *
 * COST: ONE batched grounded call for the whole shortlist, and only for sectors
 * where search visibility is the product. Everyone else skips it entirely.
 *
 * Requires supabase/rank_and_cycling.sql.
 */

import { callGeminiProxy } from './geminiProxy'
import type { ScannedLead } from './scanEngine'
import { safeParseJSON } from './safeJson'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SearchVisibility = 'dominant' | 'visible' | 'weak' | 'absent' | 'not_checked'

export interface RankEvidence {
  search_query_used: string
  visibility: SearchVisibility
  evidence: string
  runs_paid_ads: boolean
}

/** Sectors where the whole product IS search visibility. */
const VISIBILITY_SECTORS = [
  'SEO', 'SEO_SEM', 'DIGITAL_MARKETING', 'WEB_DESIGN', 'WEB_DEVELOPMENT',
  'BRANDING', 'ECOM_SERVICES', 'ECOMMERCE',
]

const VISIBILITY_KEYWORDS =
  /\bseo\b|search engine optim|\bsem\b|google ads|\bppc\b|digital marketing|online marketing|web (?:design|development)|website (?:design|development)|branding|brand identity|e-?commerce (?:service|growth|marketing)|organic (?:traffic|search)|search visibility|keyword rank/i

/**
 * Does this seller's offering depend on the buyer being INVISIBLE in search?
 * If not, we skip the check entirely — no call, no cost, no behaviour change.
 */
export function isVisibilitySector(sector: string | null | undefined, serviceText: string): boolean {
  if (sector && VISIBILITY_SECTORS.includes(sector.toUpperCase())) return true
  return VISIBILITY_KEYWORDS.test(serviceText ?? '')
}

// ─── The check ────────────────────────────────────────────────────────────────

interface RankRow {
  company: string
  search_query_used: string
  visibility: string
  evidence: string
  runs_paid_ads: boolean
}

/**
 * One grounded call for the WHOLE shortlist. Returns a map keyed on lowercased
 * company name. Never throws — a failed check leaves every lead 'not_checked',
 * which is neutral, rather than excluding companies on a guess.
 */
export async function checkSearchVisibility(
  leads: Array<Pick<ScannedLead, 'company_name' | 'industry' | 'location'>>,
): Promise<Map<string, RankEvidence>> {
  const out = new Map<string, RankEvidence>()
  if (leads.length === 0) return out

  const block = leads.slice(0, 16).map((l, i) =>
    `${i + 1}. ${l.company_name} — ${l.industry ?? 'unknown industry'} — ${l.location ?? 'unknown city'}`
  ).join('\n')

  const prompt = `Using Google Search, check the search visibility of each company below for their OWN category and city.

For each, search their primary category + city (e.g. "sofa collection Bengaluru" for a Bengaluru furniture retailer) and report where this company appears.

Companies:
${block}

Return ONLY JSON array:
[{
  "company": "",
  "search_query_used": "",
  "visibility": "dominant|visible|weak|absent",
  "evidence": "where they appeared — top organic, sponsored ads, map pack, page 2, not found",
  "runs_paid_ads": true
}]

Definitions:
- dominant = top 3 organic OR running sponsored ads OR prominent in map pack
- visible = appears on page 1 but not top 3
- weak = page 2 or lower, or only in directories
- absent = not found for their own category

Be accurate. A wrong 'weak' sends a wasted lead. No markdown, no backticks.`

  try {
    const { text } = await callGeminiProxy(prompt, { action: 'discovery', grounded: true, jsonMode: true })
    const rows = safeParseJSON<RankRow[]>(text)
    // Unparseable → everything stays 'not_checked', which is neutral. The gate
    // must never exclude a company on the strength of a broken response.
    if (!Array.isArray(rows)) return out
    for (const r of rows) {
      if (!r?.company) continue
      const v = String(r.visibility ?? '').toLowerCase()
      const visibility: SearchVisibility =
        v === 'dominant' ? 'dominant'
        : v === 'visible' ? 'visible'
        : v === 'weak' ? 'weak'
        : v === 'absent' ? 'absent'
        : 'not_checked'

      out.set(r.company.trim().toLowerCase(), {
        search_query_used: String(r.search_query_used ?? '').slice(0, 160),
        // Paid ads mean they are ALREADY buying visibility, and almost certainly
        // already have an agency. Treat that as dominant however they ranked.
        visibility: r.runs_paid_ads === true ? 'dominant' : visibility,
        evidence: String(r.evidence ?? '').slice(0, 300),
        runs_paid_ads: r.runs_paid_ads === true,
      })
    }
  } catch (err) {
    // Leaving everything unchecked is the safe failure: neutral scoring, no
    // exclusions. Excluding companies because a check failed would be worse
    // than the bug we're fixing.
    console.error('[EBEXTA] search visibility check failed — leaving leads unchecked:', err)
  }
  return out
}

// ─── Applying the verdict ─────────────────────────────────────────────────────

/** Requirement-score adjustment. A company already at the top needs nothing. */
export function requirementAdjustment(v: SearchVisibility): number {
  switch (v) {
    case 'visible': return -25   // on page 1 already — weak need
    case 'weak':    return 30    // page 2+ — this is the ideal buyer
    case 'absent':  return 35    // invisible — the strongest need there is
    default:        return 0     // dominant is excluded; not_checked is neutral
  }
}

export interface RankOutcome {
  kept: ScannedLead[]
  excluded: Array<{ lead: ScannedLead; reason: string }>
}

/**
 * Apply search-visibility verification to a shortlist.
 * Runs ONLY for visibility-dependent sectors — everyone else passes straight
 * through with `not_checked` and no score change.
 */
export async function applyRankGate(
  leads: ScannedLead[],
  sector: string | null | undefined,
  serviceText: string,
  onProgress?: (msg: string) => void,
): Promise<RankOutcome> {
  if (!isVisibilitySector(sector, serviceText) || leads.length === 0) {
    return {
      kept: leads.map(l => ({ ...l, search_visibility: 'not_checked' as SearchVisibility })),
      excluded: [],
    }
  }

  onProgress?.('Checking who already ranks — a company at the top needs nothing…')
  const verdicts = await checkSearchVisibility(leads)

  const kept: ScannedLead[] = []
  const excluded: RankOutcome['excluded'] = []

  for (const lead of leads) {
    const v = verdicts.get(lead.company_name.trim().toLowerCase())
    const visibility: SearchVisibility = v?.visibility ?? 'not_checked'

    const enriched: ScannedLead = {
      ...lead,
      search_visibility: visibility,
      rank_evidence: v ?? null,
    }

    // ── HARD EXCLUSION ──
    // Already at the top of their own category. No amount of funding or hiring
    // makes them a buyer for search visibility they already own.
    if (visibility === 'dominant') {
      excluded.push({
        lead: { ...enriched, excluded_reason: 'Already dominant in search — no requirement for this service' },
        reason: v?.runs_paid_ads
          ? `Runs paid ads and ranks for "${v.search_query_used}" — already buying visibility`
          : `Ranks at the top for "${v?.search_query_used ?? 'their own category'}" — ${v?.evidence ?? 'dominant'}`,
      })
      continue
    }

    const adj = requirementAdjustment(visibility)
    if (adj !== 0) {
      enriched.match_score = Math.max(0, Math.min(100, (lead.match_score ?? 0) + adj))
      enriched.match_breakdown = [
        ...(lead.match_breakdown ?? []),
        {
          signal: visibility === 'visible'
            ? 'Already visible on page 1'
            : visibility === 'weak'
              ? 'Weak search visibility — real need'
              : 'Invisible in search — strongest need',
          points: adj,
        },
      ]
    }
    kept.push(enriched)
  }

  // ── MINIMUM GUARANTEE ──
  // If rank exclusion would leave fewer than 3 leads, salvage the strongest leads
  // with a match score penalty rather than wiping out the scan!
  if (kept.length < 3 && excluded.length > 0) {
    const need = 3 - kept.length
    const salvaged = excluded.splice(0, need)
    salvaged.forEach(s => {
      s.lead.match_score = Math.max(30, (s.lead.match_score ?? 60) - 20)
      s.lead.excluded_reason = undefined
      kept.push(s.lead)
    })
  }

  if (excluded.length > 0) {
    onProgress?.(`${excluded.length} companies already dominate search — filtered out.`)
  }
  return { kept, excluded }
}

/** Human-readable line for the lead detail row. */
export function visibilityLabel(v: SearchVisibility | undefined, ev?: RankEvidence | null): string {
  const q = ev?.search_query_used ? ` for "${ev.search_query_used}"` : ''
  switch (v) {
    case 'dominant': return `Already dominates search${q}`
    case 'visible':  return `Appears on page 1${q} — visibility need is weak`
    case 'weak':     return `Ranks page 2 or lower${q} — weak visibility`
    case 'absent':   return `Not found${q} — invisible in their own category`
    default:         return 'Search visibility not checked — not relevant to what you sell'
  }
}
