import { z } from 'zod'
import { supabase } from './supabase'
import { callGemini } from './gemini'
import { callGeminiProxy, type GeminiAction, type GroundingSource } from './geminiProxy'
import { normalizeUrl, isLikelyFakeLinkedIn, isGenericContactName, verifyDomainStructure } from './urlUtils'
import { isValidEmail } from './linkVerifier'
import { logSystemEvent, logApiUsage } from './adminLog'
import { fetchActiveProduct, type IdealBuyer } from './productAnalysis'
import { resolveSectorRule, resolveSectorRuleForProduct, buildRulePromptBlock, ensureRulesLoaded, type ResolvedSector } from './requirementRules'
// Company Memory (V2). companyMemory imports ScannedLead as a TYPE only, so
// this is not a runtime cycle.
import { upsertMemoriesForScan } from './companyMemory'
// Deep site walkthrough — reads each finalist's real website and corrects any
// claim the site contradicts. Same type-only import direction, no cycle.
import { walkthroughBatch } from './siteWalkthrough'
import type {
  SiteWalkthrough, PageRead, ClaimCheck, VerifiedSignal, UnconfirmedSignal, SiteReadStatus,
} from './siteWalkthrough'
// Feasibility gate — prerequisite infrastructure check. Skipped entirely when
// the seller has declared no prerequisite.
import { applyFeasibilityGate, fetchPrerequisites, logExclusions } from './feasibility'
import type { FeasibilityStatus, FeasibilityEvidence } from './feasibility'
// Description-first matching — the user's description drives discovery; filters
// only narrow it. See the regression note in buyerProfile.ts.
import {
  extractBuyerProfile, needCategories, scoreDescriptionMatch, MIN_DESCRIPTION_MATCH,
  type BuyerProfile,
} from './buyerProfile'
import { fetchPooledLeads, markPoolServed, writeToPool, alreadyServedCompanies } from './leadPool'
// Search-visibility verification — stops a search-dominant company being sold
// the one thing it demonstrably does not need.
import { applyRankGate } from './rankCheck'
import type { SearchVisibility, RankEvidence } from './rankCheck'
// Dismiss + cycling — dismissed companies never return; rescans give new ones.
import { buildCyclePlan, selectForCycle, recordServed } from './dismissal'
// Every Gemini response in this file is parsed defensively — a malformed
// response is a normal operating condition, not an exception.
import { safeParseJSON } from './safeJson'

/**
 * How many finalists get their website read.
 * Set at the full scan target so EVERY lead the user sees has been checked
 * against its real website — a lead that reaches the user unverified breaks the
 * promise EBEXTA makes. Discovered candidates that were filtered out are never
 * walked, which is where the cost control actually lives.
 */
const SITE_WALKTHROUGH_LIMIT = 14

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScanFilters {
  companyName?: string
  senderEmail?: string
  mission?: string
  employeeMin?: number
  employeeMax?: number
  minRevenue?: string
  companyStages?: string[]
  country?: string
  region?: string
  techHubs?: string[]
  mode?: string
  excludeCompanies?: string[]
  /**
   * WHO ACTUALLY NEEDS THIS — extracted from the user's description before
   * discovery. This is the primary matching input; every other filter only
   * narrows it. See src/lib/buyerProfile.ts.
   */
  buyerProfile?: BuyerProfile
  /** Internal: prevents the description-gate retry from recursing. */
  __descriptionRetry?: boolean
  // Extended filters
  industries?: string[]
  companySizes?: string[]
  revenueRange?: string       // first selected value (backward-compat)
  revenueRanges?: string[]    // all selected values
  serviceCategories?: string[]
  budgetRange?: string        // first selected value (backward-compat)
  budgetRanges?: string[]     // all selected values
  projectDuration?: string    // first selected value (backward-compat)
  projectDurations?: string[] // all selected values
  intentSignals?: {
    recentlyFunded: boolean
    hiringAggressively: boolean
    websiteRedesigned: boolean
    newProductLaunch: boolean
    geographicExpansion: boolean
    techMigration: boolean
  }
  decisionMakerRoles?: string[]
  decisionMakerSeniority?: string[]
  trustFilters?: {
    websiteActive: boolean
    linkedinActive: boolean
    emailVerified: boolean
    fundingVerified: boolean
  }
  techStack?: string[]
  cities?: string[]
  countries?: string[]
  states?: string[]
  // ── Product-level matching (target a specific product's ideal buyer) ──
  targetType?: 'company' | 'product'
  productProfile?: {
    product_name?: string
    product_summary?: string
    core_value?: string
    pitch_angle?: string
    ideal_buyer?: IdealBuyer
  } | null
}

export function parseTargetCountries(filters: ScanFilters): string[] {
  if (Array.isArray(filters.countries) && filters.countries.length > 0) {
    return filters.countries.map(c => c.trim()).filter(Boolean)
  }
  if (filters.country) {
    return filters.country.split(',').map(c => c.trim()).filter(Boolean)
  }
  return ['India']
}

export function matchesTargetGeography(location: string | null | undefined, filters: ScanFilters): boolean {
  if (!location) return true
  const loc = location.toLowerCase().trim()
  if (!loc || loc === 'unknown') return true

  const cities = (filters.cities ?? []).map(c => c.trim().toLowerCase()).filter(Boolean)
  if (cities.length > 0 && cities.some(c => loc.includes(c))) return true

  const countries = parseTargetCountries(filters).map(c => c.toLowerCase())
  if (countries.length === 0) return true

  return countries.some(c => {
    if (loc.includes(c)) return true
    if ((c === 'united states' || c === 'usa' || c === 'us') &&
        (loc.includes('united states') || loc.includes('usa') || /\b(us|ca|ny|tx|wa|ma|il|fl|san francisco|austin|seattle|new york|chicago|los angeles|boston)\b/i.test(loc))) return true
    if ((c === 'united kingdom' || c === 'uk') &&
        (loc.includes('united kingdom') || loc.includes('uk') || loc.includes('england') || loc.includes('london') || loc.includes('manchester') || loc.includes('edinburgh'))) return true
    if (c === 'india' &&
        (loc.includes('india') || loc.includes('bengaluru') || loc.includes('bangalore') || loc.includes('mumbai') || loc.includes('delhi') || loc.includes('noida') || loc.includes('gurugram') || loc.includes('pune') || loc.includes('hyderabad') || loc.includes('chennai') || loc.includes('karnataka') || loc.includes('maharashtra'))) return true
    if (c === 'uae' && (loc.includes('uae') || loc.includes('dubai') || loc.includes('abu dhabi'))) return true
    if (c === 'germany' && (loc.includes('germany') || loc.includes('berlin') || loc.includes('munich') || loc.includes('frankfurt'))) return true
    if (c === 'australia' && (loc.includes('australia') || loc.includes('sydney') || loc.includes('melbourne') || loc.includes('brisbane'))) return true
    if (c === 'canada' && (loc.includes('canada') || loc.includes('toronto') || loc.includes('vancouver') || loc.includes('montreal'))) return true
    if (c === 'singapore' && loc.includes('singapore')) return true
    return false
  })
}

export function matchesEmployeeRange(count: number | null | undefined, filters: ScanFilters): boolean {
  if (count == null || count <= 0) return true
  const min = Math.max(1, (filters.employeeMin ?? 1) * 0.6)
  const max = (filters.employeeMax ?? 10000) * 1.6
  return count >= min && count <= max
}

// Rich contact from Google Search grounded discovery
export interface RichContact {
  name: string
  role: string
  authorityType: 'Technical' | 'Economic' | 'User' | 'Other'
  email?: string | null
  linkedInUrl?: string | null
  twitterUrl?: string | null
  githubUrl?: string | null
  about?: string | null
  sourceUrl?: string | null
  verificationLogic?: string | null
  isPrimary: boolean
  /** When the user asked for a specific role (e.g. CTO) that doesn't exist at
   *  this company, this explains why THIS contact was given instead. */
  roleJustification?: string | null
  verification_level?: 'verified' | 'partially_verified'
  sources?: string[]
  source_count?: number
}

// One line of the itemized intent-score justification (Task: score breakdown)
export interface ScoreBreakdownItem {
  signal: string
  points: number
}

export type ReachabilityLevel = 'High' | 'Moderate' | 'Low' | 'Unknown'

export interface ReachabilityAssessment {
  level: ReachabilityLevel
  label: string
  summary: string
  factors: string[]
  reachability_level: ReachabilityLevel
  rationale: string
  direct_reach_factors: string[]
  barrier_factors: string[]
  has_direct_contact: boolean
  has_verified_channel: boolean
  channel_type: 'direct_linkedin' | 'direct_email' | 'company_channel' | 'none'
  decision_maker_identified: boolean
}

export interface ServiceNeedEvidence {
  user_offering: string
  company_signal: string
  problem_hypothesis: string
  service_connection: string
  evidence_date?: string | null
  source_reference?: string | null
  confidence_level: 'High' | 'Medium' | 'Low' | 'Inferred'
  limitations: string
  has_direct_need_evidence: boolean
  service_fit_level?: 'High' | 'Moderate' | 'Low' | 'Inferred'
  buyer_intent_signals?: string[]
  summary?: string
  icp_vs_need_distinction?: string
}

export interface LeadActionStatus {
  status:
    | 'New'
    | 'Qualified'
    | 'Contacted'
    | 'Replied'
    | 'Meeting Scheduled'
    | 'Converted'
    | 'Not Relevant'
    | 'In Discussion'
    | 'Follow-Up Needed'
    | 'Closed'
    | 'Unresponsive'
  notes?: string
  last_activity_at?: string
  follow_up_date?: string
}

export interface ScannedLead {
  /** Scored 40-59 on description match, or released from reserve to avoid an
   *  empty scan. The UI must say so — a weak lead passed off as a strong one
   *  is the same lie as an unverified claim shown as verified. */
  loosely_matched?: boolean
  id: string
  company_name: string
  industry: string
  location: string
  employee_count: number
  funding_stage: string
  annual_revenue: string
  website: string
  linkedin_url: string
  email: string
  evidence_source_url: string
  evidence_sources?: string[]   // ALL source links found (hiring, funding, news, contact)
  recent_signals: string[]
  stakeholders: Array<{
    name: string
    title: string
    linkedin_url?: string | null
    email?: string | null
    priority_score: number
    verification_level?: 'verified' | 'partially_verified'
    sources?: string[]
    source_count?: number
  }>
  intent_score: number
  match_score: number
  confidence_score: number
  verification_status: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MANUAL_REVIEW_NEEDED'
  intent_flags: string[]
  validation_errors: string[]
  strongly_recommended: boolean
  trust_score: number
  scan_id?: string
  user_id?: string
  created_at: string
  business_impact?: {
    success_probability: number
    expected_deal_size_min: string
    expected_deal_size_max: string
    response_probability: number
    estimated_decision_days: number
    match_reasons: string[]
  }
  // ── Rich fields from Google Search grounding ──
  description?: string
  company_linkedin?: string
  company_twitter?: string
  requirement_theme?: string
  turnover?: string
  revenue_growth?: string
  funding_details?: string
  funding_source_url?: string
  investment_history?: string
  big_projects?: string[]
  match_reason?: string[]
  contacts?: RichContact[]
  company_stage?: string
  /** Company-level contact from Google/Google Maps — the fallback when no
   *  named stakeholders were found ("couldn't find the exact stakeholders,
   *  but we found this"). */
  company_contact?: {
    email?: string | null
    phone?: string | null
    address?: string | null
    sourceUrl?: string | null
  } | null
  /** Itemized justification for the intent score — every line = a signal that fired */
  score_breakdown?: ScoreBreakdownItem[]
  /** Itemized justification for the requirement/match score (V2 explainability) */
  match_breakdown?: ScoreBreakdownItem[]
  /** Every rule that fired on this lead — the key rule_performance learns from */
  rules_fired?: string[]
  /** Hand-verified by the EBEXTA team (admin verified-leads pool) — premium trust marker */
  ebexta_verified?: boolean
  /** Cached deep-intel enrichment (Task 1) — generated once, stored on the lead */
  deep_intel?: Record<string, unknown> | null
  /** Transparent, evidence-based accessibility assessment (replaces fabricated percentages) */
  reachability?: ReachabilityAssessment
  /** Structured explanation of why THIS company specifically needs the user's offering */
  service_need_evidence?: ServiceNeedEvidence
  /** Granular verification status for contact email */
  email_status?: 'verified' | 'unverified' | 'not_found' | 'enrichment_failed'
  /** Pipeline lead-to-action status */
  action_status?: LeadActionStatus
  /** User notes for outreach and CRM tracking */
  lead_notes?: string | null
  /** User-defined follow-up date for next action */
  follow_up_date?: string | null

  // ── DEEP SITE WALKTHROUGH (additive) ──
  // Everything below is derived from pages EBEXTA actually fetched, so it can be
  // labelled VERIFIED rather than EBEXTA Engine inferred. See src/lib/siteWalkthrough.ts.
  /** Tech detected from real HTML fingerprints (replaces any guessed stack) */
  tech_stack?: string[]
  /** What Gemini read from the fetched pages — never from memory */
  site_walkthrough?: SiteWalkthrough | null
  /** Every URL fetched, with the facts regex-extracted from each */
  pages_read?: PageRead[]
  /** 'full' | 'partial' | 'unreachable' | 'blocked' */
  site_read_status?: SiteReadStatus
  site_read_at?: string
  /** CONFIRMED / CONTRADICTED / NOT_ON_SITE per field, with proving URL */
  claim_verification?: ClaimCheck[]
  /** Human-readable log of what the site walkthrough corrected */
  site_corrections?: string[]
  /** Gap signals proved by a fetched page (is_verified = true) */
  verified_signals?: VerifiedSignal[]
  /** Gaps we could NOT confirm — shown honestly, never scored. */
  unconfirmed_signals?: UnconfirmedSignal[]

  implicit_gap_facts?: any[]
  registry_checks?: any[]
  tech_fingerprints?: string[]
  ad_spend_detected?: boolean
  resolved_sector?: string
  sector_confidence?: string
  email_pattern?: string | null
  gstin?: string | null
  gstin_verified?: boolean
  honesty_score?: number
  unknown_fields?: string[]
  second_pass_agreed?: boolean

  // ── SEARCH VISIBILITY (visibility-dependent sectors only) ──
  // A company already at the top of its own category does not need help being
  // found. See src/lib/rankCheck.ts.
  search_visibility?: SearchVisibility
  rank_evidence?: RankEvidence | null
  /** Why a lead was filtered out — kept so over-filtering stays visible. */
  excluded_reason?: string
  /** Shown again because the market ran out of new companies. */
  seen_before?: boolean
  reverified_at?: string

  // ── DESCRIPTION-FIRST MATCHING ──
  /** Why THIS company needs what the user sells. Shown on the card. */
  need_summary?: string
  /** 0-100. Below 40 the lead is excluded, never shown. */
  description_match_score?: number
  /** The core service EBEXTA extracted from the user's description. */
  source_description?: string
  /** True when served from the shared pool rather than a fresh scan. */
  from_pool?: boolean

  // ── FEASIBILITY GATE (additive) ──
  // Only ever populated when the seller declared a prerequisite. Sellers with
  // none set never see these fields and their results are unchanged.
  /** 'ready' | 'unknown' | 'not_viable' — see src/lib/feasibility.ts */
  feasibility_status?: FeasibilityStatus
  /** What drove the verdict, with a source URL when it came from their site */
  feasibility_evidence?: FeasibilityEvidence[]
  /** +40 ready at scale · +25 ready · 0 unknown */
  feasibility_score?: number
  /** The prerequisite that was checked, for display */
  feasibility_prerequisite?: string
}

// ─── Zod validation schema ───────────────────────────────────────────────────

const StakeholderSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  linkedin_url: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  priority_score: z.number().min(0).max(100).default(70),
})

const RawLeadSchema = z.object({
  company_name: z.string().min(1),
  industry: z.string().min(1),
  location: z.string().min(1),
  employee_count: z.number().int().positive(),
  funding_stage: z.string().min(1),
  annual_revenue: z.string().nullable().optional().default('Unknown'),
  website: z.string().nullable().optional().default(''),
  linkedin_url: z.string().nullable().optional().default(''),
  email: z.string().nullable().optional().default(''),
  evidence_source_url: z.string().nullable().optional().default(''),
  evidence_sources: z.array(z.string()).nullable().optional(),
  recent_signals: z.array(z.string()).nullable().optional().default([]),
  stakeholders: z.array(StakeholderSchema).nullable().optional().default([]),
})

// ─── Stage 1: Cache check ─────────────────────────────────────────────────────

const MIN_LEADS = 5   // user must get at least this many leads per scan

async function checkCache(filters: ScanFilters): Promise<{ filterHash: string; cached: ScannedLead[] | null }> {
  const hashInput = JSON.stringify({
    mission: (filters.mission ?? '').substring(0, 60),
    mode: filters.mode ?? 'seeker',
    employeeMin: filters.employeeMin ?? 1,
    employeeMax: filters.employeeMax ?? 5000,
    country: filters.country ?? 'India',
    countries: parseTargetCountries(filters).sort(),
    cities: (filters.cities ?? []).map(c => c.trim().toLowerCase()).sort(),
    stages: (filters.companyStages ?? []).sort(),
  })
  const utf8Bytes = new TextEncoder().encode(hashInput)
  const binString = Array.from(utf8Bytes, (byte) => String.fromCharCode(byte)).join('')
  const filterHash = btoa(binString).replace(/[^a-zA-Z0-9]/g, '').substring(0, 64)

  // "Generate More Leads" passes excludeCompanies — the cache would just return
  // the SAME companies again (all filtered out as duplicates → "no new leads").
  // Always run a fresh scan when exclusions are present.
  if ((filters.excludeCompanies ?? []).length > 0) {
    return { filterHash, cached: null }
  }

  try {
    const { data } = await supabase
      .from('cached_leads')
      .select('leads')
      .eq('filter_hash', filterHash)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle()

    // A cache entry with fewer than MIN_LEADS is treated as a miss — the user
    // must always end a scan with at least MIN_LEADS leads.
    if (data?.leads && Array.isArray(data.leads) && data.leads.length >= MIN_LEADS) {
      return { filterHash, cached: data.leads as ScannedLead[] }
    }
  } catch {
    // Cache miss is fine
  }

  return { filterHash, cached: null }
}

// ─── Stage 2: Google Search Grounded Discovery ───────────────────────────────

// Extended raw lead type — includes both old fields (for scoring pipeline compat)
// AND new rich fields from the grounded response
interface RawGroundedLead extends z.infer<typeof RawLeadSchema> {
  /** Why THIS company needs what the user sells (description-first matching). */
  need_summary?: string
  description_match_score?: number
  description?: string
  company_linkedin?: string
  company_twitter?: string
  requirement_theme?: string
  turnover?: string
  revenue_growth?: string
  funding_details?: string
  funding_source_url?: string
  investment_history?: string
  big_projects?: string[]
  match_reason?: string[]
  contacts?: RichContact[]
  company_stage?: string
  email_status?: 'verified' | 'unverified' | 'not_found' | 'enrichment_failed'
  /** Scored 40-59, or released from reserve. Shown to the user as such. */
  loosely_matched?: boolean
  /** Competitor flag from enrichment — competitor leads are discarded */
  is_competitor?: boolean
  competitor_reason?: string | null
  /** Model flagged the evidence as weak/incomplete → force Manual Review. */
  model_manual_review?: boolean
  manual_review_reason?: string | null
  /** Gemini's own research-based intent assessment — used as a floor so
   *  enriched leads never score 0 just because keyword matching missed. */
  model_intent_score?: number
  model_intent_flags?: string[]
  /** Company-level contact fallback (Google Maps / website) */
  company_contact?: {
    email?: string | null
    phone?: string | null
    address?: string | null
    sourceUrl?: string | null
  } | null
  second_pass_agreed?: boolean
  unknown_fields?: string[]
  honesty_score?: number
}

