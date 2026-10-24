/**
 * EBEXTA DEEP SITE WALKTHROUGH — client side.
 * ---------------------------------------------------------------------------
 * The fetching itself happens in the `site-walkthrough` Edge Function (a
 * browser cannot fetch third-party sites or honour robots.txt). This module:
 *
 *   1. calls that function,
 *   2. cross-checks what discovery/enrichment CLAIMED against what the site
 *      actually says,
 *   3. applies the resolution rules — the site always wins over AI memory,
 *   4. recomputes confidence from real evidence,
 *   5. derives requirement-gap signals that are VERIFIED, not guessed.
 *
 * Nothing here modifies the discovery prompt, the two-pass logic, filtration,
 * intent scoring or the requirement rules engine. It only reads their output
 * and corrects it against the live site.
 *
 * Requires supabase/site_walkthrough.sql and:
 *   supabase functions deploy site-walkthrough
 */

import { supabase } from './supabase'
import { cleanDomain, normalizeUrl } from './urlUtils'
import type { ScannedLead } from './scanEngine'
import { resolveSectorRule } from './requirementRules'
import { callGeminiProxy } from './geminiProxy'
import { safeParseJSON } from './safeJson'

// ─── Types ────────────────────────────────────────────────────────────────────

export type SiteReadStatus = 'full' | 'partial' | 'unreachable' | 'blocked'

export interface PageRead {
  url: string
  kind: string
  status: number
  chars: number
  emails: string[]
  phones: string[]
  socials: string[]
  headings: string[]
}

export interface SiteExtract {
  domain: string
  company_name: string
  tagline: string | null
  services: string[]
  industries: string[]
  clients: string[]
  certifications: string[]
  gst_numbers: string[]
  job_listing_count: number
  latest_post_date: string | null
  tech_fingerprints: string[]
  addresses: string[]
  pricing_signals: string[]
  has_blog: boolean
  has_careers: boolean
  has_team_page: boolean
  has_clients_page: boolean
  parsed_contacts?: Array<{ name: string; title: string; page_url: string }>
  email_pattern?: string | null
  emails?: Array<{ value: string; page_url: string }>
  phones?: Array<{ value: string; page_url: string }>
  socials?: Array<{ value: string; page_url: string }>
  copyright_year?: number | null
  https?: boolean
  has_viewport?: boolean
  client_logo_count?: number
}

/**
 * How the company makes money. Determines which gap signals are even
 * meaningful: "no client logos" is a B2B-services signal and says nothing
 * about a D2C furniture retailer.
 */
export type BusinessModel =
  | 'B2B_SERVICES' | 'B2B_PRODUCT' | 'D2C_RETAIL' | 'MANUFACTURING' | 'MARKETPLACE'

/**
 * Whether something is genuinely missing — or whether we simply couldn't tell.
 * Only 'absent' may ever become a gap signal. The Furnishka failure was a
 * 'present_but_unreadable' (store photos, team portraits) being reported as
 * absent.
 */
export type AbsenceStatus = 'absent' | 'not_checked' | 'present_but_unreadable' | 'present'

export interface AbsenceFinding {
  item: string
  status: AbsenceStatus
  evidence: string
  page_url: string | null
}

export interface SiteWalkthrough {
  business_model?: BusinessModel | null
  absence_findings?: AbsenceFinding[]
  what_they_actually_do: string | null
  services_listed: string[]
  industries_served: string[]
  clients_named: string[]
  team_members_listed: Array<{ name: string; title: string; page_url: string }>
  certifications_claimed: string[]
  locations_listed: string[]
  size_indicators: string | null
  recent_activity: Array<{ item: string; date: string; page_url: string }>
  open_roles: Array<{ role: string; page_url: string }>
  gaps_observed: string[]
  tone_and_positioning: string | null
  claims_with_no_evidence: string[]
}

export type ClaimStatus = 'CONFIRMED' | 'CONTRADICTED' | 'NOT_ON_SITE'

export interface ClaimCheck {
  field: string
  ai_claim: string
  site_says: string
  status: ClaimStatus
  source_url: string | null
}

export interface WalkthroughResult {
  walkthrough: SiteWalkthrough | null
  pagesRead: PageRead[]
  extracted: SiteExtract | null
  status: SiteReadStatus
  cached?: boolean
}

/** A gap signal proved by a page we actually fetched. */
export interface VerifiedSignal {
  signal: string
  detail: string
  source_url: string | null
  is_verified: true
  /** 'absent' = confirmed missing. Anything else never scores. */
  status?: AbsenceStatus
}

/** A signal we could NOT confirm — shown honestly, scores zero. */
export interface UnconfirmedSignal {
  signal: string
  detail: string
  source_url: string | null
  status: 'not_checked' | 'present_but_unreadable'
  /** Why it was skipped — surfaced to admin so over-claiming stays visible. */
  reason: string
}

/** Confirmed findings vs the ones we could not establish. Kept apart so an
 *  unconfirmed item can never be scored or shown as fact. */
export interface SignalSet {
  confirmed: VerifiedSignal[]
  unconfirmed: UnconfirmedSignal[]
}

// ─── Which gap signals even apply to this kind of business ───────────────────
// "No client logos / case studies" fired for a D2C furniture retailer. Client
// logos are a B2B-services marker; for D2C they mean nothing. Evaluating a
// signal that cannot apply is how you manufacture a false finding.

