/**
 * EBEXTA Company Memory — the persistent container.
 * ---------------------------------------------------------------------------
 * One row per (user, company), created the first time a company is scanned and
 * never wiped afterwards. Trust History, Interactions, Relationship Map, Deal
 * Strategy, Opportunity Timeline and Verification Matrix all hang off it.
 *
 * Rules this module enforces:
 *  - Re-scanning a known company MERGES (contacts deduped by name, only NEW
 *    signals become timeline events). It never overwrites accumulated history.
 *  - Gemini-generated sections are written here once and read from cache. This
 *    module never calls Gemini — see dealIntel.ts.
 *
 * Requires supabase/v2_intelligence.sql.
 */

import { supabase } from './supabase'
import type { ScannedLead, LeadActionStatus } from './scanEngine'
import { cleanDomain } from './urlUtils'
import { logSystemEvent } from './adminLog'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// ─── Types ────────────────────────────────────────────────────────────────────

export type EventType =
  | 'scan' | 'funding' | 'hiring' | 'expansion' | 'launch'
  | 'verification' | 'contact' | 'proposal' | 'meeting' | 'note' | 'outcome'

export type InteractionType =
  | 'email_sent' | 'proposal_sent' | 'reply' | 'meeting' | 'call' | 'note'

export type Outcome =
  | 'Won' | 'Lost' | 'Not Interested' | 'Wrong Contact'
  | 'Bad Match' | 'Excellent Match'

export const OUTCOMES: Outcome[] = [
  'Won', 'Lost', 'Not Interested', 'Wrong Contact', 'Bad Match', 'Excellent Match',
]

export type PipelineStage = 'lead' | 'contacted' | 'meeting' | 'proposal' | 'won' | 'lost'

export const PIPELINE_STAGES: PipelineStage[] = [
  'lead', 'contacted', 'meeting', 'proposal', 'won', 'lost',
]

export interface MemoryContact {
  name: string
  title?: string
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  verified?: boolean
  source_url?: string | null
  first_seen?: string
}

export interface CompanyMemory {
  id: string
  user_id: string
  company_name: string
  company_domain: string | null
  first_seen: string
  last_updated: string
  latest_lead_id: string | null
  company_snapshot: Partial<ScannedLead> | null
  contacts: MemoryContact[]
  relationship_map: RelationshipMap | null
  deal_strategy: DealStrategy | null
  opportunity_timeline: OpportunityTimeline | null
  verification_matrix: VerificationMatrix | null
  internal_notes: string | null
  outcome: Outcome | null
  outcome_at: string | null
  deal_value: number | null
  intelligence_generated_at: string | null
}

export interface TimelineEvent {
  id: string
  memory_id: string
  user_id: string
  event_date: string | null
  event_type: EventType
  event_title: string
  event_detail: string | null
  source_url: string | null
  is_verified: boolean
  created_at: string
}

export interface Interaction {
  id: string
  memory_id: string
  user_id: string
  interaction_type: InteractionType
  subject: string | null
  body_preview: string | null
  contact_name: string | null
  occurred_at: string
}

export interface PipelineEvent {
  id: string
  user_id: string
  memory_id: string | null
  stage: PipelineStage
  value: number | null
  note: string | null
  created_at: string
}

// ── Intelligence payload shapes (cached JSONB) ──

export interface RelationshipNode {
  name: string
  title: string
  reports_to: string | null
  decision_role: 'Economic Buyer' | 'Technical Approver' | 'Champion' | 'Influencer' | 'Gatekeeper'
  approach_order: number
}
export interface RelationshipMap {
  hierarchy: RelationshipNode[]
  approach_advice: string
}

export interface DealStrategy {
  why_now: string
  likely_problem: string
  pitch_first: string
  likely_objections: Array<{ objection: string; response: string }>
  roi_angle: string
  pricing_model: string
  opening_line: string
}

export type OppStageKey =
  | 'trigger' | 'discussion' | 'evaluation' | 'budget' | 'purchase' | 'implementation'

export interface OpportunityTimeline {
  current_stage: OppStageKey
  window_days: number
  why: string
  computed_at: string
}

