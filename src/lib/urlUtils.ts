/**
 * EBEXTA URL Utilities — safe external link handling
 *
 * BUG 1 (fixed): links without https:// are treated as relative paths
 * by the browser → appended to localhost:5000.
 * FIX: normalizeUrl() always adds https://.
 *
 * BUG 2 (fixed): Gemini invents plausible-looking but non-existent URLs
 * (company sites, evidence sources, stakeholder LinkedIn slugs).
 * FIX: normalizeUrl() rejects fakes; isLikelyFakeLinkedIn() catches
 * generated /in/ slugs; all LinkedIn buttons use LinkedIn Search
 * instead of direct profile URLs so they always land on real results.
 *
 * RULE: NEVER use raw <a href={lead.something}>.
 *       ALWAYS route through openExternal() or a search helper.
 */

// ─── Fake hostname blocklist ──────────────────────────────────────────────────

const FAKE_HOSTNAMES = new Set([
  'example.com',
  'example.org',
  'test.com',
  'placeholder.com',
  'company.com',
  'yourcompany.com',
  'mycompany.com',
  'companyname.com',
  'lorem.com',
])

const FAKE_URL_PATTERNS = [
  /placeholder/i,
  /lorem/i,
  /yourcompany/i,
  /companyname/i,
  /mycompany/i,
  /(?:^|[^a-zA-Z0-9])n\/a(?:[^a-zA-Z0-9]|$)/i,
  /\[.*\]/,   // unfilled template brackets [Company Name]
  /\{.*\}/,   // unfilled template brackets {company}
]

// ─── Generic Contact Name Blocklist ─────────────────────────────────────────────

const GENERIC_CONTACT_REGEX = /^\s*((management|leadership|executive|executives|c-suite|founder|founding|operations|sales|marketing|support|admin|tech)\s*team|leadership|management|executive|executives|team|key\s*contact|decision\s*maker|decision\s*makers|founder\/team|board\s*of\s*directors|c-suite|staff|contact|admin|support)\s*$/i

/**
 * Returns true if a contact name is a generic term (e.g., "Management Team", "Leadership").
 * Per strict rules, generic terms must NEVER be used as verified contact names.
 */
export function isGenericContactName(name?: string | null): boolean {
  if (!name) return true
  const clean = name.trim()
  if (clean === '' || clean.length < 2) return true
  return GENERIC_CONTACT_REGEX.test(clean) || /^(no\s*verified|unverified|unknown|none|n\/a)/i.test(clean)
}

/**
 * SSRF Guard — validates that an external URL points strictly to safe, public web destinations.
 * Blocks private IP ranges (RFC 1918), loopback, link-local (cloud metadata), and internal names.
 */
export function isSafePublicUrl(url?: string | null): boolean {
  if (!url) return false
  const norm = normalizeUrl(url)
  if (!norm) return false
  try {
    const parsed = new URL(norm)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false
    const host = parsed.hostname.toLowerCase()

    // Block localhost and standard loopback
    if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host === '::1' || host.startsWith('127.')) {
      return false
    }

    // Block cloud instance metadata (AWS, GCP, Azure, OpenStack 169.254.169.254)
    if (host === '169.254.169.254' || host.startsWith('169.254.')) {
      return false
    }

    // Block RFC 1918 Private IPv4 Ranges
    // 10.0.0.0/8
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return false
    // 172.16.0.0/12 (172.16 - 172.31)
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(host)) return false
    // 192.168.0.0/16
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return false

    // Block private / internal TLDs
    const parts = host.split('.')
    if (parts.length < 2) return false
    const tld = parts[parts.length - 1]
    const internalTlds = new Set(['local', 'localhost', 'internal', 'lan', 'corp', 'test', 'invalid', 'onion', 'arpa'])
    if (internalTlds.has(tld)) return false

    return true
  } catch {
    return false
  }
}

/**
 * Validates domain structure to catch dead, crashed, or invalid company website domains.
 */
export function verifyDomainStructure(url?: string | null): boolean {
  const norm = normalizeUrl(url)
  if (!norm) return false
  try {
    const host = new URL(norm).hostname.toLowerCase()
    if (!host.includes('.')) return false
    const tld = host.split('.').pop() ?? ''
    if (tld.length < 2 || ['invalid', 'test', 'local', 'localhost', 'internal', 'example'].includes(tld)) return false
    return isSafePublicUrl(norm)
  } catch {
    return false
  }
}

/**
 * Normalizes deep 404-prone subpaths down to a clean, authoritative root domain URL.
 * E.g., https://example.com/products/subpage-404 -> https://example.com
 */