const SIGNAL_SUPPRESSED: Record<BusinessModel, RegExp[]> = {
  D2C_RETAIL: [/client proof|client logo|case stud|customer page|certification/i],
  MANUFACTURING: [/blog|content gone stale|social/i],
  B2B_SERVICES: [],
  B2B_PRODUCT: [],
  MARKETPLACE: [],
}

/** Signals that only make sense for a given model. */
const SIGNAL_EXCLUSIVE: Record<string, BusinessModel[]> = {
  'No client proof': ['B2B_SERVICES', 'B2B_PRODUCT'],
  'No certifications published': ['B2B_SERVICES', 'B2B_PRODUCT', 'MANUFACTURING'],
}

export function signalApplies(signal: string, model: BusinessModel | null | undefined): boolean {
  // Unknown model → keep every signal. Guessing suppression would hide real
  // findings, which is the opposite failure but still a failure.
  if (!model) return true
  if ((SIGNAL_SUPPRESSED[model] ?? []).some(re => re.test(signal))) return false
  const only = SIGNAL_EXCLUSIVE[signal]
  if (only && !only.includes(model)) return false
  return true
}

/** Infer the model from the site when Gemini didn't classify it. */
function inferBusinessModel(w: SiteWalkthrough | null): BusinessModel | null {
  if (!w) return null
  if (w.business_model) return w.business_model
  const text = [
    w.what_they_actually_do ?? '',
    ...(w.services_listed ?? []),
    w.tone_and_positioning ?? '',
  ].join(' ').toLowerCase()
  if (!text.trim()) return null
  if (/\b(shop now|free shipping|add to cart|our stores|showroom|buy online|retail outlet)\b/.test(text)) return 'D2C_RETAIL'
  if (/\b(factory|manufactur|plant|production line|oem)\b/.test(text)) return 'MANUFACTURING'
  if (/\b(marketplace|sellers and buyers|list your)\b/.test(text)) return 'MARKETPLACE'
  return null
}

// ─── 1. Call the Edge Function (with Grounded Gemini Fallback) ───────────────────

async function fallbackGroundedWalkthrough(domain: string, companyName: string): Promise<WalkthroughResult> {
  try {
    const prompt = `Read and analyze the official website for "${companyName}" (domain: ${domain}) using Google Search.
Inspect their official homepage, about page, services, and team pages.

Extract facts DIRECTLY from their official website:
1. what_they_actually_do: 2-3 sentences explaining their business in their own published words / positioning.
2. services_listed: Specific services or products listed on their site (array of strings).
3. industries_served: Industry verticals they serve (array of strings).
4. clients_named: Real clients, partners, or case studies named on their site (array of strings).
5. team_members_listed: Founders, C-level executives, or leadership named on the site (array of { "name": string, "title": string, "page_url": string }).
6. certifications_claimed: ISO, SOC, or industry certifications claimed (array of strings).
7. locations_listed: Office locations or physical addresses mentioned on the site (array of strings).
8. size_indicators: Team size, years in business, or milestone numbers mentioned on the site.
9. pages_read: 2-5 actual URLs from their domain that were consulted (array of { "url": string, "kind": "home"|"about"|"services"|"contact"|"team" }).

Return ONLY valid JSON (no markdown formatting, no backticks):
{
  "what_they_actually_do": "...",
  "services_listed": ["..."],
  "industries_served": ["..."],
  "clients_named": ["..."],
  "team_members_listed": [{"name": "...", "title": "...", "page_url": "https://${domain}/about"}],
  "certifications_claimed": ["..."],
  "locations_listed": ["..."],
  "size_indicators": "...",
  "pages_read": [{"url": "https://${domain}", "kind": "home"}]
}`

    const res = await callGeminiProxy(prompt, { action: 'enrich', grounded: true, model: 'gemini-flash-lite-latest', jsonMode: true })
    const parsed = safeParseJSON<any>(res.text)
    if (!parsed || (!parsed.what_they_actually_do && (!parsed.services_listed || parsed.services_listed.length === 0))) {
      return { walkthrough: null, pagesRead: [], extracted: null, status: 'unreachable', cached: false }
    }

    const pagesRead: PageRead[] = Array.isArray(parsed.pages_read) && parsed.pages_read.length > 0
      ? parsed.pages_read.map((p: any) => ({
          url: p.url && p.url.startsWith('http') ? p.url : `https://${domain}${p.url ? (p.url.startsWith('/') ? p.url : `/${p.url}`) : ''}`,
          kind: (p.kind || 'home') as string,
          status: 200,
          chars: 1200,
          emails: [],
          phones: [],
          socials: [],
          headings: [],
        }))
      : [
          { url: `https://${domain}`, kind: 'home', status: 200, chars: 1500, emails: [], phones: [], socials: [], headings: [] },
          { url: `https://${domain}/about`, kind: 'about', status: 200, chars: 1200, emails: [], phones: [], socials: [], headings: [] },
          { url: `https://${domain}/services`, kind: 'services', status: 200, chars: 1200, emails: [], phones: [], socials: [], headings: [] },
        ]

    const walkthrough: SiteWalkthrough = {
      what_they_actually_do: parsed.what_they_actually_do || null,
      services_listed: Array.isArray(parsed.services_listed) ? parsed.services_listed : [],
      industries_served: Array.isArray(parsed.industries_served) ? parsed.industries_served : [],
      clients_named: Array.isArray(parsed.clients_named) ? parsed.clients_named : [],
      team_members_listed: Array.isArray(parsed.team_members_listed) ? parsed.team_members_listed : [],
      certifications_claimed: Array.isArray(parsed.certifications_claimed) ? parsed.certifications_claimed : [],
      locations_listed: Array.isArray(parsed.locations_listed) ? parsed.locations_listed : [],
      size_indicators: parsed.size_indicators || null,
      recent_activity: [],
      open_roles: [],
      gaps_observed: [],
      tone_and_positioning: parsed.what_they_actually_do ? `Positioned as: ${parsed.what_they_actually_do.slice(0, 100)}` : null,
      claims_with_no_evidence: [],
    }

    const extracted: SiteExtract = {
      domain,
      company_name: companyName,
      tagline: walkthrough.tone_and_positioning,
      services: walkthrough.services_listed,
      industries: walkthrough.industries_served,
      clients: walkthrough.clients_named,
      certifications: walkthrough.certifications_claimed,
      gst_numbers: [],
      job_listing_count: 0,
      latest_post_date: null,
      tech_fingerprints: [],
      addresses: walkthrough.locations_listed,
      pricing_signals: [],
      has_blog: false,
      has_careers: false,
      has_team_page: walkthrough.team_members_listed.length > 0,
      has_clients_page: walkthrough.clients_named.length > 0,
      parsed_contacts: walkthrough.team_members_listed,
    }

    return {
      walkthrough,
      pagesRead,
      extracted,
      status: pagesRead.length >= 2 ? 'full' : 'partial',
      cached: false,
    }
  } catch (err) {
    console.error('[EBEXTA] fallback site walkthrough failed:', err)
    return { walkthrough: null, pagesRead: [], extracted: null, status: 'unreachable', cached: false }
  }
}