export type MatrixState = 'verified' | 'partial' | 'unverified' | 'not_checked'
export interface MatrixRow {
  key: string
  label: string
  state: MatrixState
  source_url?: string | null
  fallback_url?: string | null
  detail?: string
}
export interface VerificationMatrix {
  rows: MatrixRow[]
  verified_count: number
  total: number
  confidence_score: number
  computed_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

/** Companies are matched case/whitespace-insensitively but stored as typed. */
function normName(raw: string): string {
  return (raw || '').trim().replace(/\s+/g, ' ')
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Pull a plausible date out of a signal string ("raised $4M in March 2025").
 * Returns null when nothing dateable is present — the caller then falls back to
 * the scan date and marks the event INFERRED.
 */
export function extractSignalDate(text: string): string | null {
  if (!text) return null
  // ISO-ish: 2025-03-14 / 2025/03/14
  const iso = text.match(/\b(20\d{2})[-/](0?[1-9]|1[0-2])[-/](0?[1-9]|[12]\d|3[01])\b/)
  if (iso) {
    const [, y, m, d] = iso
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
  }
  const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july',
    'august', 'september', 'october', 'november', 'december']
  const lower = text.toLowerCase()
  // "March 2025" / "Mar 2025" / "14 March 2025"
  for (let i = 0; i < MONTHS.length; i++) {
    const m = MONTHS[i]
    const re = new RegExp(`\\b(\\d{1,2})?\\s*${m.slice(0, 3)}[a-z]*\\.?,?\\s*(20\\d{2})\\b`, 'i')
    const hit = lower.match(re)
    if (hit) {
      const day = hit[1] ? hit[1].padStart(2, '0') : '01'
      return `${hit[2]}-${String(i + 1).padStart(2, '0')}-${day}`
    }
  }
  // Bare year — anchor to Jan 1 so it still sorts sensibly
  const year = lower.match(/\b(20[0-3]\d)\b/)
  if (year) return `${year[1]}-01-01`
  return null
}

/** Classify a raw signal string into a timeline event_type. */
export function classifySignal(text: string): EventType {
  const t = (text || '').toLowerCase()
  if (/rais|fund|series|seed|invest|crore|million|valuation/.test(t)) return 'funding'
  if (/hir|recruit|opening|headcount|talent|job/.test(t)) return 'hiring'
  if (/expand|new market|new office|new city|international|branch/.test(t)) return 'expansion'
  if (/launch|new product|released|unveil|introduc|beta|rebrand/.test(t)) return 'launch'
  return 'scan'
}

// ─── Read ─────────────────────────────────────────────────────────────────────

export interface MemoryListRow extends CompanyMemory {
  event_count: number
  interaction_count: number
}

/** All companies this user has ever encountered, newest activity first. */
export async function fetchCompanyMemories(): Promise<MemoryListRow[]> {
  const userId = await currentUserId()
  if (!userId) return []

  const { data, error } = await supabase
    .from('company_memory')
    .select('*')
    .eq('user_id', userId)
    .order('last_updated', { ascending: false })

  if (error) {
    console.error('[EBEXTA] company_memory fetch failed:', error.message, '— run supabase/v2_intelligence.sql?')
    return []
  }
  const rows = (data ?? []) as CompanyMemory[]
  if (rows.length === 0) return []

  const ids = rows.map(r => r.id)

  // Two flat queries + client-side tally beats N per-row count queries.
  const [{ data: ev }, { data: ix }] = await Promise.all([
    supabase.from('company_timeline').select('memory_id').in('memory_id', ids),
    supabase.from('company_interactions').select('memory_id').in('memory_id', ids),
  ])

  const tally = (list: Array<{ memory_id: string }> | null) => {
    const m = new Map<string, number>()
    for (const r of list ?? []) m.set(r.memory_id, (m.get(r.memory_id) ?? 0) + 1)
    return m
  }
  const evCount = tally(ev as Array<{ memory_id: string }> | null)
  const ixCount = tally(ix as Array<{ memory_id: string }> | null)

  return rows.map(r => ({
    ...r,
    contacts: Array.isArray(r.contacts) ? r.contacts : [],
    event_count: evCount.get(r.id) ?? 0,
    interaction_count: ixCount.get(r.id) ?? 0,
  }))
}

export async function fetchMemory(memoryId: string): Promise<CompanyMemory | null> {
  if (!UUID_RE.test(memoryId)) return null
  const { data, error } = await supabase
    .from('company_memory')
    .select('*')
    .eq('id', memoryId)
    .maybeSingle()
  if (error) { console.error('[EBEXTA] memory fetch failed:', error.message); return null }
  if (!data) return null
  const row = data as CompanyMemory
  return { ...row, contacts: Array.isArray(row.contacts) ? row.contacts : [] }
}

/** Find the memory row for a company name (used to link a lead → its memory). */
export async function fetchMemoryByCompany(companyName: string): Promise<CompanyMemory | null> {
  const userId = await currentUserId()
  if (!userId || !companyName) return null
  const { data } = await supabase
    .from('company_memory')
    .select('*')
    .eq('user_id', userId)
    .eq('company_name', normName(companyName))
    .maybeSingle()
  if (!data) return null
  const row = data as CompanyMemory
  return { ...row, contacts: Array.isArray(row.contacts) ? row.contacts : [] }
}

export async function fetchTimeline(memoryId: string): Promise<TimelineEvent[]> {
  if (!UUID_RE.test(memoryId)) return []
  const { data, error } = await supabase
    .from('company_timeline')
    .select('*')
    .eq('memory_id', memoryId)
    .order('event_date', { ascending: false })
    .order('created_at', { ascending: false })
  if (error) { console.error('[EBEXTA] timeline fetch failed:', error.message); return [] }
  return (data ?? []) as TimelineEvent[]
}

export async function fetchInteractions(memoryId: string): Promise<Interaction[]> {
  if (!UUID_RE.test(memoryId)) return []
  const { data, error } = await supabase
    .from('company_interactions')
    .select('*')
    .eq('memory_id', memoryId)
    .order('occurred_at', { ascending: false })
  if (error) { console.error('[EBEXTA] interactions fetch failed:', error.message); return [] }
  return (data ?? []) as Interaction[]
}

export async function fetchPipelineEvents(memoryId?: string): Promise<PipelineEvent[]> {
  const userId = await currentUserId()
  if (!userId) return []
  let q = supabase.from('pipeline_events').select('*').eq('user_id', userId)
  if (memoryId && UUID_RE.test(memoryId)) q = q.eq('memory_id', memoryId)
  const { data, error } = await q.order('created_at', { ascending: false })
  if (error) { console.error('[EBEXTA] pipeline fetch failed:', error.message); return [] }
  return (data ?? []) as PipelineEvent[]
}

// ─── Write: timeline ──────────────────────────────────────────────────────────

export interface NewTimelineEvent {
  memoryId: string
  eventType: EventType
  title: string
  detail?: string | null
  date?: string | null
  sourceUrl?: string | null
  /** VERIFIED = we have a source that proves it. Otherwise INFERRED. */
  isVerified?: boolean
}

export async function addTimelineEvent(e: NewTimelineEvent): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId || !UUID_RE.test(e.memoryId)) return false
  const { error } = await supabase.from('company_timeline').insert({
    memory_id:   e.memoryId,
    user_id:     userId,
    event_date:  e.date ?? todayISO(),
    event_type:  e.eventType,
    event_title: e.title.slice(0, 200),
    event_detail: e.detail ?? null,
    source_url:  e.sourceUrl ?? null,
    // A source URL is what makes an event VERIFIED — never claim otherwise.
    is_verified: e.isVerified ?? !!e.sourceUrl,
  })
  if (error) { console.error('[EBEXTA] timeline insert failed:', error.message); return false }
  return true
}