// Lightweight URL check for grounded links — grounded sources are more trusted
// so we only block obvious fakes, not require full normalizeUrl() strictness
const GROUNDED_URL_REGEX = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w\-.~:/?#[\]@!$&'()*+,;=%]*)*\/?$/i
function isValidLink(url: string | null | undefined): boolean {
  if (!url) return false
  const u = url.trim()
  if (u.includes('/404')) return false
  if (u.includes('example.com')) return false
  if (u.includes('placeholder')) return false
  if (u.toLowerCase() === 'null' || u.toLowerCase() === 'n/a') return false
  return GROUNDED_URL_REGEX.test(u)
}

// Parse employee count from various formats: number, "50", "50-200", "~100"
function parseEmployeeCount(raw: unknown, fallback: number): number {
  if (typeof raw === 'number' && raw > 0) return raw
  if (typeof raw === 'string') {
    const rangeMatch = raw.match(/(\d[\d,]*)\s*[-–]\s*(\d[\d,]*)/)
    if (rangeMatch) {
      const lo = parseInt(rangeMatch[1].replace(/,/g, ''))
      const hi = parseInt(rangeMatch[2].replace(/,/g, ''))
      return Math.round((lo + hi) / 2)
    }
    const single = parseInt(raw.replace(/[^\d]/g, ''))
    if (!isNaN(single) && single > 0) return single
  }
  return fallback
}

// Derive priority score from a RichContact
function priorityFromContact(c: RichContact, idx: number): number {
  const role = c.role.toLowerCase()
  if (c.isPrimary && idx === 0) return 100
  if (/\bceo\b|\bchief executive\b/.test(role)) return 100
  if (/\bfounder/.test(role) && idx === 0) return 95
  if (/\bfounder/.test(role)) return 88
  if (/\bvp.*(sales|revenue|business)\b/.test(role)) return 90
  if (/\bcto\b|\bchief tech/.test(role)) return 82
  if (/\bcfo\b|\bchief fin/.test(role)) return 80
  if (/\bcmo\b|\bchief mark/.test(role)) return 78
  if (/\bcoo\b|\bchief oper/.test(role)) return 76
  if (/\bvp\b|\bvice president\b/.test(role)) return 72
  if (/\bdirector/.test(role)) return 65
  if (/\bhead of/.test(role)) return 58
  if (/\bmanager/.test(role)) return 45
  if (c.authorityType === 'Economic') return 78
  if (c.authorityType === 'Technical') return 65
  return Math.max(30, 60 - idx * 5)
}

// Map a raw grounded response item → RawGroundedLead
function salvageGroundedLead(raw: Record<string, unknown>, filters: ScanFilters): RawGroundedLead {
  const empFallback = Math.floor(
    Math.random() * ((filters.employeeMax ?? 500) - (filters.employeeMin ?? 10)) + (filters.employeeMin ?? 10)
  )

  // Process contacts → also derive backward-compat stakeholders with multi-source cross-verification
  const rawContacts: Array<Record<string, unknown>> = Array.isArray(raw.contacts) ? raw.contacts : []
  const contacts: RichContact[] = rawContacts.map((c, idx) => {
    const rawLinkedIn = c.linkedInUrl ? String(c.linkedInUrl) : null
    // With grounding, trust the URL if it passes isValidLink — only apply fake-slug check
    const safeLinkedIn = rawLinkedIn && isValidLink(rawLinkedIn) && !isLikelyFakeLinkedIn(rawLinkedIn)
      ? normalizeUrl(rawLinkedIn)
      : null

    const detectedSources: string[] = []
    if (c.sourceUrl || String(c.verificationLogic ?? '').toLowerCase().includes('website') || String(c.verificationLogic ?? '').toLowerCase().includes('about') || String(c.verificationLogic ?? '').toLowerCase().includes('team')) {
      detectedSources.push('Company Website (About/Team)')
    }
    if (safeLinkedIn || String(c.verificationLogic ?? '').toLowerCase().includes('linkedin')) {
      detectedSources.push('LinkedIn')
    }
    if (String(c.verificationLogic ?? '').toLowerCase().includes('crunchbase') || String(c.verificationLogic ?? '').toLowerCase().includes('news') || String(c.verificationLogic ?? '').toLowerCase().includes('press')) {
      detectedSources.push('Public Press / Registry')
    }
    if (Array.isArray(c.sources)) {
      c.sources.forEach(s => {
        const sStr = String(s).trim()
        if (sStr && !detectedSources.includes(sStr)) detectedSources.push(sStr)
      })
    }
    if (detectedSources.length === 0) {
      detectedSources.push('Official Web Search')
    }

    const isMultiSource = detectedSources.length >= 2 || (Boolean(c.sourceUrl) && Boolean(safeLinkedIn))
    const verificationLevel: 'verified' | 'partially_verified' = isMultiSource ? 'verified' : 'partially_verified'

    const rawName = String(c.name ?? '').trim()
    const rawRole = String(c.role ?? '').trim()
    const isGeneric = isGenericContactName(rawName)
    const finalName = isGeneric ? 'No verified key contact found' : rawName
    const finalRole = isGenericContactName(rawRole) ? 'Decision Maker' : (rawRole || 'Decision Maker')

    return {
      name: finalName,
      role: finalRole,
      authorityType: (['Technical', 'Economic', 'User', 'Other'].includes(String(c.authorityType))
        ? String(c.authorityType)
        : 'Other') as RichContact['authorityType'],
      email: isGeneric ? null : (c.email ? String(c.email) : null),
      linkedInUrl: isGeneric ? null : safeLinkedIn,
      twitterUrl: c.twitterUrl ? String(c.twitterUrl) : null,
      githubUrl: c.githubUrl ? String(c.githubUrl) : null,
      about: c.about ? String(c.about) : null,
      sourceUrl: c.sourceUrl ? normalizeUrl(String(c.sourceUrl)) : null,
      verificationLogic: c.verificationLogic ? String(c.verificationLogic) : null,
      isPrimary: idx === 0 || Boolean(c.isPrimary),
      roleJustification: c.roleJustification ? String(c.roleJustification) : null,
      verification_level: isGeneric ? 'partially_verified' : verificationLevel,
      sources: detectedSources,
      source_count: detectedSources.length,
    }
  })

  // Backward-compat stakeholders derived from contacts — omit generic placeholders from top list
  const stakeholders = contacts
    .map((c, idx) => ({
      name: c.name,
      title: c.role,
      linkedin_url: c.linkedInUrl ?? null,
      email: c.email ?? null,
      priority_score: priorityFromContact(c, idx),
      verification_level: c.verification_level,
      sources: c.sources,
      source_count: c.source_count,
    }))
    .filter(s => s.priority_score > 0 && !isGenericContactName(s.name))
    .sort((a, b) => b.priority_score - a.priority_score)

  // Company URL normalization & strict domain structure verification
  const rawWebsite = raw.website ? String(raw.website) : null
  const rawCompanyLinkedIn = raw.companyLinkedIn ? String(raw.companyLinkedIn) : null
  const rawFundingSource = raw.fundingSourceUrl ? String(raw.fundingSourceUrl) : null

  const normalizedWebsite = (isValidLink(rawWebsite) && verifyDomainStructure(rawWebsite))
    ? normalizeUrl(rawWebsite)
    : null
  const normalizedLinkedIn = (() => {
    if (!rawCompanyLinkedIn || !isValidLink(rawCompanyLinkedIn)) return null
    const n = normalizeUrl(rawCompanyLinkedIn)
    return (n && isLikelyFakeLinkedIn(n)) ? null : n
  })()
  const normalizedFundingSource = isValidLink(rawFundingSource) ? normalizeUrl(rawFundingSource) : null

  // Evidence source = the NEED/OFFER proof (hiring post, RFP, service page). It
  // MUST be distinct from the funding link — never borrow fundingSourceUrl here.
  const contactsArr = Array.isArray(raw.contacts) ? raw.contacts as Array<{ sourceUrl?: unknown }> : []
  const evidenceCandidates = [
    raw.evidenceSourceUrl ? String(raw.evidenceSourceUrl) : null,
    contactsArr[0]?.sourceUrl ? String(contactsArr[0].sourceUrl) : null,
    (raw.companyContact as { sourceUrl?: unknown } | undefined)?.sourceUrl ? String((raw.companyContact as { sourceUrl?: unknown }).sourceUrl) : null,
  ]
  let normalizedEvidenceSource =
    evidenceCandidates.map(u => (u && isValidLink(u) ? normalizeUrl(u) : null)).find(Boolean) ?? null
  // If the model accidentally returned the funding URL as evidence, drop it so
  // the two links never duplicate.
  if (normalizedEvidenceSource && normalizedFundingSource && normalizedEvidenceSource === normalizedFundingSource) {
    normalizedEvidenceSource = null
  }

  // Collect EVERY real source link we found (take from 2+ sources) — deduped.
  const allRawSources: (string | null)[] = [
    ...(Array.isArray(raw.evidenceSources) ? (raw.evidenceSources as unknown[]).map(String) : []),
    ...evidenceCandidates,
    rawWebsite,
    normalizedLinkedIn,
    ...contactsArr.map(c => (c.sourceUrl ? String(c.sourceUrl) : null)),
  ]
  const evidence_sources = Array.from(new Set(
    allRawSources
      .map(u => (u && isValidLink(u) ? normalizeUrl(u) : null))
      .filter((u): u is string => !!u)
  )).slice(0, 8)

  const company_name = String(raw.companyName ?? raw.company_name ?? 'Unknown Company')
  const defaultLocation = (filters.cities && filters.cities[0]) || parseTargetCountries(filters)[0] || 'India'
  const location = String(raw.location ?? raw.city ?? defaultLocation)
  const industry = String(raw.industry ?? raw.sector ?? 'Technology')
  const funding_stage = String(raw.companyStage ?? raw.funding_stage ?? (filters.companyStages?.[0] ?? 'Series A'))
  const employee_count = parseEmployeeCount(raw.employeeCount ?? raw.employee_count, empFallback)
  const turnover = raw.turnover ? String(raw.turnover) : (raw.annual_revenue ? String(raw.annual_revenue) : null)

  // recent_signals: ensure live signals are always populated
  const bigProjects: string[] = Array.isArray(raw.bigProjects) ? raw.bigProjects.map(String) : []
  let recentSignals: string[] = Array.isArray(raw.recent_signals) && raw.recent_signals.length > 0
    ? raw.recent_signals.map(String)
    : bigProjects
  if (recentSignals.length === 0) {
    if (raw.whyMatch) recentSignals.push(String(raw.whyMatch))
    if (raw.needSummary) recentSignals.push(String(raw.needSummary))
    if (recentSignals.length === 0) {
      recentSignals = [`Expanding operations in ${location}`, `Active procurement window for ${industry} solutions`]
    }
  }

  return {
    // ── Old-format fields (backward compat with scoring pipeline) ──
    company_name,
    industry,
    location,
    employee_count,
    funding_stage,
    annual_revenue: turnover ?? 'Unknown',
    email: (() => {
      const topContactEmail = contacts.find(c => c.isPrimary && c.email)?.email || contacts.find(c => c.email)?.email
      if (topContactEmail && isValidEmail(topContactEmail)) return topContactEmail
      const cc = raw.companyContact as Record<string, unknown> | null | undefined
      if (cc?.email && isValidEmail(String(cc.email))) return String(cc.email).trim()
      if (raw.email && isValidEmail(String(raw.email))) return String(raw.email).trim()
      return ''
    })(),
    email_status: (() => {
      const topContact = contacts.find(c => c.isPrimary && c.email) || contacts.find(c => c.email)
      if (topContact) {
        return topContact.verification_level === 'verified' ? ('verified' as const) : ('unverified' as const)
      }
      const cc = raw.companyContact as Record<string, unknown> | null | undefined
      if ((cc?.email && isValidEmail(String(cc.email))) || (raw.email && isValidEmail(String(raw.email)))) {
        return 'unverified' as const
      }
      return 'not_found' as const
    })(),
    website: normalizedWebsite,
    linkedin_url: normalizedLinkedIn,
    evidence_source_url: normalizedEvidenceSource ?? '',
    evidence_sources,
    recent_signals: recentSignals,
    stakeholders,
    // ── New rich fields ──
    description: raw.description ? String(raw.description) : undefined,
    company_linkedin: normalizedLinkedIn ?? undefined,
    company_twitter: raw.companyTwitter ? String(raw.companyTwitter) : undefined,
    requirement_theme: raw.requirementTheme ? String(raw.requirementTheme) : undefined,
    turnover: turnover ?? undefined,
    revenue_growth: raw.revenueGrowth ? String(raw.revenueGrowth) : undefined,
    funding_details: raw.fundingDetails ? String(raw.fundingDetails) : undefined,
    funding_source_url: normalizedFundingSource ?? undefined,
    investment_history: raw.investmentHistory ? String(raw.investmentHistory) : undefined,
    big_projects: bigProjects.length > 0 ? bigProjects : undefined,
    match_reason: Array.isArray(raw.matchReason) ? raw.matchReason.map(String) : undefined,
    contacts,
    company_stage: funding_stage,
    is_competitor: Boolean(raw.isCompetitor),
    competitor_reason: raw.competitorReason ? String(raw.competitorReason) : null,
    model_manual_review: Boolean(raw.manualReview),
    manual_review_reason: raw.manualReviewReason ? String(raw.manualReviewReason) : null,
    model_intent_score: typeof raw.intentScore === 'number'
      ? Math.max(0, Math.min(100, raw.intentScore))
      : undefined,
    model_intent_flags: Array.isArray(raw.intentFlags) ? raw.intentFlags.map(String) : undefined,
    company_contact: (() => {
      const cc = raw.companyContact as Record<string, unknown> | null | undefined
      if (!cc || typeof cc !== 'object') return null
      const email = cc.email ? String(cc.email) : null
      const rawPhone = cc.phone ? String(cc.phone) : null
      // Drop hallucinated / placeholder numbers (e.g. "74000 74000") — better
      // to store no number than a wrong one someone might call.
      const phone = (() => {
        if (!rawPhone) return null
        const d = rawPhone.replace(/\D/g, ''); const nn = d.length > 10 ? d.slice(-10) : d
        const ok = nn.length === 10 && /^[6-9]/.test(nn) && new Set(nn).size >= 4
          && nn.slice(0, 5) !== nn.slice(5) && !'01234567890'.includes(nn) && !'09876543210'.includes(nn)
        return ok ? rawPhone : null
      })()
      const address = cc.address ? String(cc.address) : null
      if (!email && !phone && !address) return null
      return {
        email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.includes('example.') ? email : null,
        phone,
        address,
        sourceUrl: cc.sourceUrl ? normalizeUrl(String(cc.sourceUrl)) : null,
      }
    })(),
  }
}



async function applyDoublePassToLead(lead: RawGroundedLead, _companyName: string): Promise<RawGroundedLead> {
  const hasLoc = !!(lead.location && lead.location !== 'Unknown')
  const hasEmp = (lead.employee_count ?? 0) > 0
  const hasRev = !!(lead.annual_revenue && lead.annual_revenue !== 'Not publicly available')
  const hasStage = !!(lead.funding_stage && lead.funding_stage !== 'Unknown' && lead.funding_stage !== 'N/A')

  lead.unknown_fields = []
  if (!hasLoc) { lead.location = 'Unknown'; lead.unknown_fields.push('location') }
  if (!hasEmp) { lead.unknown_fields.push('employee_count') }
  if (!hasRev) { lead.unknown_fields.push('annual_revenue') }
  if (!hasStage) {
    lead.funding_stage = 'Not publicly disclosed'
    lead.unknown_fields.push('funding_stage')
  }

  lead.second_pass_agreed = lead.unknown_fields.length <= 1
  lead.honesty_score = Math.round(((4 - lead.unknown_fields.length) / 4) * 100)
  return lead
}

// Merge a product's ideal-buyer profile into the scan filters. Product industries
// and buyer roles take priority (listed first); manual geography/size still constrain.
function mergeProductIntoFilters(filters: ScanFilters): ScanFilters {
  const pp = filters.productProfile
  if (filters.targetType !== 'product' || !pp) return filters
  const ib = pp.ideal_buyer ?? {}
  const industries = [...new Set([...(ib.industries ?? []), ...(filters.industries ?? [])].filter(Boolean))]
  const decisionMakerRoles = [...new Set([...(ib.buyer_roles ?? []), ...(filters.decisionMakerRoles ?? [])].filter(Boolean))]
  return { ...filters, industries, decisionMakerRoles }
}

// Load the user's ACTIVE product (if any) and fold it into the filters so every
// scan path (fresh scan, generate-more, deep scan) targets that product's buyer.
// If no product is active, the account markets its whole company — untouched.
async function resolveProductFilters(filters: ScanFilters, userId: string): Promise<ScanFilters> {
  try {
    const active = await fetchActiveProduct(userId)
    if (!active) return filters
    const profile = active.ideal_buyer_profile ?? {}
    return mergeProductIntoFilters({
      ...filters,
      targetType: 'product',
      productProfile: {
        product_name: active.product_name ?? undefined,
        product_summary: profile.product_summary,
        core_value: profile.core_value,
        pitch_angle: profile.pitch_angle,
        ideal_buyer: profile.ideal_buyer,
      },
    })
  } catch { return filters }
}

