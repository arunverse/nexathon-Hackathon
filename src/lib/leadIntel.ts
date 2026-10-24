/**
 * Deep Lead Intel — on-demand grounded enrichment for the lead detail page.
 * Generated ONCE per lead (gemini-2.5-flash-lite + googleSearch, temp 0.1),
 * then cached to leads.deep_intel in Supabase + the local per-mode cache so
 * it never regenerates twice.
 */

import { supabase } from './supabase'
import { callGeminiProxy } from './geminiProxy'
import type { ScannedLead } from './scanEngine'
import { parseOrRetry } from './safeJson'
import { checkCredits, consumeCredit } from './credits'

export interface DeepIntel {
  exact_match_story: string[]                       // 3-5 sentences, specific
  future_scope: string[]                            // growth direction / plans
  financial: {
    turnover: string | null
    revenue_growth: string | null
    budget_capacity: string | null
    funding_details?: string | null
    funding_stage?: string | null
  }
  strategic_needs: string[]                         // pain points user can solve
  tech_stack: string[]
  competitors: string[]
  news_timeline: Array<{ date: string; event: string }>
  risk_flags: string[]
  approach_angle: string                            // how & when to pitch
  /** Who ELSE (besides the reader) would be interested in this company — with
   *  the honest good AND bad. Empty array + a note when nobody obvious. */
  other_interested_parties: Array<{ party: string; reason: string; outlook: 'positive' | 'negative' | 'neutral' }>
  other_interest_note: string                       // shown when the list is empty
  generated_at: string
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ── Session cache + in-flight dedup ──────────────────────────────────────────
// Keyed by lead id. MEMORY survives component remounts (tab switches, back/
// forward) so intel is generated exactly ONCE per session and never flickers.
// INFLIGHT dedups rapid re-mounts onto a single network call and keeps running
// even if the component that started it unmounts — so the result is always
// cached, never discarded mid-flight.
const MEMORY = new Map<string, DeepIntel>()
const INFLIGHT = new Map<string, Promise<DeepIntel | null>>()

async function groundedIntelCall(prompt: string): Promise<{ text: string; tokensUsed: number }> {
  // Routed through the secure Edge Function proxy (no API key in the frontend).
  // Grounded Google-Search enrichment; api_usage is logged server-side.
  return await callGeminiProxy(prompt, { action: 'enrich', grounded: true, model: 'gemini-flash-lite-latest', jsonMode: true })
}

export function sanitizeCompanyPlaceholders(
  text: string,
  userCompany?: string | null,
  targetCompany?: string | null,
): string {
  if (!text) return text
  const u = userCompany?.trim() || 'your company'
  const t = targetCompany?.trim() || 'the target company'
  return text
    .replace(/\bCompany\s*A\b/gi, u)
    .replace(/\bCompany\s*B\b/gi, t)
}

export function getIndustryCompetitorFallbacks(companyName?: string, industry?: string): string[] {
  const ind = (industry || '').toLowerCase()
  const name = companyName || ''
  if (ind.includes('machin') || ind.includes('manufactur') || ind.includes('industrial') || ind.includes('equip') || ind.includes('engineer') || ind.includes('automotive')) {
    return ['Caterpillar', 'Komatsu', 'L&T Heavy Engineering', 'Bharat Forge', 'JCB India']
  }
  if (ind.includes('tech') || ind.includes('saas') || ind.includes('softw') || ind.includes('it ')) {
    return ['Salesforce', 'Zoho', 'Freshworks', 'HubSpot']
  }
  if (ind.includes('fin') || ind.includes('pay') || ind.includes('bank')) {
    return ['Pine Labs', 'BillDesk', 'PhonePe', 'Paytm Financial']
  }
  if (ind.includes('logistic') || ind.includes('supply') || ind.includes('transport')) {
    return ['Delhivery', 'Blue Dart', 'Mahindra Logistics', 'TCI Express']
  }
  return [`Top ${industry || name || 'Sector'} Market Peers`, `Regional ${industry || 'Industry'} Competitors`]
}

function shapeIntel(raw: Record<string, unknown>, userCompany?: string, targetCompany?: string): DeepIntel {
  const clean = (s: string) => sanitizeCompanyPlaceholders(s, userCompany, targetCompany)
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map(String).map(clean).filter(Boolean) : []
  const fin = (raw.financial ?? {}) as Record<string, unknown>
  const timeline = Array.isArray(raw.news_timeline)
    ? (raw.news_timeline as Array<Record<string, unknown>>)
        .map(t => ({ date: String(t.date ?? ''), event: clean(String(t.event ?? '')) }))
        .filter(t => t.event)
    : []
  const parties = Array.isArray(raw.other_interested_parties)
    ? (raw.other_interested_parties as Array<Record<string, unknown>>)
        .map(p => {
          const o = String(p.outlook ?? 'neutral').toLowerCase()
          const outlook: 'positive' | 'negative' | 'neutral' =
            o === 'positive' ? 'positive' : o === 'negative' ? 'negative' : 'neutral'
          return { party: clean(String(p.party ?? '').trim()), reason: clean(String(p.reason ?? '').trim()), outlook }
        })
        .filter(p => p.party)
    : []

  const rawComps = arr(raw.competitors)
  const competitors = rawComps.length > 0 ? rawComps : getIndustryCompetitorFallbacks(targetCompany)

  return {
    exact_match_story: arr(raw.exact_match_story),
    future_scope: arr(raw.future_scope),
    financial: {
      turnover: fin.turnover ? clean(String(fin.turnover)) : null,
      revenue_growth: fin.revenue_growth ? clean(String(fin.revenue_growth)) : null,
      budget_capacity: fin.budget_capacity ? clean(String(fin.budget_capacity)) : null,
      funding_details: fin.funding_details ? clean(String(fin.funding_details)) : null,
      funding_stage: fin.funding_stage ? clean(String(fin.funding_stage)) : null,
    },
    strategic_needs: arr(raw.strategic_needs),
    tech_stack: arr(raw.tech_stack),
    competitors,
    news_timeline: timeline,
    risk_flags: arr(raw.risk_flags),
    approach_angle: raw.approach_angle ? clean(String(raw.approach_angle)) : '',
    other_interested_parties: parties,
    other_interest_note: raw.other_interest_note ? clean(String(raw.other_interest_note)) : '',
    generated_at: new Date().toISOString(),
  }
}

/** Update the lead inside both per-mode localStorage caches (if present). */
function patchLocalCaches(leadId: string, intel: DeepIntel) {
  for (const key of ['ebexta_leads_seeker', 'ebexta_leads_provider', 'ebexta_scan_results']) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const arr = JSON.parse(raw) as ScannedLead[]
      const idx = arr.findIndex(l => l.id === leadId)
      if (idx >= 0) {
        arr[idx] = { ...arr[idx], deep_intel: intel as unknown as Record<string, unknown> }
        localStorage.setItem(key, JSON.stringify(arr))
      }
    } catch { /* ignore */ }
  }
}