/**
 * Insert only events whose (type,title) pair isn't already on this timeline.
 * This is what makes a re-scan additive instead of duplicating history.
 */
export async function addTimelineEventsIfNew(
  memoryId: string,
  events: Array<Omit<NewTimelineEvent, 'memoryId'>>,
): Promise<number> {
  const userId = await currentUserId()
  if (!userId || !UUID_RE.test(memoryId) || events.length === 0) return 0

  const { data: existing } = await supabase
    .from('company_timeline')
    .select('event_type, event_title')
    .eq('memory_id', memoryId)

  const seen = new Set(
    (existing ?? []).map(r => `${r.event_type}::${String(r.event_title ?? '').toLowerCase()}`)
  )

  const rows = events
    .filter(e => {
      const key = `${e.eventType}::${e.title.slice(0, 200).toLowerCase()}`
      if (seen.has(key)) return false
      seen.add(key)   // also de-dupes within this same batch
      return true
    })
    .map(e => ({
      memory_id:    memoryId,
      user_id:      userId,
      event_date:   e.date ?? todayISO(),
      event_type:   e.eventType,
      event_title:  e.title.slice(0, 200),
      event_detail: e.detail ?? null,
      source_url:   e.sourceUrl ?? null,
      is_verified:  e.isVerified ?? !!e.sourceUrl,
    }))

  if (rows.length === 0) return 0
  const { error } = await supabase.from('company_timeline').insert(rows)
  if (error) { console.error('[EBEXTA] timeline batch insert failed:', error.message); return 0 }
  return rows.length
}

export async function deleteTimelineEvent(id: string): Promise<boolean> {
  const { error } = await supabase.from('company_timeline').delete().eq('id', id)
  if (error) { console.error('[EBEXTA] timeline delete failed:', error.message); return false }
  return true
}

// ─── Write: interactions ──────────────────────────────────────────────────────

export interface NewInteraction {
  interactionType: InteractionType
  subject?: string | null
  bodyPreview?: string | null
  contactName?: string | null
}

const INTERACTION_EVENT: Record<InteractionType, { type: EventType; verb: string }> = {
  email_sent:    { type: 'contact',  verb: 'Email sent' },
  proposal_sent: { type: 'proposal', verb: 'Proposal sent' },
  reply:         { type: 'contact',  verb: 'Reply received' },
  meeting:       { type: 'meeting',  verb: 'Meeting' },
  call:          { type: 'contact',  verb: 'Call' },
  note:          { type: 'note',     verb: 'Note' },
}

/**
 * Log an interaction AND mirror it onto the trust-history timeline.
 * Interactions are first-party facts, so they are always VERIFIED.
 */
export async function logInteraction(
  memoryId: string,
  i: NewInteraction,
): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId || !UUID_RE.test(memoryId)) return false

  const { error } = await supabase.from('company_interactions').insert({
    memory_id:        memoryId,
    user_id:          userId,
    interaction_type: i.interactionType,
    subject:          i.subject ?? null,
    body_preview:     (i.bodyPreview ?? '').slice(0, 400) || null,
    contact_name:     i.contactName ?? null,
  })
  if (error) { console.error('[EBEXTA] interaction insert failed:', error.message); return false }

  const meta = INTERACTION_EVENT[i.interactionType]
  await addTimelineEvent({
    memoryId,
    eventType: meta.type,
    title: i.contactName ? `${meta.verb} — ${i.contactName}` : meta.verb,
    detail: i.subject ?? i.bodyPreview?.slice(0, 200) ?? null,
    isVerified: true,   // it happened inside EBEXTA — first-party fact
  })
  await touchMemory(memoryId)
  return true
}

