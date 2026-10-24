/**
 * EBEXTA FEASIBILITY GATE — can this company actually USE what you sell?
 * ---------------------------------------------------------------------------
 * Some products have prerequisites. Software that runs on a company's existing
 * CCTV network cannot be deployed at a company with no cameras — no matter how
 * funded, how large, or how strong every other signal is.
 *
 * Equally: having the prerequisite AT SCALE is often a stronger buying signal
 * than funding. A company with 200 cameras across 6 sites is the ideal buyer.
 *
 * THE GATE ONLY RUNS WHEN THE SELLER HAS DECLARED A PREREQUISITE.
 * With none set, every function here short-circuits and behaviour is unchanged.
 *
 * Decision order (cheapest and strongest first):
 *   1. Site walkthrough evidence — pages we actually fetched
 *   2. Firmographic inference — business type strongly implies it
 *   3. Gemini judgement — ONE batched call for the whole shortlist
 *
 * Requires supabase/feasibility_gate.sql.
 */

import { supabase } from './supabase'
import { callGemini } from './gemini'
import type { ScannedLead } from './scanEngine'
import { safeParseJSON } from './safeJson'

// ─── Types ────────────────────────────────────────────────────────────────────

export type FeasibilityStatus = 'ready' | 'unknown' | 'not_viable'

export interface FeasibilityEvidence {
  source: 'website' | 'firmographic' | 'ai'
  detail: string
  source_url: string | null
  /** Only website evidence can ever be presented as verified fact. */
  is_verified: boolean
}

export interface FeasibilityVerdict {
  status: FeasibilityStatus
  score: number
  evidence: FeasibilityEvidence[]
  prerequisite: string
  /** e.g. "multi-site", "large premises" — drives the +40 vs +25 split. */
  scale_indicator: string | null
}

// ─── Prerequisite vocabulary ──────────────────────────────────────────────────

/**
 * Terms that indicate a prerequisite is PRESENT, and business types that imply
 * it. Keyed by a normalised prerequisite phrase. Anything not listed here still
 * works — it falls through to the EBEXTA Engine judgement step.
 */
interface PrereqProfile {
  match: RegExp
  /** Words on their site that mean they have it. */
  positive: RegExp
  /** Words that mean they almost certainly do NOT have it. */
  negative: RegExp
  /** Industries / descriptors that imply they have it. */
  impliesPresent: RegExp
  /** Industries / descriptors that imply they do not. */
  impliesAbsent: RegExp
  /** Site words that mean they have it at scale. */
  scale: RegExp
}