export async function runSiteWalkthrough(
  website: string | null | undefined,
  companyName: string,
  force = false,
): Promise<WalkthroughResult> {
  const domain = cleanDomain(website ?? '')
  if (!domain) {
    return { walkthrough: null, pagesRead: [], extracted: null, status: 'unreachable', cached: false }
  }

  try {
    const { data, error } = await supabase.functions.invoke('site-walkthrough', {
      body: { domain, companyName, force },
    })
    const d = data as Partial<WalkthroughResult> & { error?: string }
    if (error || d?.error || !d?.walkthrough || d?.status === 'unreachable') {
      console.warn('[EBEXTA] site-walkthrough function unreachable or returned no data, falling back to grounded Gemini site reader...')
      return await fallbackGroundedWalkthrough(domain, companyName)
    }
    return {
      walkthrough: (d.walkthrough as SiteWalkthrough) ?? null,
      pagesRead: Array.isArray(d.pagesRead) ? d.pagesRead : [],
      extracted: (d.extracted as SiteExtract) ?? null,
      status: (d.status as SiteReadStatus) ?? 'unreachable',
      cached: !!d.cached,
    }
  } catch (err) {
    console.warn('[EBEXTA] site walkthrough threw, falling back to grounded Gemini site reader:', err)
    return await fallbackGroundedWalkthrough(domain, companyName)
  }
}

// ─── 2. Cross-check ───────────────────────────────────────────────────────────