/**
 * Log an interaction by company name — used by callers (email editor, pitch
 * modal) that hold a lead, not a memory id. Creates the memory if missing.
 */
export async function logInteractionForCompany(
  lead: Pick<ScannedLead, 'company_name'> & Partial<ScannedLead>,
  i: NewInteraction,
): Promise<boolean> {
  const memoryId = await ensureMemoryForLead(lead as ScannedLead)
  if (!memoryId) return false
  return logInteraction(memoryId, i)
}

// ─── Write: memory record ─────────────────────────────────────────────────────

export async function updateMemory(
  memoryId: string,
  patch: Partial<Pick<CompanyMemory,
    'internal_notes' | 'deal_value' | 'outcome' | 'outcome_at' |
    'relationship_map' | 'deal_strategy' | 'opportunity_timeline' |
    'verification_matrix' | 'intelligence_generated_at' | 'company_domain'>>,
  /**
   * Whether this counts as activity on the company. Pass false for writes that
   * are just caching a computed view (opening the page recomputes and re-caches
   * the free sections) — otherwise merely LOOKING at a company would reorder the
   * "last updated" list, which is a lie.
   */
  touch = true,
): Promise<boolean> {
  const { error } = await supabase
    .from('company_memory')
    .update(touch ? { ...patch, last_updated: new Date().toISOString() } : patch)
    .eq('id', memoryId)
  if (error) { console.error('[EBEXTA] memory update failed:', error.message); return false }
  return true
}

async function touchMemory(memoryId: string): Promise<void> {
  await supabase
    .from('company_memory')
    .update({ last_updated: new Date().toISOString() })
    .eq('id', memoryId)
}

/**
 * Update lead action status, follow-up date, and notes.
 * Syncs to company_memory (internal_notes, interactions) and updates localStorage caches.
 */
export async function updateLeadActionStatus(
  lead: ScannedLead,
  actionStatus: LeadActionStatus
): Promise<void> {
  // 1. Update localStorage caches
  const keys = ['ebexta_leads_seeker', 'ebexta_leads_provider', 'ebexta_scan_results']
  for (const key of keys) {
    try {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      const list: ScannedLead[] = JSON.parse(raw)
      const idx = list.findIndex(l => l.id === lead.id || (l.company_name && lead.company_name && l.company_name.toLowerCase() === lead.company_name.toLowerCase()))
      if (idx !== -1) {
        list[idx] = { ...list[idx], action_status: actionStatus }
        localStorage.setItem(key, JSON.stringify(list))
      }
    } catch { /* ignore */ }
  }

  // 2. Persist to company_memory if company name exists
  if (lead.company_name) {
    try {
      const memId = await ensureMemoryForLead(lead)
      if (memId) {
        if (actionStatus.notes !== undefined) {
          await updateMemory(memId, {
            internal_notes: actionStatus.notes,
          })
        }
        if (actionStatus.status) {
          await logInteractionForCompany({ company_name: lead.company_name }, {
            interactionType: 'note',
            subject: `Lead Status: ${actionStatus.status}`,
            bodyPreview: actionStatus.notes || `Status marked as ${actionStatus.status}${actionStatus.follow_up_date ? ` (Follow up: ${actionStatus.follow_up_date})` : ''}`,
            contactName: lead.contacts?.[0]?.name ?? lead.stakeholders?.[0]?.name ?? null,
          })
        }
      }
    } catch (err) {
      console.warn('[EBEXTA] updateLeadActionStatus memory sync error:', err)
    }
  }

  window.dispatchEvent(new CustomEvent('ebexta_lead_updated', { detail: { leadId: lead.id, actionStatus } }))
}

// ─── Contacts merge ───────────────────────────────────────────────────────────

function contactKey(c: { name?: string | null }): string {
  return (c.name ?? '').trim().toLowerCase()
}

/** Merge new contacts into an existing list, deduped by name. Never drops. */
export function mergeContacts(
  existing: MemoryContact[],
  incoming: MemoryContact[],
): MemoryContact[] {
  const byName = new Map<string, MemoryContact>()
  for (const c of existing) {
    const k = contactKey(c)
    if (k) byName.set(k, c)
  }
  for (const c of incoming) {
    const k = contactKey(c)
    if (!k) continue
    const prev = byName.get(k)
    if (!prev) {
      byName.set(k, { ...c, first_seen: c.first_seen ?? new Date().toISOString() })
      continue
    }
    // Fill gaps only — an already-known detail is never overwritten with null,
    // and a verified contact never downgrades to unverified.
    byName.set(k, {
      ...prev,
      title:        prev.title        || c.title,
      email:        prev.email        || c.email,
      phone:        prev.phone        || c.phone,
      linkedin_url: prev.linkedin_url || c.linkedin_url,
      source_url:   prev.source_url   || c.source_url,
      verified:     prev.verified || c.verified || false,
    })
  }
  return [...byName.values()]
}

