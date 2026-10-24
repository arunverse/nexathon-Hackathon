/**
 * EBEXTA V2 — Company Memory intelligence generators.
 * ---------------------------------------------------------------------------
 * COST RULE (critical): the two Gemini-backed sections are generated ONCE, on
 * demand, when the user opens a company — then cached to company_memory
 * forever. Reopening the page makes ZERO API calls. The ONLY way to regenerate
 * is an explicit "Refresh intelligence" click (force = true).
 *
 * Never call these in a loop over scan results.
 *
 * The other two sections cost nothing:
 *  - Opportunity timeline  → pure rules, no API
 *  - Verification matrix   → reads what the scan already stored, no API
 */

import { callGemini } from './gemini'
import { supabase } from './supabase'
import {
  updateMemory,
  type CompanyMemory,
  type RelationshipMap,
  type RelationshipNode,
  type DealStrategy,
  type OpportunityTimeline,
  type OppStageKey,
  type VerificationMatrix,
  type MatrixRow,
  type MatrixState,
} from './companyMemory'
import { normalizeUrl, googleSearch, linkedInCompanySearch, linkedInPersonSearch } from './urlUtils'
import { isValidEmail } from './linkVerifier'
import { safeParseJSON } from './safeJson'

// ─── JSON extraction (Gemini sometimes wraps in prose or fences) ──────────────

function parseJson<T>(raw: string): T | null {
  // Every Gemini response in this file goes through the shared parser, which
  // recovers fenced, prose-wrapped and truncated JSON instead of throwing. A
  // SyntaxError here used to take the whole deal-intel view down.
  const viaShared = safeParseJSON<T>(raw)
  if (viaShared !== null) return viaShared
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  const s = cleaned.indexOf('{')
  const e = cleaned.lastIndexOf('}')
  if (s === -1 || e <= s) return null
  try {
    return JSON.parse(cleaned.slice(s, e + 1)) as T
  } catch {
    return null
  }
}

type Snapshot = Record<string, unknown>

function snap(memory: CompanyMemory): Snapshot {
  return (memory.company_snapshot ?? {}) as Snapshot
}

function str(v: unknown, fallback = ''): string {
  const s = v == null ? '' : String(v).trim()
  return s || fallback
}

// ════════════════════════════════════════════════════════════════════════════
// #2 RELATIONSHIP INTELLIGENCE — Gemini, generated once, cached
// ════════════════════════════════════════════════════════════════════════════

const DECISION_ROLES: RelationshipNode['decision_role'][] = [
  'Economic Buyer', 'Technical Approver', 'Champion', 'Influencer', 'Gatekeeper',
]

function sanitizeRelationshipMap(raw: unknown, knownNames: string[]): RelationshipMap | null {
  const obj = raw as { hierarchy?: unknown; approach_advice?: unknown }
  if (!obj || !Array.isArray(obj.hierarchy)) return null

  // The prompt says "infer from titles only — do not invent people". We enforce
  // that here: any node whose name isn't a stakeholder we actually found is
  // dropped, so the tree can never show a hallucinated person.
  const allowed = new Set(knownNames.map(n => n.trim().toLowerCase()))

  const nodes: RelationshipNode[] = []
  for (const item of obj.hierarchy as Array<Record<string, unknown>>) {
    const name = str(item?.name)
    if (!name || !allowed.has(name.toLowerCase())) continue
    const role = str(item?.decision_role) as RelationshipNode['decision_role']
    const reportsToRaw = str(item?.reports_to)
    nodes.push({
      name,
      title: str(item?.title, '—'),
      reports_to: reportsToRaw && allowed.has(reportsToRaw.toLowerCase()) ? reportsToRaw : null,
      decision_role: DECISION_ROLES.includes(role) ? role : 'Influencer',
      approach_order: Number(item?.approach_order) > 0 ? Math.round(Number(item.approach_order)) : 99,
    })
  }
  if (nodes.length === 0) return null

  // A node can't report to itself, and a 2-cycle would render as an infinite tree.
  const byName = new Map(nodes.map(n => [n.name.toLowerCase(), n]))
  for (const n of nodes) {
    if (n.reports_to && n.reports_to.toLowerCase() === n.name.toLowerCase()) n.reports_to = null
    const parent = n.reports_to ? byName.get(n.reports_to.toLowerCase()) : null
    if (parent && parent.reports_to && parent.reports_to.toLowerCase() === n.name.toLowerCase()) {
      parent.reports_to = null
    }
  }

  return {
    hierarchy: nodes.sort((a, b) => a.approach_order - b.approach_order),
    approach_advice: str(obj.approach_advice),
  }
}

