/**
 * EBEXTA — WHO ACTUALLY NEEDS THIS?
 * ---------------------------------------------------------------------------
 * The regression this fixes: a game-development provider was shown SaaS and
 * cloud companies. The description said "game development company" and the
 * industry filter said "Technology" — and the filter won.
 *
 * The missing step was translation. Nothing turned
 *   "we build games"  →  "gaming studios, ed-tech, brands, AR/VR, publishers"
 * so the model had to make that leap itself, inside a prompt where a concrete
 * industry filter was pulling the other way.
 *
 * This module does that translation once per description, before discovery, and
 * caches it. One cheap ungrounded call.
 */

import { callGemini } from './gemini'
import { MISSION_MAX } from './sanitize'
import { safeParseJSON } from './safeJson'

export interface BuyerProfile {
  /** What they actually sell, 2-5 words. The thing buyers need. */
  core_service: string
  service_category: string
  /** Prose describing the businesses that genuinely need this. */
  who_needs_this: string
  buyer_industries: string[]
  buyer_triggers: string[]
  /** Phrases that find companies NEEDING this — not companies providing it. */
  search_phrases: string[]
  /** Company types to exclude — above all, competitors. */
  exclude: string[]
}

// ─── Cache ────────────────────────────────────────────────────────────────────
// Keyed on the description itself, so re-scanning with the same profile costs
// nothing. Session-scoped: a description edit invalidates it naturally.
const cache = new Map<string, BuyerProfile>()

function cacheKey(description: string, mode: string): string {
  return `${mode}::${description.trim().toLowerCase().slice(0, 300)}`
}

function str(v: unknown, max = 400): string {
  return (v == null ? '' : String(v)).trim().slice(0, max)
}
function arr(v: unknown, max = 8): string[] {
  return Array.isArray(v)
    ? v.map(x => String(x).trim()).filter(Boolean).slice(0, max)
    : []
}

/**
 * Sensible fallback when the extraction call fails.
 * Critically it still keeps the DESCRIPTION central — the whole bug was the
 * description getting dropped, so a degraded path must never drop it again.
 */
function fallbackProfile(description: string, mode: string): BuyerProfile {
  const svc = description.trim().slice(0, 80) || 'B2B services'
  return {
    core_service: svc,
    service_category: '',
    who_needs_this: mode === 'provider'
      ? `Businesses that need ${svc} but do not provide it themselves.`
      : `Companies that provide ${svc}.`,
    buyer_industries: [],
    buyer_triggers: [],
    search_phrases: mode === 'provider'
      ? [`companies needing ${svc}`, `businesses looking for ${svc}`, `${svc} outsourcing`]
      : [`${svc} providers`, `${svc} agencies`, `${svc} vendors`],
    exclude: mode === 'provider' ? [`companies that provide ${svc}`] : [],
  }
}

/**
 * Translate the user's self-description into a description of their BUYERS.
 *
 * @param description  what the user wrote about their company/product
 * @param mode         'provider' (find buyers) or 'seeker' (find vendors)
 */
export async function extractBuyerProfile(
  description: string,
  mode: 'seeker' | 'provider' = 'provider',
): Promise<BuyerProfile> {
  const desc = (description ?? '').trim()
  if (!desc) return fallbackProfile('', mode)

  const key = cacheKey(desc, mode)
  const hit = cache.get(key)
  if (hit) return hit

  const directionNote = mode === 'provider'
    ? `The user SELLS this. Describe the businesses that would BUY it.`
    : `The user WANTS TO BUY this. Describe the companies that PROVIDE it.`

  const prompt = `A company describes itself as:
"""${desc.slice(0, MISSION_MAX)}"""

${directionNote}

Return ONLY JSON:
{
  "core_service": "the specific service or product they actually sell, in 2-5 words",
  "service_category": "the category it belongs to",
  "who_needs_this": "describe the businesses that genuinely need this service — be specific about their type, situation and why",
  "buyer_industries": ["industries where buyers of THIS service live"],
  "buyer_triggers": ["what situations make a company need this service"],
  "search_phrases": ["5 search phrases that would find companies NEEDING this service — phrase them around the NEED, not the service"],
  "exclude": ["types of companies to exclude — especially competitors who provide this same service"]
}

Worked example — for "game development company" in provider mode:
- core_service: "custom game development"
- who_needs_this should describe gaming studios needing outsourced dev, ed-tech companies wanting gamified learning, brands wanting branded games, casino/real-money gaming operators, AR/VR companies — NOT SaaS or cloud companies.
- search_phrases would be things like "gaming studios hiring external developers", "brands launching branded games", "ed-tech companies gamification" — NOT "game development companies", which would return competitors.
- exclude would include "other game development studios and agencies".

Be concrete and specific to THIS description. No markdown, no backticks.`

  try {
    const fetchPromise = callGemini(prompt, { action: 'enrich', maxRetries: 1 })
    const timeoutPromise = new Promise<string>((_, reject) =>
      setTimeout(() => reject(new Error('Buyer profile timeout')), 7000)
    )
    const text = await Promise.race([fetchPromise, timeoutPromise])
    const o = safeParseJSON<Record<string, unknown>>(text)
    // Unparseable → the built-in profile, which is always better than throwing
    // during the very first step of a scan.
    if (!o) return fallbackProfile(desc, mode)
    const profile: BuyerProfile = {
      core_service: str(o.core_service, 80) || desc.slice(0, 80),
      service_category: str(o.service_category, 80),
      who_needs_this: str(o.who_needs_this, 800),
      buyer_industries: arr(o.buyer_industries),
      buyer_triggers: arr(o.buyer_triggers),
      search_phrases: arr(o.search_phrases, 6),
      exclude: arr(o.exclude, 6),
    }

    // An extraction with no usable search phrases is worse than the fallback.
    if (profile.search_phrases.length === 0 && !profile.who_needs_this) {
      return fallbackProfile(desc, mode)
    }

    cache.set(key, profile)
    return profile
  } catch (err) {
    console.warn('[EBEXTA] buyer profile extraction fast fallback:', err)
    return fallbackProfile(desc, mode)
  }
}