const PREREQ_PROFILES: PrereqProfile[] = [
  {
    // CCTV / surveillance / video infrastructure
    match: /cctv|camera|surveillance|video\s*(?:feed|infra|monitor)|nvr|dvr/i,
    positive: /\bcctv\b|surveillance|security camera|video monitoring|nvr\b|dvr\b|control room|security guard|guard(?:ing)? staff|access control|premises security/i,
    negative: /fully remote|remote[- ]first|no physical office|work from anywhere|distributed team/i,
    impliesPresent: /manufactur|factory|plant|warehouse|logistics|retail|store|outlet|showroom|hospital|clinic|school|college|campus|hotel|resort|bank|petrol|fuel|mall|airport|port|mining|construction site|cold storage|distribution/i,
    impliesAbsent: /\bsaas\b|software (?:agency|studio|company)|app development|web (?:design|development)|digital (?:agency|marketing)|consultanc|freelance|remote[- ]first/i,
    scale: /multiple (?:locations|sites|branches|outlets|plants|warehouses)|\d{2,}\s*(?:branches|outlets|stores|locations|sites|plants|warehouses)|pan[- ]india|nationwide|across \d+ (?:cities|states)/i,
  },
  {
    // Physical stores / retail footprint
    match: /physical store|retail (?:outlet|store|presence)|storefront|branch|showroom/i,
    positive: /store locator|our (?:stores|outlets|branches|showrooms)|visit us at|walk[- ]in|find a store/i,
    negative: /online[- ]only|pure[- ]play (?:online|ecommerce)|d2c online|no physical/i,
    impliesPresent: /retail|restaurant|cafe|pharmacy|supermarket|showroom|dealership|salon|gym|clinic|bank/i,
    impliesAbsent: /\bsaas\b|software|agency|consultanc|remote[- ]first|marketplace only/i,
    scale: /\d{2,}\s*(?:stores|outlets|branches|showrooms)|multiple (?:cities|locations)|pan[- ]india|nationwide/i,
  },
  {
    // Fleet / vehicles
    match: /fleet|vehicle|truck|logistics fleet|transport/i,
    positive: /our fleet|fleet of|vehicles|trucks|drivers|last[- ]mile|delivery network|dispatch/i,
    negative: /asset[- ]light|no owned vehicles|purely software/i,
    impliesPresent: /logistics|transport|trucking|courier|delivery|fleet|mobility|cab|taxi|shipping|distribution/i,
    impliesAbsent: /\bsaas\b|software|agency|consultanc|fintech|edtech/i,
    scale: /\d{2,}\s*(?:vehicles|trucks|drivers)|fleet of \d+|nationwide (?:network|coverage)/i,
  },
  {
    // ERP / existing enterprise systems
    match: /\berp\b|sap|oracle|tally|existing (?:system|software)|crm/i,
    positive: /\berp\b|\bsap\b|oracle|tally|netsuite|dynamics|salesforce|zoho|integration with/i,
    negative: /spreadsheet[- ]based|manual process|no software/i,
    impliesPresent: /manufactur|enterprise|distribution|wholesale|pharma|automotive/i,
    impliesAbsent: /startup|early[- ]stage|freelance|solo/i,
    scale: /enterprise[- ]wide|multi[- ]entity|group compan/i,
  },
  {
    // Cloud / existing digital infrastructure
    match: /cloud|aws|azure|gcp|kubernetes|existing infrastructure|data ?cent/i,
    positive: /\baws\b|\bazure\b|google cloud|\bgcp\b|kubernetes|docker|microservices|data ?cent|devops/i,
    negative: /on[- ]premise only|no cloud|legacy only/i,
    impliesPresent: /\bsaas\b|software|tech|platform|fintech|edtech|healthtech|api|developer/i,
    impliesAbsent: /retail store|restaurant|salon|local (?:shop|business)/i,
    scale: /multi[- ]region|global infrastructure|high availability|scale of \d+/i,
  },
]

function profileFor(prerequisite: string): PrereqProfile | null {
  return PREREQ_PROFILES.find(p => p.match.test(prerequisite)) ?? null
}

// ─── Reading the seller's declared prerequisites ──────────────────────────────

function cleanList(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map(x => String(x ?? '').trim()).filter(Boolean).slice(0, 5)
}

/**
 * What must already exist at the client's side.
 * Product-level prerequisites win when product targeting is active.
 * Returns [] when the seller declared none — which disables the gate.
 */
export async function fetchPrerequisites(userId: string): Promise<string[]> {
  if (!userId) return []
  try {
    const [{ data: product }, { data: profile }] = await Promise.all([
      supabase.from('user_products')
        .select('prerequisites')
        .eq('user_id', userId).eq('is_active', true)
        .maybeSingle(),
      supabase.from('profiles')
        .select('prerequisites, target_type')
        .eq('id', userId)
        .maybeSingle(),
    ])

    const productPrereqs = cleanList(product?.prerequisites)
    const profilePrereqs = cleanList(profile?.prerequisites)

    // Product targeting active and the product declares its own → those win.
    if (profile?.target_type === 'product' && productPrereqs.length > 0) return productPrereqs
    return profilePrereqs.length > 0 ? profilePrereqs : productPrereqs
  } catch (err) {
    // Column missing (SQL not run yet) → behave exactly as before.
    console.warn('[EBEXTA] prerequisites unavailable — feasibility gate skipped:', err)
    return []
  }
}

// ─── 1. Site walkthrough evidence (strongest) ────────────────────────────────

interface PageLike { url?: string; kind?: string; headings?: string[] }