export async function generateRelationshipMap(
  memory: CompanyMemory,
  userService: string,
): Promise<RelationshipMap | null> {
  const contacts = (memory.contacts ?? []).filter(c => c.name)
  if (contacts.length === 0) return null

  const list = contacts
    .map(c => `${c.name} — ${c.title || 'title unknown'}`)
    .join('; ')

  const prompt = `Given these stakeholders at ${memory.company_name} with titles [${list}], infer the likely reporting hierarchy and decision roles for a B2B purchase of ${userService || 'our service'}. Return ONLY JSON:
{ "hierarchy": [ { "name": "...", "title": "...", "reports_to": "name or null", "decision_role": "Economic Buyer|Technical Approver|Champion|Influencer|Gatekeeper", "approach_order": 1 } ], "approach_advice": "who to contact first and why, one sentence" }
Infer from titles only — do not invent people.`

  const text = await callGemini(prompt, { action: 'enrich' })
  const parsed = parseJson<unknown>(text)
  return sanitizeRelationshipMap(parsed, contacts.map(c => c.name))
}

// ════════════════════════════════════════════════════════════════════════════
// #3 AI DEAL STRATEGY — Gemini, generated once, cached
// ════════════════════════════════════════════════════════════════════════════

function sanitizeDealStrategy(raw: unknown): DealStrategy | null {
  const o = raw as Record<string, unknown>
  if (!o || typeof o !== 'object') return null

  const objections = Array.isArray(o.likely_objections)
    ? (o.likely_objections as Array<Record<string, unknown>>)
        .map(x => ({ objection: str(x?.objection), response: str(x?.response) }))
        .filter(x => x.objection && x.response)
        .slice(0, 5)
    : []

  const s: DealStrategy = {
    why_now:         str(o.why_now),
    likely_problem:  str(o.likely_problem),
    pitch_first:     str(o.pitch_first),
    likely_objections: objections,
    roi_angle:       str(o.roi_angle),
    pricing_model:   str(o.pricing_model),
    opening_line:    str(o.opening_line),
  }
  // If the model returned an empty shell, treat it as a failure rather than
  // rendering a card full of blanks.
  const filled = [s.why_now, s.likely_problem, s.pitch_first, s.roi_angle, s.opening_line]
    .filter(Boolean).length
  return filled >= 3 ? s : null
}

export async function generateDealStrategy(
  memory: CompanyMemory,
  userService: string,
): Promise<DealStrategy | null> {
  const d = snap(memory)
  const contacts = (memory.contacts ?? []).slice(0, 6)
    .map(c => `${c.name} (${c.title || 'unknown title'})`).join(', ')

  const intel = [
    `Name: ${memory.company_name}`,
    d.industry        ? `Industry: ${d.industry}` : '',
    d.location        ? `Location: ${d.location}` : '',
    d.employee_count  ? `Employees: ${d.employee_count}` : '',
    d.funding_stage   ? `Stage: ${d.funding_stage}` : '',
    d.annual_revenue  ? `Revenue: ${d.annual_revenue}` : '',
    d.description     ? `About: ${str(d.description).slice(0, 400)}` : '',
    Array.isArray(d.recent_signals) && d.recent_signals.length
      ? `Recent signals: ${(d.recent_signals as string[]).join('; ').slice(0, 600)}` : '',
    Array.isArray(d.match_reason) && d.match_reason.length
      ? `Why they matched: ${(d.match_reason as string[]).join('; ').slice(0, 400)}` : '',
    d.requirement_theme ? `Requirement theme: ${d.requirement_theme}` : '',
    contacts ? `Known stakeholders: ${contacts}` : '',
  ].filter(Boolean).join('\n')

  const prompt = `Act as a senior B2B sales strategist. Company:
${intel}

We sell: ${userService || 'B2B services'}.
Return ONLY JSON:
{
 "why_now": "the specific reason this moment is right, tied to their real signals",
 "likely_problem": "the problem they are most likely trying to solve",
 "pitch_first": "which specific service/offering to lead with and why",
 "likely_objections": [ {"objection": "...", "response": "..."} ],
 "roi_angle": "the ROI framing that will land",
 "pricing_model": "engagement model that fits their stage and size",
 "opening_line": "one specific first line for outreach"
}
Be specific to this company. No generic advice.`

  const text = await callGemini(prompt, { preferFlash: true, action: 'enrich' })
  return sanitizeDealStrategy(parseJson<unknown>(text))
}