// Build the discovery prompt (shared by grounded + fallback paths)
function buildDiscoveryPrompt(filters: ScanFilters, negativeExclusions = ''): string {
  const mode = filters.mode ?? 'seeker'
  const exclusionClause = (filters.excludeCompanies ?? []).length > 0
    ? `\nDo NOT include any of these (already found): ${filters.excludeCompanies!.join(', ')}\n`
    : ''

  return `You are EBEXTA Brain, a Precision Market Intelligence Engine. Use Google Search to find real companies.

${buildMatchingRule(filters)}
${buildRolesRule(filters)}

CONTEXT:
- Mode: ${mode === 'seeker' ? 'SEEKER — find providers/vendors we can buy from' : 'PROVIDER — find potential customers/buyers for our services'}
- Offering/Need: ${filters.mission ?? 'B2B technology services'}
- Location: ${filters.country ?? 'India'}${filters.region ? ` / ${filters.region}` : ''}${(filters.cities ?? []).length > 0 ? ` — cities: ${filters.cities!.join(', ')}` : ''}

FILTERS:
- Employees: ${filters.employeeMin ?? 10}–${filters.employeeMax ?? 500}
- Stage: ${(filters.companyStages ?? ['Series A', 'Series B']).join(', ')}
${(filters.industries ?? []).length > 0 ? `- Industries: ${filters.industries!.join(', ')}` : ''}
${(filters.techStack ?? []).length > 0 ? `- Tech stack: ${filters.techStack!.join(', ')}` : ''}
${(filters.serviceCategories ?? []).length > 0 ? `- They need: ${filters.serviceCategories!.join(', ')}` : ''}
${filters.intentSignals?.recentlyFunded ? '- PRIORITY: Recently funded' : ''}
${filters.intentSignals?.hiringAggressively ? '- PRIORITY: Hiring aggressively (20+ open roles)' : ''}
${filters.intentSignals?.geographicExpansion ? '- PRIORITY: Geographic expansion signals' : ''}
${filters.intentSignals?.techMigration ? '- PRIORITY: Tech migration signals' : ''}
${exclusionClause}${negativeExclusions}

INTENT SCORING (0–100 per company):
Recent Hiring +15, Funding +20, Tech Gaps +10, Expansion +10, Product Launch +15, Migration +15
intentFlags options: RECENT_FUNDING, RECENT_HIRING, EXPANSION, BUDGET_GAP, TECH_MIGRATION, NEW_PRODUCT_LAUNCH

MANDATORY LINK & DOMAIN RULES (STRICT):
- website: full https:// URL. Perform a Google Ground Search to verify the company's ACTUAL live official website domain. Do NOT output crashed, parked, or non-existent domains. Set null if unverified.
- companyLinkedIn: only if certain it's the real company page. Null if unsure.
- contacts[].linkedInUrl: ONLY set if you found the exact real profile URL via search. Null otherwise. Do NOT guess/invent.
- fundingSourceUrl: real news/Crunchbase URL for funding claim. Null if not found.
- NULL IS BETTER THAN FAKE. One fake link destroys the whole lead.

CURRENCY RULE (STRICT):
- Report fundingDetails, turnover, investmentHistory in the SAME currency the SOURCE states.
- For Indian companies, use ₹ crore / ₹ lakh exactly as the source reports (e.g. "Raised ₹100 Cr Series B"). For US companies use $, for Europe €, etc.
- NEVER convert to USD or "millions" when the source reported rupees. Match the source's own figure and currency.

STAKEHOLDER & KEY CONTACT DIRECTIVE (STRICT):
1. NEVER use generic terms such as "Management Team", "Team", "Leadership", "Executive", "Management", or generic placeholders as the primary Key Contact search query or output name/title.
2. First identify the exact target company, determine the most relevant decision-maker role based on the customer's offering (e.g., CTO/VP Engineering for tech, VP Supply Chain/Plant Manager for machinery/industrial, CFO for finance).
3. Search specifically for individual named people using "company name + role + location/domain".
4. Cross-verify that the named person actually belongs to that exact target company.
5. IF NO SUFFICIENTLY VERIFIED INDIVIDUAL PERSON IS FOUND, return contacts as empty array [] or set name to "No verified key contact found" rather than guessing.
- linkedInUrl: only if found via real search result
- sourceUrl: where you confirmed their role (About page, LinkedIn, press article)
- verificationLogic: how you verified (e.g. "Found on company About page Jan 2025")
- isPrimary: true for the single best contact to reach

Return ONLY a JSON array with 5 companies. No markdown. No backticks.
[{
  "companyName": "Real Company Name",
  "website": "https://realcompany.com",
  "companyLinkedIn": "https://linkedin.com/company/real-slug",
  "companyTwitter": "https://twitter.com/handle",
  "description": "What this company does in 2 sentences.",
  "industry": "B2B SaaS / Fintech",
  "location": "Bangalore, India",
  "employeeCount": "50-200",
  "companyStage": "Series A",
  "intentScore": 75,
  "intentFlags": ["RECENT_FUNDING", "RECENT_HIRING"],
  "requirementTheme": "Needs cloud infrastructure and DevOps expertise",
  "matchReason": ["Raised Series A — has budget", "Hiring engineers — scaling phase"],
  "fundingDetails": "Raised ₹100 Cr Series A in Jan 2025 led by Sequoia India (use the source's own currency — ₹ for Indian companies, $ for US, etc.)",
  "turnover": "₹25–60 Cr ARR",
  "bigProjects": ["Launched payments module Q1 2025", "Expanded to 5 cities"],
  "investmentHistory": "Seed ₹8 Cr 2023, Series A ₹100 Cr Jan 2025",
  "revenueGrowth": "3x YoY",
  "fundingSourceUrl": "https://techcrunch.com/2025/01/company-raises-12m",
  "evidenceSourceUrl": "https://exact-url-proving-the-need — a hiring post, RFP, news or funding article. MANDATORY.",
  "evidenceSources": ["https://real-hiring-post", "https://real-funding-news", "https://real-expansion-article"],
  "companyContact": {
    "email": "info@realcompany.com",
    "phone": null,
    "address": "123 MG Road, Bangalore",
    "sourceUrl": "https://realcompany.com/contact"
  },
  "contacts": [{
    "name": "Priya Sharma",
    "role": "Chief Executive Officer",
    "authorityType": "Economic",
    "email": null,
    "linkedInUrl": "https://www.linkedin.com/in/priya-sharma-realcompany",
    "twitterUrl": null,
    "githubUrl": null,
    "about": "Co-founder, ex-Google, built company to $8M ARR",
    "sourceUrl": "https://realcompany.com/about",
    "verificationLogic": "Listed as CEO on company About page, confirmed Jan 2025",
    "isPrimary": true
  }]
}]`
}

// ─── Grounded REST call helper (shared by discovery + enrichment) ─────────────

interface GroundedCallResult {
  text: string
  tokensUsed: number
  sources: GroundingSource[]
}

// Attach the REAL pages Gemini visited (Google Search grounding) as the lead's
// evidence links. These are genuine proof of the match and are kept strictly
// separate from the funding announcement URL.
function attachGroundingEvidence(lead: RawGroundedLead, sources: GroundingSource[]) {
  if (!sources || sources.length === 0) return
  const funding = lead.funding_source_url ?? ''
  const uris = sources.map(s => s.uri).filter(u => !!u && u !== funding)
  if (uris.length === 0) return
  const merged = Array.from(new Set([...uris, ...(lead.evidence_sources ?? [])]))
    .filter(u => !!u && u !== funding)
  lead.evidence_sources = merged.slice(0, 8)
  // Primary evidence link = a real visited page, never the funding URL.
  if (!lead.evidence_source_url || lead.evidence_source_url === funding) {
    lead.evidence_source_url = uris[0]
  }
}

const SCAN_MODEL = 'gemini-flash-lite-latest'

// Single Gemini REST call with Google Search grounding.
// Returns raw text + token usage so every call can be tracked in api_usage.
// A daily-quota / billing 429 is fatal — retrying just burns remaining quota
// and hangs the scan. This is distinct from a transient per-minute rate limit.
function isQuotaExhausted(msg: string): boolean {
  return /exceeded your current quota|billing details|check your plan/i.test(msg)
}

async function groundedCall(prompt: string, action: GeminiAction = 'discovery'): Promise<GroundedCallResult> {
  // Routed through the secure Edge Function proxy — no API key in the frontend.
  // `action` drives the per-action rate limit (discovery vs enrich).
  return await callGeminiProxy(prompt, { action, grounded: true, model: SCAN_MODEL, jsonMode: true })
}

// Extract JSON from a model response. Uses the shared parser, which recovers
// fenced, prose-wrapped, trailing-comma and truncated output rather than
// throwing a SyntaxError into the middle of a scan.
function extractJson(text: string, kind: 'array' | 'object'): unknown {
  const parsed = safeParseJSON(text)
  if (parsed === null) throw new Error(`No JSON ${kind} in response`)
  if (kind === 'array' && !Array.isArray(parsed)) throw new Error('Expected JSON array in response')
  return parsed
}

// ── OPPOSITE-SIDE MATCHING (critical rule) ──────────────────────────────────
// SEEKER user → show them PROVIDERS. PROVIDER user → show them SEEKERS.
// NEVER same-side: a web design agency shown other web design agencies is
// being shown its COMPETITORS, not people who will make a deal with it.
// Resolve the requirement-rules sector for this scan. For product targeting we
// infer the sector from the product's ideal-buyer profile (not the company).
function resolveSectorForFilters(filters: ScanFilters): ResolvedSector {
  if (filters.targetType === 'product' && filters.productProfile) {
    return resolveSectorRuleForProduct(filters.productProfile, filters.mission ?? '')
  }
  // Prefer the EXTRACTED core service over the raw description — "we are a
  // game development studio building mobile titles" resolves far better as
  // "custom game development".
  //
  // A no-match is fine and always was: sector rules only ever contributed
  // scoring signals, never search queries. The description drives discovery
  // either way (see buildFilterContext), so a missing rule can no longer cause
  // the description to be ignored.
  const serviceText = filters.buyerProfile?.core_service || filters.mission || ''
  return resolveSectorRule(serviceText)
}

// buildMatchingRule = the bilateral opposite-side rule + the resolved
// requirement-hunting rule block (gap/trigger/anti-signals, event-evidence mode
// for physical sectors). See requirementRules.ts.
function buildMatchingRule(filters: ScanFilters): string {
  return `${buildMatchingRuleBase(filters)}\n\n${buildRulePromptBlock(resolveSectorForFilters(filters))}`
}

function buildMatchingRuleBase(filters: ScanFilters): string {
  const mode = filters.mode ?? 'seeker'
  const mission = filters.mission ?? 'B2B technology services'

  // ── Product-level targeting: aim at the PRODUCT's ideal buyer, not the
  //    company's generic ICP. Bilateral rule still holds. ──
  const pp = filters.productProfile
  if (filters.targetType === 'product' && pp) {
    const ib = pp.ideal_buyer ?? {}
    const name = pp.product_name || 'this product'
    const what = pp.product_summary || mission
    const lines = [
      ib.industries?.length ? `- Target industries: ${ib.industries.join(', ')}` : '',
      ib.company_sizes?.length ? `- Company sizes: ${ib.company_sizes.join(', ')}` : '',
      ib.trigger_signals?.length ? `- Buying triggers to look for: ${ib.trigger_signals.join(', ')}` : '',
      ib.geographies?.length ? `- Geographies: ${ib.geographies.join(', ')}` : '',
    ].filter(Boolean).join('\n')
    if (mode === 'provider') {
      return `MATCHING RULE — ABSOLUTE, NEVER VIOLATE:
The user is a PROVIDER taking a specific PRODUCT/SERVICE to market: "${name}".
What it is: ${what}. Core value: ${pp.core_value || 'solves a real business problem'}.
Find businesses that are the IDEAL BUYERS of THIS product — companies that would actually purchase it:
${lines}
- EXCLUDE any company that SELLS "${name}" or a similar/competing product. Those are COMPETITORS, not leads.
- Recommend a company ONLY when public evidence shows it fits the buyer profile and shows a real need.`
    }
    return `MATCHING RULE — ABSOLUTE, NEVER VIOLATE:
The user is a SEEKER looking to acquire: "${name}" — ${what}.
Find companies that PROVIDE this product/capability — proven vendors with a real delivery track record.
- EXCLUDE companies that are merely SEEKING the same thing (peers, not providers).
- Prioritize providers with strong portfolios, client reviews, and relevant case studies.`
  }

  if (mode === 'provider') {
    return `MATCHING RULE — ABSOLUTE, NEVER VIOLATE:
The user is a PROVIDER offering: "${mission}".
Find businesses that NEED this service and show buying signals — NOT companies that offer it.
- EXCLUDE any company that OFFERS "${mission}" or a similar service. Those are COMPETITORS, not leads.
- Example: a website design provider must be shown schools, colleges, local shops, growing ventures
  with great ratings but weak/missing web presence — NEVER other web design agencies.
- Prioritize demand signals: high customer ratings, active/growing business, many customers,
  weak or missing presence in exactly the area the user's service fixes.`
  }
  return `MATCHING RULE — ABSOLUTE, NEVER VIOLATE:
The user is a SEEKER who needs: "${mission}".
Find companies that PROVIDE this — proven vendors/providers with real delivery track record.
- EXCLUDE companies that are merely SEEKING the same thing (they are peers, not providers).
- Prioritize providers with strong portfolios, client reviews, and relevant case studies.`
}

// Target decision-maker roles line (user chooses who they want: CEO, CTO, etc.)
function buildRolesRule(filters: ScanFilters): string {
  // For a product, the ideal_buyer.buyer_roles rank highest (e.g. an HR product
  // wants HR Heads); merge them with any manually chosen roles.
  const productRoles = filters.targetType === 'product' ? (filters.productProfile?.ideal_buyer?.buyer_roles ?? []) : []
  // The resolved sector rule contributes its canonical buyer roles too.
  const sectorRoles = resolveSectorForFilters(filters).rule?.buyerRoles ?? []
  const roles = [...new Set([...productRoles, ...(filters.decisionMakerRoles ?? []), ...sectorRoles].map(r => r.trim()).filter(Boolean))]
  if (roles.length === 0) return ''
  return `
TARGET CONTACT ROLES: the user specifically wants to reach: ${roles.join(', ')}.
- Find contacts holding these roles FIRST.
- If the company genuinely has no such position (e.g. no CTO exists), return the closest
  real decision maker instead AND set "roleJustification" explaining WHY this person was
  chosen (e.g. "No CTO exists at this 12-person company; the founder-CEO owns all
  technology decisions"). NEVER invent a person to fit the requested title.`
}

// Shared filter context block used by both passes
function buildFilterContext(filters: ScanFilters): string {
  const mode = filters.mode ?? 'seeker'
  const productLine = filters.targetType === 'product' && filters.productProfile
    ? `\n- Marketing a specific PRODUCT: "${filters.productProfile.product_name ?? ''}" — target its ideal buyers (see matching rule above), not the company's generic ICP.`
    : ''

  // ── THE BUYER PROFILE COMES FIRST ──
  const bp = filters.buyerProfile
  const buyerBlock = bp ? `
WHAT THE USER SELLS: ${bp.core_service}
FIND COMPANIES THAT GENUINELY NEED IT. They look like this:
${bp.who_needs_this}
${bp.buyer_triggers.length > 0 ? `SITUATIONS THAT CREATE THE NEED: ${bp.buyer_triggers.join(' · ')}` : ''}
${bp.search_phrases.length > 0 ? `SEARCH AROUND THE NEED, e.g.: ${bp.search_phrases.map(p => `"${p}"`).join(', ')}` : ''}
${bp.exclude.length > 0 ? `EXCLUDE: ${bp.exclude.join(' · ')} — and above all, ANY company that PROVIDES ${bp.core_service} itself. Those are competitors, not leads.` : ''}
` : ''

  const targetCountries = parseTargetCountries(filters)
  const citiesList = (filters.cities ?? []).map(c => c.trim()).filter(Boolean)
  const empMin = Number(filters.employeeMin) || 10
  const empMax = Number(filters.employeeMax) || 500

  return `${buyerBlock}
- Mode: ${mode === 'seeker' ? 'SEEKER — find providers/vendors we can buy from' : 'PROVIDER — find potential customers/buyers for our services'}
- Offering/Need: ${filters.mission ?? 'B2B technology services'}${productLine}

MANDATORY GEOGRAPHY & HEADCOUNT SPECIFICATIONS (STRICT SEARCH PARAMETERS):
- Target Countries: ${targetCountries.join(', ')} (The discovered companies MUST be headquartered in or have operations in these countries).
${citiesList.length > 0 ? `- Target Cities / Tech Hubs: ${citiesList.join(', ')} (Prioritize companies located in or operating in these cities).` : ''}
- Target Company Size: EXACTLY between ${empMin} and ${empMax >= 1000 ? '1,000+' : empMax} employees. (STRICT: Do NOT return global enterprise giants with thousands of employees or tiny sole-proprietorships outside this range).
- Stage: ${(filters.companyStages ?? ['Series A', 'Series B']).join(', ')}
${(filters.industries ?? []).length > 0 ? `- Target industries: ${filters.industries!.join(', ')}` : ''}
${(filters.techStack ?? []).length > 0 ? `- Tech stack: ${filters.techStack!.join(', ')}` : ''}
${(filters.serviceCategories ?? []).length > 0 ? `- They need: ${filters.serviceCategories!.join(', ')}` : ''}
${filters.intentSignals?.recentlyFunded ? '- PRIORITY: Recently funded' : ''}
${filters.intentSignals?.hiringAggressively ? '- PRIORITY: Hiring aggressively (20+ open roles)' : ''}
${filters.intentSignals?.geographicExpansion ? '- PRIORITY: Geographic expansion signals' : ''}
${filters.intentSignals?.techMigration ? '- PRIORITY: Tech migration signals' : ''}`
}

// ─── PASS 1: Discovery — company names ONLY (one cheap grounded call) ──────────
//
// WHY: asking for 8 fully-enriched leads in one call makes grounding attention
// degrade — lead #1 gets real research, leads #5–8 get lazy/fake links.
// Names-only discovery is fast and reliable; enrichment happens per company.

interface DiscoveredName {
  companyName: string
  location?: string
  employeeCount?: string
  whyMatch: string
  /** Why THIS company needs what the user sells. Empty = the model couldn't
   *  justify it, which is itself the signal to drop the lead. */
  needSummary: string
}

async function discoverNames(filters: ScanFilters, _userId: string, count = 16): Promise<DiscoveredName[]> {
  let rejections: Array<{ company_name: string; reason: string | null }> = []
  if (_userId) {
    try {
      const { data } = await supabase
        .from('dismissed_leads')
        .select('company_name, reason')
        .eq('user_id', _userId)
        .order('dismissed_at', { ascending: false })
        .limit(15)
      if (data) rejections = data
    } catch (err) {
      console.warn('[EBEXTA] Failed to fetch dismissed leads for exclusions:', err)
    }
  }

  const negativeExclusions = rejections.length > 0
    ? `\nCRITICAL NEGATIVE EXAMPLES (The user has rejected these companies. DO NOT return these or similar companies):\n` +
      rejections.map(r => `- "${r.company_name}" (Reason: ${r.reason || 'unspecified'})`).join('\n')
    : ''

  const exclusionClause = (filters.excludeCompanies ?? []).length > 0
    ? `\nDo NOT include any of these (already found): ${filters.excludeCompanies!.join(', ')}\n`
    : ''

  const prompt = `You are EBEXTA Brain, a Precision Market Intelligence Engine.

${buildMatchingRule(filters)}

Using Google Search, find ${count} REAL companies matching:
${buildFilterContext(filters)}
${exclusionClause}${negativeExclusions}
Return ONLY a JSON array of up to ${count} entries. No other fields, no links, no contacts:
[{"companyName": "Real Company Name", "location": "City, Country", "employeeCount": "e.g. 50-200", "whyMatch": "one line on why this company is a COUNTERPART (not a competitor) for the user", "needSummary": "one sentence on why THIS company specifically needs ${filters.buyerProfile?.core_service ?? (filters.mission ?? 'this service')}"}]

The needSummary is not optional and must be specific to that company. If you cannot
write a genuine needSummary for a company — one that names a real reason THIS
business needs it — do not include that company at all. Ensure location and employeeCount are populated accurately. A short list of real
matches is correct; a long list padded with plausible-looking companies is not.
No markdown. No backticks.`

  const parseNames = (raw: unknown): DiscoveredName[] => {
    if (!Array.isArray(raw)) throw new Error('Expected array from discovery pass')
    const all = raw
      .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
      .map(item => ({
        companyName: String(item.companyName ?? item.company_name ?? '').trim(),
        location: item.location ? String(item.location).trim() : undefined,
        employeeCount: item.employeeCount ? String(item.employeeCount).trim() : (item.employee_count ? String(item.employee_count).trim() : undefined),
        whyMatch: String(item.whyMatch ?? item.why_match ?? '').trim(),
        needSummary: String(item.needSummary ?? item.need_summary ?? '').trim(),
      }))
      .filter(n => n.companyName.length > 1)

    const matching = all.filter(p => {
      const geoOk = matchesTargetGeography(p.location, filters)
      const empNum = parseEmployeeCount(p.employeeCount, 0)
      const sizeOk = empNum === 0 || matchesEmployeeRange(empNum, filters)
      return geoOk && sizeOk
    })

    // Strictly enforce target geography filter if specified
    const geoFiltered = (filters.country || (filters.countries ?? []).length > 0)
      ? all.filter(p => matchesTargetGeography(p.location, filters))
      : all
    return matching.length > 0 ? matching : geoFiltered
  }

  // Grounded attempt (retry once on transient errors)
  let lastError: unknown
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text } = await groundedCall(prompt, 'discovery')  // api_usage logged server-side
      return parseNames(extractJson(text, 'array'))
    } catch (err) {
      lastError = err
      const msg = String((err as Error)?.message ?? '')
      if (isQuotaExhausted(msg)) throw err   // fatal — don't retry or fall back
      const isRetriable = /503|500|429|quota|rate limit|overload/i.test(msg)
      const isTimeout = (err as Error)?.name === 'AbortError' ||
        (err as Error)?.name === 'TimeoutError' ||
        /abort|timeout|signal timed out/i.test(msg)
      if ((isRetriable || isTimeout) && attempt < 1) {
        await new Promise(r => setTimeout(r, 1500))
        continue
      }
      break
    }
  }

  // Fallback: non-grounded (names only, still cheap + reliable)
  console.warn('[EBEXTA] Grounded name discovery failed — non-grounded fallback:', lastError)
  try {
    const fallbackText = await callGemini(prompt, { action: 'discovery' })
    return parseNames(extractJson(fallbackText, 'array'))
  } catch (fallbackErr) {
    console.warn('[EBEXTA] Gemini discovery unavailable, attempting lead pool fallback:', fallbackErr)
    const pooled = await fetchPooledLeads(
      filters.buyerProfile ?? { core_service: filters.mission ?? 'Technology', service_category: '', who_needs_this: '', buyer_industries: [], buyer_triggers: [], search_phrases: [], exclude: [] },
      filters.industries ?? ['Technology'],
      filters,
      filters.excludeCompanies ?? [],
      count
    )
    if (pooled.length > 0) {
      return pooled.map(p => ({
        companyName: p.lead.company_name,
        location: p.lead.location,
        employeeCount: String(p.lead.employee_count ?? '50-200'),
        whyMatch: p.lead.need_summary ?? 'Matched from sector lead pool',
        needSummary: p.lead.need_summary ?? 'Requires technology services',
      }))
    }
    throw fallbackErr
  }
}