/** Text we can actually search: page headings + everything the site said. */
function siteTextFor(lead: Partial<ScannedLead>): { text: string; urlFor: (needle: string) => string | null } {
  const pages = (lead.pages_read ?? []) as PageLike[]
  const w = (lead.site_walkthrough ?? {}) as Record<string, unknown>

  const perPage = pages.map(p => ({
    url: p.url ?? null,
    text: [(p.headings ?? []).join(' ')].join(' ').toLowerCase(),
  }))

  const walkthroughText = [
    String(w.what_they_actually_do ?? ''),
    ...(Array.isArray(w.services_listed) ? w.services_listed.map(String) : []),
    ...(Array.isArray(w.industries_served) ? w.industries_served.map(String) : []),
    ...(Array.isArray(w.locations_listed) ? w.locations_listed.map(String) : []),
    String(w.size_indicators ?? ''),
    String(w.tone_and_positioning ?? ''),
  ].join(' ').toLowerCase()

  const all = [walkthroughText, ...perPage.map(p => p.text)].join(' ')
  const homeUrl = pages.find(p => p.kind === 'home')?.url ?? pages[0]?.url ?? null

  return {
    text: all,
    urlFor: (needle: string) => {
      const hit = perPage.find(p => p.text.includes(needle.toLowerCase()))
      return hit?.url ?? homeUrl
    },
  }
}

/** Did the pages we fetched settle it? Null when the site was silent. */
function checkFromSite(
  lead: Partial<ScannedLead>,
  prof: PrereqProfile | null,
): { status: FeasibilityStatus; evidence: FeasibilityEvidence; scale: string | null } | null {
  // No site read = no site evidence. Never pretend otherwise.
  const readOk = lead.site_read_status === 'full' || lead.site_read_status === 'partial'
  if (!readOk || !prof) return null

  const { text, urlFor } = siteTextFor(lead)
  if (!text.trim()) return null

  const posMatch = text.match(prof.positive)
  if (posMatch) {
    const scaleMatch = text.match(prof.scale)
    return {
      status: 'ready',
      scale: scaleMatch ? scaleMatch[0] : null,
      evidence: {
        source: 'website',
        detail: scaleMatch
          ? `Their website mentions "${posMatch[0]}" and operates at scale — "${scaleMatch[0]}".`
          : `Their website mentions "${posMatch[0]}".`,
        source_url: urlFor(posMatch[0]),
        is_verified: true,
      },
    }
  }

  const negMatch = text.match(prof.negative)
  if (negMatch) {
    return {
      status: 'not_viable',
      scale: null,
      evidence: {
        source: 'website',
        detail: `Their website describes them as "${negMatch[0]}" — the prerequisite cannot be present.`,
        source_url: urlFor(negMatch[0]),
        is_verified: true,
      },
    }
  }

  return null
}

// ─── 2. Firmographic inference ────────────────────────────────────────────────

function checkFromFirmographics(
  lead: Partial<ScannedLead>,
  prof: PrereqProfile | null,
): { status: FeasibilityStatus; evidence: FeasibilityEvidence; scale: string | null } | null {
  if (!prof) return null

  const descriptor = [
    lead.industry ?? '', lead.description ?? '', lead.requirement_theme ?? '',
    lead.company_stage ?? '', (lead.big_projects ?? []).join(' '),
  ].join(' ')
  if (!descriptor.trim()) return null

  const employees = lead.employee_count ?? 0

  const present = descriptor.match(prof.impliesPresent)
  if (present) {
    // Headcount is the honest proxy for scale when the site didn't say.
    const atScale = employees >= 500
    return {
      status: 'ready',
      scale: atScale ? `${employees.toLocaleString()} employees` : null,
      evidence: {
        source: 'firmographic',
        detail: atScale
          ? `A ${descriptor.match(prof.impliesPresent)?.[0]} business with ${employees.toLocaleString()} employees almost certainly has this in place, at scale.`
          : `Their business type (${present[0]}) strongly implies this is already in place.`,
        source_url: null,
        is_verified: false,   // inference, not fact — the badge must say so
      },
    }
  }

  const absent = descriptor.match(prof.impliesAbsent)
  // A small company of a type that implies absence is the clear-cut case.
  // A large one might still have premises, so we stay honest and say unknown.
  if (absent && employees > 0 && employees < 50) {
    return {
      status: 'not_viable',
      scale: null,
      evidence: {
        source: 'firmographic',
        detail: `A ${absent[0]} business with ${employees} employees is very unlikely to have this — the product could not be deployed.`,
        source_url: null,
        is_verified: false,
      },
    }
  }

  return null
}