// ════════════════════════════════════════════════════════════════════════════
// #4 OPPORTUNITY TIMELINE — rules only, ZERO Gemini calls
// ════════════════════════════════════════════════════════════════════════════

export const OPP_STAGES: Array<{ key: OppStageKey; label: string }> = [
  { key: 'trigger',        label: 'Trigger Event' },
  { key: 'discussion',     label: 'Internal Discussion' },
  { key: 'evaluation',     label: 'Vendor Evaluation' },
  { key: 'budget',         label: 'Budget Approval' },
  { key: 'purchase',       label: 'Purchase' },
  { key: 'implementation', label: 'Implementation' },
]

/** Cycle length by company stage — mirrors estimated_decision_days in scanEngine. */
export function cycleDaysForStage(stageRaw: string): number {
  const s = (stageRaw || '').toLowerCase()
  if (/bootstrap|self.?fund|pre.?seed/.test(s)) return 7
  if (/\bseed\b/.test(s)) return 10
  if (/series\s*a/.test(s)) return 21
  if (/series\s*[bc]/.test(s)) return 30
  if (/series\s*[d-z]|enterprise|public|listed|ipo/.test(s)) return 45
  return 21
}

function monthsSince(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const t = Date.parse(dateStr)
  if (!Number.isFinite(t)) return null
  return (Date.now() - t) / (1000 * 60 * 60 * 24 * 30.44)
}

/**
 * Estimate where this company sits in the buying cycle.
 * Pure function of what the scan already knows — no API, no cost.
 */
export function computeOpportunityTimeline(memory: CompanyMemory): OpportunityTimeline {
  const d = snap(memory)
  const flags = new Set((Array.isArray(d.intent_flags) ? d.intent_flags : []).map(String))
  const signals = (Array.isArray(d.recent_signals) ? d.recent_signals as string[] : []).join(' ').toLowerCase()

  const stageText = str(d.funding_stage) || str(d.company_stage)
  const impact = (d.business_impact ?? {}) as Record<string, unknown>
  const cycleDays = Number(impact.estimated_decision_days) > 0
    ? Math.round(Number(impact.estimated_decision_days))
    : cycleDaysForStage(stageText)

  // How fresh is the funding trigger? Prefer a real date pulled from the signal
  // text; fall back to first_seen, which is when we saw the signal.
  const fundingRecentMonths = monthsSince(memory.first_seen)

  let current: OppStageKey = 'trigger'
  let why = 'First discovered by EBEXTA — no dated trigger event recorded yet.'

  const hasFunding = flags.has('RECENT_FUNDING') || /rais|funding|series|seed round/.test(signals)
  const hasHiring  = flags.has('HIRING_SURGE') || flags.has('RECENT_HIRING_SALES') || /hiring|recruit|opening/.test(signals)
  const hasLaunch  = flags.has('NEW_PRODUCT_LAUNCH') || /launch|new product|rebrand/.test(signals)
  const hasExpand  = flags.has('GEOGRAPHIC_EXPANSION') || /expand|new office|new market/.test(signals)

  // Active hiring for the related role is the strongest "they're shopping" tell.
  if (hasHiring) {
    current = 'evaluation'
    why = 'Actively hiring for related roles — teams at this point are already comparing vendors.'
  } else if (hasFunding && (fundingRecentMonths == null || fundingRecentMonths <= 3)) {
    current = 'discussion'
    why = 'Funding landed within the last ~3 months — budget exists and the internal "what do we buy first" conversation is happening now.'
  } else if (hasFunding) {
    current = 'evaluation'
    why = 'Funded, but the raise is no longer fresh — spend decisions are likely already in evaluation.'
  } else if (hasLaunch || hasExpand) {
    current = 'discussion'
    why = hasLaunch
      ? 'A launch or rebrand is underway — supporting spend is being scoped internally.'
      : 'Geographic or market expansion is underway — new vendor needs are being scoped.'
  }

  // Deals that already moved through the funnel override the signal guess.
  const outcome = memory.outcome
  if (outcome === 'Won') {
    current = 'implementation'
    why = 'Marked Won — this company has moved past purchase.'
  }

  const idx = OPP_STAGES.findIndex(s => s.key === current)
  // Remaining window = the share of the cycle still ahead of them.
  const remaining = Math.max(3, Math.round(cycleDays * (1 - idx / OPP_STAGES.length)))

  return {
    current_stage: current,
    window_days: remaining,
    why,
    computed_at: new Date().toISOString(),
  }
}