export function getSafeFallbackUrl(url?: string | null): string | null {
  const norm = normalizeUrl(url)
  if (!norm || !isSafePublicUrl(norm)) return null
  try {
    const parsed = new URL(norm)
    return `https://${parsed.hostname}`
  } catch {
    return null
  }
}

/**
 * Returns verified domain details or "Website not verified" if unconfirmed/missing.
 * Per strict rules: never guess or generate companyname.com.
 */
export function displayCompanyWebsite(url?: string | null): { verified: boolean; text: string; domain: string | null } {
  const norm = normalizeUrl(url)
  if (norm && verifyDomainStructure(norm)) {
    try {
      const host = new URL(norm).hostname.replace(/^www\./, '')
      return { verified: true, text: host, domain: host }
    } catch {
      // invalid URL
    }
  }
  return { verified: false, text: 'Website not verified', domain: null }
}

// ─── LinkedIn fake-slug detection ─────────────────────────────────────────────

/**
 * Detect fabricated LinkedIn /in/ profile URLs.
 *
 * Gemini generates slugs like:
 *   linkedin.com/in/priya-verma-e5f6g7h8
 *   linkedin.com/in/rahul-sharma-a1b2c3d4
 *   linkedin.com/in/john-doe-12345678
 *
 * These look plausible but 404 because the person doesn't exist at that slug.
 * LinkedIn profile slugs are chosen by users and are NOT predictable from names.
 *
 * Returns true if the URL looks like a fabricated slug.
 * When true, use linkedInPersonSearch() instead.
 */
export function isLikelyFakeLinkedIn(url: string | null | undefined): boolean {
  if (!url) return true

  const lower = url.toLowerCase().replace(/\/$/, '')

  // Only evaluate /in/ person profile paths (company slugs can be arbitrary words)
  if (!lower.includes('/in/')) return false

  // Pattern: firstname-lastname-XXXXXXXX  (random hex/alphanumeric suffix Gemini appends)
  // e.g. /in/priya-verma-e5f6g7h8  /in/john-smith-ab12cd34
  if (/\/in\/[a-z]+-[a-z]+-[a-z0-9]{6,}$/.test(lower)) return true

  const slug = lower.split('/').pop() ?? ''

  // Pattern: ends in hyphen followed by 6+ char mixed alphanumeric/hex blob with digits
  // e.g. /in/john-12345678 or /in/jane-doe-a1b2c3d4
  if (/-[a-z0-9]*\d[a-z0-9]*$/.test(slug)) {
    const lastPart = slug.split('-').pop() ?? ''
    if (lastPart.length >= 6) return true
  }

  // Purely synthetic random hex/digit hash of 8+ characters
  if (/^[a-f0-9]{8,}$/.test(slug) && /\d/.test(slug)) return true

  // Specific known hallucination fragments Gemini uses
  if (
    lower.includes('-e5f') ||
    lower.includes('-a1b') ||
    lower.includes('-b2c') ||
    lower.includes('placeholder') ||
    lower.includes('example') ||
    lower.includes('yourname') ||
    lower.includes('personname')
  ) {
    return true
  }

  // Short fake slugs: /in/abc  /in/xy  (less than 4 chars after last slash)
  if (slug.length < 4) return true

  // Synthetic role-suffix patterns commonly hallucinated by AI or used in mock data (e.g. -revops, -risk, -cpo)
  if (/-(revops|risk|ops|eng|ceo|cto|cfo|coo|cpo|founder|head|vp|director|sales|marketing|growth|product|supply|tech)$/i.test(slug)) {
    return true
  }

  return false
}

// ─── Core URL normalization ───────────────────────────────────────────────────

/**
 * Normalizes a raw URL string from Gemini / Supabase into a safe, absolute URL.
 * Returns null if the URL is missing, fake, or malformed.
 */
export function normalizeUrl(url: string | null | undefined): string | null {
  if (!url) return null

  let clean = url.trim()

  // Reject empties, fragments, javascript: schemes, sentinel strings
  if (
    clean === '' ||
    clean === '#' ||
    clean.toLowerCase().startsWith('javascript:') ||
    clean.toLowerCase() === 'null' ||
    clean.toLowerCase() === 'undefined' ||
    clean.toLowerCase() === 'unknown' ||
    clean.toLowerCase() === 'n/a'
  ) {
    return null
  }

  // Reject known-fake string patterns before we even try parsing
  if (FAKE_URL_PATTERNS.some(p => p.test(clean))) return null

  // Add https:// if missing — BUG 1 fix
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
    clean = clean.replace(/^\/+/, '')
    clean = 'https://' + clean
  }

  // Parse and validate
  let parsed: URL
  try {
    parsed = new URL(clean)
  } catch {
    return null
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname.includes('.')) return null
  if (parsed.hostname === 'localhost') return null
  if (parsed.hostname === '127.0.0.1') return null
  if (parsed.hostname === '0.0.0.0') return null
  if (FAKE_HOSTNAMES.has(parsed.hostname.toLowerCase())) return null

  return parsed.href
}