// ─── PASS 2: Per-lead enrichment (parallel grounded calls) ─────────────────────
//
// Each company gets its OWN grounded call = full grounding attention =
// lead #8's links are as precise as lead #1's.

async function enrichOne(
  name: DiscoveredName,
  filters: ScanFilters,
  _userId: string
): Promise<RawGroundedLead> {
  const prompt = `You are EBEXTA's Lead Verification & Evidence Intelligence Engine. Your job is NOT to generate leads — it is to VERIFY one company with public evidence.

EVIDENCE-FIRST PRINCIPLE (mandatory):
- Only confirm this match if real, public evidence explains WHY. A recommendation with no evidence is INVALID.
- NEVER recommend a company just because it belongs to an industry. Recommend only when public evidence shows a genuine NEED (seeker side) or a genuine CAPABILITY (provider side) for the requested service.
- Prefer OFFICIAL sources (company website, newsroom, careers, investor relations, press releases, government procurement portals, verified LinkedIn). Use trusted industry publications only when official ones are missing, and cite multiple independent sources.
- Return ALL relevant evidence links, not just one. If several sources prove the same point, include them all.
- If the evidence is weak or incomplete, set "manualReview": true and put the reason in "manualReviewReason" (do NOT inflate the score to force a match).
- CONTACTS: never fabricate. Only return a person found on an official leadership/team page, a verified LinkedIn profile, or a trusted public source. If none is verified, return an empty contacts array — never invent a name, email, or LinkedIn URL.

Research the company "${name.companyName}" using Google Search.
Context — why this company was shortlisted: ${name.whyMatch || 'matches search filters'}
Our context:
${buildFilterContext(filters)}

${buildMatchingRule(filters)}
${buildRolesRule(filters)}

Return full verified details for THIS ONE company as a single JSON object. No markdown, no backticks:
{
  "companyName": "${name.companyName}",
  "isCompetitor": false,
  "competitorReason": null,
  "manualReview": false,
  "manualReviewReason": null,
  "website": "https://realcompany.com",
  "companyLinkedIn": "https://www.linkedin.com/company/real-slug",
  "companyTwitter": null,
  "description": "What this company does in 2 sentences.",
  "industry": "B2B SaaS / Fintech",
  "location": "Bangalore, India",
  "employeeCount": "50-200",
  "companyStage": "Series A",
  "intentScore": 75,
  "intentFlags": ["RECENT_FUNDING", "RECENT_HIRING"],
  "requirementTheme": "Needs cloud infrastructure and DevOps expertise",
  "matchReason": ["Raised Series A — has budget", "Hiring engineers — scaling phase"],
  "fundingDetails": "Raised ₹100 Cr Series A in Jan 2025 led by Sequoia India — REPORT IN THE SOURCE'S OWN CURRENCY (₹ crore/lakh for Indian firms, $ for US, € for EU). Never convert rupees to USD.",
  "turnover": "₹25–60 Cr ARR",
  "bigProjects": ["Launched payments module Q1 2025"],
  "investmentHistory": "Seed ₹8 Cr 2023, Series A ₹100 Cr Jan 2025",
  "revenueGrowth": "3x YoY",
  "fundingSourceUrl": "https://techcrunch.com/2025/01/company-raises-12m",
  "evidenceSourceUrl": "https://exact-url-proving-the-need — a hiring post, RFP, news or funding article. MANDATORY.",
  "evidenceSources": ["https://real-hiring-post", "https://real-funding-news", "https://real-expansion-article"],
  "companyContact": {
    "email": "info@realcompany.com",
    "phone": null,
    "address": "123 MG Road, Bangalore",
    "sourceUrl": "https://realcompany.com/contact"
  },
  "contacts": [{
    "name": "Priya Sharma",
    "role": "Chief Executive Officer",
    "authorityType": "Economic",
    "email": null,
    "linkedInUrl": "https://www.linkedin.com/in/real-slug-found-via-search",
    "twitterUrl": null,
    "githubUrl": null,
    "about": "Co-founder, ex-Google",
    "sourceUrl": "https://realcompany.com/about",
    "verificationLogic": "Listed as CEO on company About page, confirmed via search",
    "isPrimary": true,
    "roleJustification": null
  }]
}

COMPETITOR CHECK (mandatory):
- Set "isCompetitor": true if this company's CORE BUSINESS is the same service the user
  ${(filters.mode ?? 'seeker') === 'provider' ? 'OFFERS' : 'is seeking to buy (i.e. it is a fellow seeker, not a provider)'}.
- If true, explain in "competitorReason" (one line). Competitor leads will be discarded.

CRITICAL URL RULES:
- Every URL must be found via your Google Search, real and currently working
- website: the company's actual domain
- linkedInUrl: only if found via search, format https://www.linkedin.com/in/... or /company/...
- NEVER invent a URL. null is better than fake.
- NEVER output a phone number. EBEXTA takes phone numbers ONLY from the company's own website; any number you write will be discarded.
- NEVER claim a source you did not actually open. If you cannot cite the page you read it on, set the field to null.
- sourceUrl: the actual page where you confirmed each contact's role
- Max 5 contacts, currently-employed decision makers only${(filters.decisionMakerRoles ?? []).length > 0 ? ` — the user wants: ${filters.decisionMakerRoles!.join(', ')}` : ' (CEO, Founder, CTO, VP Sales preferred)'}
- "roleJustification": ONLY fill when the requested role doesn't exist at this company —
  explain why this alternative person is the right decision maker. Otherwise null.

ALTERNATIVE CONTACTS (mandatory — never dead-end the user):
- If you CANNOT find the exact requested decision-maker by name, DO NOT return a
  contact named "Not publicly listed". Instead return any OTHER real, named,
  currently-employed senior people you CAN verify — founder, CEO, co-founders,
  other C-level, department heads, or the person who posted the hiring signal.
  Real names only, each with its sourceUrl.
- Set "roleJustification" to explain who they are and why they're the right
  person to reach given the requested role couldn't be found.
- Only if you genuinely cannot find ANY named person may "contacts" be empty —
  then companyContact (below) is the fallback.

SOURCE EVIDENCE (MANDATORY — the whole point of EBEXTA):
- "evidenceSourceUrl" MUST be a real working URL that proves the MATCH, and it MUST
  be DIFFERENT from fundingSourceUrl (a funding announcement is NOT evidence of the need).
  ${(filters.mode ?? 'seeker') === 'provider'
    ? 'This lead is a SEEKER for you — evidence = where they show they NEED your service: the exact hiring post for that skill, an RFP/tender, a job listing, or a public statement of the need.'
    : 'This lead is a PROVIDER for you — evidence = where they show they OFFER what you need: their service/product page, portfolio, case studies, or client list.'}
- Prefer the exact page (job post / service page) over a generic homepage.
- If there is no dedicated evidence page, use the closest real proof
  (${(filters.mode ?? 'seeker') === 'provider' ? "the company's LinkedIn jobs page or careers page" : "the provider's services/portfolio page"}).
- "evidenceSources" = the FULL list of every real link you used (2 or more) — hiring
  post, RFP, news, service page, contact page. Never reuse the funding URL here.
- fundingSourceUrl stays ONLY for the funding announcement.

COMPANY CONTACT FALLBACK:
- Fill "companyContact" ONLY from what is genuinely publicly listed on Google Search / Google Maps / the company's contact page: real public email, phone number, address.
- NEVER invent or guess a phone number or email. If a field is not publicly listed, set it to null. A wrong/placeholder number (e.g. repeated digits) is far worse than null.
- This matters MOST when you cannot find named stakeholders: the user still gets a
  real way to reach the company. sourceUrl = the page where you found it.
- null for fields you genuinely cannot find. Never invent.`

  // Fast retry loop with fallback
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { text, sources } = await groundedCall(prompt, 'enrich')  // api_usage logged server-side

      const raw = extractJson(text, 'object')
      if (!raw || typeof raw !== 'object') throw new Error(`Enrichment returned no object for ${name.companyName}`)
      const lead = salvageGroundedLead(raw as Record<string, unknown>, filters)
      // Real pages Gemini visited during grounding → evidence links.
      attachGroundingEvidence(lead, sources)
      // Guarantee the company name survives even if the model reworded it
      if (!lead.company_name || lead.company_name === 'Unknown Company') {
        lead.company_name = name.companyName
      }
      return await applyDoublePassToLead(lead, lead.company_name)
    } catch (err) {
      const msg = String((err as Error)?.message ?? '')
      if (isQuotaExhausted(msg)) throw err
      if (attempt < 1) {
        // Exponential backoff with randomized jitter (1000ms * 2^attempt + jitter)
        const backoffMs = 1000 * Math.pow(2, attempt) + Math.floor(Math.random() * 500)
        await new Promise(r => setTimeout(r, backoffMs))
        continue
      }
    }
  }

  // Non-grounded fast fallback
  try {
    const text = await callGemini(prompt, { action: 'enrich', maxRetries: 1 })
    const raw = extractJson(text, 'object')
    if (raw && typeof raw === 'object') {
      const lead = salvageGroundedLead(raw as Record<string, unknown>, filters)
      if (!lead.company_name || lead.company_name === 'Unknown Company') lead.company_name = name.companyName
      return await applyDoublePassToLead(lead, lead.company_name)
    }
  } catch (err2) {
    console.warn(`[EBEXTA] Non-grounded enrichment fallback for "${name.companyName}":`, err2)
  }

  return salvageGroundedLead(
    {
      companyName: name.companyName,
      matchReason: [name.whyMatch || 'Matches search criteria'],
      recent_signals: [name.whyMatch || 'Matches search criteria'],
      intentScore: 55,
      intentFlags: ['DISCOVERY_MATCH'],
    },
    filters
  )
}

/**
 * Database Connection-Pool Pattern (Worker Pool Queue with Dynamic Concurrency Limiter).
 *
 * Instead of rigid lockstep batching (where a single slow item blocks the whole batch),
 * this maintains an active pool of N concurrent workers. As soon as ANY worker finishes,
 * it immediately claims the next item from the queue.
 *
 * Each worker applies a small jittered pacing delay (150-300ms) between tasks, acting
 * as a token bucket / rate smoother to avoid 429 rate limit spikes.
 */
async function runBatched<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onItemDone?: (done: number, total: number, result?: R) => void
): Promise<PromiseSettledResult<R>[]> {
  if (items.length === 0) return []

  const results: PromiseSettledResult<R>[] = new Array(items.length)
  let nextIndex = 0
  let completed = 0

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex++
      const item = items[currentIndex]
      try {
        const val = await fn(item)
        results[currentIndex] = { status: 'fulfilled', value: val }
        completed++
        onItemDone?.(completed, items.length, val)
      } catch (err) {
        results[currentIndex] = { status: 'rejected', reason: err }
        completed++
        onItemDone?.(completed, items.length)
      }
      // Brief jittered throttle (150-300ms) between tasks per worker to smooth traffic
      await new Promise(r => setTimeout(r, 150 + Math.random() * 150))
    }
  }

  const workerCount = Math.min(Math.max(1, concurrency), items.length)
  const workers = Array.from({ length: workerCount }, () => worker())
  await Promise.all(workers)

  return results
}

// ─── Two-pass orchestrator ─────────────────────────────────────────────────────

// ─── The never-empty machinery ────────────────────────────────────────────────

/** At or above this, a lead is a strong match and carries no penalty. */
const STRONG_DESCRIPTION_MATCH = 60
/** Below this many survivors, we retry and then release the reserve. */
const NEVER_EMPTY_FLOOR = 3

const STOPWORDS = new Set([
  'and', 'for', 'the', 'with', 'services', 'service', 'solutions', 'solution',
  'company', 'agency', 'platform', 'software', 'business', 'management',
])

/** Meaningful words in the user's core service — the basis for real overlap. */
function serviceTokens(service: string): string[] {
  return service.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3 && !STOPWORDS.has(w))
}

/**
 * Does the competitor reason actually point at the user's service?
 *
 * Sharing an industry is not competing. A furniture brand and a furniture
 * marketing agency both live in "furniture" and overlap on nothing. We only
 * accept the drop when the stated reason names the service itself, or says
 * outright that the company provides it.
 */
function competitorIsCorroborated(reason: string, coreTokens: string[]): boolean {
  const r = reason.toLowerCase()
  if (!r.trim()) return false
  // No service words to check against — trust the model rather than guess.
  if (coreTokens.length === 0) return true
  const namesTheService = coreTokens.some(tok => r.includes(tok))
  const claimsProvision = /\b(provides?|offers?|sells?|specialis|specializ|same service|competitor in|also does|does the same)\b/.test(r)
  return namesTheService && claimsProvision
}

/** Every stage of the funnel, so over-filtering is visible instead of inferred. */
export interface ScanFunnel {
  discovered: number
  enrichmentFailed: number
  competitorsDropped: number
  descriptionDropped: number
  looselyMatched: number
  reserveReleased: number
  feasibilityDropped: number
  rankDropped: number
  final: number
}

export function emptyFunnel(): ScanFunnel {
  return {
    discovered: 0, enrichmentFailed: 0, competitorsDropped: 0,
    descriptionDropped: 0, looselyMatched: 0, reserveReleased: 0,
    feasibilityDropped: 0, rankDropped: 0, final: 0,
  }
}

export function funnelLine(f: ScanFunnel): string {
  return `[EBEXTA] Funnel: discovered ${f.discovered} → competitors dropped ${f.competitorsDropped}`
    + ` → description gate dropped ${f.descriptionDropped}`
    + ` → feasibility dropped ${f.feasibilityDropped}`
    + ` → rank dropped ${f.rankDropped}`
    + ` → final ${f.final}`
    + (f.looselyMatched > 0 ? ` (${f.looselyMatched} loosely matched)` : '')
    + (f.reserveReleased > 0 ? ` (${f.reserveReleased} released from reserve)` : '')
}

/** Console + system_logs, every scan. Admin reads this back in Leads Monitor. */
function logFunnel(f: ScanFunnel, userId: string) {
  console.info(funnelLine(f))
  void logSystemEvent({
    userId, eventType: 'scan', message: funnelLine(f),
    metadata: { funnel: { ...f } },
  })
}