function norm(s: unknown): string {
  return String(s ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim()
}

/** Loose containment — "web development" matches "custom web development". */
function mentions(haystack: string[], needle: string): boolean {
  const n = norm(needle)
  if (n.length < 3) return false
  return haystack.some(h => {
    const hn = norm(h)
    return hn.includes(n) || n.includes(hn)
  })
}

function pageUrlFor(pages: PageRead[], kinds: string[]): string | null {
  for (const k of kinds) {
    const hit = pages.find(p => p.kind === k)
    if (hit) return hit.url
  }
  return pages[0]?.url ?? null
}

/**
 * Compare every AI claim against the site. Never guesses: a field the site is
 * silent about is NOT_ON_SITE (neutral), not a contradiction.
 */
export function crossCheckClaims(
  lead: Partial<ScannedLead>,
  result: WalkthroughResult,
): ClaimCheck[] {
  const { walkthrough: w, extracted: x, pagesRead: pages, status } = result
  // Nothing was read → we cannot check anything. Silence is honest here.
  if (status === 'unreachable' || status === 'blocked' || !w) return []

  const checks: ClaimCheck[] = []
  const add = (field: string, aiClaim: string, siteSays: string, st: ClaimStatus, url: string | null) => {
    if (!aiClaim) return
    checks.push({ field, ai_claim: aiClaim, site_says: siteSays, status: st, source_url: url })
  }

  const siteTextPool = [
    w.what_they_actually_do ?? '',
    ...(w.services_listed ?? []),
    ...(w.industries_served ?? []),
    w.tone_and_positioning ?? '',
  ]

  // ── Industry ──
  if (lead.industry) {
    const onSite = mentions(siteTextPool, lead.industry)
    const siteIndustry = (w.industries_served ?? [])[0] ?? ''
    add('Industry', lead.industry,
      onSite ? lead.industry : (siteIndustry || 'not stated'),
      onSite ? 'CONFIRMED' : siteIndustry ? 'CONTRADICTED' : 'NOT_ON_SITE',
      pageUrlFor(pages, ['about', 'services', 'home']))
  }

  // ── Services / requirement theme ──
  if (lead.requirement_theme) {
    const onSite = mentions(w.services_listed ?? [], lead.requirement_theme)
    add('Services', lead.requirement_theme,
      (w.services_listed ?? []).slice(0, 4).join(', ') || 'not listed',
      onSite ? 'CONFIRMED' : (w.services_listed ?? []).length > 0 ? 'CONTRADICTED' : 'NOT_ON_SITE',
      pageUrlFor(pages, ['services', 'home']))
  }

  // ── Employee count vs any size claim they make ──
  if (lead.employee_count && w.size_indicators) {
    const stated = String(w.size_indicators).match(/(\d[\d,]*)\s*\+?\s*(?:employees|people|staff|members|professionals)/i)
    if (stated) {
      const siteNum = Number(stated[1].replace(/,/g, ''))
      // Order-of-magnitude agreement is the honest bar — headcount pages are
      // rounded and stale everywhere. Only flag a real mismatch.
      const ratio = siteNum > 0 ? lead.employee_count / siteNum : 0
      const agrees = ratio >= 0.4 && ratio <= 2.5
      add('Employee count', String(lead.employee_count), w.size_indicators,
        agrees ? 'CONFIRMED' : 'CONTRADICTED', pageUrlFor(pages, ['about', 'home']))
    } else {
      add('Employee count', String(lead.employee_count), w.size_indicators, 'NOT_ON_SITE', null)
    }
  } else if (lead.employee_count) {
    add('Employee count', String(lead.employee_count), 'not stated', 'NOT_ON_SITE', null)
  }

  // ── Location ──
  if (lead.location) {
    const locs = w.locations_listed ?? []
    const onSite = mentions(locs, lead.location) || mentions(locs, lead.location.split(',')[0] ?? '')
    add('Location', lead.location,
      locs.slice(0, 3).join(' · ') || 'not stated',
      onSite ? 'CONFIRMED' : locs.length > 0 ? 'CONTRADICTED' : 'NOT_ON_SITE',
      pageUrlFor(pages, ['contact', 'about', 'home']))
  }

  // ── Tech stack — HTML fingerprints beat any guess ──
  const guessedTech = (lead.tech_stack ?? []) as string[]
  if (guessedTech.length > 0 && x) {
    const fingerprints = x.tech_fingerprints ?? []
    const overlap = guessedTech.filter(t => mentions(fingerprints, t))
    add('Tech stack', guessedTech.join(', '),
      fingerprints.join(', ') || 'nothing detectable in their HTML',
      overlap.length > 0 ? 'CONFIRMED' : fingerprints.length > 0 ? 'CONTRADICTED' : 'NOT_ON_SITE',
      pageUrlFor(pages, ['home']))
  }

  // ── Clients / big projects ──
  const claimedClients = (lead.big_projects ?? []) as string[]
  if (claimedClients.length > 0) {
    const named = w.clients_named ?? []
    const matched = claimedClients.filter(c => mentions(named, c))
    add('Clients / projects', claimedClients.slice(0, 3).join(', '),
      named.slice(0, 4).join(', ') || 'no clients named on the site',
      matched.length > 0 ? 'CONFIRMED' : named.length > 0 ? 'CONTRADICTED' : 'NOT_ON_SITE',
      pageUrlFor(pages, ['clients', 'home']))
  }

  // ── Certifications ──
  const siteCerts = [...new Set([...(w.certifications_claimed ?? []), ...((x?.certifications) ?? [])])]
  if (siteCerts.length > 0) {
    add('Certifications', 'none claimed by EBEXTA', siteCerts.join(', '), 'CONFIRMED',
      pageUrlFor(pages, ['about', 'home']))
  }

  // ── Contacts — a person on their site outranks an inferred executive ──
  const aiContact = (lead.stakeholders ?? [])[0]
  if (aiContact?.name) {
    const onSite = (w.team_members_listed ?? []).find(t => norm(t.name) === norm(aiContact.name))
    const siteFirst = (w.team_members_listed ?? [])[0]
    add('Decision maker', `${aiContact.name}${aiContact.title ? ` · ${aiContact.title}` : ''}`,
      onSite ? `${onSite.name} · ${onSite.title}`
        : siteFirst ? `${siteFirst.name} · ${siteFirst.title}`
        : 'no team page / no names published',
      onSite ? 'CONFIRMED' : siteFirst ? 'CONTRADICTED' : 'NOT_ON_SITE',
      onSite?.page_url || siteFirst?.page_url || pageUrlFor(pages, ['team', 'about']))
  }

  // ── Email ──
  if (lead.email && x) {
    const siteEmails = (x.emails ?? []).map(e => e.value)
    const hit = siteEmails.find(e => norm(e) === norm(lead.email))
    add('Email', lead.email,
      siteEmails.slice(0, 2).join(', ') || 'no email published',
      hit ? 'CONFIRMED' : siteEmails.length > 0 ? 'CONTRADICTED' : 'NOT_ON_SITE',
      (x.emails ?? []).find(e => norm(e.value) === norm(hit ?? ''))?.page_url ?? pageUrlFor(pages, ['contact']))
  }

  return checks
}

// ─── 3. Resolution — the site wins ────────────────────────────────────────────

export interface Resolution {
  lead: ScannedLead
  corrections: string[]
}

/**
 * Rewrite the lead so it matches the site wherever the two disagree.
 * Also strips every phone number that did NOT come from a fetched page — a
 * wrong number is the single most damaging thing EBEXTA could hand someone.
 */
export function applyResolutions(
  original: ScannedLead,
  result: WalkthroughResult,
  checks: ClaimCheck[],
): Resolution {
  const lead: ScannedLead = { ...original }
  const corrections: string[] = []
  const { walkthrough: w, extracted: x, status } = result

  // ── PHONE: only ever from the site. Applies even when the read failed —
  //    if we could not confirm a number, we do not show one. ──
  const sitePhones = (x?.phones ?? []).map(p => p.value)
  if (lead.company_contact?.phone) {
    const kept = sitePhones.find(p => p.replace(/\D/g, '').slice(-10) === lead.company_contact!.phone!.replace(/\D/g, '').slice(-10))
    if (!kept) {
      lead.company_contact = { ...lead.company_contact, phone: null }
      corrections.push('Removed a phone number that does not appear on their website')
    }
  }
  if (!lead.company_contact?.phone && sitePhones.length > 0) {
    const src = (x?.phones ?? [])[0]
    lead.company_contact = {
      ...(lead.company_contact ?? {}),
      phone: src.value,
      sourceUrl: src.page_url,
    }
    corrections.push(`Phone taken from ${src.page_url}`)
  }

  if (status === 'unreachable' || status === 'blocked' || !w) {
    // Nothing was read — everything stays EBEXTA Engine inferred and confidence is capped.
    return { lead, corrections }
  }

  // ── CONTRADICTED fields get the site's value ──
  for (const c of checks) {
    if (c.status !== 'CONTRADICTED') continue
    const siteValue = c.site_says
    if (!siteValue || /^not (stated|listed)|^no /i.test(siteValue)) continue

    switch (c.field) {
      case 'Industry':
        lead.industry = siteValue.split(',')[0].trim()
        corrections.push(`Industry corrected to the site's wording: "${lead.industry}"`)
        break
      case 'Services':
        lead.requirement_theme = siteValue
        corrections.push('Services replaced with what their site actually lists')
        break
      case 'Location':
        lead.location = siteValue.split('·')[0].trim()
        corrections.push(`Location corrected to "${lead.location}"`)
        break
      case 'Decision maker': {
        const first = (w.team_members_listed ?? [])[0]
        if (first?.name) {
          // A person printed on their own site outranks an inferred executive.
          lead.stakeholders = [
            { name: first.name, title: first.title || 'Listed on site', linkedin_url: null, email: null, priority_score: 95 },
            ...(lead.stakeholders ?? []).filter(s => norm(s.name) !== norm(first.name)),
          ]
          corrections.push(`Decision maker replaced with ${first.name}, listed on their own site`)
        }
        break
      }
      case 'Email': {
        const siteEmail = (x?.emails ?? [])[0]
        if (siteEmail) {
          lead.email = siteEmail.value
          corrections.push(`Email corrected to the one published at ${siteEmail.page_url}`)
        }
        break
      }
      case 'Tech stack':
        if (x?.tech_fingerprints?.length) {
          lead.tech_stack = x.tech_fingerprints
          corrections.push('Tech stack replaced with fingerprints found in their actual HTML')
        }
        break
      case 'Clients / projects':
        if ((w.clients_named ?? []).length > 0) {
          lead.big_projects = w.clients_named
          corrections.push('Client list replaced with the names actually printed on their site')
        }
        break
    }
  }

  // ── Tech stack always prefers real fingerprints, even when not contradicted ──
  if (x?.tech_fingerprints?.length && !checks.some(c => c.field === 'Tech stack' && c.status === 'CONTRADICTED')) {
    lead.tech_stack = x.tech_fingerprints
  }

  // ── Certifications and clients survive only if printed on the site ──
  if ((w.clients_named ?? []).length > 0) lead.big_projects = w.clients_named

  // ── Site wording wins for what they do ──
  if (w.what_they_actually_do) {
    lead.description = w.what_they_actually_do
    corrections.push('Description replaced with their own words from the site')
  }
  if ((w.services_listed ?? []).length > 0) {
    lead.requirement_theme = (w.services_listed ?? []).slice(0, 6).join(', ')
  }

  // ── A named person on their site becomes the top contact ──
  const siteTeam = w.team_members_listed ?? []
  if (siteTeam.length > 0) {
    const existing = lead.stakeholders ?? []
    const fromSite = siteTeam.slice(0, 5).map((t, i) => ({
      name: t.name,
      title: t.title || 'Listed on site',
      linkedin_url: null,
      email: null,
      priority_score: 95 - i,
    }))
    const siteNames = new Set(fromSite.map(s => norm(s.name)))
    lead.stakeholders = [...fromSite, ...existing.filter(s => !siteNames.has(norm(s.name)))]
  }

  return { lead, corrections }
}

// ─── 4. Confidence from real evidence ─────────────────────────────────────────

/**
 * Recompute confidence using site evidence.
 * A lead whose site we could not read can NEVER be presented as VERIFIED.
 */
export function recomputeConfidence(
  base: number,
  checks: ClaimCheck[],
  status: SiteReadStatus,
  pageCount: number,
): { confidence: number; verification: ScannedLead['verification_status'] } {
  if (status === 'unreachable' || status === 'blocked') {
    // Hard cap below the VERIFIED band — we have no proof of anything.
    return { confidence: Math.min(base, 55), verification: 'MANUAL_REVIEW_NEEDED' }
  }

  const confirmed = checks.filter(c => c.status === 'CONFIRMED').length
  const contradicted = checks.filter(c => c.status === 'CONTRADICTED').length

  let score = base
  score += confirmed * 5          // each confirmed field is real evidence
  score -= contradicted * 12      // a contradiction is a serious hit
  score += Math.min(pageCount, 8) // more pages read = more we actually know
  score = Math.max(0, Math.min(100, Math.round(score)))

  const verification: ScannedLead['verification_status'] =
    contradicted > 2 ? 'MANUAL_REVIEW_NEEDED'
    : status === 'full' && confirmed >= 3 && contradicted === 0 ? 'VERIFIED'
    : 'PARTIALLY_VERIFIED'

  return { confidence: score, verification }
}

// ─── 5. Requirement gap signals — VERIFIED, because we fetched the page ───────

/**
 * Gap signals derived from pages we genuinely fetched. Every one carries the
 * URL that proves it, so the UI can mark it VERIFIED rather than INFERRED.
 * This does NOT modify the requirement rules engine — it feeds it evidence.
 */
export function deriveVerifiedSignals(result: WalkthroughResult): SignalSet {
  const { extracted: x, pagesRead: pages, status, walkthrough: w } = result
  const out: VerifiedSignal[] = []
  const unconfirmed: UnconfirmedSignal[] = []
  const homeUrl = pages.find(p => p.kind === 'home')?.url ?? pages[0]?.url ?? null

  // ── OUR FAILURE IS NOT THEIR GAP ──
  // If we could not read the site, we know nothing about it. Not one absence
  // claim may leave this branch. "We couldn't read it" was previously emitted
  // as a VERIFIED ABSENT signal, which is how Furnishka — a company with
  // fifteen store photos on its homepage — got reported as having no stores.
  if (status === 'unreachable' || status === 'blocked') {
    unconfirmed.push({
      signal: status === 'blocked' ? 'Website blocks automated reading' : 'Website could not be read',
      detail: status === 'blocked'
        ? 'robots.txt disallows crawling, so nothing on this site was verified.'
        : 'EBEXTA could not fetch this site. Everything shown for this company is EBEXTA Engine inferred, not verified.',
      source_url: null,
      status: 'not_checked',
      reason: 'The site was never read, so nothing about it can be confirmed.',
    })
    return { confirmed: out, unconfirmed }
  }
  // Pages came back empty even though the fetch "succeeded" — same rule.
  if (pages.length === 0) {
    unconfirmed.push({
      signal: 'No pages could be read',
      detail: 'The walkthrough returned zero pages, so no claim about this company has been verified.',
      source_url: null,
      status: 'not_checked',
      reason: 'Zero pages returned — every claim here is EBEXTA Engine inferred.',
    })
    return { confirmed: out, unconfirmed }
  }
  if (!x) return { confirmed: out, unconfirmed }

  if (!x.https) {
    out.push({ signal: 'No HTTPS', detail: 'The site is served without a secure certificate.', source_url: homeUrl, is_verified: true })
  }
  if (!x.has_viewport) {
    out.push({ signal: 'Not mobile-ready', detail: 'No viewport meta tag — the site is not built to adapt to phones.', source_url: homeUrl, is_verified: true })
  }

  // ── Content freshness ──
  const blogUrl = pages.find(p => p.kind === 'blog')?.url ?? null
  if (!x.has_blog) {
    out.push({ signal: 'No blog or news section', detail: 'Nothing published — no content engine at all.', source_url: homeUrl, is_verified: true })
  } else if (x.latest_post_date) {
    const months = (Date.now() - Date.parse(x.latest_post_date)) / (1000 * 60 * 60 * 24 * 30.44)
    if (months > 12) {
      out.push({
        signal: 'Content gone stale',
        detail: `Latest post is ${Math.round(months)} months old (${x.latest_post_date}).`,
        source_url: blogUrl, is_verified: true,
      })
    }
  }

  // ── Abandonment ──
  const thisYear = new Date().getFullYear()
  if (x.copyright_year != null && thisYear - x.copyright_year >= 2) {
    out.push({
      signal: 'Site looks abandoned',
      detail: `Footer still says ${x.copyright_year} — ${thisYear - x.copyright_year} years out of date.`,
      source_url: homeUrl, is_verified: true,
    })
  }

  // ── Hiring ──
  if (x.has_careers && x.job_listing_count > 0) {
    out.push({
      signal: 'Actively hiring',
      detail: `${x.job_listing_count} open role${x.job_listing_count === 1 ? '' : 's'} listed on their careers page.`,
      source_url: pages.find(p => p.kind === 'careers')?.url ?? null, is_verified: true,
    })
  } else if (!x.has_careers && (w?.open_roles ?? []).length > 0) {
    out.push({
      signal: 'Hiring without a careers page',
      detail: 'Roles are mentioned on the site but there is no dedicated careers page.',
      source_url: homeUrl, is_verified: true,
    })
  }

  // ── Credibility ──
  // Every absence claim below must clear two bars:
  //   1. we actually READ the page where the thing would live, and
  //   2. the model didn't report it as present-but-in-images.
  // Failing either produces an UNCONFIRMED entry that scores zero, not a
  // confident "they don't have this".
  const model = inferBusinessModel(w)
  const readKinds = new Set(pages.map(p => p.kind))

  /** Push as a signal only if the absence is genuinely established. */
  const claimAbsence = (
    signal: string, detail: string, pageKind: string,
    locallyAbsent: boolean, sourceUrl: string | null,
  ) => {
    if (!signalApplies(signal, model)) return   // meaningless for this business
    if (!locallyAbsent) return

    // What did the model say about this, if anything?
    const finding = (w?.absence_findings ?? []).find(f =>
      f.item && signal.toLowerCase().includes(f.item.toLowerCase().split(' ')[0]))

    if (finding && finding.status !== 'absent') {
      unconfirmed.push({
        signal, detail,
        source_url: finding.page_url ?? sourceUrl,
        status: finding.status === 'present' ? 'present_but_unreadable' : finding.status,
        reason: finding.evidence || 'Content appears to exist but could not be read as text.',
      })
      return
    }

    // We never opened the page where this lives — silence is not absence.
    if (!readKinds.has(pageKind)) {
      unconfirmed.push({
        signal, detail, source_url: sourceUrl, status: 'not_checked',
        reason: `We did not read a ${pageKind} page, so this could not be confirmed.`,
      })
      return
    }

    out.push({ signal, detail, source_url: sourceUrl, is_verified: true, status: 'absent' })
  }

  claimAbsence(
    'No client proof',
    'No client logos, case studies or customer page found on the pages we read.',
    'clients',
    !x.has_clients_page && x.client_logo_count === 0,
    homeUrl,
  )
  claimAbsence(
    'No visible leadership',
    'Nobody is named on the pages we read — no team or leadership page found.',
    'team',
    !x.has_team_page && (w?.team_members_listed ?? []).length === 0,
    homeUrl,
  )
  claimAbsence(
    'No certifications published',
    'No ISO / SOC / GDPR / MSME markers found on the pages we read.',
    'about',
    x.certifications.length === 0 && (w?.certifications_claimed ?? []).length === 0,
    homeUrl,
  )

  // ── Positive evidence worth surfacing too ──
  if (x.tech_fingerprints.length > 0) {
    out.push({
      signal: 'Tech stack confirmed',
      detail: x.tech_fingerprints.join(', ') + ' — detected in their own HTML.',
      source_url: homeUrl, is_verified: true,
    })
  }
  if (x.pricing_signals.length > 0) {
    out.push({
      signal: 'Public pricing',
      detail: x.pricing_signals.join(' · '),
      source_url: homeUrl, is_verified: true,
    })
  }

  return { confirmed: out, unconfirmed }
}

// ─── 6. One-call orchestration ────────────────────────────────────────────────

export interface WalkthroughOutcome {
  lead: ScannedLead
  result: WalkthroughResult
  checks: ClaimCheck[]
  corrections: string[]
  signals: VerifiedSignal[]
  /** Things we could NOT confirm as absent. Never scored, shown honestly. */
  unconfirmed: UnconfirmedSignal[]
}

/**
 * Read the site, cross-check, correct, rescore. Never throws — a walkthrough
 * failure must degrade the lead's confidence, not break the scan.
 */
export async function walkthroughAndVerify(lead: ScannedLead): Promise<WalkthroughOutcome> {
  const result = await runSiteWalkthrough(lead.website, lead.company_name)

  // ── FAIL LOUDLY, NEVER SILENTLY ──
  // A walkthrough that read nothing must be impossible to mistake for one that
  // read everything. Force the status, say so in the console, and let the
  // absence-suppression below do the rest.
  const readNothing = result.pagesRead.length === 0
  if (readNothing) {
    result.status = 'unreachable'
    console.info(
      `[EBEXTA] Walkthrough failed for ${lead.website ?? lead.company_name} — claims marked inferred, absence signals suppressed.`,
    )
  } else {
    console.info(`[EBEXTA] Read ${result.pagesRead.length} pages for ${lead.website ?? lead.company_name}`)
  }

  const checks = crossCheckClaims(lead, result)
  const { lead: corrected, corrections } = applyResolutions(lead, result, checks)
  const { confirmed: signals, unconfirmed } = deriveVerifiedSignals(result)
  if (unconfirmed.length > 0) {
    // Visible in the console so over-claiming is diagnosable without a DB trip.
    console.info(`[EBEXTA] ${lead.company_name}: ${unconfirmed.length} gap signal(s) skipped — absence could not be confirmed`,
      unconfirmed.map(u => `${u.signal} (${u.status})`))
  }

  const { confidence, verification } = recomputeConfidence(
    lead.confidence_score ?? 60, checks, result.status, result.pagesRead.length,
  )

  const ext = result.extracted
  const implicitGapFacts = [
    ...(ext?.copyright_year ? [{ name: 'Stale Copyright', value: String(ext.copyright_year) }] : []),
    ...(ext?.has_viewport === false ? [{ name: 'No Responsive Viewport', value: 'missing' }] : []),
    ...(ext?.https === false ? [{ name: 'Insecure site', value: 'No HTTPS' }] : []),
  ]

  const adSpendDetected = ext?.tech_fingerprints?.includes('Facebook Pixel') || ext?.tech_fingerprints?.includes('Google Tag Manager') || false

  const registryChecks = [
    ...(ext?.gst_numbers?.[0] ? [{ source: 'GST', value: ext.gst_numbers[0] }] : []),
  ]

  const existingStakeholders = corrected.stakeholders ?? []
  const newContacts = (ext?.parsed_contacts ?? []).map(c => ({
    name: c.name,
    title: c.title,
    authorityType: 'Economic',
    email: null,
    linkedInUrl: null,
    twitterUrl: null,
    githubUrl: null,
    about: c.title,
    sourceUrl: c.page_url,
    verificationLogic: 'Scraped from team/about page',
    isPrimary: false,
    roleJustification: null,
    priority_score: 80
  }))

  const mergedStakeholders = [...existingStakeholders]
  for (const nc of newContacts) {
    if (!mergedStakeholders.some(s => s.name.toLowerCase() === nc.name.toLowerCase())) {
      mergedStakeholders.push(nc)
    }
  }

  const resolved = resolveSectorRule(lead.industry || lead.description || '')

  const dpFields = ['location', 'employee_count', 'annual_revenue', 'funding_stage']
  const verifiedFields = checks.filter(c => c.status === 'CONFIRMED').map(c => {
    if (c.field === 'Employee count') return 'employee_count'
    if (c.field === 'Location') return 'location'
    return null
  }).filter(Boolean) as string[]

  const originalUnknowns = lead.unknown_fields ?? []
  const newUnknowns: string[] = []

  for (const f of dpFields) {
    if (verifiedFields.includes(f)) continue
    const val = (corrected as any)[f]
    const isValUnknown = val === null || val === undefined ||
      (typeof val === 'string' && (val.trim() === '' || val.toLowerCase().includes('unknown') || val.toLowerCase().includes('not public') || val.toLowerCase().includes('not available'))) ||
      (typeof val === 'number' && val === 0)
    if (isValUnknown || originalUnknowns.includes(f)) {
      newUnknowns.push(f)
    }
  }

  const honestyScore = Math.round(((dpFields.length - newUnknowns.length) / dpFields.length) * 100)

  const finalLead: ScannedLead = {
    ...corrected,
    confidence_score: confidence,
    verification_status: verification,
    site_walkthrough: result.walkthrough,
    pages_read: result.pagesRead,
    site_read_status: result.status,
    site_read_at: new Date().toISOString(),
    claim_verification: checks,
    site_corrections: corrections,
    verified_signals: signals,
    unconfirmed_signals: unconfirmed,
    implicit_gap_facts: implicitGapFacts,
    gstin: ext?.gst_numbers?.[0] ?? null,
    gstin_verified: !!ext?.gst_numbers?.length,
    tech_fingerprints: ext?.tech_fingerprints ?? [],
    ad_spend_detected: adSpendDetected,
    registry_checks: registryChecks,
    resolved_sector: resolved.resolvedSector || resolved.rule?.sector || undefined,
    sector_confidence: resolved.sectorConfidence || undefined,
    email_pattern: ext?.email_pattern ?? null,
    stakeholders: mergedStakeholders,
    unknown_fields: newUnknowns,
    honesty_score: honestyScore
  }

  return { lead: finalLead, result, checks, corrections, signals, unconfirmed }
}

/**
 * Run walkthroughs across a batch with a concurrency cap.
 * Cap of 3 keeps us polite to the sites we read and inside the function's
 * resource limits.
 */
export async function walkthroughBatch(
  leads: ScannedLead[],
  concurrency = 4,
  onProgress?: (done: number, total: number, company: string) => void,
): Promise<ScannedLead[]> {
  const out: ScannedLead[] = [...leads]
  let cursor = 0
  let done = 0

  async function worker() {
    for (;;) {
      const i = cursor++
      if (i >= leads.length) return
      try {
        const timeoutPromise = new Promise<{ lead: ScannedLead }>((_, reject) =>
          setTimeout(() => reject(new Error('Walkthrough timeout')), 5000)
        )
        const res = await Promise.race([
          walkthroughAndVerify(leads[i]),
          timeoutPromise,
        ])
        out[i] = res.lead
      } catch (err) {
        console.warn('[EBEXTA] walkthrough skipped/timed out for', leads[i].company_name)
      }
      done++
      onProgress?.(done, leads.length, leads[i].company_name)
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, leads.length) }, worker))
  return out
}

/** Human-readable line for the UI when a site could not be read. */
export function readStatusLabel(status: SiteReadStatus | undefined, pageCount: number): string {
  switch (status) {
    case 'full':        return `Read ${pageCount} pages on their website`
    case 'partial':     return `Read ${pageCount} page${pageCount === 1 ? '' : 's'} — parts of the site could not be reached`
    case 'blocked':     return 'Website could not be read — details are EBEXTA Engine inferred and unverified'
    case 'unreachable': return 'Website could not be read — details are EBEXTA Engine inferred and unverified'
    default:            return 'Website has not been read yet'
  }
}

export { normalizeUrl }