/** Contacts, as accumulated from a lead's stakeholders + rich contacts. */
export function contactsFromLead(lead: Partial<ScannedLead>): MemoryContact[] {
  const out: MemoryContact[] = []
  for (const s of lead.stakeholders ?? []) {
    if (!s?.name) continue
    out.push({
      name: s.name,
      title: s.title,
      email: s.email ?? null,
      linkedin_url: s.linkedin_url ?? null,
      verified: false,
    })
  }
  // RichContact uses different field names to Stakeholder (role/linkedInUrl) —
  // normalise both into one MemoryContact shape.
  for (const c of lead.contacts ?? []) {
    const name = (c?.name ?? '').trim()
    if (!name) continue
    out.push({
      name,
      title: c.role || undefined,
      email: c.email ?? null,
      linkedin_url: c.linkedInUrl ?? null,
      source_url: c.sourceUrl ?? null,
      verified: false,
    })
  }
  return out
}

// ─── The upsert that runs after every scan ────────────────────────────────────

/** Build the timeline events implied by a lead's signals. */
function signalEvents(lead: Partial<ScannedLead>): Array<Omit<NewTimelineEvent, 'memoryId'>> {
  const bits: Array<{ text: string; url?: string | null }> = []

  for (const s of lead.recent_signals ?? []) bits.push({ text: s, url: lead.evidence_source_url })
  for (const p of lead.big_projects ?? [])   bits.push({ text: p, url: lead.evidence_source_url })
  if (lead.funding_details)   bits.push({ text: lead.funding_details, url: lead.funding_source_url ?? lead.evidence_source_url })
  if (lead.revenue_growth)    bits.push({ text: lead.revenue_growth, url: lead.evidence_source_url })
  if (lead.investment_history) bits.push({ text: lead.investment_history, url: lead.funding_source_url ?? lead.evidence_source_url })

  const scanDate = todayISO()
  return bits
    .map(b => (b.text ?? '').trim())
    .filter(t => t.length > 3)
    .map((text, idx) => {
      const url = bits[idx].url ?? null
      const dated = extractSignalDate(text)
      return {
        eventType: classifySignal(text),
        title: text.length > 120 ? `${text.slice(0, 117)}…` : text,
        detail: text.length > 120 ? text : null,
        // A date pulled from the signal text is the real event date; otherwise
        // we only know we saw it today.
        date: dated ?? scanDate,
        sourceUrl: url,
        // Only a source link earns the VERIFIED badge. Everything else is AI
        // inference from the scan and is labelled INFERRED.
        isVerified: !!url,
      }
    })
}

function snapshotFromLead(lead: Partial<ScannedLead>): Record<string, unknown> {
  return {
    industry: lead.industry ?? null,
    location: lead.location ?? null,
    employee_count: lead.employee_count ?? null,
    funding_stage: lead.funding_stage ?? lead.company_stage ?? null,
    annual_revenue: lead.annual_revenue ?? lead.turnover ?? null,
    website: lead.website ?? null,
    linkedin_url: lead.linkedin_url ?? lead.company_linkedin ?? null,
    email: lead.email ?? null,
    description: lead.description ?? null,
    intent_score: lead.intent_score ?? null,
    match_score: lead.match_score ?? null,
    confidence_score: lead.confidence_score ?? null,
    trust_score: lead.trust_score ?? null,
    verification_status: lead.verification_status ?? null,
    intent_flags: lead.intent_flags ?? [],
    score_breakdown: lead.score_breakdown ?? null,
    rules_fired: lead.rules_fired ?? null,
    business_impact: lead.business_impact ?? null,
    company_contact: lead.company_contact ?? null,
    evidence_source_url: lead.evidence_source_url ?? null,
    funding_source_url: lead.funding_source_url ?? null,
    recent_signals: lead.recent_signals ?? [],
    match_reason: lead.match_reason ?? null,
    requirement_theme: lead.requirement_theme ?? null,
    ebexta_verified: lead.ebexta_verified ?? false,
    // Key contacts — must be preserved so Lead Detail can render them
    stakeholders: lead.stakeholders ?? [],
  }
}


/**
 * Create-or-merge the memory record for one lead.
 * Returns the memory id, or null if the write failed (never throws — memory is
 * an enhancement, a failure here must not break a scan).
 */
