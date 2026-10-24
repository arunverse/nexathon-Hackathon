/**
 * EBEXTA Link Verifier — trust layer for all external URLs
 *
 * Rules (from build brief):
 * - NEVER show a broken/fake/404 link next to a VERIFIED lead
 * - Classify links before surfacing them in the UI
 * - If a link cannot be confirmed as reachable, show a safe fallback
 *
 * Approach:
 * 1. Format check — is this a valid URL at all?
 * 2. Fake-pattern rejection — catch hallucinated/placeholder URLs
 * 3. HEAD request attempt — confirm reachability (best-effort; CORS will block many)
 * 4. Return typed LinkStatus so UI can decide what to render
 */

export type LinkStatus =
  | 'verified'       // passed format + fake-check + HEAD returned 2xx/3xx
  | 'unverified'     // passed format + fake-check, but HEAD blocked by CORS or timed out
  | 'fake'           // failed fake-pattern check
  | 'invalid'        // failed URL format check
  | 'broken'         // HEAD returned 4xx / 5xx

export interface VerifiedLink {
  url: string
  status: LinkStatus
  label: string      // display text
  safeToShow: boolean  // true for verified + unverified only
  fallbackUrl?: string // safe root domain or search URL if original fails
  lastCheckedAt?: string // validation timestamp
}

// ─── Fake / hallucination patterns ──────────────────────────────────────────

const FAKE_PATTERNS = [
  /example\.com/i,
  /example\.org/i,
  /test\.com/i,
  /placeholder/i,
  /localhost/i,
  /127\.0\.0\.1/,
  /0\.0\.0\.0/,
  // Obviously synthetic LinkedIn slugs
  /linkedin\.com\/in\/ceo-[a-z]+-[0-9]+$/i,
  /linkedin\.com\/in\/founder-of-[a-z]/i,
  /linkedin\.com\/company\/your-company/i,
  // AI-generated URL patterns
  /yourcompany/i,
  /companyname/i,
  /mycompany/i,
  /\[.*\]/,  // square brackets in URL = template not filled
  /\{.*\}/,  // curly brackets = template not filled
  // Very short fake slugs
  /linkedin\.com\/(in|company)\/[a-z]{1,3}$/i,
]

const DISPOSABLE_EMAIL_DOMAINS = [
  'mailinator.com', 'guerrillamail.com', 'tempmail.com', 'throwaway.email',
  'yopmail.com', 'sharklasers.com', 'mailnull.com', 'example.com',
]

// ─── Core validation ──────────────────────────────────────────────────────────

import { isSafePublicUrl, isLikelyFakeLinkedIn, getSafeFallbackUrl } from './urlUtils'

function isValidUrl(raw: string): boolean {
  if (!raw || typeof raw !== 'string') return false
  const trimmed = raw.trim()
  if (trimmed.length < 4) return false
  try {
    const url = new URL(trimmed)
    return (url.protocol === 'http:' || url.protocol === 'https:') && isSafePublicUrl(trimmed)
  } catch {
    return false
  }
}

function isFakeUrl(raw: string): boolean {
  return FAKE_PATTERNS.some(pattern => pattern.test(raw))
}

export function isValidEmail(raw: string | null | undefined): boolean {
  if (!raw) return false
  const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
  if (!emailRe.test(raw)) return false
  const domain = raw.split('@')[1]?.toLowerCase() ?? ''
  return !DISPOSABLE_EMAIL_DOMAINS.some(d => domain === d || domain.endsWith(`.${d}`))
}

// ─── Reachability is a SERVER-SIDE question ───────────────────────────────────
//
// This used to fetch the company's URL straight from the browser. That can
// never work: the Content Security Policy pins connect-src to 'self' and
// Supabase, and even without a CSP, cross-origin CORS would block it. Every
// such call failed, and a silent failure that looks like a verdict is the most
// dangerous kind of bug this codebase can have.
//
// Reachability now comes from the site-walkthrough Edge Function, which fetches
// server-side where no CSP or CORS applies. Nothing in the browser may ever
// fetch an external domain again — the CSP is correct; the old code was wrong.

// ─── Main verifier ────────────────────────────────────────────────────────────

export function verifyLink(
  raw: string | null | undefined,
  label: string,
  siteReadStatus?: string | null,
): VerifiedLink {
  const url = (raw ?? '').trim()
  const now = new Date().toISOString()

  if (!isValidUrl(url)) {
    return { url, status: 'invalid', label, safeToShow: false, lastCheckedAt: now }
  }

  if (isFakeUrl(url)) {
    return { url, status: 'fake', label, safeToShow: false, lastCheckedAt: now }
  }

  if (label.toLowerCase().includes('linkedin') && isLikelyFakeLinkedIn(url)) {
    return { url, status: 'fake', label, safeToShow: false, lastCheckedAt: now }
  }

  const fallbackUrl = getSafeFallbackUrl(url) ?? undefined

  // If server-side walkthrough explicitly proved this domain 404 or unreachable,
  // classify it as broken so the UI warns the user rather than giving a dead link.
  if (siteReadStatus === 'unreachable') {
    return { url, status: 'broken', label, safeToShow: false, fallbackUrl, lastCheckedAt: now }
  }

  if (siteReadStatus === 'full' || siteReadStatus === 'partial') {
    return { url, status: 'verified', label, safeToShow: true, fallbackUrl, lastCheckedAt: now }
  }

  return { url, status: 'unverified', label, safeToShow: true, fallbackUrl, lastCheckedAt: now }
}

/**
 * Batch-verify all links for a lead.
 * Returns results keyed by field name.
 */
export function verifyLeadLinks(lead: {
  website?: string | null
  linkedin_url?: string | null
  evidence_source_url?: string | null
  email?: string | null
  site_read_status?: string | null
}): Record<string, VerifiedLink> {
  const website = verifyLink(lead.website, 'Website', lead.site_read_status)
  const linkedin = verifyLink(lead.linkedin_url, 'LinkedIn')
  const evidence = verifyLink(lead.evidence_source_url, 'Evidence Source')

  const emailStatus = (isValidEmail(lead.email) ? 'unverified' : 'fake') as LinkStatus

  return {
    website,
    linkedin,
    evidence,
    email: {
      url: lead.email ?? '',
      status: emailStatus,
      label: 'Email',
      safeToShow: emailStatus === 'unverified' || emailStatus === 'verified',
    },
  }
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

/** Returns the icon name (Material Symbols) for a given link status */
export function linkStatusIcon(status: LinkStatus): string {
  switch (status) {
    case 'verified':   return 'verified'
    case 'unverified': return 'help'
    case 'broken':     return 'link_off'
    case 'fake':       return 'gpp_bad'
    case 'invalid':    return 'block'
  }
}

/** Returns the colour for a given link status */
export function linkStatusColor(status: LinkStatus): string {
  switch (status) {
    case 'verified':   return 'var(--accent)'
    case 'unverified': return 'rgba(245,158,11,0.8)'
    case 'broken':     return '#EF4444'
    case 'fake':       return '#EF4444'
    case 'invalid':    return 'var(--text-muted)'
  }
}

/** Returns a short human-readable label */
export function linkStatusLabel(status: LinkStatus): string {
  switch (status) {
    case 'verified':   return 'Reachable'
    case 'unverified': return 'Not confirmed'
    case 'broken':     return 'Broken link'
    case 'fake':       return 'Fake / AI-generated'
    case 'invalid':    return 'Invalid URL'
  }
}