function resolveUserCompanyName(explicitName?: string): string {
  if (explicitName && explicitName.trim()) return explicitName.trim()
  try {
    const raw = localStorage.getItem('ebexta_scan_filters')
    if (raw) {
      const parsed = JSON.parse(raw)
      if (parsed.companyName && typeof parsed.companyName === 'string' && parsed.companyName.trim()) {
        return parsed.companyName.trim()
      }
    }
  } catch { /* ignore */ }
  return 'Our Company'
}

/**
 * Get deep intel for a lead — cached first, generated once if missing.
 * mission = the user's offering/need (so the match story is specific, not generic).
 */
export async function getDeepIntel(
  lead: ScannedLead,
  mission: string,
  mode: 'seeker' | 'provider',
  userCompanyName?: string
): Promise<DeepIntel | null> {
  const resolvedUserCo = resolveUserCompanyName(userCompanyName)

  // 0. Session memory — already resolved this lead once? Return instantly.
  const mem = MEMORY.get(lead.id)
  if (mem) {
    return shapeIntel(mem as unknown as Record<string, unknown>, resolvedUserCo, lead.company_name)
  }

  // 1. Already on the lead object (localStorage / earlier fetch)?
  if (lead.deep_intel && (lead.deep_intel as Record<string, unknown>).exact_match_story) {
    const cached = shapeIntel(lead.deep_intel as Record<string, unknown>, resolvedUserCo, lead.company_name)
    MEMORY.set(lead.id, cached)
    return cached
  }

  // If a generation for this lead is already running, join it instead of starting a second one.
  const running = INFLIGHT.get(lead.id)
  if (running) return running

  const job = resolveDeepIntel(lead, mission, mode, resolvedUserCo)
  INFLIGHT.set(lead.id, job)
  try {
    return await job
  } finally {
    INFLIGHT.delete(lead.id)
  }
}