// ════════════════════════════════════════════════════════════════════════════
// #5 MULTI-SOURCE VERIFICATION MATRIX — exposes existing data, ZERO API calls
// ════════════════════════════════════════════════════════════════════════════

interface VerifiedContactLite {
  status: string
  verified_email: string | null
  verified_phone: string | null
  verified_name: string | null
  verified_position: string | null
  verified_linkedin: string | null
  verified_website: string | null
  verified_evidence_url: string | null
  confidence_score: number | null
}

/** EBEXTA-team-verified contact for this company, if one was delivered. */
export async function fetchVerifiedContact(companyName: string): Promise<VerifiedContactLite | null> {
  const { data } = await supabase
    .from('verification_requests')
    .select('status, verified_email, verified_phone, verified_name, verified_position, verified_linkedin, verified_website, verified_evidence_url, confidence_score')
    .eq('company_name', companyName)
    .in('status', ['verified', 'delivered'])
    .order('delivered_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as VerifiedContactLite | null) ?? null
}

/**
 * Build the 8-row checklist. Every row states what proved it, and every
 * unverified row carries a one-click search fallback — never a broken link.
 */
export function computeVerificationMatrix(
  memory: CompanyMemory,
  verified: VerifiedContactLite | null,
): VerificationMatrix {
  const d = snap(memory)
  const name = memory.company_name
  const website = normalizeUrl(str(d.website))
  const linkedin = normalizeUrl(str(d.linkedin_url))
  const evidence = normalizeUrl(str(d.evidence_source_url))
  const fundingUrl = normalizeUrl(str(d.funding_source_url))
  const email = str(d.email)
  const companyContact = (d.company_contact ?? {}) as Record<string, unknown>
  const phone = str(companyContact.phone)
  const contacts = memory.contacts ?? []
  const topContact = contacts[0]

  const rows: MatrixRow[] = []
  const add = (
    key: string, label: string, state: MatrixState,
    sourceUrl?: string | null, fallbackUrl?: string | null, detail?: string,
  ) => rows.push({ key, label, state, source_url: sourceUrl ?? null, fallback_url: fallbackUrl ?? null, detail })

  // 1. Company exists — a scan record plus firmographics is our own evidence.
  add('exists', 'Company exists',
    d.industry || d.location ? 'verified' : 'partial',
    evidence ?? website ?? null,
    googleSearch(name),
    d.industry ? `${str(d.industry)}${d.location ? ` · ${str(d.location)}` : ''}` : 'Discovered by scan')

  // 2. Website live
  add('website', 'Website live',
    website ? 'verified' : 'unverified',
    website,
    googleSearch(`${name} official website`),
    website ?? 'No website found')

  // 3. LinkedIn
  add('linkedin', 'LinkedIn',
    linkedin ? 'verified' : 'unverified',
    linkedin,
    linkedInCompanySearch(name),
    linkedin ?? 'No company page found')

  // 4. Funding claim — only VERIFIED when a funding source link exists.
  const fundingClaim = str(d.funding_stage) || str(d.annual_revenue)
  add('funding', 'Funding claim',
    fundingUrl ? 'verified' : fundingClaim ? 'partial' : 'not_checked',
    fundingUrl,
    googleSearch(`${name} funding round`),
    fundingClaim || 'No funding claim recorded')

  // 5. Email
  const bestEmail = verified?.verified_email || email
  add('email', 'Email',
    verified?.verified_email ? 'verified' : isValidEmail(bestEmail) ? 'partial' : 'unverified',
    verified?.verified_evidence_url ?? null,
    googleSearch(`${name} contact email`),
    bestEmail || 'No email found')

  // 6. Phone
  const bestPhone = verified?.verified_phone || phone
  add('phone', 'Phone',
    verified?.verified_phone ? 'verified' : bestPhone ? 'partial' : 'not_checked',
    verified?.verified_evidence_url ?? (str(companyContact.sourceUrl) || null),
    googleSearch(`${name} contact number`),
    bestPhone || 'No phone found')

  // 7. Decision maker
  add('decision_maker', 'Decision maker',
    verified?.verified_name ? 'verified' : topContact ? 'partial' : 'unverified',
    verified?.verified_linkedin ?? topContact?.linkedin_url ?? null,
    topContact
      ? linkedInPersonSearch(topContact.name, name, topContact.title)
      : linkedInCompanySearch(name),
    verified?.verified_name
      ? `${verified.verified_name}${verified.verified_position ? ` · ${verified.verified_position}` : ''}`
      : topContact ? `${topContact.name}${topContact.title ? ` · ${topContact.title}` : ''}` : 'No named contact yet')

  // 8. News / source
  add('news', 'News / source',
    evidence ? 'verified' : 'unverified',
    evidence,
    googleSearch(`${name} news`),
    evidence ?? 'No dated source captured')

  const verified_count = rows.filter(r => r.state === 'verified').length
  const confidence = Number(d.confidence_score)

  return {
    rows,
    verified_count,
    total: rows.length,
    confidence_score: Number.isFinite(confidence) ? Math.round(confidence) : Math.round((verified_count / rows.length) * 100),
    computed_at: new Date().toISOString(),
  }
}

// ════════════════════════════════════════════════════════════════════════════
// ORCHESTRATOR — the ONLY entry point the Memory page uses
// ════════════════════════════════════════════════════════════════════════════

export interface IntelligenceBundle {
  relationship_map: RelationshipMap | null
  deal_strategy: DealStrategy | null
  opportunity_timeline: OpportunityTimeline
  verification_matrix: VerificationMatrix
  /** true when this call actually spent Gemini quota */
  generated: boolean
  error?: string
}

/**
 * Resolve all four intelligence sections for a company.
 *
 * force = false (page open):
 *   - Cached Gemini sections are returned as-is. NO API call is made.
 *   - Gemini runs ONLY the first time, when both cached sections are empty.
 * force = true ("Refresh intelligence"):
 *   - Both Gemini sections are regenerated and re-cached.
 *
 * The free sections (opportunity timeline, verification matrix) are recomputed
 * every time because they're pure functions — no quota, always current.
 */
export async function ensureIntelligence(
  memory: CompanyMemory,
  userService: string,
  force = false,
): Promise<IntelligenceBundle> {
  // ── Free sections: always fresh, always zero cost ──
  const opportunity_timeline = computeOpportunityTimeline(memory)
  const verifiedContact = await fetchVerifiedContact(memory.company_name)
  const verification_matrix = computeVerificationMatrix(memory, verifiedContact)

  let relationship_map = memory.relationship_map
  let deal_strategy = memory.deal_strategy
  let generated = false
  let error: string | undefined

  const needsGemini = force || (!relationship_map && !deal_strategy)

  if (needsGemini) {
    generated = true
    // Run both in parallel — one failing must not lose the other.
    const [relRes, dealRes] = await Promise.allSettled([
      generateRelationshipMap(memory, userService),
      generateDealStrategy(memory, userService),
    ])

    if (relRes.status === 'fulfilled') {
      relationship_map = relRes.value ?? relationship_map
    } else {
      error = String((relRes.reason as Error)?.message ?? 'Relationship map failed')
      console.error('[EBEXTA] relationship map failed:', relRes.reason)
    }

    if (dealRes.status === 'fulfilled') {
      deal_strategy = dealRes.value ?? deal_strategy
    } else {
      error = String((dealRes.reason as Error)?.message ?? 'Deal strategy failed')
      console.error('[EBEXTA] deal strategy failed:', dealRes.reason)
    }
  }

  // Cache everything back to Supabase so the next open costs nothing.
  // `touch` only when we actually generated something — simply opening a
  // company must not make it look like it was updated.
  await updateMemory(memory.id, {
    relationship_map,
    deal_strategy,
    opportunity_timeline,
    verification_matrix,
    ...(generated && (relationship_map || deal_strategy)
      ? { intelligence_generated_at: new Date().toISOString() }
      : {}),
  }, generated)

  return { relationship_map, deal_strategy, opportunity_timeline, verification_matrix, generated, error }
}