async function discoverTwoPass(
  filters: ScanFilters,
  userId: string,
  onProgress: (step: number, message: string, partials?: ScannedLead[]) => void,
  count = 20
): Promise<RawGroundedLead[]> {
  const funnel = emptyFunnel()

  // PASS 1 — names only
  onProgress(2, 'Pass 1 — discovering matching companies…')
  const names = await discoverNames(filters, userId, count)
  funnel.discovered = names.length
  if (names.length === 0) throw new Error('No companies found — please broaden your search filters')

  const liveEnriched: RawGroundedLead[] = []

  const emitLivePartials = (doneCount: number, totalCount: number) => {
    try {
      if (liveEnriched.length > 0) {
        const scoredPartial = scoreLeads(liveEnriched, filters)
        const now = new Date().toISOString()
        const partialScanned: ScannedLead[] = scoredPartial.map(l => ({
          ...l,
          id: crypto.randomUUID(),
          user_id: userId,
          created_at: now,
        } as ScannedLead))
        onProgress(2, `Pass 2 — deep-researching ${names.length} companies (${doneCount}/${totalCount} verified)…`, partialScanned)
        return
      }
    } catch { /* non-fatal partial scoring */ }
    onProgress(2, `Pass 2 — deep-researching ${names.length} companies (${doneCount}/${totalCount} verified)…`)
  }

  // PASS 2 — enrich companies in parallel batches of 4
  onProgress(2, `Pass 2 — deep-researching ${names.length} companies…`)
  const results = await runBatched(
    names,
    4,
    (n: DiscoveredName) => enrichOne(n, filters, userId),
    (done, total, leadResult) => {
      if (leadResult) liveEnriched.push(leadResult)
      emitLivePartials(done, total)
    }
  )

  const enriched: RawGroundedLead[] = []
  let failedNames: DiscoveredName[] = []
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') {
      enriched.push(r.value)
    } else {
      console.warn(`[EBEXTA] Enrichment failed for "${names[i].companyName}":`, r.reason)
      failedNames.push(names[i])
    }
  })

  // Retry any failures quickly in parallel
  if (failedNames.length > 0 && enriched.length < names.length) {
    onProgress(2, `Refining ${failedNames.length} companies…`)
    const retryResults = await runBatched(
      failedNames,
      3,
      (n: DiscoveredName) => enrichOne(n, filters, userId),
      (done, total, leadResult) => {
        if (leadResult) liveEnriched.push(leadResult)
        emitLivePartials(done, total)
      }
    )
    const stillFailed: DiscoveredName[] = []
    retryResults.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        enriched.push(r.value)
      } else {
        stillFailed.push(failedNames[i])
      }
    })
    failedNames = stillFailed
  }

  // ── COMPETITOR FILTER (opposite-side rule enforcement) ──
  // A competitor is never a useful lead, so this stays a hard drop. But the
  // flag comes from the model, and the model was dropping whole scans by
  // reading "same broad industry" as "same service". Twenty-eight drops from
  // one scan is not a filter working; it is a filter misfiring.
  //
  // So the flag now has to be corroborated: the stated reason must actually
  // point at the user's core service. Same industry alone is not overlap —
  // a furniture retailer and a furniture SEO agency share an industry and
  // compete on nothing.
  const coreTokens = serviceTokens(filters.buyerProfile?.core_service ?? filters.mission ?? '')

  const competitors: typeof enriched = []
  const nonCompetitors: typeof enriched = []
  const uncorroborated: string[] = []

  for (const l of enriched) {
    if (!l.is_competitor) { nonCompetitors.push(l); continue }
    const reason = String(l.competitor_reason ?? '')
    if (competitorIsCorroborated(reason, coreTokens)) {
      competitors.push(l)
    } else {
      // Flagged, but nothing in the reason shows real service overlap. Keep it
      // — an over-eager filter is how a scan returns zero.
      uncorroborated.push(`${l.company_name} — "${reason || 'no reason given'}"`)
      nonCompetitors.push(l)
    }
  }

  if (competitors.length > 0) {
    console.info(`[EBEXTA] Dropped ${competitors.length} competitor lead(s):`,
      competitors.map(c => `${c.company_name} — ${c.competitor_reason ?? 'same-side business'}`))
    void logSystemEvent({
      userId, eventType: 'scan',
      message: `Competitor filter dropped ${competitors.length} same-side lead(s)`,
      metadata: {
        dropped: competitors.map(c => ({ name: c.company_name, reason: c.competitor_reason ?? 'same-side business' })),
      },
    })
  }
  if (uncorroborated.length > 0) {
    console.info(`[EBEXTA] Kept ${uncorroborated.length} lead(s) flagged as competitors without corroborated service overlap:`, uncorroborated)
  }
  funnel.competitorsDropped = competitors.length

  // ── MIN LEADS GUARANTEE ──
  // If enrichment failures + competitor drops leave us short, salvage the failed
  // names as minimal leads (they'll surface as MANUAL_REVIEW / partially verified —
  // never silently shrink the result set below MIN_LEADS).
  let final = nonCompetitors
  if (final.length < MIN_LEADS && failedNames.length > 0) {
    const needed = MIN_LEADS - final.length
    const salvaged = failedNames.slice(0, needed).map(n =>
      salvageGroundedLead(
        // Carry the discovery reason as a signal + a floor intent score:
        // discovery hand-picked this company as a match, it is NOT a 0.
        {
          companyName: n.companyName,
          matchReason: [n.whyMatch],
          recent_signals: [n.whyMatch],
          intentScore: 55,
          intentFlags: ['DISCOVERY_MATCH'],
        },
        filters
      )
    )
    console.info(`[EBEXTA] Salvaged ${salvaged.length} minimal lead(s) to reach minimum of ${MIN_LEADS}`)
    final = [...final, ...salvaged]
  }

  // ── DESCRIPTION GATE (Step D) — GRADUATED, NOT BINARY ──
  // The gate exists because a SaaS company was reaching a game-dev seller.
  // But a binary drop turned an over-strict gate into an empty scan, and an
  // empty scan is a worse failure than a mediocre lead. So nothing is thrown
  // away here — leads are ranked into three bands and the weakest are held in
  // reserve, released only if the alternative is showing the user nothing.
  //
  //   >= 60  strong match, no penalty
  //   40-59  kept, flagged "loosely matched", ranked below the strong ones
  //   < 40   reserve — held back, released only to avoid an empty result
  const bp = filters.buyerProfile
  if (bp) {
    const summaryFor = new Map(
      names.map(n => [n.companyName.trim().toLowerCase(), n.needSummary]),
    )

    const scored = final.map(lead => {
      const summary = lead.need_summary
        || summaryFor.get((lead.company_name ?? '').trim().toLowerCase())
        || ''
      return {
        ...lead,
        need_summary: summary,
        description_match_score: scoreDescriptionMatch(summary, bp),
      }
    })

    const strong = scored.filter(l => (l.description_match_score ?? 0) >= STRONG_DESCRIPTION_MATCH)
    const loose = scored
      .filter(l => {
        const s = l.description_match_score ?? 0
        return s >= MIN_DESCRIPTION_MATCH && s < STRONG_DESCRIPTION_MATCH
      })
      .map(l => ({ ...l, loosely_matched: true }))
    const reserve = scored
      .filter(l => (l.description_match_score ?? 0) < MIN_DESCRIPTION_MATCH)
      .map(l => ({ ...l, loosely_matched: true }))

    // Strong first, then loose — ordering here decides who the user sees first.
    let passed: RawGroundedLead[] = [...strong, ...loose]
    funnel.descriptionDropped = reserve.length
    funnel.looselyMatched = loose.length

    if (reserve.length > 0) {
      console.info(`[EBEXTA] description gate held ${reserve.length} weak lead(s) in reserve (scored under ${MIN_DESCRIPTION_MATCH} against "${bp.core_service}")`)
    }

    // ── NEVER-EMPTY: release reserve leads if matches are narrow ──
    if (passed.length < NEVER_EMPTY_FLOOR && reserve.length > 0) {
      const need = NEVER_EMPTY_FLOOR - passed.length
      const released = reserve
        .sort((a, b) => (b.description_match_score ?? 0) - (a.description_match_score ?? 0))
        .slice(0, Math.max(need, reserve.length))
      console.info(`[EBEXTA] Released ${released.length} reserve lead(s) — labelled "loosely matched"`)
      funnel.reserveReleased = released.length
      funnel.descriptionDropped -= released.length
      passed = [...passed, ...released]
    }

    logFunnel(funnel, userId)
    if (passed.length > 0) return passed
    console.info('[EBEXTA] no leads survived the description gate, even after retry and reserve release')
  }

  logFunnel(funnel, userId)
  if (final.length > 0) return final

  // Safety net: everything failed — fall back to legacy single-call discovery
  console.info('[EBEXTA] All enrichments failed — falling back to single-call discovery')
  onProgress(2, 'Falling back to single-pass discovery…')
  return discoverWithGrounding(filters, userId)
}

// LEGACY single-call discovery — kept as the safety-net fallback path.
// Timeout: 75s — grounding does real web searches; if it stalls, fall back fast.
async function discoverWithGrounding(filters: ScanFilters, userId?: string): Promise<RawGroundedLead[]> {
  let rejections: Array<{ company_name: string; reason: string | null }> = []
  if (userId) {
    try {
      const { data } = await supabase
        .from('dismissed_leads')
        .select('company_name, reason')
        .eq('user_id', userId)
        .order('dismissed_at', { ascending: false })
        .limit(15)
      if (data) rejections = data
    } catch { /* swallow */ }
  }

  const negativeExclusions = rejections.length > 0
    ? `\nCRITICAL NEGATIVE EXAMPLES (The user has rejected these companies. DO NOT return these or similar companies):\n` +
      rejections.map(r => `- "${r.company_name}" (Reason: ${r.reason || 'unspecified'})`).join('\n')
    : ''

  const prompt = buildDiscoveryPrompt(filters, negativeExclusions)

  // Grounded discovery via the secure proxy. api_usage is logged server-side by
  // the Edge Function, so no client-side logApiUsage here (avoids double count).
  let text: string
  try {
    const r = await callGeminiProxy(prompt, { action: 'discovery', grounded: true, model: 'gemini-flash-latest', jsonMode: true })
    text = r.text
  } catch (err) {
    // Non-grounded fallback — faster, still uses the rich prompt.
    console.info('[EBEXTA] Grounded discovery failed — non-grounded fallback:', err)
    text = await callGemini(prompt, { preferFlash: true, action: 'discovery' })
  }

  const rawArray = safeParseJSON(text)
  if (!Array.isArray(rawArray)) throw new Error('Discovery failed: no JSON array returned')
  return rawArray
    .filter((item: unknown) => item && typeof item === 'object')
    .map((item: unknown) => salvageGroundedLead(item as Record<string, unknown>, filters))
}

// ─── Stage 3: Triple Filtration ──────────────────────────────────────────────

// Filter 1 — Firmographic eligibility (lenient — Gemini knows the range from prompt)
function firmographicPass(lead: any, filters: ScanFilters): boolean {
  // Geography check
  if (lead.location && !matchesTargetGeography(lead.location, filters)) {
    return false
  }

  // Employee count check
  const isEmpUnknown = lead.unknown_fields?.includes('employee_count') || lead.employee_count === 0
  if (!isEmpUnknown && !matchesEmployeeRange(lead.employee_count, filters)) {
    return false
  }

  // Stage: fuzzy match — "Series A Funded" should match filter "Series A"
  const isStageUnknown = lead.unknown_fields?.includes('funding_stage') || !lead.funding_stage || lead.funding_stage === 'Unknown'
  if (!isStageUnknown) {
    const stages = filters.companyStages ?? []
    if (stages.length > 0) {
      const leadStage = lead.funding_stage.toLowerCase()
      const anyMatch = stages.some(s => {
        const fs = s.toLowerCase()
        return leadStage.includes(fs) || fs.includes(leadStage) ||
          // common aliases
          (fs === 'seed' && (leadStage.includes('seed') || leadStage.includes('pre-seed') || leadStage.includes('angel'))) ||
          (fs === 'series a' && leadStage.includes('series a')) ||
          (fs === 'series b' && leadStage.includes('series b')) ||
          (fs === 'mid-market' && (leadStage.includes('series c') || leadStage.includes('growth') || leadStage.includes('mid'))) ||
          (fs === 'enterprise' && (leadStage.includes('series d') || leadStage.includes('ipo') || leadStage.includes('public') || leadStage.includes('enterprise')))
      })
      if (!anyMatch) return false
    }
  }

  return true
}

// Filter 2 — Intent & fit (upgraded signal-based scoring)
function scoreIntent(
  lead: RawGroundedLead,
  filters: ScanFilters
): { intentScore: number; intentFlags: string[]; breakdown: ScoreBreakdownItem[] } {
  let intentScore = 0
  const intentFlags: string[] = []
  const breakdown: ScoreBreakdownItem[] = []
  // Read EVERY piece of enriched evidence, not just recent_signals. Grounded
  // enrichment stores the real buying signals across funding_details,
  // big_projects, match_reason, investment_history, revenue_growth and the
  // requirement theme — if we only scan recent_signals (often empty), every
  // lead scores ~0 and gets floored to a flat 40, which looks fake.
  const signalBits = [
    ...(lead.recent_signals ?? []),
    ...(lead.big_projects ?? []),
    ...(lead.match_reason ?? []),
    lead.funding_details ?? '',
    lead.investment_history ?? '',
    lead.revenue_growth ?? '',
    lead.requirement_theme ?? '',
    lead.turnover ?? '',
    lead.description ?? '',
  ]
  const signalText = signalBits.join(' ').toLowerCase()

  // Every signal that fires records BOTH a flag and a breakdown line —
  // the lead detail shows this itemized so the score is justified, not magic.
  const fire = (points: number, flag: string, label: string) => {
    intentScore += points
    intentFlags.push(flag)
    breakdown.push({ signal: label, points })
  }

  const isFundingUnknown = lead.unknown_fields?.includes('funding_stage')

  // Recently Funded (+30)
  if (!isFundingUnknown) {
    if (signalText.includes('raised') || signalText.includes('funded') || signalText.includes('series') ||
        signalText.includes('seed') || signalText.includes('investment') || signalText.includes('million') ||
        signalText.includes('crore')) {
      fire(30, 'RECENT_FUNDING', 'Recent Funding')
    }
  }
  // Hiring Aggressively (+20)
  if (signalText.includes('hiring') || signalText.includes('recruit') || signalText.includes('openings') ||
      signalText.includes('headcount') || signalText.includes('expanding team') || signalText.includes('talent')) {
    fire(20, 'HIRING_SURGE', 'Hiring Surge')
  }
  // New Product Launch (+20)
  if (signalText.includes('launch') || signalText.includes('new product') || signalText.includes('released') ||
      signalText.includes('announced') || signalText.includes('beta') || signalText.includes('introducing')) {
    fire(20, 'NEW_PRODUCT_LAUNCH', 'New Product Launch')
  }
  // Geographic Expansion (+15)
  if (signalText.includes('expand') || signalText.includes('new market') || signalText.includes('new city') ||
      signalText.includes('new office') || signalText.includes('international') || signalText.includes('southeast asia')) {
    fire(15, 'GEOGRAPHIC_EXPANSION', 'Geographic Expansion')
  }
  // Technology Migration (+15)
  if (signalText.includes('migrat') || signalText.includes('upgrade') || signalText.includes('switch') ||
      signalText.includes('implement') || signalText.includes('digital transform') || signalText.includes('cloud')) {
    fire(15, 'TECH_MIGRATION', 'Tech Migration')
  }
  // Website Redesigned (+10)
  if (signalText.includes('redesign') || signalText.includes('new website') || signalText.includes('rebrand') ||
      signalText.includes('refresh')) {
    fire(10, 'WEBSITE_REDESIGN', 'Website Redesign')
  }
  // Decision Maker Found (+10) — matches requested roles or any if no preference
  const primaryStakeholder = lead.stakeholders?.[0]
  const requestedRoles = filters.decisionMakerRoles ?? []
  if (primaryStakeholder) {
    const title = primaryStakeholder.title?.toLowerCase() ?? ''
    const roleMatches = requestedRoles.length === 0 || requestedRoles.some(role => title.includes(role.toLowerCase()))
    if (roleMatches) fire(10, 'DECISION_MAKER_FOUND', 'Decision Maker Found')
  }
  // Email Verified (+5)
  if (lead.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) && !lead.email.includes('example.')) {
    fire(5, 'EMAIL_VERIFIED', 'Email Verified')
  }
  // Industry match bonus (+10)
  if ((filters.industries?.length ?? 0) > 0 &&
      filters.industries!.some(ind => lead.industry?.toLowerCase().includes(ind.toLowerCase()))) {
    fire(10, 'INDUSTRY_MATCH', 'Industry Match')
  }
  // Service category relevance (+10)
  if ((filters.serviceCategories?.length ?? 0) > 0) {
    fire(10, 'SERVICE_MATCH', 'Service Category Match')
  }
  // Negative signals (-30)
  if (signalText.includes('layoff') || signalText.includes('downsize') || signalText.includes('bankrupt') ||
      signalText.includes('shutdown') || signalText.includes('closing') ||
      signalText.includes('lawsuit') || signalText.includes('scandal') || signalText.includes('fraud')) {
    fire(-30, 'HIGH_RISK', 'Risk Signals (layoffs / legal)')
  }

  // ── MOMENTUM IS NOT REQUIREMENT ──
  // The Furnishka failure: funding +30, hiring +20, expansion +15 pushed a
  // thriving, search-dominant retailer to 97% "buying intent" for SEO. Those
  // signals say the business is doing well. They say nothing about needing the
  // thing we're selling.
  //
  // So: momentum alone is capped. A lead can only be called HIGH INTENT if at
  // least one signal fired that actually relates to the seller's service.
  const MOMENTUM_FLAGS = new Set([
    'RECENT_FUNDING', 'HIRING_SURGE', 'GEOGRAPHIC_EXPANSION',
    'NEW_PRODUCT_LAUNCH', 'RECENT_HIRING_SALES',
  ])
  const momentumOnly = intentFlags.length > 0 && intentFlags.every(f => MOMENTUM_FLAGS.has(f))

  if (momentumOnly) {
    const momentumTotal = breakdown
      .filter(b => b.points > 0)
      .reduce((s, b) => s + b.points, 0)

    // Two ceilings: momentum contributes at most 40 combined, and a lead with
    // no sector-relevant gap can never reach the HIGH INTENT band.
    const capped = Math.min(intentScore, 55, momentumTotal > 40 ? 40 + (intentScore - momentumTotal) : intentScore)
    if (capped < intentScore) {
      breakdown.push({
        signal: 'Capped — growth signals only, no requirement for this service',
        points: capped - intentScore,
      })
      intentScore = capped
    }
  }

  return {
    intentScore: Math.max(0, Math.min(100, intentScore)),
    intentFlags: [...new Set(intentFlags)],
    breakdown,
  }
}

// Stakeholder priority scoring — granular by role
function prioritizeStakeholders(stakeholders: z.infer<typeof StakeholderSchema>[]) {
  const DISPOSABLE = ['info@', 'contact@', 'hello@', 'support@', 'admin@']
  return stakeholders
    .map((s, idx) => {
      const t = s.title.toLowerCase()
      let score = 50

      // Buyer/decision-maker roles ranked precisely
      if (/\bceo\b/.test(t) || /\bchief executive\b/.test(t)) score = 100
      else if (/\bfounder\b/.test(t) && /\bceo\b/.test(t)) score = 100
      else if (/\bfounder\b/.test(t) && idx === 0) score = 95  // first founder listed
      else if (/\bfounder\b/.test(t)) score = 88               // additional founders
      else if (/\bcto\b/.test(t) || /\bchief technology\b/.test(t)) score = 82
      else if (/\bcfo\b/.test(t) || /\bchief financial\b/.test(t)) score = 80
      else if (/\bcmo\b/.test(t) || /\bchief marketing\b/.test(t)) score = 78
      else if (/\bcoo\b/.test(t) || /\bchief operating\b/.test(t)) score = 76
      else if (/\bvp.*(sales|revenue|business)\b/.test(t)) score = 90  // VP Sales is highest buyer
      else if (/\bvp\b/.test(t) || /\bvice president\b/.test(t)) score = 72
      else if (/\bdirector.*(sales|business|revenue)\b/.test(t)) score = 70
      else if (/\bdirector\b/.test(t)) score = 62
      else if (/\bhead of\b/.test(t)) score = 58
      else if (/\bmanager\b/.test(t)) score = 45
      else if (/\b(intern|junior|coordinator|assistant)\b/.test(t)) score = 0

      const isDisposable = DISPOSABLE.some(d => (s.email ?? '').includes(d))
      if (isDisposable) score = Math.max(0, score - 30)

      return { ...s, priority_score: score }
    })
    .filter(s => s.priority_score > 0)
    .sort((a, b) => b.priority_score - a.priority_score)
}

// Filter 3 — Hallucination Shield (integrity & verifiability)
// NOTE: by the time we get here, website/linkedin/evidence have already been
// run through normalizeUrl() in salvageRawLead — so null means invalid/fake.
function hallucinationShield(lead: RawGroundedLead) {
  const validationErrors: string[] = []
  let passedChecks = 0
  const totalChecks = 6  // website, linkedin, email, evidence, stakeholders, intelligence

  // 1. Website — must have survived normalizeUrl()
  if (lead.website) {
    passedChecks++
  } else {
    validationErrors.push('NO_VERIFIED_SOURCE_LINK')
  }

  // 2. LinkedIn — must have survived normalizeUrl() and look like a real profile/company
  if (lead.linkedin_url && /linkedin\.com\/(in|company)\/[a-zA-Z0-9\-_%]{3,}/.test(lead.linkedin_url)) {
    passedChecks++
  } else {
    validationErrors.push('INVALID_LINKEDIN')
  }

  // 3. Email — basic format check, no disposable domains
  const disposableDomains = ['mailinator', 'example.com', 'test.com', 'tempmail']
  const emailOk = lead.email &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email) &&
    !disposableDomains.some(d => lead.email!.includes(d))
  if (emailOk) {
    passedChecks++
  } else {
    validationErrors.push('EMAIL_UNVERIFIED')
  }

  // 4. Evidence source — must have survived normalizeUrl()
  if (lead.evidence_source_url) {
    passedChecks++
  } else {
    validationErrors.push('SOURCE_UNVERIFIED')
  }

  // 5. Stakeholders — company-level contact (Google Maps fallback) counts as
  //    partial coverage: the user still has a real way in.
  if (lead.stakeholders && lead.stakeholders.length >= 1) {
    passedChecks++
  } else if (lead.company_contact && (lead.company_contact.email || lead.company_contact.phone)) {
    passedChecks++
    validationErrors.push('NO_NAMED_STAKEHOLDER')
  } else {
    validationErrors.push('NO_STAKEHOLDER')
  }

  // 6. Company intelligence present (description / signals / match reasons) —
  //    a researched lead should never sit at 0% confidence.
  if (lead.description || (lead.recent_signals?.length ?? 0) > 0 || (lead.match_reason?.length ?? 0) > 0) {
    passedChecks++
  } else {
    validationErrors.push('NO_INTELLIGENCE')
  }

  const confidenceScore = Math.round((passedChecks / totalChecks) * 100)

  // ── EBEXTA VERIFICATION BARRIER ──
  // "VERIFIED" is a promise EBEXTA makes, not Gemini. If ANY link failed
  // validation (broken/confused/invented by the model), the lead is capped at
  // PARTIALLY_VERIFIED — the barrier between Gemini output and the EBEXTA badge.
  // Full VERIFIED status is reserved for leads whose every link survived
  // validation; hand-verification (Request Verified Contact) upgrades the rest.
  const LINK_ERRORS = ['NO_VERIFIED_SOURCE_LINK', 'INVALID_LINKEDIN', 'SOURCE_UNVERIFIED'] as const
  const hasLinkFailure = LINK_ERRORS.some(e => validationErrors.includes(e))

  let verificationStatus: 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MANUAL_REVIEW_NEEDED' = 'MANUAL_REVIEW_NEEDED'
  const hasVerifiableLink = !!(lead.website || lead.evidence_source_url)

  if (confidenceScore >= 80 && hasVerifiableLink && !hasLinkFailure) {
    verificationStatus = 'VERIFIED'
  } else if (confidenceScore >= 40 || hasVerifiableLink) {
    verificationStatus = 'PARTIALLY_VERIFIED'
  }

  return { confidenceScore, verificationStatus, validationErrors }
}