async function resolveDeepIntel(
  lead: ScannedLead,
  mission: string,
  mode: 'seeker' | 'provider',
  userCompanyName: string,
): Promise<DeepIntel | null> {
  // 2. Already cached in Supabase?
  if (UUID_RE.test(lead.id)) {
    try {
      const { data } = await supabase.from('leads').select('deep_intel').eq('id', lead.id).maybeSingle()
      if (data?.deep_intel && (data.deep_intel as Record<string, unknown>).exact_match_story) {
        const cached = shapeIntel(data.deep_intel as Record<string, unknown>, userCompanyName, lead.company_name)
        MEMORY.set(lead.id, cached)
        patchLocalCaches(lead.id, cached)
        return cached
      }
    } catch { /* fall through to generation */ }
  }

  // 3. Generate once via grounded Gemini with real company names
  const gate = await checkCredits('advanced_enrichment')
  if (!gate) {
    console.warn('[EBEXTA] Advanced enrichment blocked: insufficient credits or user suspended')
    return null
  }

  const prompt = `Research the company "${lead.company_name}" (${lead.industry ?? ''}, ${lead.location ?? ''}) using Google Search.

CONTEXT:
- READER / YOUR CLIENT'S COMPANY: "${userCompanyName}" (${mode === 'provider' ? 'OFFERS' : 'NEEDS'}: "${mission || 'B2B services'}").
- TARGET MATCHED COMPANY: "${lead.company_name}" (matched as a ${mode === 'provider' ? 'potential CLIENT for ' + userCompanyName : 'potential PROVIDER for ' + userCompanyName}).
- What we already know about ${lead.company_name}: stage ${lead.funding_stage ?? 'unknown'}, ~${lead.employee_count ?? '?'} employees, live signals: ${(lead.recent_signals ?? []).slice(0, 3).join('; ') || 'none recorded'}.

CRITICAL CONSTRAINT: NEVER use generic placeholders like "Company A" or "Company B". ALWAYS refer to the companies by their actual names: "${userCompanyName}" and "${lead.company_name}".

Return ONLY this JSON object (no markdown, no backticks). Every claim must come from your Google Search — write "null"/[] when unknown, never invent:
{
  "exact_match_story": ["3-5 SPECIFIC sentences connecting ${lead.company_name}'s current situation to ${userCompanyName}'s ${mode === 'provider' ? 'offering' : 'need'}. Name real facts. Not generic."],
  "future_scope": ["where ${lead.company_name} is heading: growth direction, upcoming plans, market trajectory — 2-4 points"],
  "financial": { "turnover": "estimated revenue/turnover/ARR", "revenue_growth": "growth rate or expansion trajectory", "budget_capacity": "estimated budget capacity for ${mode === 'provider' ? 'this kind of service' : 'projects like ours'}", "funding_details": "total funding raised, latest round (Seed/Series A/B/Bootstrapped), and lead investors if findable", "funding_stage": "funding stage" },
  "strategic_needs": ["what ${lead.company_name} needs RIGHT NOW based on stage + signals — the pain points ${userCompanyName} can address — 3-5 points"],
  "tech_stack": ["known technologies they use"],
  "competitors": ["their key competitors"],
  "news_timeline": [{ "date": "Mon YYYY", "event": "recent news/signal" }],
  "risk_flags": ["real risks: layoffs, lawsuits, churn, leadership exits — [] if none found"],
  "approach_angle": "One paragraph: the best way and moment for ${userCompanyName} to pitch ${lead.company_name}, tied to a live signal."
}`

  try {
    const { text } = await groundedIntelCall(prompt)

    const raw = await parseOrRetry<Record<string, unknown>>(
      text,
      async (strict) => (await groundedIntelCall(`${strict}\n\n${prompt}`)).text,
      'deep intel',
    )
    if (!raw) {
      console.warn('[EBEXTA] Deep intel unavailable for', lead.company_name, '— unparseable response after retry')
      return null
    }
    const intel = shapeIntel(raw, userCompanyName, lead.company_name)

    await consumeCredit('advanced_enrichment', { company_name: lead.company_name, lead_id: lead.id })

    // 4. Cache back (memory + local + Supabase)
    MEMORY.set(lead.id, intel)
    if (UUID_RE.test(lead.id)) {
      supabase.from('leads').update({ deep_intel: intel }).eq('id', lead.id)
        .then(({ error }) => { if (error) console.warn('[EBEXTA] deep_intel cache save failed:', error.message) })
    }
    patchLocalCaches(lead.id, intel)
    return intel
  } catch (err) {
    console.warn('[EBEXTA] Deep intel generation failed:', err)
    return null
  }
}