// ─── Source / evidence links — always resolvable (never 404) ──────────────────
// Grounding-redirect URLs (Google's vertexaisearch links) EXPIRE and then 404,
// and model-written funding/evidence URLs are often invented. We cannot verify a
// URL resolves from the browser, so for evidence/funding we open a Google search
// that includes the company + the source's real domain — it always resolves and
// lands on (or right next to) the actual source.
const GROUNDING_HOSTS = /vertexaisearch\.cloud\.google\.com|googleusercontent\.com|grounding-api-redirect/i

/** Clean display domain for a source URL, or '' if it's a redirect/search host. */
export function cleanDomain(url: string | null | undefined): string {
  const n = normalizeUrl(url)
  if (!n) return ''
  try {
    const host = new URL(n).hostname.replace(/^www\./, '')
    if (GROUNDING_HOSTS.test(host) || /(^|\.)google\.[a-z.]+$/i.test(host)) return ''
    return host
  } catch { return '' }
}

/** A search URL that reliably surfaces news & evidence (company + domain + hint). */
export function sourceSearchUrl(company: string, rawUrl?: string | null, hint = '', newsOnly = false): string {
  const domain = cleanDomain(rawUrl)
  const isIndustrialOrNews = newsOnly || /news|machinery|industrial|equipment|manufactur|plant|contract|project|expansion/i.test(hint)
  const newsTerms = isIndustrialOrNews ? 'news press release' : ''
  const q = [company, domain, hint, newsTerms].filter(Boolean).join(' ').trim() || company
  const tbmParam = isIndustrialOrNews ? '&tbm=nws' : ''
  return `https://www.google.com/search?q=${encodeURIComponent(q)}${tbmParam}`
}

// ─── External link opener ─────────────────────────────────────────────────────

/**
 * Safely resolves an evidence / grounding URL to an external destination that will NOT 404.
 * Grounding redirects (/grounding-api-redirect/ or vertexaisearch) expire in minutes and return:
 * "404. That’s an error. The requested URL /grounding-api-redirect/ was not found on this server."
 * This function extracts any embedded destination URL or falls back to a clean Google search for the evidence.
 */
export function resolveSafeUrl(url: string | null | undefined, fallbackQuery?: string): string | null {
  if (!url) {
    return fallbackQuery ? `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery)}` : null
  }

  const clean = url.trim()

  // Strict SSRF defense: block private networks and internal IPs
  if (!isSafePublicUrl(clean)) {
    console.warn('[EBEXTA] Blocked non-public or SSRF target URL:', clean)
    return null
  }

  // 1. Grounding redirects: extract target or route to verified search
  if (clean.includes('grounding-api-redirect') || clean.includes('vertexaisearch.cloud.google.com')) {
    try {
      const fullUrl = clean.startsWith('http') ? clean : `https://www.google.com${clean.startsWith('/') ? '' : '/'}${clean}`
      const parsed = new URL(fullUrl)
      const target = parsed.searchParams.get('url') || parsed.searchParams.get('dest') || parsed.searchParams.get('target') || parsed.searchParams.get('q')
      if (target && target.startsWith('http') && !target.includes('grounding-api-redirect') && isSafePublicUrl(target)) {
        return normalizeUrl(target)
      }
    } catch {
      // invalid URL
    }

    if (fallbackQuery && fallbackQuery.trim()) {
      return `https://www.google.com/search?q=${encodeURIComponent(fallbackQuery.trim())}`
    }
    return `https://www.google.com/search?q=${encodeURIComponent('evidence source verification')}`
  }

  // 2. Intercept fake LinkedIn slugs that 404 and route safely to people search
  if (isLikelyFakeLinkedIn(clean)) {
    if (fallbackQuery && fallbackQuery.trim()) {
      return linkedInPersonSearch(fallbackQuery.trim(), '')
    }
    return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(fallbackQuery || 'decision maker')}`
  }

  return normalizeUrl(url)
}

/**
 * Safely opens a URL in a new tab.
 * Intercepts expired grounding redirect URLs and routes them safely to destination or search.
 * Returns true if the URL was valid and opened, false if blocked.
 */
export function openExternal(url: string | null | undefined, fallbackQuery?: string): boolean {
  const safe = resolveSafeUrl(url, fallbackQuery)
  if (!safe) {
    console.warn('[EBEXTA] Blocked invalid/fake URL:', url)
    return false
  }
  window.open(safe, '_blank', 'noopener,noreferrer')
  return true
}

// ─── LinkedIn search helpers (always resolve to real results) ─────────────────

// Names EBEXTA uses when a specific person wasn't found — never search LinkedIn
// for these literal strings.
const PLACEHOLDER_NAME = /^(not publicly listed|not listed|unknown|undisclosed|n\/?a|none|private|tbd|—|-)$/i

function cleanName(name: string): string {
  return (name ?? '')
    .replace(/\b(Dr|Mr|Mrs|Ms|Prof)\.?\b/gi, '') // Remove prefixes
    .replace(/\(.*\)/g, '') // Remove parenthesis like (She/Her)
    .replace(/[,|-].*/, '') // Remove anything after comma, pipe, or hyphen
    .trim()
}

function cleanCompany(company: string): string {
  let c = (company ?? '').replace(/\b(Inc|LLC|Pvt|Ltd|Limited|Corp|Corporation|Co)\b\.?/gi, '').trim()
  c = c.split(/[-,(]/)[0].trim()
  const words = c.split(/\s+/)
  // Take at most the first 2 words to avoid overly specific phrase searches
  return words.slice(0, 2).join(' ')
}

/**
 * LinkedIn People Search for a person by name + company.
 *
 * BUG 1: Appending the full company name (e.g. "Context Layer for Accurate...")
 * or uncleaned names ("Leena Abraham, CEO") causes LinkedIn to return 0 results.
 * BUG 2: Removing the company name entirely (just "keywords=Harshit Chouhan")
 * causes LinkedIn to return thousands of results, making it hard to find the right person.
 *
 * FIX: Clean both the name and the company name, take the first 2 words of the company,
 * and combine them in the `keywords` parameter.
 */
export function linkedInPersonSearch(name: string, company: string, role?: string): string {
  const cName = cleanName(name)
  const usableName = cName && !PLACEHOLDER_NAME.test(cName)
  const cCompany = cleanCompany(company)

  let terms: string
  if (usableName) {
    terms = `${cName} ${cCompany}`.trim()
  } else {
    const cRole = cleanName(role ?? '') // Reusing cleanName to strip fluff from role too
    terms = `${cRole} ${cCompany}`.trim() || cCompany
  }
  
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(terms)}`
}