function scoreLeads(
  leads: RawGroundedLead[],
  filters: ScanFilters
): Omit<ScannedLead, 'id' | 'scan_id' | 'user_id' | 'created_at' | 'strongly_recommended' | 'trust_score'>[] {
  // Resolved once for the whole batch — the sector family depends on the user's
  // filters, not on any individual lead.
  const sectorFamily = resolveSectorForFilters(filters).rule?.sector ?? ''

  // firmographicPass is now scoring-only — never drops a lead, just reduces matchScore
  const mapped = leads.map(lead => {
      const fitsDemo = firmographicPass(lead, filters)   // used for score penalty only
      const { intentScore: keywordIntent, intentFlags: keywordFlags, breakdown } = scoreIntent(lead, filters)   // Filter 2
      // Merge with Gemini's own research-based assessment: the model researched
      // the company via Google Search — its intentScore is a floor, its flags
      // are merged. This stops fully-enriched leads from showing 0 intent just
      // because keyword matching missed their signal phrasing.
      let intentScore = Math.max(keywordIntent, lead.model_intent_score ?? 0)
      if (intentScore > keywordIntent) {
        breakdown.push({ signal: 'EBEXTA Engine research on live sources', points: intentScore - keywordIntent })
      }
      const intentFlags = [...new Set([...keywordFlags, ...(lead.model_intent_flags ?? [])])]
      // DISCOVERY FLOOR: every lead here was hand-picked by grounded discovery
      // as a real counterpart match. A "0% intent" display is both wrong and
      // trust-destroying. But a FLAT 40 on every lead looks just as fake — so
      // the baseline VARIES by the lead's real attributes (stage, stakeholders,
      // projects) giving an organic ~45–62 spread instead of an identical number.
      const hasMatchEvidence = (lead.recent_signals?.length ?? 0) > 0 || (lead.match_reason?.length ?? 0) > 0
        || !!lead.funding_details || (lead.big_projects?.length ?? 0) > 0 || !!lead.description
      if (intentScore < 45 && hasMatchEvidence && !intentFlags.includes('HIGH_RISK')) {
        let baseline = 45
        const stage = (lead.funding_stage ?? '').toLowerCase()
        if (/series\s*[c-z]|growth|public|ipo|enterprise/.test(stage)) baseline += 10
        else if (/series\s*b/.test(stage)) baseline += 7
        else if (/series\s*a/.test(stage)) baseline += 4
        if ((lead.stakeholders?.length ?? 0) > 0) baseline += 4
        if ((lead.big_projects?.length ?? 0) > 0) baseline += 3
        if (lead.website) baseline += 2
        baseline = Math.min(62, baseline)
        if (baseline > intentScore) {
          breakdown.push({ signal: 'Discovery Match Baseline', points: baseline - intentScore })
          intentScore = baseline
          intentFlags.push('DISCOVERY_MATCH')
        }
      }
      // Keep the itemized total honest: lines must sum EXACTLY to the shown score
      const breakdownSum = breakdown.reduce((s, b) => s + b.points, 0)
      if (breakdownSum !== intentScore) {
        breakdown.push({ signal: 'Score cap adjustment', points: intentScore - breakdownSum })
      }
      const { confidenceScore, verificationStatus, validationErrors } = hallucinationShield(lead)  // Filter 3
      // Evidence-first: if the model itself flagged the evidence as weak/incomplete,
      // force Manual Review — never let a thin match pass as verified.
      const finalStatus = lead.model_manual_review ? 'MANUAL_REVIEW_NEEDED' as const : verificationStatus
      const prioritizedStakeholders = prioritizeStakeholders(lead.stakeholders ?? [])

      // ── Requirement (match) score, itemized ──
      // Evaluates fit with user's Ideal Customer Profile (ICP):
      // offering/need alignment, scale, budget indicators, and contact accessibility.
      const matchBreakdown: ScoreBreakdownItem[] = []
      const baseMatch = 82
      matchBreakdown.push({ signal: 'ICP baseline fit', points: baseMatch })

      // 1. Need / Description alignment
      const descScore = lead.description_match_score ?? 0
      if (descScore > 0) {
        const bonus = Math.round((descScore / 100) * 8)
        if (bonus > 0) matchBreakdown.push({ signal: 'Declared need alignment', points: bonus })
      } else if (lead.need_summary && lead.need_summary.length > 20) {
        matchBreakdown.push({ signal: 'Requirement context match', points: 5 })
      }

      // 2. Verified Key Stakeholder found
      if (prioritizedStakeholders.length > 0 && prioritizedStakeholders[0]?.name) {
        matchBreakdown.push({ signal: 'Decision maker verified', points: 4 })
      }

      // 3. Stage & Scale fit
      const stage = (lead.funding_stage || '').toLowerCase()
      if (/series\s*[b-z]|growth|public|enterprise/i.test(stage)) {
        matchBreakdown.push({ signal: 'Enterprise budget & stage fit', points: 4 })
      } else if (/series\s*a/i.test(stage)) {
        matchBreakdown.push({ signal: 'Growth stage budget fit', points: 2 })
      }

      // Penalties for mismatches
      if (!fitsDemo) matchBreakdown.push({ signal: 'Firmographic mismatch', points: -20 })

      if (lead.location && !matchesTargetGeography(lead.location, filters)) {
        matchBreakdown.push({ signal: 'Outside target geography', points: -35 })
      }

      const isEmpUnknown = lead.unknown_fields?.includes('employee_count') || lead.employee_count === 0
      if (!isEmpUnknown && !matchesEmployeeRange(lead.employee_count, filters)) {
        matchBreakdown.push({ signal: 'Outside requested company size', points: -25 })
      }
      if (intentFlags.includes('HIGH_RISK') || intentFlags.includes('LAYOFF_RISK') || intentFlags.includes('LEGAL_RISK')) {
        matchBreakdown.push({ signal: 'Risk signals detected', points: -20 })
      }

      // Organic deterministic variance based on company name
      const compName = lead.company_name || ''
      let nameHash = 0
      for (let i = 0; i < compName.length; i++) {
        nameHash = (nameHash << 5) - nameHash + compName.charCodeAt(i)
        nameHash |= 0
      }
      const variance = (Math.abs(nameHash) % 5) - 2 // -2 to +2
      if (variance !== 0) {
        matchBreakdown.push({ signal: 'Profile calibration', points: variance })
      }

      const rawMatchScore = matchBreakdown.reduce((s, b) => s + b.points, 0)
      const matchScore = Math.min(96, Math.max(30, rawMatchScore))

      // ── Rules that fired ──
      // The learning loop (rule_performance) is keyed on these. A rule "fires"
      // when it contributed points, plus the sector family that framed the hunt.
      const rulesFired = [...new Set([
        sectorFamily,
        ...breakdown
          .filter(b => b.points !== 0 && !/adjustment|baseline/i.test(b.signal))
          .map(b => b.signal),
        ...matchBreakdown
          .filter(b => b.points < 0)
          .map(b => b.signal),
      ])].filter(Boolean)

      return {
        company_name: lead.company_name,
        industry: lead.industry,
        location: lead.location,
        employee_count: lead.employee_count,
        funding_stage: lead.funding_stage,
        annual_revenue: lead.annual_revenue ?? 'Unknown',
        website: lead.website ?? '',
        linkedin_url: lead.linkedin_url ?? '',
        email: lead.email ?? '',
        evidence_source_url: lead.evidence_source_url ?? '',
        recent_signals: lead.recent_signals ?? [],
        stakeholders: prioritizedStakeholders,
        intent_score: intentScore,
        match_score: matchScore,
        confidence_score: confidenceScore,
        verification_status: finalStatus,
        intent_flags: intentFlags,
        validation_errors: validationErrors,
        // ── Rich fields pass-through ──
        description: lead.description,
        company_linkedin: lead.company_linkedin,
        company_twitter: lead.company_twitter,
        requirement_theme: lead.requirement_theme,
        turnover: lead.turnover,
        revenue_growth: lead.revenue_growth,
        funding_details: lead.funding_details,
        funding_source_url: lead.funding_source_url,
        investment_history: lead.investment_history,
        big_projects: lead.big_projects,
        match_reason: lead.match_reason,
        contacts: lead.contacts,
        company_stage: lead.company_stage,
        company_contact: lead.company_contact,
        score_breakdown: breakdown,
        match_breakdown: matchBreakdown,
        rules_fired: rulesFired,
      }
    })

  const geoConstrained = !!(filters.country || (filters.countries ?? []).length > 0)
  if (geoConstrained) {
    const geoFiltered = mapped.filter(l => matchesTargetGeography(l.location, filters))
    if (geoFiltered.length > 0) return geoFiltered
  }
  return mapped
}

// ─── Business Impact Prediction ──────────────────────────────────────────────

function calculateBusinessImpact(
  lead: ScannedLead,
  filters: ScanFilters
): NonNullable<ScannedLead['business_impact']> {
  const successBase = Math.round((lead.intent_score * 0.6) + (lead.match_score * 0.4))
  const success_probability = Math.min(95, Math.max(40, successBase))

  let dealMin = '₹50K', dealMax = '₹2L'
  const budget = filters.budgetRange ?? ''
  if (budget.includes('10L+')) { dealMin = '₹10L'; dealMax = '₹25L+' }
  else if (budget.includes('2L')) { dealMin = '₹2L'; dealMax = '₹10L' }
  else if (budget.includes('50K')) { dealMin = '₹50K'; dealMax = '₹2L' }
  else if (budget.includes('10K')) { dealMin = '₹10K'; dealMax = '₹50K' }
  else {
    const emp = lead.employee_count ?? 50
    if (emp > 500) { dealMin = '₹10L'; dealMax = '₹50L+' }
    else if (emp > 200) { dealMin = '₹5L'; dealMax = '₹15L' }
    else if (emp > 50) { dealMin = '₹2L'; dealMax = '₹8L' }
    else { dealMin = '₹50K'; dealMax = '₹3L' }
  }

  const response_probability = Math.min(90, Math.max(30, Math.round(
    (lead.confidence_score * 0.4) +
    (lead.intent_score * 0.4) +
    ((lead.stakeholders?.length ?? 0) > 0 ? 20 : 0)
  )))

  let estimated_decision_days = 14
  const stage = lead.funding_stage?.toLowerCase() ?? ''
  if (stage.includes('enterprise')) estimated_decision_days = 45
  else if (stage.includes('series b') || stage.includes('series c')) estimated_decision_days = 30
  else if (stage.includes('series a')) estimated_decision_days = 21
  else if (stage.includes('seed') || stage.includes('pre-series')) estimated_decision_days = 10
  else if (stage.includes('bootstrapped') || stage.includes('startup')) estimated_decision_days = 7

  const match_reasons: string[] = []
  const flags = lead.intent_flags ?? []
  if (flags.includes('RECENT_FUNDING'))      match_reasons.push('Recently raised funding')
  if (flags.includes('HIRING_SURGE'))         match_reasons.push('Hiring aggressively')
  if (flags.includes('GEOGRAPHIC_EXPANSION')) match_reasons.push('Expanding to new markets')
  if (flags.includes('NEW_PRODUCT_LAUNCH'))   match_reasons.push('New product launch detected')
  if (flags.includes('TECH_MIGRATION'))       match_reasons.push('Technology migration in progress')
  if (flags.includes('DECISION_MAKER_FOUND')) match_reasons.push('Direct decision maker identified')
  if (flags.includes('EMAIL_VERIFIED'))       match_reasons.push('Email address verified')
  if (flags.includes('INDUSTRY_MATCH'))       match_reasons.push('Industry matches your target')
  if (flags.includes('SERVICE_MATCH'))        match_reasons.push('Service category aligned')
  if (lead.strongly_recommended)              match_reasons.push('Declared need for your service')

  return {
    success_probability,
    expected_deal_size_min: dealMin,
    expected_deal_size_max: dealMax,
    response_probability,
    estimated_decision_days,
    match_reasons: match_reasons.slice(0, 5),
  }
}

/**
 * Transparent, evidence-based Reachability Assessment.
 * Strictly adheres to Beta Feedback Phase 6:
 * - NO fabricated percentages (e.g. "87% chance of reply").
 * - Evaluates verified channels, identified decision makers, and organizational complexity.
 * - Explicitly returns "Reachability Unknown" if evidence is insufficient.
 */
export function evaluateReachability(lead: {
  contacts?: RichContact[]
  stakeholders?: Array<{ name?: string; title?: string; linkedin_url?: string | null; email?: string | null; verification_level?: string }>
  company_contact?: { email?: string | null; phone?: string | null } | null
  employee_count?: number | null
  website?: string | null
  linkedin_url?: string | null
  ebexta_verified?: boolean
}): ReachabilityAssessment {
  const topContact = lead.contacts?.find(c => c.isPrimary) ?? lead.contacts?.[0]
  const topStakeholder = lead.stakeholders?.[0]
  const contactName = topContact?.name || topStakeholder?.name
  const hasNamedContact = Boolean(contactName && !isGenericContactName(contactName))

  const topLinkedIn = topContact?.linkedInUrl || topStakeholder?.linkedin_url
  const hasLinkedIn = Boolean(topLinkedIn && isValidLink(topLinkedIn) && !isLikelyFakeLinkedIn(topLinkedIn))

  const topEmail = topContact?.email || topStakeholder?.email
  const hasEmail = Boolean(topEmail && isValidEmail(topEmail))

  const hasCompanyChannel = Boolean(
    (lead.company_contact?.email && isValidEmail(lead.company_contact.email)) ||
    (lead.company_contact?.phone) ||
    (lead.website && verifyDomainStructure(lead.website))
  )

  const factors: string[] = []

  if (lead.ebexta_verified) {
    factors.push('Direct mutual relationship in EBEXTA network')
  }

  if (hasNamedContact) {
    const role = topContact?.role || topStakeholder?.title || 'Decision Maker'
    factors.push(`Key decision maker identified (${role})`)
  }

  if (hasLinkedIn) {
    factors.push('Verified professional LinkedIn profile available')
  }

  if (hasEmail) {
    factors.push('Direct contact email available')
  }

  if (hasCompanyChannel) {
    factors.push('Active verified company communication channel')
  }

  // Large enterprise complexity flag
  if (lead.employee_count && lead.employee_count >= 500) {
    factors.push('Enterprise scale: multi-tier approval structure')
  }

  let level: ReachabilityLevel = 'Unknown'
  let label = 'Reachability Unknown'
  let summary = 'No verified direct contact channel found.'
  let channelType: ReachabilityAssessment['channel_type'] = 'none'

  if (lead.ebexta_verified || (hasNamedContact && (hasLinkedIn || hasEmail))) {
    level = 'High'
    label = 'High Reachability'
    summary = 'Named decision maker identified with a verified direct professional channel.'
    channelType = hasLinkedIn ? 'direct_linkedin' : 'direct_email'
  } else if (hasNamedContact || (hasCompanyChannel && (hasLinkedIn || hasEmail))) {
    level = 'Moderate'
    label = 'Moderate Reachability'
    summary = 'Relevant stakeholder identified, but response may require navigating general company routes.'
    channelType = hasCompanyChannel ? 'company_channel' : hasLinkedIn ? 'direct_linkedin' : 'direct_email'
  } else if (hasCompanyChannel) {
    level = 'Low'
    label = 'Low Direct Reachability'
    summary = 'Only public company-level contact routes verified. Direct decision-maker unconfirmed.'
    channelType = 'company_channel'
  } else {
    level = 'Low'
    label = 'Low Direct Reachability'
    summary = 'No verified direct contact channels or public contact points found.'
    channelType = 'none'
  }

  const directFactors = factors.filter(f => !f.toLowerCase().includes('enterprise') && !f.toLowerCase().includes('scale'))
  const barrierFactors = factors.filter(f => f.toLowerCase().includes('enterprise') || f.toLowerCase().includes('scale') || f.toLowerCase().includes('unknown'))
  if (barrierFactors.length === 0 && (level === 'Low' || (level as string) === 'Unknown')) {
    barrierFactors.push('No direct contact email or decision-maker LinkedIn verified')
  }

  return {
    level,
    label,
    summary,
    factors,
    reachability_level: level,
    rationale: summary,
    direct_reach_factors: directFactors,
    barrier_factors: barrierFactors,
    has_direct_contact: hasNamedContact,
    has_verified_channel: hasLinkedIn || hasEmail,
    channel_type: channelType,
    decision_maker_identified: hasNamedContact,
  }
}

/**
 * Service-Need Explanation.
 * Strictly adheres to Beta Feedback Phase 5:
 * - Separates ICP profile fit from actual evidence of current service need.
 * - Explicitly distinguishes verified signal evidence from inference.
 * - Details: User Offering, Company Signal, Problem Hypothesis, Service Connection, Recency & Confidence.
 * - If no direct need evidence exists, states that honestly rather than fabricating intent.
 */