export async function upsertCompanyMemory(
  userId: string,
  lead: Partial<ScannedLead> & { company_name: string },
): Promise<string | null> {
  const name = normName(lead.company_name)
  if (!userId || !name) return null

  try {
    const { data: existing } = await supabase
      .from('company_memory')
      .select('id, contacts')
      .eq('user_id', userId)
      .eq('company_name', name)
      .maybeSingle()

    const nowIso = new Date().toISOString()
    const domain = cleanDomain(lead.website) || null
    const leadId = lead.id && UUID_RE.test(lead.id) ? lead.id : null

    if (!existing) {
      // ── NEW company ──
      const { data: created, error } = await supabase
        .from('company_memory')
        .insert({
          user_id: userId,
          company_name: name,
          company_domain: domain,
          first_seen: nowIso,
          last_updated: nowIso,
          latest_lead_id: leadId,
          company_snapshot: snapshotFromLead(lead),
          contacts: mergeContacts([], contactsFromLead(lead)),
        })
        .select('id')
        .single()

      if (error || !created) {
        console.error('[EBEXTA] memory create failed:', error?.message, '— run supabase/v2_intelligence.sql?')
        return null
      }

      await addTimelineEventsIfNew(created.id, [
        {
          eventType: 'scan',
          title: 'First discovered by EBEXTA',
          detail: `${lead.industry ?? 'Company'}${lead.location ? ` · ${lead.location}` : ''}`,
          isVerified: true,   // we did the scan — that is a fact we own
        },
        ...signalEvents(lead),
      ])
      return created.id
    }

    // ── EXISTING company: merge, never overwrite ──
    const prevContacts = Array.isArray(existing.contacts)
      ? (existing.contacts as MemoryContact[]) : []

    const { error: updErr } = await supabase
      .from('company_memory')
      .update({
        last_updated: nowIso,
        latest_lead_id: leadId ?? undefined,
        company_domain: domain ?? undefined,
        company_snapshot: snapshotFromLead(lead),
        contacts: mergeContacts(prevContacts, contactsFromLead(lead)),
      })
      .eq('id', existing.id)

    if (updErr) console.error('[EBEXTA] memory update failed:', updErr.message)

    // Only signals we haven't already recorded become new events.
    await addTimelineEventsIfNew(existing.id, signalEvents(lead))
    return existing.id
  } catch (err) {
    console.error('[EBEXTA] memory upsert error (non-fatal):', err)
    return null
  }
}

/** Run memory upsert for a whole scan result. Never throws. */
export async function upsertMemoriesForScan(
  userId: string,
  leads: Array<Partial<ScannedLead> & { company_name: string }>,
): Promise<void> {
  // Sequential on purpose: a scan is ~14 leads and each does a read + write.
  // Firing 14 parallel upserts risks two writers racing the same company row.
  for (const lead of leads) {
    await upsertCompanyMemory(userId, lead)
  }
}

// ─── Backfill: import leads that pre-date Company Memory ──────────────────────

/**
 * Build memory rows for every company already in `leads` that doesn't have one.
 *
 * Company Memory only starts recording from the scan that created it, so a user
 * who scanned before V2 shipped would see an empty Companies page and think it
 * was broken. This imports their existing history once.
 *
 * Batched (not one upsert per lead) so a few hundred leads is a handful of
 * queries, not hundreds. Idempotent — companies already in memory are skipped.
 * Makes ZERO Gemini calls.
 */