// ─── 3. Gemini judgement — ONE batched call for the whole shortlist ───────────

interface AiVerdict {
  company: string
  has_prerequisite: 'yes' | 'no' | 'unknown'
  evidence: string
  scale_indicator: string | null
}

async function judgeBatch(
  leads: Array<Partial<ScannedLead>>,
  prerequisite: string,
): Promise<Map<string, AiVerdict>> {
  const out = new Map<string, AiVerdict>()
  if (leads.length === 0) return out

  const block = leads.map((l, i) => {
    const w = (l.site_walkthrough ?? {}) as Record<string, unknown>
    const siteBits = [
      String(w.what_they_actually_do ?? ''),
      Array.isArray(w.services_listed) ? w.services_listed.map(String).join(', ') : '',
      String(w.size_indicators ?? ''),
      Array.isArray(w.locations_listed) ? w.locations_listed.map(String).join(', ') : '',
    ].filter(Boolean).join(' | ').slice(0, 500)

    return `${i + 1}. COMPANY: ${l.company_name}
   Industry: ${l.industry ?? 'unknown'} | Employees: ${l.employee_count ?? 'unknown'} | Location: ${l.location ?? 'unknown'}
   Website text: ${siteBits || '(their website could not be read)'}`
  }).join('\n\n')

  const prompt = `For each company below, judge whether they ALREADY have ${prerequisite}. Base this on the website text provided and the company's nature.

${block}

Return ONLY JSON array:
[{ "company": "", "has_prerequisite": "yes|no|unknown", "evidence": "what indicates this", "scale_indicator": "how much of it they likely have, or null" }]

Answer 'unknown' when genuinely unclear — do NOT guess. A wrong 'yes' wastes the user's time; a wrong 'no' loses them a customer.`

  try {
    const text = await callGemini(prompt, { action: 'enrich' })
    const parsed = safeParseJSON<AiVerdict[]>(text)
    // No verdicts → every lead stays 'unknown', which the gate treats as
    // shown-but-ranked-lower. Never as excluded.
    if (!Array.isArray(parsed)) return out
    for (const v of parsed) {
      if (!v?.company) continue
      const verdict = String(v.has_prerequisite ?? 'unknown').toLowerCase()
      out.set(v.company.trim().toLowerCase(), {
        company: v.company,
        has_prerequisite: verdict === 'yes' ? 'yes' : verdict === 'no' ? 'no' : 'unknown',
        evidence: String(v.evidence ?? ''),
        scale_indicator: v.scale_indicator ? String(v.scale_indicator) : null,
      })
    }
  } catch (err) {
    // A judgement failure must leave leads as 'unknown', never exclude them.
    console.error('[EBEXTA] feasibility batch judgement failed:', err)
  }
  return out
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * 'ready' at scale is worth more than funding — a company with the prerequisite
 * everywhere is the ideal buyer, not merely an eligible one.
 */
export function scoreFor(status: FeasibilityStatus, scale: string | null): number {
  if (status === 'ready') return scale ? 40 : 25
  return 0   // 'unknown' is neutral; 'not_viable' never reaches ranking
}

export function feasibilityLabel(status: FeasibilityStatus | undefined, prerequisite: string): string {
  const thing = prerequisite.replace(/^(existing|an?|the)\s+/i, '').trim()
  switch (status) {
    case 'ready':      return `Has existing ${thing}`
    case 'not_viable': return `No ${thing} — cannot deploy`
    case 'unknown':    return `${thing.charAt(0).toUpperCase()}${thing.slice(1)} unconfirmed — verify before pitching`
    default:           return ''
  }
}

// ─── The gate ─────────────────────────────────────────────────────────────────

export interface GateResult {
  /** Leads that survived — 'ready' and 'unknown', already ranked. */
  kept: ScannedLead[]
  /** Leads removed as unsellable, kept for the admin audit. */
  excluded: Array<{ lead: ScannedLead; reason: string; evidence: FeasibilityEvidence[] }>
  /** The prerequisite that was checked; empty means the gate did not run. */
  prerequisite: string
}

/**
 * Run the gate over the final shortlist.
 * With no prerequisite declared this returns every lead untouched — no work
 * done, no API calls, no behaviour change.
 */
export async function applyFeasibilityGate(
  leads: ScannedLead[],
  prerequisites: string[],
  onProgress?: (msg: string) => void,
): Promise<GateResult> {
  const prerequisite = (prerequisites ?? [])[0] ?? ''
  if (!prerequisite || leads.length === 0) {
    return { kept: leads, excluded: [], prerequisite: '' }
  }

  const prof = profileFor(prerequisite)
  onProgress?.(`Checking which companies can actually use ${prerequisite}…`)

  const verdicts = new Map<string, FeasibilityVerdict>()
  const needsAi: ScannedLead[] = []

  // Steps 1 and 2 — free, and stronger than a guess.
  for (const lead of leads) {
    const fromSite = checkFromSite(lead, prof)
    if (fromSite) {
      verdicts.set(lead.id, {
        status: fromSite.status,
        score: scoreFor(fromSite.status, fromSite.scale),
        evidence: [fromSite.evidence],
        prerequisite,
        scale_indicator: fromSite.scale,
      })
      continue
    }

    const fromFirmo = checkFromFirmographics(lead, prof)
    if (fromFirmo) {
      verdicts.set(lead.id, {
        status: fromFirmo.status,
        score: scoreFor(fromFirmo.status, fromFirmo.scale),
        evidence: [fromFirmo.evidence],
        prerequisite,
        scale_indicator: fromFirmo.scale,
      })
      continue
    }

    needsAi.push(lead)
  }

  // Step 3 — one call for everything still unresolved.
  if (needsAi.length > 0) {
    const judged = await judgeBatch(needsAi, prerequisite)
    for (const lead of needsAi) {
      const v = judged.get(lead.company_name.trim().toLowerCase())
      const status: FeasibilityStatus =
        v?.has_prerequisite === 'yes' ? 'ready'
        : v?.has_prerequisite === 'no' ? 'not_viable'
        : 'unknown'
      verdicts.set(lead.id, {
        status,
        score: scoreFor(status, v?.scale_indicator ?? null),
        evidence: v
          ? [{ source: 'ai', detail: v.evidence || 'Judged from the company profile.', source_url: null, is_verified: false }]
          : [{ source: 'ai', detail: 'Could not determine whether this company has the prerequisite.', source_url: null, is_verified: false }],
        prerequisite,
        scale_indicator: v?.scale_indicator ?? null,
      })
    }
  }

  // Attach the verdict to each lead, then split.
  const kept: ScannedLead[] = []
  const excluded: GateResult['excluded'] = []

  for (const lead of leads) {
    const v = verdicts.get(lead.id) ?? {
      status: 'unknown' as FeasibilityStatus, score: 0, evidence: [], prerequisite, scale_indicator: null,
    }
    const enriched: ScannedLead = {
      ...lead,
      feasibility_status: v.status,
      feasibility_score: v.score,
      feasibility_evidence: v.evidence,
      feasibility_prerequisite: prerequisite,
    }

    if (v.status === 'not_viable') {
      excluded.push({
        lead: enriched,
        reason: v.evidence[0]?.detail ?? `No ${prerequisite} found`,
        evidence: v.evidence,
      })
      continue
    }

    // Feasibility joins the itemised breakdown like every other signal, so the
    // user can see exactly why this lead ranked where it did.
    if (v.score !== 0) {
      enriched.score_breakdown = [
        ...(lead.score_breakdown ?? []),
        { signal: v.scale_indicator ? `Has ${prerequisite} at scale` : `Has ${prerequisite}`, points: v.score },
      ]
    }
    kept.push(enriched)
  }

  return { kept, excluded, prerequisite }
}

/** Record what the gate removed, so over-filtering is visible immediately. */
export async function logExclusions(
  userId: string,
  scanId: string | null,
  prerequisite: string,
  excluded: GateResult['excluded'],
): Promise<void> {
  if (excluded.length === 0) return
  try {
    await supabase.from('feasibility_exclusions').insert(
      excluded.map(e => ({
        user_id: userId,
        scan_id: scanId,
        company_name: e.lead.company_name,
        prerequisite,
        reason: e.reason.slice(0, 500),
        evidence: e.evidence,
      })),
    )
  } catch (err) {
    console.warn('[EBEXTA] could not log feasibility exclusions:', err)
  }
}