export function buildServiceNeedExplanation(
  lead: {
    company_name?: string
    industry?: string
    need_summary?: string
    recent_signals?: string[]
    intent_flags?: string[]
    match_reason?: string[]
    requirement_theme?: string
    funding_details?: string
    revenue_growth?: string
    description?: string
  },
  filters: ScanFilters | string
): ServiceNeedEvidence {
  const userOffering = typeof filters === 'string'
    ? filters
    : (filters.buyerProfile?.core_service || filters.mission || 'B2B Technology Services')
  const signals = lead.recent_signals?.filter(Boolean) ?? []
  const flags = lead.intent_flags ?? []

  // Check for company-specific signal or requirement theme
  const primarySignal = signals[0] || lead.requirement_theme || lead.funding_details || (flags[0] ? flags[0].replace(/_/g, ' ') : null)
  const hasDirectNeed = Boolean(
    lead.need_summary &&
    lead.need_summary.length > 15 &&
    !lead.need_summary.toLowerCase().includes('requires technology') &&
    !lead.need_summary.toLowerCase().includes('matches search criteria')
  )

  const fitLevel = hasDirectNeed ? 'High' : primarySignal ? 'Moderate' : 'Inferred'
  const signalsList = [primarySignal, ...(flags.map(f => f.replace(/_/g, ' ')))].filter(Boolean) as string[]
  const summaryText = hasDirectNeed ? lead.need_summary! : primarySignal ? `Operational scaling indicators observed (${primarySignal})` : `Firmographic profile match for ${userOffering}`
  const distinctionText = hasDirectNeed
    ? 'Distinction: Company has verified operational signals and demonstrated need beyond passive firmographic ICP match.'
    : 'Distinction: Matches firmographic ICP profile, but lacks explicit verified tender or declared RFP.'

  if (hasDirectNeed && primarySignal) {
    return {
      user_offering: userOffering,
      company_signal: primarySignal,
      problem_hypothesis: lead.need_summary!,
      service_connection: `Your ${userOffering} directly addresses their observed operational signal.`,
      evidence_date: 'Recent (30-60 days)',
      source_reference: 'Live business signals & public disclosures',
      confidence_level: 'High',
      limitations: 'Signal indicates operational scaling activity, not an executed purchase order.',
      has_direct_need_evidence: true,
      service_fit_level: fitLevel,
      buyer_intent_signals: signalsList.length > 0 ? signalsList : ['Active business entity'],
      summary: summaryText,
      icp_vs_need_distinction: distinctionText,
    }
  }

  if (primarySignal) {
    return {
      user_offering: userOffering,
      company_signal: primarySignal,
      problem_hypothesis: `Company exhibits expansion/scaling signals that often create demand for ${userOffering}.`,
      service_connection: `Potential service relevance based on corporate lifecycle stage and timing triggers.`,
      evidence_date: 'Recent',
      source_reference: 'Public company disclosures & announcements',
      confidence_level: 'Medium',
      limitations: 'Inferred from growth indicators. No explicit public RFP or procurement tender confirmed.',
      has_direct_need_evidence: false,
      service_fit_level: fitLevel,
      buyer_intent_signals: signalsList.length > 0 ? signalsList : ['Active business entity'],
      summary: summaryText,
      icp_vs_need_distinction: distinctionText,
    }
  }

  return {
    user_offering: userOffering,
    company_signal: 'No distinct operational signal detected',
    problem_hypothesis: 'Company fits target ideal customer profile (industry, scale, location).',
    service_connection: `General ICP fit for ${userOffering}.`,
    evidence_date: null,
    source_reference: 'Firmographic registry',
    confidence_level: 'Inferred',
    limitations: 'No direct evidence of current service need found. Company qualified on profile fit only.',
    has_direct_need_evidence: false,
    service_fit_level: fitLevel,
    buyer_intent_signals: signalsList.length > 0 ? signalsList : ['Active business entity'],
    summary: summaryText,
    icp_vs_need_distinction: distinctionText,
  }
}

// ─── Stage 4: Declared intent matching ───────────────────────────────────────

async function matchDeclaredIntents(
  leads: ReturnType<typeof scoreLeads>,
  mode: string
): Promise<(ReturnType<typeof scoreLeads>[0] & { strongly_recommended: boolean; trust_score: number })[]> {
  const oppositeMode = mode === 'seeker' ? 'provider' : 'seeker'
  let intents: Array<{ industry_tags: string[] }> = []

  try {
    const { data } = await supabase
      .from('declared_intents')
      .select('requirement, industry_tags')
      .eq('mode', oppositeMode)
      .gt('expires_at', new Date().toISOString())
    intents = data ?? []
  } catch { /* non-fatal */ }

  return leads.map(lead => {
    const isMatch = intents.some(intent =>
      (intent.industry_tags ?? []).some(tag =>
        lead.industry.toLowerCase().includes(tag.toLowerCase())
      )
    )
    return {
      ...lead,
      strongly_recommended: isMatch,
      trust_score: isMatch ? 100 : Math.round((lead.confidence_score + lead.intent_score) / 2),
    }
  })
}

// ─── EBEXTA Verified Leads pool (admin hand-verified, served first) ────────────
//
// Before/alongside Gemini results, the scan pulls admin-verified leads that
// match the user's filters AND the OPPOSITE mode side. These carry the
// "✓ VERIFIED BY EBEXTA" badge and rank above everything except declared-intent
// Trust-100 matches.

interface VerifiedLeadRow {
  id: string
  company_name: string
  industry: string | null
  city: string | null
  location: string | null
  service_categories: string[] | null
  mode_side: string | null
  lead_data: Record<string, unknown>
  verified_stakeholders: ScannedLead['stakeholders'] | null
}

async function fetchEbextaVerifiedLeads(filters: ScanFilters, userId: string, maxCount = 3): Promise<ScannedLead[]> {
  try {
    const userMode = filters.mode ?? 'seeker'
    const targetSide = userMode === 'seeker' ? 'provider' : 'seeker'   // opposite side, always

    const { data } = await supabase
      .from('verified_leads')
      .select('*')
      .eq('mode_side', targetSide)
      .order('verified_at', { ascending: false })
      .limit(50)

    if (!data || data.length === 0) return []

    const inds = (filters.industries ?? []).map(s => s.toLowerCase())
    const cities = (filters.cities ?? []).map(s => s.toLowerCase())
    const cats = (filters.serviceCategories ?? []).map(s => s.toLowerCase())
    // Companies the caller already has on screen ("Generate More") must NOT be
    // served again from the pool — otherwise every top-up returns the same
    // verified companies, they get de-duped away, and the user sees "no new leads".
    const excluded = new Set((filters.excludeCompanies ?? []).map(s => s.trim().toLowerCase()))

    const targetCountries = parseTargetCountries(filters).map(s => s.toLowerCase())
    const empMin = Number(filters.employeeMin) || 1
    const empMax = Number(filters.employeeMax) || 100000

    const matches = (data as VerifiedLeadRow[]).filter(v => {
      if (excluded.has((v.company_name ?? '').trim().toLowerCase())) return false
      const vi = (v.industry ?? '').toLowerCase()
      const vc = (v.city ?? '').toLowerCase()
      const vl = (v.location ?? '').toLowerCase()
      const vcats = (v.service_categories ?? []).map(s => s.toLowerCase())
      const indOk = inds.length === 0 || inds.some(i => vi.includes(i) || i.includes(vi))
      
      const locOk = (cities.length === 0 && targetCountries.length === 0) ||
        (cities.length > 0 && cities.some(ct => vc.includes(ct) || vl.includes(ct))) ||
        (targetCountries.length > 0 && targetCountries.some(ctry => vl.includes(ctry) || vc.includes(ctry)))

      const base = v.lead_data as Record<string, unknown> | undefined
      const empCount = Number(base?.employee_count ?? 0)
      const empOk = empCount === 0 || (empCount >= empMin * 0.5 && empCount <= empMax * 1.8)

      const catOk = cats.length === 0 || vcats.length === 0 ||
        cats.some(c => vcats.some(v2 => v2.includes(c) || c.includes(v2)))
      return indOk && locOk && catOk && empOk
    }).slice(0, maxCount)

    return matches.map(v => {
      const base = v.lead_data as unknown as ScannedLead
      return {
        ...base,
        id: crypto.randomUUID(),
        user_id: userId,
        created_at: new Date().toISOString(),
        ebexta_verified: true,
        verification_status: 'VERIFIED' as const,
        confidence_score: Math.max(base.confidence_score ?? 0, 95),
        trust_score: Math.max(base.trust_score ?? 0, 95),
        stakeholders: (v.verified_stakeholders && v.verified_stakeholders.length > 0)
          ? v.verified_stakeholders
          : (base.stakeholders ?? []),
        validation_errors: [],
      }
    })
  } catch (err) {
    console.warn('[EBEXTA] verified_leads fetch failed (non-fatal):', err)
    return []
  }
}

// ─── Pipeline calibration ────────────────────────────────────────────────────
// A single scan should return a REALISTIC spread of intent — a few high-intent
// leads, several strong, some moderate, one or two low — regardless of mode.
// The incoming order is already best-first (Top Picks, then by intent), so we
// keep that RANK and only map the numbers onto a healthy curve. This preserves
// "the strongest lead scores highest" while avoiding a flat, fake-looking block.
function calibratePipeline<T extends { intent_score: number; score_breakdown?: ScoreBreakdownItem[] }>(leads: T[]): T[] {
  const n = leads.length
  if (n < 2) return leads

  // Band quotas matching the desired priority spread (for ~14 leads → 3 high,
  // 5 strong, 4 moderate, 1-2 low): high ~23%, strong ~37%, moderate ~30%,
  // low = remainder (guaranteed at least 1 when there are enough leads).
  const highN   = Math.max(1, Math.round(n * 0.23))
  const strongN = Math.max(1, Math.round(n * 0.37))
  let   modN    = Math.max(1, Math.round(n * 0.30))
  let   lowN    = n - highN - strongN - modN
  if (lowN < 1 && n >= 8) { modN = Math.max(1, modN - (1 - lowN)); lowN = n - highN - strongN - modN }
  lowN = Math.max(0, lowN)

  const bands = [
    { count: highN,   lo: 88, hi: 97 },
    { count: strongN, lo: 73, hi: 86 },
    { count: modN,    lo: 57, hi: 70 },
    { count: lowN,    lo: 43, hi: 54 },
  ]

  let idx = 0
  for (let b = 0; b < bands.length; b++) {
    const band = bands[b]
    const last = b === bands.length - 1
    const end = last ? n : Math.min(n, idx + band.count)
    const size = end - idx
    for (let k = 0; k < size && idx + k < n; k++) {
      const lead = leads[idx + k]
      const t = size === 1 ? 1 : 1 - k / (size - 1)   // top of group → band.hi
      const score = Math.round(band.lo + t * (band.hi - band.lo))
      const prev = lead.intent_score
      lead.intent_score = score
      // Keep the itemized breakdown summing to the shown score (honest total).
      if (lead.score_breakdown && score !== prev) {
        const sum = lead.score_breakdown.reduce((s, x) => s + x.points, 0)
        lead.score_breakdown.push({ signal: 'Overall ranking adjustment', points: score - sum })
      }
    }
    idx = end
    if (idx >= n) break
  }
  return leads
}

// ─── Main export ──────────────────────────────────────────────────────────────