// ─── Need categories — the pool reuse key ─────────────────────────────────────

/**
 * Normalised tags describing what a matched company NEEDS.
 *
 * This is what keeps a game-dev seller and a SaaS seller apart even when both
 * filter "Technology, Bengaluru": their categories don't intersect, so they
 * can't draw each other's pooled leads.
 */
export function needCategories(profile: BuyerProfile): string[] {
  const raw = [
    profile.core_service,
    profile.service_category,
    ...profile.buyer_industries,
    ...profile.buyer_triggers,
  ]
  const tags = raw
    .flatMap(s => String(s).toLowerCase().split(/[,/&|]+/))
    .map(s => s.replace(/[^a-z0-9 +-]/g, ' ').replace(/\s+/g, ' ').trim())
    // Single words are too coarse — "tech" would match everything.
    .filter(s => s.length >= 4 && s.length <= 48)
  return [...new Set(tags)].slice(0, 24)
}

/** Jaccard overlap of two tag sets, 0-100. */
export function categoryOverlap(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0
  const setB = new Set(b)
  // Substring matching either way, so "game development" hits "custom game development".
  const shared = a.filter(x => setB.has(x) || b.some(y => y.includes(x) || x.includes(y)))
  const union = new Set([...a, ...b]).size
  return union > 0 ? Math.round((shared.length / union) * 100) : 0
}

// ─── Step D — does this lead's need actually relate to what we sell? ──────────

const STOPWORDS = new Set([
  'the', 'and', 'for', 'with', 'that', 'this', 'their', 'they', 'from', 'have',
  'company', 'companies', 'business', 'businesses', 'services', 'service',
  'solutions', 'solution', 'needs', 'need', 'looking', 'a', 'an', 'of', 'to',
])

function tokens(s: string): string[] {
  return String(s).toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
}

/**
 * Score 0-100: does this need_summary genuinely reference the user's service?
 *
 * Deliberately conservative — an empty or generic summary scores near zero, so
 * a lead the model couldn't justify gets dropped instead of shown. That is the
 * behaviour the regression was missing.
 */
export function scoreDescriptionMatch(
  needSummary: string,
  profile: BuyerProfile,
): number {
  const summary = (needSummary ?? '').trim()
  if (summary.length < 15) return 0   // empty or a stub — not a justification

  // Boilerplate that says nothing about this company specifically.
  if (/^(they|this company|the company)?\s*(could|might|may|would)\s+(benefit|use|need)/i.test(summary)) {
    return 15
  }

  const summaryTokens = new Set(tokens(summary))
  if (summaryTokens.size === 0) return 0

  let score = 0

  // The strongest signal: the core service named in the summary.
  const serviceTokens = tokens(profile.core_service)
  const serviceHits = serviceTokens.filter(t => summaryTokens.has(t)).length
  if (serviceTokens.length > 0) {
    score += Math.round((serviceHits / serviceTokens.length) * 45)
  }

  // A trigger the buyer profile predicted actually showing up.
  const triggerHit = profile.buyer_triggers.some(tr =>
    tokens(tr).some(t => summaryTokens.has(t)))
  if (triggerHit) score += 20

  // The company sitting in an industry we expect buyers to live in.
  const industryHit = profile.buyer_industries.some(ind =>
    tokens(ind).some(t => summaryTokens.has(t)))
  if (industryHit) score += 15

  // Overlap with the who_needs_this prose.
  const whoTokens = new Set(tokens(profile.who_needs_this))
  const whoHits = [...summaryTokens].filter(t => whoTokens.has(t)).length
  if (whoTokens.size > 0) score += Math.min(20, whoHits * 4)

  return Math.max(0, Math.min(100, score))
}

/** Below this, the lead is excluded rather than shown. */
export const MIN_DESCRIPTION_MATCH = 40