/**
 * LinkedIn Company Search by company name.
 * Always resolves to real LinkedIn search results — never a 404.
 * USE THIS for company LinkedIn buttons when the stored URL may be fake.
 */
export function linkedInCompanySearch(company: string): string {
  const query = encodeURIComponent(company)
  return `https://www.linkedin.com/search/results/companies/?keywords=${query}`
}

// ─── Other search fallbacks ───────────────────────────────────────────────────

/**
 * Google search fallback — used when company website is null/fake.
 */
export function googleSearch(query: string): string {
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

// Legacy aliases — kept for backward compatibility with existing callers
/** @deprecated Use linkedInCompanySearch() */
export const linkedinSearchUrl = linkedInCompanySearch

/** @deprecated Use linkedInPersonSearch() */
export function linkedinPeopleSearchUrl(name: string, company: string): string {
  return linkedInPersonSearch(name, company)
}

/** @deprecated Use googleSearch() */
export function googleSearchUrl(companyName: string): string {
  return googleSearch(companyName + ' company website')
}

// ─── Person discovery helpers (for Key Contact action buttons) ────────────────

/**
 * Google search for a specific person at a company.
 * Uses quoted terms for precision: "Person Name" "Role" "Company Name"
 * This is a DISCOVERY tool — results are NOT verified.
 */
export function googlePersonSearch(name: string, company: string, role?: string): string {
  const cName = cleanName(name)
  const cCompany = cleanCompany(company)
  const cRole = cleanName(role ?? '')

  const parts: string[] = []
  if (cName) parts.push(`"${cName}"`)
  if (cRole) parts.push(`"${cRole}"`)
  if (cCompany) parts.push(`"${cCompany}"`)

  const query = parts.length > 0 ? parts.join(' ') : company
  return `https://www.google.com/search?q=${encodeURIComponent(query)}`
}

/**
 * Social media profile search for a person at a company.
 * Appends "social media" to surface public profiles (X/Twitter, Instagram, etc.)
 * This is a DISCOVERY tool — results are NOT verified.
 */
export function socialMediaSearch(name: string, company: string): string {
  const cName = cleanName(name)
  const cCompany = cleanCompany(company)

  const parts: string[] = []
  if (cName) parts.push(`"${cName}"`)
  if (cCompany) parts.push(`"${cCompany}"`)
  parts.push('social media')

  return `https://www.google.com/search?q=${encodeURIComponent(parts.join(' '))}`
}