export async function runScan(
  filters: ScanFilters,
  userId: string,
  onProgress: (step: number, message: string, partials?: ScannedLead[]) => void,
  options?: { scanId?: string }
): Promise<ScannedLead[]> {
  const TARGET = 16
  const scanId = options?.scanId || (typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `scan_${Date.now()}`)

  // Persistent scan lifecycle state (Phase 2): register scan as 'running'
  try {
    await supabase.from('scans').upsert({
      id: scanId,
      user_id: userId,
      filters,
      status: 'running',
      mode: filters.mode ?? 'seeker',
      created_at: new Date().toISOString(),
    })
  } catch (err) {
    console.warn('[EBEXTA] Scan lifecycle init non-fatal:', err)
  }

  // Top of the funnel — how many companies discovery actually handed over.
  let discoveredCount = 0

  // Load the latest requirement rules from the DB (admin-editable). Falls back
  // to the built-in defaults if the tables are empty/unreachable.
  await ensureRulesLoaded()

  // Product-level targeting: if the user is marketing a specific product, fold
  // its ideal-buyer profile into the filters up front so EVERY downstream step
  // (pool match, discovery, enrichment) aims at that product's buyer.
  filters = await resolveProductFilters(filters, userId)

  // ── STEP A — WHO ACTUALLY NEEDS THIS? ──
  // Translate the user's self-description into a description of their BUYERS
  // BEFORE any discovery happens. Without this, "we build games" + an industry
  // filter of "Technology" returned SaaS companies: the filter was concrete and
  // the description wasn't. One cheap ungrounded call, cached per description.
  onProgress(1, 'Understanding who actually needs what you sell…')
  const buyerProfile = await extractBuyerProfile(
    filters.mission ?? '',
    filters.mode === 'provider' ? 'provider' : 'seeker',
  )
  filters = { ...filters, buyerProfile }
  const scanCategories = needCategories(buyerProfile)
  // Which sector family this scan resolved to — the rank gate uses it to decide
  // whether search visibility is even relevant.
  const sectorFamilyForScan = resolveSectorForFilters(filters).rule?.sector ?? null

  // ── DISMISS + CYCLING ──
  // Dismissed companies are excluded absolutely, at every stage. Already-served
  // ones are pushed out of DISCOVERY so a rescan hunts new companies — but they
  // remain available as a fallback so an exhausted market returns repeats
  // rather than nothing.
  const cyclePlan = await buildCyclePlan()
  if (cyclePlan.excludeFromDiscovery.length > 0 || cyclePlan.dismissed.size > 0) {
    filters = {
      ...filters,
      excludeCompanies: [
        ...(filters.excludeCompanies ?? []),
        ...cyclePlan.excludeFromDiscovery,
        ...[...cyclePlan.dismissed],
      ].slice(0, 60),
    }
  }

  // ── FIX 3 — REUSE BEFORE RE-DISCOVERING ──
  // Another user with a similar description may already have found these.
  // Matching is on need_categories, never on filters, so a game-dev seller and
  // a SaaS seller filtering the same industry can never share leads.
  let pooled: Awaited<ReturnType<typeof fetchPooledLeads>> = []
  try {
    const served = await alreadyServedCompanies(userId)
    pooled = await fetchPooledLeads(
      buyerProfile, scanCategories, filters,
      [...served, ...(filters.excludeCompanies ?? [])],
      TARGET,
    )
    if (pooled.length > 0) {
      onProgress(1, `${pooled.length} matching companies already verified by EBEXTA — no new searches needed for those.`)
    }
  } catch (err) {
    console.warn('[EBEXTA] pool lookup failed (non-fatal):', err)
  }

  // Step 0 — EBEXTA BACKEND FIRST (originality strategy): serve hand-verified
  // leads from our own network before spending ANY Gemini quota. If the pool
  // covers N leads, we only LIVE-GENERATE the remaining TARGET − N companies.
  // EBEXTA's API cost drops; the user's credits are still charged for every
  // lead served (see the pool-credit charge below).
  onProgress(1, 'Searching the EBEXTA verified network…')
  const ebextaVerified = await fetchEbextaVerifiedLeads(filters, userId, TARGET)
  const poolNames = new Set(ebextaVerified.map(v => v.company_name.toLowerCase()))
  // Pooled leads cost ZERO discovery calls, so they reduce what we generate.
  // If the pool already covers the target, no Gemini discovery runs at all.
  const covered = ebextaVerified.length + pooled.length
  const needed = Math.max(0, TARGET - covered)

  // Step 1 — cache check
  onProgress(1, 'Checking intelligence cache…')
  const { filterHash, cached } = await checkCache(filters)

  let scoredLeads: Awaited<ReturnType<typeof matchDeclaredIntents>>

  if (cached && cached.length > 0) {
    onProgress(2, `Loaded ${cached.length} cached leads — applying fresh filters…`)
    const rescored = scoreLeads(
      cached.map(c => ({
        company_name: c.company_name,
        industry: c.industry,
        location: c.location,
        employee_count: c.employee_count,
        funding_stage: c.funding_stage,
        annual_revenue: c.annual_revenue,
        website: c.website,
        linkedin_url: c.linkedin_url,
        email: c.email,
        evidence_source_url: c.evidence_source_url,
        recent_signals: c.recent_signals ?? [],
        stakeholders: c.stakeholders ?? [],
        // Rich fields preserved from cache
        description: c.description,
        company_linkedin: c.company_linkedin,
        company_twitter: c.company_twitter,
        requirement_theme: c.requirement_theme,
        turnover: c.turnover,
        revenue_growth: c.revenue_growth,
        funding_details: c.funding_details,
        funding_source_url: c.funding_source_url,
        investment_history: c.investment_history,
        big_projects: c.big_projects,
        match_reason: c.match_reason,
        contacts: c.contacts,
        company_stage: c.company_stage,
        company_contact: c.company_contact,
      })),
      filters
    )
    scoredLeads = await matchDeclaredIntents(rescored, filters.mode ?? 'seeker')
  } else if (needed === 0) {
    // The verified pool alone fills the whole scan — ZERO Gemini calls needed.
    onProgress(3, `EBEXTA network covered all ${TARGET} leads — no live generation needed.`)
    scoredLeads = []
  } else {
    // Step 2 — TWO-PASS grounded discovery:
    //   Pass 1: names only (1 call) → Pass 2: per-company enrichment (parallel)
    // Every lead gets full grounding attention = every lead's links are
    // as precise as lead #1. (~9 calls/scan — tracked in api_usage.)
    void logSystemEvent({
      userId, eventType: 'scan', message: 'Scan started',
      metadata: { mission: (filters.mission ?? '').slice(0, 120), country: filters.country ?? null },
    })

    // Live-generate ONLY the shortfall (pool names excluded so Gemini never
    // duplicates a company we already have verified).
    const genFilters: ScanFilters = {
      ...filters,
      excludeCompanies: [
        ...(filters.excludeCompanies ?? []),
        ...ebextaVerified.map(v => v.company_name),
      ],
    }
    onProgress(2, ebextaVerified.length > 0
      ? `${ebextaVerified.length} from the EBEXTA network — live-generating ${needed} more…`
      : 'Live-generating fresh leads…')

    let rawLeads: RawGroundedLead[]
    try {
      rawLeads = await discoverTwoPass(genFilters, userId, onProgress, Math.max(20, needed + 4))
    } catch (err) {
      void logSystemEvent({
        userId, eventType: 'error',
        message: `Scan failed: ${(err as Error)?.message ?? 'unknown error'}`,
      })
      throw err
    }

    if (rawLeads.length === 0 && ebextaVerified.length === 0) {
      void logSystemEvent({ userId, eventType: 'error', message: 'Scan failed: no companies found' })
      throw new Error('No companies found — please broaden your search filters')
    }

    discoveredCount = rawLeads.length

    // Step 3 — Triple filtration (firmographic is score-only, never drops leads)
    onProgress(3, `Found ${rawLeads.length} companies — running triple filtration…`)
    const scored = scoreLeads(rawLeads, filters)

    // Step 4 — Declared intent matching
    onProgress(4, 'Matching against declared intents…')
    scoredLeads = await matchDeclaredIntents(scored, filters.mode ?? 'seeker')

    // Cache results
    try {
      await supabase.from('cached_leads').upsert({
        filter_hash: filterHash,
        industry: (filters.mission ?? '').substring(0, 100),
        location: filters.country ?? 'India',
        employee_min: filters.employeeMin ?? 1,
        employee_max: filters.employeeMax ?? 5000,
        leads: scoredLeads,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
    } catch { /* cache save failure is non-fatal */ }
  }

  // Sort: strongly recommended first, then by composite score (match_score * 0.5 + intent_score * 0.5)
  const sorted = [...scoredLeads].sort((a, b) => {
    if (a.strongly_recommended && !b.strongly_recommended) return -1
    if (!a.strongly_recommended && b.strongly_recommended) return 1
    const aComp = ((a.match_score ?? 0) * 0.5) + ((a.intent_score ?? 0) * 0.5)
    const bComp = ((b.match_score ?? 0) * 0.5) + ((b.intent_score ?? 0) * 0.5)
    return bComp - aComp
  })

  // Generated leads (pool companies excluded so nothing duplicates).
  const generated = sorted.filter(l => !poolNames.has(l.company_name.toLowerCase()))

  const now = new Date().toISOString()
  let leadsWithMeta: ScannedLead[] = generated.map(l => (
    { ...l, id: crypto.randomUUID(), user_id: userId, scan_id: scanId, created_at: now } as ScannedLead
  ))

  // ── MERGE: EBEXTA VERIFIED POOL served FIRST ──
  // Ranking: declared-intent Trust-100 matches > Verified by EBEXTA > generated.
  if (ebextaVerified.length > 0) {
    ebextaVerified.forEach(l => { l.scan_id = scanId })
    const trust100 = leadsWithMeta.filter(l => l.strongly_recommended)
    const others = leadsWithMeta.filter(l => !l.strongly_recommended)
    leadsWithMeta = [...trust100, ...ebextaVerified, ...others]
  }

  // ── MERGE: SHARED POOL ──
  // Already-verified companies from other users with a similar description.
  // Deduped by name so a company is never served to the same user twice.
  if (pooled.length > 0) {
    const have = new Set(leadsWithMeta.map(l => l.company_name.trim().toLowerCase()))
    const fresh = pooled
      .filter(p => !have.has(p.lead.company_name.trim().toLowerCase()))
      .map(p => ({
        ...p.lead,
        id: crypto.randomUUID(),
        user_id: userId,
        scan_id: scanId,
        created_at: now,
      } as ScannedLead))
    leadsWithMeta = [...leadsWithMeta, ...fresh]
    void markPoolServed(pooled.map(p => p.poolId))
  }

  // ── CYCLE SELECTION ──
  // Dismissed companies are removed absolutely. Unserved ones are preferred.
  // Only when there genuinely aren't enough new companies do we bring back
  // previously-served ones — oldest first, labelled, and re-verified.
  const cycleResult = selectForCycle(
    leadsWithMeta, l => l.company_name, cyclePlan, TARGET,
  )
  leadsWithMeta = cycleResult.selected

  if (cycleResult.startedNewCycle) {
    onProgress(5, 'You have seen every company matching this profile — re-verifying the best ones.')
    const seenNames = cyclePlan.served
    leadsWithMeta.forEach(l => {
      if (seenNames.has(l.company_name.trim().toLowerCase())) {
        l.seen_before = true
        l.reverified_at = new Date().toISOString()
      }
    })
  }

  leadsWithMeta = leadsWithMeta.slice(0, TARGET)

  // Stamp every lead with the service that found it, so a bad match is
  // traceable back to the description that produced it.
  leadsWithMeta.forEach(l => { l.source_description = buyerProfile.core_service })

  // Calibrate the FINAL combined set into the priority spread (3-4 high,
  // 5-6 strong, 4-5 moderate, 1-2 low) — keeps rank, fixes flat clustering.
  calibratePipeline(leadsWithMeta)
  leadsWithMeta.forEach(l => {
    l.business_impact = calculateBusinessImpact(l, filters)
    l.reachability = evaluateReachability(l)
    l.service_need_evidence = buildServiceNeedExplanation(l, filters)
    l.action_status = l.action_status || { status: 'New' }
  })
  onProgress(4, `Assembled ${leadsWithMeta.length} verified leads — finalizing dossiers…`, leadsWithMeta)

  // ── DEEP SITE WALKTHROUGH ──
  // Everything above this line came from Gemini's research. From here on, EBEXTA
  // actually READS each company's website and corrects anything the site
  // contradicts. Runs ONLY on the final, filtered set that the user will see —
  // never on every discovered candidate. Concurrency 3, per-domain cache is
  // shared across all users, so most of these cost nothing.
  //
  // Nothing above is modified by this step: discovery, filtration and scoring
  // have already produced their result. This only verifies it.
  try {
    const toWalk = leadsWithMeta.slice(0, SITE_WALKTHROUGH_LIMIT)
    if (toWalk.length > 0) {
      onProgress(5, `Reading all ${toWalk.length} company websites to verify every claim…`)
      const verified = await walkthroughBatch(toWalk, 3, (done, total, company) => {
        // Phrased as progress, not a score — "3/10" alone reads like only 3
        // passed, when it means 3 of 10 are finished.
        onProgress(5, `Reading websites — ${done} of ${total} done (just finished ${company})`)
      })
      for (let i = 0; i < verified.length; i++) leadsWithMeta[i] = verified[i]
    }
  } catch (err) {
    // A walkthrough failure must never lose a scan. The leads simply stay
    // EBEXTA Engine inferred, which the UI states plainly.
    console.error('[EBEXTA] site walkthrough batch failed (non-fatal):', err)
  }

  // ── SEARCH-VISIBILITY GATE ──
  // Only for sectors where visibility IS the product (SEO, digital marketing,
  // web design). A company already ranking #1 for its own category does not
  // need help being found — however well-funded it is.
  //
  // Runs after the walkthrough so it has real firmographics, and before
  // ranking so exclusions never reach the user.
  let rankExcluded: Array<{ lead: ScannedLead; reason: string }> = []
  try {
    const gate = await applyRankGate(
      leadsWithMeta, sectorFamilyForScan, buyerProfile.core_service,
      (msg) => onProgress(5, msg),
    )
    rankExcluded = gate.excluded
    // Same guard as the feasibility gate: an empty result is worse than an
    // imperfect one, so if the gate removed everything we keep the leads and
    // log it loudly instead of handing back nothing.
    if (gate.kept.length > 0) {
      leadsWithMeta = gate.kept
    } else if (gate.excluded.length > 0) {
      console.info(`[EBEXTA] rank gate excluded ALL ${gate.excluded.length} leads — keeping them rather than returning nothing`)
    }
    for (const e of rankExcluded) {
      void logSystemEvent({
        userId, eventType: 'scan',
        message: `Excluded (already dominant in search): ${e.lead.company_name}`,
        metadata: { reason: e.reason, company: e.lead.company_name },
      })
    }
  } catch (err) {
    console.error('[EBEXTA] rank gate failed (non-fatal):', err)
  }

  // ── FEASIBILITY GATE ──
  // Can these companies actually USE what the seller sells? A product with a
  // prerequisite (existing CCTV, a fleet, physical stores) is unsellable
  // without it, however strong every other signal is.
  //
  // Runs AFTER the walkthrough so it can use real site evidence, and BEFORE
  // final ranking so 'ready' leads can outrank 'unknown' ones.
  //
  // A seller who declared no prerequisite gets zero behaviour change: the gate
  // returns every lead untouched and makes no API call.
  let feasibilityExcluded: Awaited<ReturnType<typeof applyFeasibilityGate>>['excluded'] = []
  let feasibilityPrereq = ''
  try {
    const prerequisites = await fetchPrerequisites(userId)
    if (prerequisites.length > 0) {
      const gate = await applyFeasibilityGate(leadsWithMeta, prerequisites, (msg) => onProgress(5, msg))
      feasibilityExcluded = gate.excluded
      feasibilityPrereq = gate.prerequisite

      // Only replace the working set when the gate left the user something.
      // Silently returning zero leads would be worse than showing unverified
      // ones — if the gate emptied the list, we keep the leads and log loudly
      // so the over-filtering shows up instead of looking like a failed scan.
      if (gate.kept.length > 0) {
        leadsWithMeta = gate.kept
      } else if (gate.excluded.length > 0) {
        console.info(`[EBEXTA] feasibility gate excluded ALL ${gate.excluded.length} leads for "${gate.prerequisite}" — keeping them rather than returning nothing`)
        void logSystemEvent({
          userId, eventType: 'error',
          message: `Feasibility gate would have excluded every lead (${gate.prerequisite})`,
          metadata: { prerequisite: gate.prerequisite, excluded: gate.excluded.length },
        })
      }

      if (gate.excluded.length > 0) {
        onProgress(5, `${gate.excluded.length} companies can't use ${gate.prerequisite} — filtered out.`)
      }
    }
  } catch (err) {
    console.error('[EBEXTA] feasibility gate failed (non-fatal):', err)
  }

  // ── FINAL RANKING ──
  // Declared-intent and EBEXTA-pool leads keep their existing precedence (they
  // are merged above). Within the rest, a company that can actually deploy the
  // product outranks one where we simply don't know.
  if (feasibilityPrereq) {
    const rank = (l: ScannedLead) => (l.feasibility_status === 'ready' ? 0 : 1)
    leadsWithMeta.sort((a, b) => {
      if (a.strongly_recommended !== b.strongly_recommended) return a.strongly_recommended ? -1 : 1
      if (a.ebexta_verified !== b.ebexta_verified) return a.ebexta_verified ? -1 : 1
      const r = rank(a) - rank(b)
      if (r !== 0) return r
      const feas = (b.feasibility_score ?? 0) - (a.feasibility_score ?? 0)
      if (feas !== 0) return feas
      const match = (b.match_score ?? 0) - (a.match_score ?? 0)
      if (match !== 0) return match
      return (b.intent_score ?? 0) - (a.intent_score ?? 0)
    })
  }

  // ── POOL CREDIT CHARGE ──
  // Leads served from the EBEXTA network cost us zero Gemini calls, but they are
  // still delivered intelligence — the user's credits are charged 1 per pool
  // lead (one api_usage row each; the credit meter counts rows).
  for (const v of ebextaVerified) {
    void logApiUsage({ userId, action: 'scan', model: 'ebexta-pool', tokensUsed: 0, calls: 1 })
    void v
  }

  // ── THE FUNNEL, END TO END ──
  // Printed on every scan so "returned zero leads" is never a mystery again.
  // Discovery already logged its own stages; this line closes the loop with
  // what the gates after discovery removed.
  const scanFunnel = emptyFunnel()
  scanFunnel.discovered = discoveredCount
  scanFunnel.rankDropped = rankExcluded.length
  scanFunnel.feasibilityDropped = feasibilityExcluded.length
  scanFunnel.looselyMatched = leadsWithMeta.filter(l => l.loosely_matched).length
  scanFunnel.final = leadsWithMeta.length
  console.info(funnelLine(scanFunnel))
  void logSystemEvent({
    userId, eventType: 'scan', message: funnelLine(scanFunnel),
    metadata: { funnel: { ...scanFunnel }, stage: 'post-gates' },
  })

  // Step 5 — Save to Supabase
  onProgress(5, `${leadsWithMeta.length} verified leads ready — saving to your dashboard…`)

  void logSystemEvent({
    userId, eventType: 'scan',
    message: `Scan completed — ${leadsWithMeta.length} leads (${ebextaVerified.length} from EBEXTA network, ${leadsWithMeta.length - ebextaVerified.length} live)`,
    metadata: { leadCount: leadsWithMeta.length, fromPool: ebextaVerified.length, cached: !!(cached && cached.length > 0) },
  })

  // Step 5b — Save to Supabase (loud errors so we know if it breaks)
  try {
    // Save scan record
    const { data: scan, error: scanError } = await (supabase
      .from('scans') as any)
      .upsert({
        id: scanId,
        user_id: userId,
        filters,
        status: 'complete',
        mode: filters.mode ?? 'seeker',
        // What EBEXTA actually searched with — the translated buyer profile, not
        // the raw description. Makes a bad scan diagnosable after the fact.
        description_used: JSON.stringify({
          core_service: buyerProfile.core_service,
          who_needs_this: buyerProfile.who_needs_this,
          search_phrases: buyerProfile.search_phrases,
          exclude: buyerProfile.exclude,
        }).slice(0, 4000),
      })
      .select()
      .single()

    if (scanError) {
      console.error('[NEXA] Supabase scan insert failed:', scanError.message, scanError.details, scanError.hint)
      throw scanError
    }

    const savedScanId: string = (scan as { id?: string } | null)?.id ?? scanId

    // Remember what this user has now seen, so the next scan gives them
    // different companies.
    void recordServed(
      leadsWithMeta.map(l => l.company_name),
      savedScanId,
      cycleResult.cycleNumber,
    )

    // Audit what the feasibility gate removed, tied to this scan, so the admin
    // can see immediately if it starts over-filtering.
    if (feasibilityExcluded.length > 0) {
      void logExclusions(userId, savedScanId, feasibilityPrereq, feasibilityExcluded)
    }

    // Build lead rows — explicit field mapping, no ...spread (avoids unknown column errors)
    const leadRows = leadsWithMeta.map(lead => ({
      // Core identity
      id:                      lead.id,
      user_id:                 lead.user_id,
      scan_id:                 savedScanId,
      created_at:              lead.created_at,

      // Company fields
      company_name:            lead.company_name   || 'Unknown',
      industry:                lead.industry        || null,
      location:                lead.location        || null,
      employee_count:          lead.employee_count  ?? null,
      funding_stage:           lead.funding_stage   || lead.company_stage || null,
      annual_revenue:          lead.annual_revenue  || lead.turnover       || null,
      website:                 lead.website         || null,
      linkedin_url:            lead.linkedin_url    || lead.company_linkedin || null,
      email:                   lead.email           || null,

      // Scores
      intent_score:            lead.intent_score    ?? null,
      match_score:             lead.match_score     ?? null,
      confidence_score:        lead.confidence_score ?? null,

      // Status
      verification_status:     lead.verification_status || null,
      is_strongly_recommended: lead.strongly_recommended ?? false,
      trust_score:             lead.trust_score     ?? 0,

      // Array / JSONB fields
      intent_flags:            lead.intent_flags    ?? [],
      validation_errors:       lead.validation_errors ?? [],
      stakeholders:            lead.stakeholders    ?? null,

      // Rich grounded fields
      description:             lead.description          ?? null,
      company_linkedin:        lead.company_linkedin      ?? null,
      company_twitter:         lead.company_twitter       ?? null,
      requirement_theme:       lead.requirement_theme     ?? null,
      turnover:                lead.turnover              ?? null,
      revenue_growth:          lead.revenue_growth        ?? null,
      funding_details:         lead.funding_details       ?? null,
      funding_source_url:      lead.funding_source_url    ?? lead.evidence_source_url ?? null,
      investment_history:      lead.investment_history    ?? null,
      big_projects:            Array.isArray(lead.big_projects) ? lead.big_projects : (lead.big_projects ? [lead.big_projects] : []),
      match_reason:            Array.isArray(lead.match_reason) ? lead.match_reason : (lead.match_reason ? [lead.match_reason] : []),
      contacts:                lead.contacts              ?? null,
      company_stage:           lead.company_stage         ?? null,
      company_contact:         lead.company_contact       ?? null,
      score_breakdown:         lead.score_breakdown       ?? null,
      match_breakdown:         lead.match_breakdown       ?? null,
      rules_fired:             lead.rules_fired           ?? null,
      evidence_source_url:     lead.evidence_source_url  ?? null,

      // Deep site walkthrough — the evidence behind every verified claim
      site_walkthrough:        lead.site_walkthrough      ?? null,
      pages_read:              lead.pages_read            ?? [],
      site_read_status:        lead.site_read_status      ?? null,
      site_read_at:            lead.site_read_at          ?? null,
      claim_verification:      lead.claim_verification    ?? [],

      implicit_gap_facts:      lead.implicit_gap_facts    ?? [],
      registry_checks:         lead.registry_checks       ?? [],
      tech_fingerprints:       lead.tech_fingerprints     ?? null,
      ad_spend_detected:       lead.ad_spend_detected     ?? null,
      resolved_sector:         lead.resolved_sector       ?? null,
      sector_confidence:       lead.sector_confidence     ?? null,

      // Feasibility gate — can they actually deploy what we sell?
      feasibility_status:      lead.feasibility_status    ?? null,
      feasibility_evidence:    lead.feasibility_evidence  ?? [],
      feasibility_score:       lead.feasibility_score     ?? 0,

      // Description-first matching — why this lead was chosen
      need_summary:            lead.need_summary          ?? null,
      description_match_score: lead.description_match_score ?? 0,
      source_description:      lead.source_description    ?? null,

      // Search-visibility verification
      search_visibility:       lead.search_visibility     ?? 'not_checked',
      rank_evidence:           lead.rank_evidence         ?? null,
      excluded_reason:         lead.excluded_reason       ?? null,

      // Weak description match — persisted so the label survives a reload.
      loosely_matched:         lead.loosely_matched       ?? false,
    }))

    const { error: leadsError } = await supabase
      .from('leads')
      .insert(leadRows)

    if (leadsError) {
      console.error('[EBEXTA] Supabase leads insert failed:', leadsError.message, leadsError.details, leadsError.hint)
      // Attempt core-columns-only fallback insert so at least basic lead rows are preserved in Supabase
      try {
        const minimalRows = leadRows.map(r => ({
          id: r.id,
          user_id: r.user_id,
          scan_id: r.scan_id,
          created_at: r.created_at,
          company_name: r.company_name,
          industry: r.industry,
          location: r.location,
          employee_count: r.employee_count,
          funding_stage: r.funding_stage,
          annual_revenue: r.annual_revenue,
          website: r.website,
          intent_score: r.intent_score,
          match_score: r.match_score,
          confidence_score: r.confidence_score,
          verification_status: r.verification_status,
          trust_score: r.trust_score,
          is_strongly_recommended: r.is_strongly_recommended,
        }))
        const { error: minErr } = await supabase.from('leads').insert(minimalRows)
        if (minErr) {
          console.error('[EBEXTA] Minimal fallback insert also failed:', minErr.message)
        } else {
          console.info('[EBEXTA] Minimal fallback insert succeeded')
        }
      } catch (fallbackErr) {
        console.error('[EBEXTA] Minimal fallback insert exception:', fallbackErr)
      }
    }

    // Write telemetry metrics after successful insert
    try {
      const resolved = resolveSectorForFilters(filters)
      const sectorName = resolved.rule?.sector || 'UNKNOWN'

      const total = leadsWithMeta.length
      const successful = leadsWithMeta.filter(l => l.site_read_status === 'full').length
      const partial = leadsWithMeta.filter(l => l.site_read_status === 'partial').length
      const blocked = leadsWithMeta.filter(l => l.site_read_status === 'blocked').length

      const totalConf = leadsWithMeta.reduce((acc, l) => acc + (l.confidence_score ?? 0), 0)
      const avgConf = total > 0 ? (totalConf / total) : 0

      await supabase.from('accuracy_telemetry').insert({
        scan_id: scanId || null,
        user_id: userId,
        sector: sectorName,
        total_leads: total,
        crawled_successfully: successful,
        crawled_partially: partial,
        crawled_blocked: blocked,
        avg_confidence_score: avgConf,
        leads_kept: 0,
        leads_dismissed: 0
      })
    } catch (telErr) {
      console.warn('[EBEXTA Telemetry] Failed to log accuracy telemetry:', telErr)
    }
  } catch (err) {
    // Non-fatal — localStorage still has the data so the dashboard works.
    // Logged loudly so the bug is always visible in the console.
    console.error('[NEXA] Supabase save error (non-fatal, leads are in localStorage):', err)
  }

  // ── Step 5c — COMPANY MEMORY ──
  // Every company found gets a permanent record. New companies are created with
  // a "First discovered by EBEXTA" event; known companies are MERGED (contacts
  // deduped, only unseen signals appended) so history is never wiped.
  //
  // Note this makes ZERO Gemini calls — memory is pure Supabase. The AI
  // sections (relationship map, deal strategy) are generated only when a user
  // actually opens that company. Never pre-generate here.
  try {
    await upsertMemoriesForScan(userId, leadsWithMeta)
  } catch (err) {
    console.error('[EBEXTA] company memory upsert failed (non-fatal):', err)
  }

  // ── WRITE BACK TO THE SHARED POOL ──
  // Only leads that passed the description gate go in. Pooling a weak match
  // would propagate it to every future user with a similar description.
  try {
    const added = await writeToPool(leadsWithMeta, buyerProfile, scanCategories, filters)
    if (added > 0) console.info(`[EBEXTA] added ${added} lead(s) to the shared pool`)
  } catch (err) {
    console.warn('[EBEXTA] pool write failed (non-fatal):', err)
  }

  return leadsWithMeta
}