export async function backfillMemoryFromLeads(): Promise<{ created: number; error: string | null }> {
  const userId = await currentUserId()
  if (!userId) return { created: 0, error: 'Not signed in' }

  try {
    const [{ data: leadRows, error: leadErr }, { data: memRows }] = await Promise.all([
      supabase
        .from('leads')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1000),
      supabase
        .from('company_memory')
        .select('company_name')
        .eq('user_id', userId),
    ])

    if (leadErr) return { created: 0, error: leadErr.message }

    const known = new Set(
      ((memRows ?? []) as Array<{ company_name: string }>)
        .map(r => normName(r.company_name).toLowerCase())
    )

    // Leads come newest-first, so the FIRST time we see a company is its most
    // recent record — that's the snapshot worth keeping.
    const newest = new Map<string, Record<string, unknown>>()
    for (const raw of (leadRows ?? []) as Array<Record<string, unknown>>) {
      const name = normName(String(raw.company_name ?? ''))
      const key = name.toLowerCase()
      if (!name || known.has(key) || newest.has(key)) continue
      newest.set(key, raw)
    }

    if (newest.size === 0) return { created: 0, error: null }

    const nowIso = new Date().toISOString()
    const toInsert: Array<Record<string, unknown>> = []
    const leadByName = new Map<string, Partial<ScannedLead>>()

    for (const raw of newest.values()) {
      // The leads table stores `is_strongly_recommended`; ScannedLead calls it
      // `strongly_recommended`. Normalise before anything reads it.
      const lead: Partial<ScannedLead> = {
        ...(raw as Partial<ScannedLead>),
        strongly_recommended: Boolean(raw.is_strongly_recommended ?? raw.strongly_recommended),
      }
      const name = normName(String(raw.company_name ?? ''))
      leadByName.set(name, lead)

      toInsert.push({
        user_id: userId,
        company_name: name,
        company_domain: cleanDomain(lead.website) || null,
        // Keep the real discovery date — the lead's created_at, not today.
        first_seen: (raw.created_at as string) ?? nowIso,
        last_updated: (raw.created_at as string) ?? nowIso,
        latest_lead_id: UUID_RE.test(String(raw.id ?? '')) ? raw.id : null,
        company_snapshot: snapshotFromLead(lead),
        contacts: mergeContacts([], contactsFromLead(lead)),
      })
    }

    const { data: created, error: insErr } = await supabase
      .from('company_memory')
      .insert(toInsert)
      .select('id, company_name, first_seen')

    if (insErr) {
      console.error('[EBEXTA] memory backfill failed:', insErr.message, '— run supabase/v2_intelligence.sql?')
      return { created: 0, error: insErr.message }
    }

    // Seed each new record's timeline in one batch insert.
    const events: Array<Record<string, unknown>> = []
    for (const row of (created ?? []) as Array<{ id: string; company_name: string; first_seen: string }>) {
      const lead = leadByName.get(row.company_name)
      if (!lead) continue
      const seenDate = (row.first_seen ?? nowIso).slice(0, 10)

      events.push({
        memory_id: row.id,
        user_id: userId,
        event_date: seenDate,
        event_type: 'scan',
        event_title: 'First discovered by EBEXTA',
        event_detail: `${lead.industry ?? 'Company'}${lead.location ? ` · ${lead.location}` : ''}`,
        source_url: null,
        is_verified: true,   // we ran the scan — a fact we own
      })

      for (const e of signalEvents(lead)) {
        events.push({
          memory_id: row.id,
          user_id: userId,
          // Prefer a date parsed from the signal; otherwise the day we found it.
          event_date: e.date && e.date !== todayISO() ? e.date : seenDate,
          event_type: e.eventType,
          event_title: e.title,
          event_detail: e.detail ?? null,
          source_url: e.sourceUrl ?? null,
          is_verified: e.isVerified ?? !!e.sourceUrl,
        })
      }
    }

    if (events.length > 0) {
      // Chunked — one enormous insert can trip request size limits.
      for (let i = 0; i < events.length; i += 200) {
        const { error } = await supabase.from('company_timeline').insert(events.slice(i, i + 200))
        if (error) console.error('[EBEXTA] backfill timeline insert failed:', error.message)
      }
    }

    return { created: (created ?? []).length, error: null }
  } catch (err) {
    console.error('[EBEXTA] backfill error:', err)
    return { created: 0, error: (err as Error)?.message ?? 'Backfill failed' }
  }
}

/** Get (or lazily create) the memory id for a lead. */
export async function ensureMemoryForLead(lead: Partial<ScannedLead> & { company_name?: string }): Promise<string | null> {
  if (!lead?.company_name) return null
  const userId = await currentUserId()
  if (!userId) return null
  const found = await fetchMemoryByCompany(lead.company_name)
  if (found) return found.id
  return upsertCompanyMemory(userId, lead as Partial<ScannedLead> & { company_name: string })
}

// ─── Verified contacts → memory ───────────────────────────────────────────────

interface DeliveredVerification {
  company_name: string | null
  verified_name: string | null
  verified_position: string | null
  verified_email: string | null
  verified_phone: string | null
  verified_linkedin: string | null
  verified_evidence_url: string | null
  delivered_at: string | null
}

/**
 * Fold every EBEXTA-delivered contact into the matching company's memory:
 * merge the contact (marked verified) and add a VERIFIED timeline event.
 *
 * Idempotent — merging dedupes by name and the timeline insert skips events
 * already recorded, so this is safe to call on every page load.
 */
export async function syncVerifiedContactsToMemory(): Promise<number> {
  const userId = await currentUserId()
  if (!userId) return 0

  const { data, error } = await supabase
    .from('verification_requests')
    .select('company_name, verified_name, verified_position, verified_email, verified_phone, verified_linkedin, verified_evidence_url, delivered_at')
    .eq('user_id', userId)
    .in('status', ['verified', 'delivered'])
  if (error) return 0

  const rows = (data ?? []) as DeliveredVerification[]
  let synced = 0

  for (const r of rows) {
    if (!r.company_name || !r.verified_name) continue

    const memory = await fetchMemoryByCompany(r.company_name)
    // Only fold into companies we already remember — a verification for a
    // company that was never scanned has no memory to attach to.
    if (!memory) continue

    const merged = mergeContacts(memory.contacts ?? [], [{
      name: r.verified_name,
      title: r.verified_position ?? undefined,
      email: r.verified_email,
      phone: r.verified_phone,
      linkedin_url: r.verified_linkedin,
      source_url: r.verified_evidence_url,
      verified: true,
    }])

    await supabase
      .from('company_memory')
      .update({ contacts: merged, last_updated: new Date().toISOString() })
      .eq('id', memory.id)

    const added = await addTimelineEventsIfNew(memory.id, [{
      eventType: 'verification',
      title: `Contact verified by EBEXTA — ${r.verified_name}`,
      detail: [r.verified_position, r.verified_email, r.verified_phone].filter(Boolean).join(' · ') || null,
      date: r.delivered_at ? r.delivered_at.slice(0, 10) : undefined,
      sourceUrl: r.verified_evidence_url,
      isVerified: true,   // hand-verified by the EBEXTA team
    }])
    if (added > 0) synced++
  }
  return synced
}

// ─── #10 Outcome feedback + learning loop ─────────────────────────────────────

/** Outcomes that count as a positive signal for the rules that found the lead. */
const POSITIVE_OUTCOMES: Outcome[] = ['Won', 'Excellent Match']

const OUTCOME_STAGE: Partial<Record<Outcome, PipelineStage>> = {
  'Won': 'won',
  'Lost': 'lost',
  'Not Interested': 'lost',
  'Bad Match': 'lost',
}

/**
 * Bump rule_performance for every rule that fired on this lead.
 * Uses an atomic RPC so concurrent bumps don't clobber each other.
 */
export async function bumpRulePerformance(ruleKeys: string[], converted: boolean): Promise<void> {
  const keys = [...new Set(ruleKeys.filter(Boolean))].slice(0, 40)
  if (keys.length === 0) return
  const { error } = await supabase.rpc('ebexta_bump_rule_performance', {
    p_rule_keys: keys,
    p_converted: converted,
  })
  if (error) console.error('[EBEXTA] rule_performance bump failed:', error.message)
}

/**
 * Record an outcome. Writes memory.outcome, a timeline event, a pipeline event,
 * and — for Won / Excellent Match — the rule_performance conversion credit.
 */
export async function setOutcome(
  memory: Pick<CompanyMemory, 'id' | 'company_name' | 'company_snapshot'>,
  outcome: Outcome,
  dealValue?: number | null,
): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false
  const nowIso = new Date().toISOString()

  const { error } = await supabase
    .from('company_memory')
    .update({
      outcome,
      outcome_at: nowIso,
      last_updated: nowIso,
      ...(dealValue != null ? { deal_value: dealValue } : {}),
    })
    .eq('id', memory.id)
  if (error) { console.error('[EBEXTA] outcome save failed:', error.message); return false }

  await addTimelineEvent({
    memoryId: memory.id,
    eventType: 'outcome',
    title: `Outcome: ${outcome}`,
    detail: dealValue != null ? `Deal value logged: ${dealValue}` : null,
    isVerified: true,   // the user told us — first-party fact
  })

  const stage = OUTCOME_STAGE[outcome]
  if (stage) {
    await addPipelineEvent(memory.id, stage, stage === 'won' ? dealValue ?? null : null, `Outcome: ${outcome}`)
  }

  // Learning loop — credit every rule that surfaced this company.
  const snap = (memory.company_snapshot ?? {}) as Record<string, unknown>
  const rules = rulesFiredFromSnapshot(snap)
  if (rules.length > 0) {
    await bumpRulePerformance(rules, POSITIVE_OUTCOMES.includes(outcome))
  }

  // 'Wrong Contact' is a data-quality problem, not a sales outcome — flag it for
  // the admin verification review queue.
  if (outcome === 'Wrong Contact') {
    await flagWrongContact(memory.id, memory.company_name)
  }
  return true
}

/** rules_fired if the scan recorded it, else fall back to the score breakdown. */
export function rulesFiredFromSnapshot(snap: Record<string, unknown>): string[] {
  const fired = snap.rules_fired
  if (Array.isArray(fired) && fired.length > 0) return fired.map(String)
  const breakdown = snap.score_breakdown
  if (Array.isArray(breakdown)) {
    return (breakdown as Array<{ signal?: string }>)
      .map(b => String(b?.signal ?? ''))
      .filter(Boolean)
  }
  const flags = snap.intent_flags
  return Array.isArray(flags) ? flags.map(String) : []
}

/** Best-effort flag into the admin log — never blocks the outcome write. */
async function flagWrongContact(memoryId: string, companyName: string): Promise<void> {
  try {
    const userId = await currentUserId()
    void logSystemEvent({
      userId: userId ?? undefined,
      eventType: 'verification',
      message: `Wrong contact reported — ${companyName}`,
      metadata: { memoryId, companyName, reason: 'outcome:Wrong Contact', needsQualityReview: true },
    })
  } catch { /* non-fatal */ }
}

export async function addPipelineEvent(
  memoryId: string | null,
  stage: PipelineStage,
  value?: number | null,
  note?: string | null,
): Promise<boolean> {
  const userId = await currentUserId()
  if (!userId) return false
  const { error } = await supabase.from('pipeline_events').insert({
    user_id: userId,
    memory_id: memoryId,
    stage,
    value: value ?? null,
    note: note ?? null,
  })
  if (error) { console.error('[EBEXTA] pipeline insert failed:', error.message); return false }
  return true
}

/** Advance the funnel from the Company Memory stage selector. */
export async function moveToStage(
  memoryId: string,
  stage: PipelineStage,
  value?: number | null,
): Promise<boolean> {
  const ok = await addPipelineEvent(memoryId, stage, value ?? null, `Moved to ${stage}`)
  if (ok) {
    await addTimelineEvent({
      memoryId,
      eventType: stage === 'meeting' ? 'meeting' : stage === 'proposal' ? 'proposal' : 'note',
      title: `Pipeline: moved to ${stage}`,
      isVerified: true,
    })
  }
  return ok
}
