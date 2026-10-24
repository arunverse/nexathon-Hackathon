// ─── EBEXTA Deep Site Walkthrough (Edge Function) ─────────────────────────────
// Reads a company's ACTUAL website and derives intel from what is genuinely
// published there. Gemini's role here is reader-and-summariser of pages WE
// fetched — never a source of remembered facts.
//
// Why this must be server-side: a browser cannot fetch third-party sites (CORS)
// and cannot honour robots.txt. This function does both.
//
// Deploy:  supabase functions deploy site-walkthrough
// Secrets: reuses GEMINI_API_KEY (already set for the `gemini` function)
//
// Request:  { domain: string, companyName?: string, force?: boolean }
// Response: { walkthrough, pagesRead, extracted, status, cached }
//
// This function is standalone: it does NOT modify or call the existing
// `gemini` function, and touches no existing table beyond INSERTing api_usage.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ═══════════════════════════════════════════════════════════════════════════
// CORS — ONE ALLOWLIST, COPIED VERBATIM INTO EVERY EDGE FUNCTION
//
// This block is byte-identical in credits, gemini, site-walkthrough and
// account. It is duplicated rather than imported from _shared/cors.ts on
// purpose: the Supabase Dashboard function editor deploys a SINGLE file, and a
// _shared import would fail there. _shared/cors.ts is the reference copy — if
// you change one, change them all.
//
// You should rarely need to. To allow a new origin WITHOUT redeploying
// anything, add it to the ALLOWED_ORIGINS secret (comma-separated) under
// Edge Functions → Secrets. It is merged with the list below and applies to
// every function at once.
//
// Never "*". The Supabase JWT is the real auth gate; this is defence in depth.
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_ALLOWED = [
  // Production
  'https://ebexta.com', 'https://www.ebexta.com',
  'https://webexta.com', 'https://www.webexta.com',
  // Local development. vite.config.ts pins the dev server to port 8000
  // (strictPort), so that is the one that actually matters day to day. The
  // others are kept for preview builds and older setups.
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:4000', 'http://127.0.0.1:4000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:3000', 'http://127.0.0.1:3000',
]
function allowedOrigins(): string[] {
  const fromEnv = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])]
}
function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin') ?? ''
  if (!origin) return true
  const allow = allowedOrigins()
  if (allow.includes(origin)) return true
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    if (host === 'ebexta.com' || host.endsWith('.ebexta.com')) return true
    if (host === 'webexta.com' || host.endsWith('.webexta.com')) return true
    if (host.endsWith('.vercel.app')) return true
    if (host === 'localhost' || host === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}
function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = isOriginAllowed(req)
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'https://ebexta.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  }
}
function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

// ════════════════════════════════════════════════════════════════════════════
// CONFIG
// ════════════════════════════════════════════════════════════════════════════

const MAX_PAGES = 8
const PAGE_TIMEOUT_MS = 10_000
const TOTAL_BUDGET_MS = 20_000        // hard cap per company
const CACHE_DAYS = 30
const MAX_TEXT_CHARS = 15_000
const UA = 'Mozilla/5.0 (compatible; EBEXTA-SiteReader/1.0; +https://webexta.com)'

/** Priority paths, grouped. One hit per group is enough. */
const PATH_GROUPS: Array<{ kind: PageKind; paths: string[] }> = [
  { kind: 'home',     paths: ['/'] },
  { kind: 'about',    paths: ['/about', '/about-us', '/company', '/who-we-are'] },
  { kind: 'services', paths: ['/services', '/solutions', '/products', '/what-we-do'] },
  { kind: 'contact',  paths: ['/contact', '/contact-us'] },
  { kind: 'team',     paths: ['/team', '/leadership', '/people', '/management'] },
  { kind: 'clients',  paths: ['/clients', '/customers', '/case-studies', '/portfolio', '/work'] },
  { kind: 'careers',  paths: ['/careers', '/jobs', '/join-us'] },
  { kind: 'blog',     paths: ['/blog', '/news', '/press', '/media'] },
]

type PageKind = 'home' | 'about' | 'services' | 'contact' | 'team' | 'clients' | 'careers' | 'blog'
type ReadStatus = 'full' | 'partial' | 'unreachable' | 'blocked'

interface FetchedPage {
  url: string
  kind: PageKind
  status: number
  html: string
  text: string
}

// ════════════════════════════════════════════════════════════════════════════
// FETCH LAYER
// ════════════════════════════════════════════════════════════════════════════

function normaliseDomain(raw: string): string | null {
  const s = (raw || '').trim().toLowerCase()
  if (!s) return null
  try {
    const url = new URL(s.startsWith('http') ? s : `https://${s}`)
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(url.hostname)) return null
    // Never let this be pointed at internal infrastructure.
    if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0)/.test(url.hostname)) return null
    return url.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

const DESKTOP_UAS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/123.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Edge/122.0.0.0'
];

function getRandomUserAgent(): string {
  return DESKTOP_UAS[Math.floor(Math.random() * DESKTOP_UAS.length)];
}

async function fetchWithTimeout(url: string, ms: number): Promise<Response | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  const userAgent = getRandomUserAgent()
  try {
    return await fetch(url, {
      redirect: 'follow',
      headers: {
        'User-Agent': userAgent,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1'
      },
      signal: controller.signal,
    })
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Honour robots.txt. We only need the rules that apply to us (User-agent: * or
 * a EBEXTA match) — a full parser is overkill, but a blanket "Disallow: /" must
 * be respected absolutely.
 */
async function robotsAllows(origin: string): Promise<boolean> {
  const resp = await fetchWithTimeout(`${origin}/robots.txt`, 5000)
  if (!resp || !resp.ok) return true   // no robots.txt = no restriction
  let body = ''
  try { body = (await resp.text()).slice(0, 20_000) } catch { return true }

  const lines = body.split('\n').map(l => l.trim())
  let applies = false
  for (const line of lines) {
    if (/^user-agent:/i.test(line)) {
      const agent = line.split(':')[1]?.trim().toLowerCase() ?? ''
      applies = agent === '*' || agent.includes('ebexta')
      continue
    }
    if (!applies) continue
    if (/^disallow:\s*\/\s*$/i.test(line)) return false   // blanket ban — stop
  }
  return true
}

/** Strip scripts/styles/nav so Gemini reads content, not chrome. */
function htmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim()
}

// ── VISUAL SECTIONS ──────────────────────────────────────────────────────────
// Why this exists: extraction used to be text-only. A furniture retailer's
// "Our Presence" section was a grid of 15 store PHOTOS and "Our Team" was six
// portraits with name captions. htmlToText threw all of that away, so Gemini
// saw nothing there and asserted the company had no stores and no leadership —
// both false, both shown to the user as verified.
//
// Images carry meaning. We now capture what's around them.

interface VisualSection {
  heading: string
  image_count: number
  captions: string[]
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ').trim()
}

/** Meaningful caption? Filenames and boilerplate alt text are not. */
function usefulCaption(raw: string): boolean {
  const s = raw.trim()
  if (s.length < 2 || s.length > 90) return false
  if (/\.(png|jpe?g|gif|svg|webp|avif)$/i.test(s)) return false
  if (/^(image|img|photo|picture|icon|logo|banner|slide|thumbnail)[\s_-]*\d*$/i.test(s)) return false
  if (/^https?:\/\//i.test(s)) return false
  return true
}

/**
 * Split the page at headings and, for each section, record how many images it
 * holds and what they're captioned. A heading with many images almost always
 * means that content EXISTS — in image form.
 */
function extractVisualSections(html: string): VisualSection[] {
  const sections: VisualSection[] = []

  // Each chunk = one heading plus everything up to the next heading.
  const re = /<h([1-4])[^>]*>([\s\S]{0,200}?)<\/h\1>([\s\S]*?)(?=<h[1-4][^>]*>|$)/gi

  for (const m of html.matchAll(re)) {
    const heading = decodeEntities(m[2].replace(/<[^>]+>/g, ' '))
    const body = m[3] ?? ''
    if (!heading || heading.length > 90) continue

    const imgTags = body.match(/<img\b[^>]*>/gi) ?? []
    if (imgTags.length === 0) continue

    const captions: string[] = []

    // alt / title on the images themselves
    for (const tag of imgTags) {
      for (const attr of ['alt', 'title']) {
        const hit = tag.match(new RegExp(`${attr}=["']([^"']{2,90})["']`, 'i'))
        if (hit) {
          const c = decodeEntities(hit[1])
          if (usefulCaption(c)) captions.push(c)
        }
      }
    }

    // <figcaption>
    for (const f of body.matchAll(/<figcaption[^>]*>([\s\S]{0,120}?)<\/figcaption>/gi)) {
      const c = decodeEntities(f[1].replace(/<[^>]+>/g, ' '))
      if (usefulCaption(c)) captions.push(c)
    }

    // Text immediately AFTER an image — this is how team names and store names
    // appear under photo grids, and it is the case that broke Furnishka.
    for (const a of body.matchAll(/<img\b[^>]*>\s*(?:<\/[a-z]+>\s*)*<([a-z][a-z0-9]*)[^>]*>([\s\S]{0,90}?)<\/\1>/gi)) {
      const c = decodeEntities(a[2].replace(/<[^>]+>/g, ' '))
      if (usefulCaption(c)) captions.push(c)
    }

    sections.push({
      heading,
      image_count: imgTags.length,
      captions: [...new Set(captions)].slice(0, 20),
    })
  }

  // Biggest galleries first — those carry the most meaning.
  return sections
    .filter(s => s.image_count > 0)
    .sort((a, b) => b.image_count - a.image_count)
    .slice(0, 12)
}

/** Try each candidate path in a group; keep the first that returns HTML 200. */
async function tryGroup(origin: string, group: { kind: PageKind; paths: string[] }): Promise<FetchedPage | null> {
  for (const path of group.paths) {
    const url = `${origin}${path}`
    const resp = await fetchWithTimeout(url, PAGE_TIMEOUT_MS)
    if (!resp || !resp.ok) continue
    const ctype = resp.headers.get('content-type') ?? ''
    if (!ctype.includes('html')) continue
    let html = ''
    try { html = (await resp.text()).slice(0, 400_000) } catch { continue }
    const text = htmlToText(html)
    if (text.length < 40) continue   // an empty shell isn't a page we "read"
    return { url: resp.url || url, kind: group.kind, status: resp.status, html, text }
  }
  return null
}

/** When path guesses miss, the sitemap tells us the real URLs. */
async function pathsFromSitemap(origin: string): Promise<string[]> {
  const resp = await fetchWithTimeout(`${origin}/sitemap.xml`, 6000)
  if (!resp || !resp.ok) return []
  let xml = ''
  try { xml = (await resp.text()).slice(0, 200_000) } catch { return [] }
  const locs = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)].map(m => m[1])
  const wanted = /(about|service|solution|product|contact|team|leadership|client|customer|case|portfolio|career|job|blog|news)/i
  return locs.filter(u => wanted.test(u)).slice(0, 6)
}

// ════════════════════════════════════════════════════════════════════════════
// EXTRACTION — pure regex over the real HTML. No AI, so it cannot hallucinate.
// ════════════════════════════════════════════════════════════════════════════

interface PageExtract {
  url: string
  kind: PageKind
  emails: string[]
  phones: string[]
  socials: string[]
  headings: string[]
}

interface ParsedContact {
  name: string
  title: string
  page_url: string
}

interface SiteExtract {
  emails: Array<{ value: string; page_url: string }>
  phones: Array<{ value: string; page_url: string }>
  socials: Array<{ value: string; page_url: string }>
  copyright_year: number | null
  https: boolean
  has_viewport: boolean
  client_logo_count: number
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
  parsed_contacts: ParsedContact[]
  email_pattern: string | null
}

const EMAIL_RE = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi
// Indian formats: +91 98765 43210 / 09876543210 / 98765-43210
const PHONE_RE = /(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}\b/g
const SOCIAL_RE = /https?:\/\/(?:www\.)?(?:linkedin\.com|twitter\.com|x\.com|instagram\.com|youtube\.com|facebook\.com)\/[^\s"'<>)]+/gi
const GST_RE = /\b\d{2}[A-Z]{5}\d{4}[A-Z]{1}[A-Z\d]{1}Z[A-Z\d]{1}\b/g

const TECH_SIGNATURES: Array<[string, RegExp]> = [
  ['Shopify',          /cdn\.shopify\.com|shopify-section|Shopify\.theme/i],
  ['WordPress',        /wp-content|wp-includes|wp-json/i],
  ['Wix',              /static\.wixstatic\.com|wix-code/i],
  ['Squarespace',      /squarespace\.com|static1\.squarespace/i],
  ['Webflow',          /webflow\.com|w-webflow/i],
  ['React',            /__REACT_DEVTOOLS|data-reactroot|react-dom/i],
  ['Next.js',          /__NEXT_DATA__|\/_next\//i],
  ['HubSpot',          /js\.hs-scripts\.com|hubspot/i],
  ['Google Analytics', /googletagmanager\.com|gtag\(|google-analytics\.com/i],
  ['Intercom',         /widget\.intercom\.io|intercomSettings/i],
  ['Zoho',             /zoho\.com|zohopublic/i],
  ['Salesforce',       /salesforce\.com|pardot/i],
  ['Cloudflare',       /cloudflare|cdnjs\.cloudflare/i],
  ['Tailwind',         /tailwindcss|tw-/i],
  ['Bootstrap',        /bootstrap(?:\.min)?\.(?:css|js)/i],
]

const CERT_SIGNATURES: Array<[string, RegExp]> = [
  ['ISO 9001',  /ISO[\s-]?9001/i],
  ['ISO 27001', /ISO[\s-]?27001/i],
  ['ISO',       /\bISO[\s-]?\d{4,5}\b/i],
  ['BIS',       /\bBIS\s+(?:certifi|approv|registr)/i],
  ['SOC 2',     /SOC[\s-]?2\b/i],
  ['GDPR',      /\bGDPR\b/i],
  ['CMMI',      /\bCMMI\b/i],
  ['MSME',      /\bMSME\b|Udyam/i],
  ['HIPAA',     /\bHIPAA\b/i],
]

function uniq(arr: string[]): string[] {
  return [...new Set(arr.map(s => s.trim()).filter(Boolean))]
}

function extractPage(page: FetchedPage): PageExtract {
  const headings = [...page.html.matchAll(/<h[1-3][^>]*>([\s\S]{0,160}?)<\/h[1-3]>/gi)]
    .map(m => htmlToText(m[1]))
    .filter(h => h.length > 1)
    .slice(0, 30)

  return {
    url: page.url,
    kind: page.kind,
    emails: uniq(page.text.match(EMAIL_RE) ?? [])
      // Asset filenames masquerade as emails (e.g. logo@2x.png).
      .filter(e => !/\.(png|jpe?g|gif|svg|webp|css|js)$/i.test(e))
      .slice(0, 12),
    phones: uniq(page.text.match(PHONE_RE) ?? []).slice(0, 8),
    socials: uniq(page.html.match(SOCIAL_RE) ?? []).slice(0, 12),
    headings,
  }
}

/** Count <img> inside sections whose heading mentions clients/partners. */
function countClientLogos(html: string): number {
  const re = /<h[1-4][^>]*>([\s\S]{0,120}?)<\/h[1-4]>([\s\S]{0,4000}?)(?=<h[1-4]|$)/gi
  let total = 0
  for (const m of html.matchAll(re)) {
    const heading = htmlToText(m[1]).toLowerCase()
    if (!/client|customer|partner|trusted|brands we|worked with/.test(heading)) continue
    total += (m[2].match(/<img\b/gi) ?? []).length
  }
  return total
}

function latestPostDate(html: string, text: string): string | null {
  const dates: number[] = []
  for (const m of html.matchAll(/datetime=["'](\d{4}-\d{2}-\d{2})/gi)) {
    const t = Date.parse(m[1]); if (Number.isFinite(t)) dates.push(t)
  }
  const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december'
  for (const m of text.matchAll(new RegExp(`\\b(?:(\\d{1,2})\\s+)?(${MONTHS})[a-z]*\\.?,?\\s+(20\\d{2})\\b`, 'gi'))) {
    const t = Date.parse(`${m[2]} ${m[1] ?? 1}, ${m[3]}`)
    if (Number.isFinite(t) && t <= Date.now()) dates.push(t)
  }
  if (dates.length === 0) return null
  return new Date(Math.max(...dates)).toISOString().slice(0, 10)
}

function extractPeople(pages: FetchedPage[]): ParsedContact[] {
  const contacts: ParsedContact[] = []
  const teamPages = pages.filter(p => ['team', 'about', 'home', 'contact'].includes(p.kind))
  const titleRegex = /\b(?:cmo|cfo|cto|ceo|founder|co-founder|director|president|vp|vice president|head of|manager|lead|executive|chief)\b/i

  for (const page of teamPages) {
    const textLines = page.text.split('\n').map(l => l.trim()).filter(l => l.length > 2)

    for (let i = 0; i < textLines.length; i++) {
      const line = textLines[i]

      // Name - Title
      const matchInline = line.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*[-–,]\s*(.+)$/)
      if (matchInline) {
        const name = matchInline[1].trim()
        const title = matchInline[2].trim()
        if (titleRegex.test(title) && name.split(' ').length <= 4) {
          contacts.push({ name, title, page_url: page.url })
          continue
        }
      }

      // Title on line, Name on previous line
      if (titleRegex.test(line) && line.length < 50) {
        if (i > 0) {
          const prevLine = textLines[i - 1]
          const isName = /^[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,2}$/.test(prevLine)
          if (isName) {
            contacts.push({ name: prevLine, title: line, page_url: page.url })
          }
        }
      }
    }
  }

  const seen = new Set<string>()
  return contacts.filter(c => {
    const key = c.name.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  }).slice(0, 10)
}

function detectEmailPattern(emails: string[], domain: string): string | null {
  const localParts = emails
    .map(e => e.split('@')[0].toLowerCase())
    .filter(lp => !['info', 'contact', 'admin', 'hr', 'sales', 'support', 'hello', 'careers', 'jobs', 'office'].includes(lp))

  if (localParts.length === 0) return null

  let dotCount = 0
  let underscoreCount = 0

  for (const lp of localParts) {
    if (lp.includes('.')) dotCount++
    if (lp.includes('_')) underscoreCount++
  }

  const total = localParts.length
  if (dotCount / total > 0.5) return 'first.last@' + domain
  if (underscoreCount / total > 0.5) return 'first_last@' + domain
  return 'first@' + domain
}

function buildSiteExtract(pages: FetchedPage[], origin: string): SiteExtract {
  const perPage = pages.map(extractPage)
  const allHtml = pages.map(p => p.html).join('\n')
  const allText = pages.map(p => p.text).join('\n')
  const home = pages.find(p => p.kind === 'home') ?? pages[0]

  const withPage = (items: string[], url: string) => items.map(value => ({ value, page_url: url }))

  const emails = perPage.flatMap(p => withPage(p.emails, p.url))
  const phones = perPage.flatMap(p => withPage(p.phones, p.url))
  const socials = perPage.flatMap(p => withPage(p.socials, p.url))

  // Footer copyright year — the cheapest freshness tell there is.
  const years = [...allText.matchAll(/(?:©|&copy;|copyright)\s*(?:\d{4}\s*[-–]\s*)?(20\d{2})/gi)]
    .map(m => Number(m[1]))
    .filter(y => y >= 2000 && y <= new Date().getFullYear() + 1)

  const careersPage = pages.find(p => p.kind === 'careers')
  const jobCount = careersPage
    ? Math.max(
        (careersPage.html.match(/\b(apply now|apply here|view (?:role|position|job))\b/gi) ?? []).length,
        (careersPage.html.match(/<(?:li|article|div)[^>]*(?:job|vacanc|position|opening)[^>]*>/gi) ?? []).length,
      )
    : 0

  const blogPage = pages.find(p => p.kind === 'blog')

  const parsed_contacts = extractPeople(pages)
  const cleanDomain = origin.replace(/^https?:\/\/(?:www\.)?/i, '')
  const email_pattern = detectEmailPattern(emails.map(e => e.value), cleanDomain)

  return {
    emails: emails.slice(0, 20),
    phones: phones.slice(0, 12),
    socials: socials.slice(0, 16),
    copyright_year: years.length ? Math.max(...years) : null,
    https: origin.startsWith('https://'),
    has_viewport: /<meta[^>]+name=["']viewport["']/i.test(home?.html ?? ''),
    client_logo_count: countClientLogos(allHtml),
    certifications: CERT_SIGNATURES.filter(([, re]) => re.test(allText)).map(([name]) => name),
    gst_numbers: uniq(allText.match(GST_RE) ?? []).slice(0, 3),
    job_listing_count: jobCount,
    latest_post_date: blogPage ? latestPostDate(blogPage.html, blogPage.text) : null,
    tech_fingerprints: TECH_SIGNATURES.filter(([, re]) => re.test(allHtml)).map(([name]) => name),
    addresses: uniq(
      (allText.match(/[A-Z][^.]{10,90}?\b(?:Road|Rd|Street|St|Lane|Nagar|Colony|Sector|Phase|Floor|Tower|Park)\b[^.]{0,60}?\b\d{6}\b/g) ?? []),
    ).slice(0, 4),
    pricing_signals: uniq(
      (allText.match(/(?:starting at|starts from|from)\s*(?:₹|Rs\.?|INR|\$)\s*[\d,]+/gi) ?? []),
    ).slice(0, 5),
    has_blog: !!blogPage,
    has_careers: !!careersPage,
    has_team_page: pages.some(p => p.kind === 'team'),
    has_clients_page: pages.some(p => p.kind === 'clients'),
    parsed_contacts,
    email_pattern
  }
}

// ════════════════════════════════════════════════════════════════════════════
// GEMINI — reads ONLY the text we fetched
// ════════════════════════════════════════════════════════════════════════════

/** Prioritise the pages that actually describe the business. */
function buildCorpus(pages: FetchedPage[]): string {
  const priority: PageKind[] = ['about', 'services', 'clients', 'careers', 'home', 'team', 'blog', 'contact']
  const ordered = [...pages].sort((a, b) => priority.indexOf(a.kind) - priority.indexOf(b.kind))

  let out = ''
  for (const p of ordered) {
    if (out.length >= MAX_TEXT_CHARS) break
    const room = MAX_TEXT_CHARS - out.length
    out += `\n\n===== PAGE: ${p.url} =====\n${p.text.slice(0, Math.min(room, 4000))}`
  }
  return out.trim()
}

/**
 * The block that stops false absence claims. Rendered separately from the page
 * text so the model cannot miss it.
 */
function buildVisualBlock(pages: FetchedPage[]): string {
  const lines: string[] = []
  for (const p of pages) {
    const sections = extractVisualSections(p.html)
    for (const s of sections) {
      if (s.image_count < 2) continue   // one stray image proves nothing
      const caps = s.captions.length > 0 ? ` — captions: ${s.captions.join(', ')}` : ''
      lines.push(`  [${p.url}] "${s.heading}" — ${s.image_count} images${caps}`)
    }
  }
  if (lines.length === 0) return ''
  return `\n\nVISUAL SECTIONS FOUND (content shown as IMAGES, not text — these prove the content EXISTS):\n${lines.slice(0, 24).join('\n')}`
}

async function readWithGemini(
  companyName: string, corpus: string, visualBlock: string, pageUrls: string[], apiKey: string,
): Promise<{ result: unknown; tokens: number }> {
  const prompt = `Below is the ACTUAL content from ${companyName}'s website, fetched today. Analyse ONLY this. Do not use anything you remember about this company. If the content does not state something, say null — never fill a gap from memory.

PAGES WE READ (these are the ONLY pages you may reason about):
${pageUrls.map(u => `  - ${u}`).join('\n')}

WEBSITE TEXT:
${corpus}${visualBlock}

CRITICAL RULE ON ABSENCE:
You may state that something is missing ONLY if you positively checked the page where it would live and it genuinely is not there in TEXT OR IMAGES.

Before claiming anything is absent, check the VISUAL SECTIONS block above. A section heading with many images almost always means that content EXISTS in image form — for example "Our Presence" with 15 images means they DO have physical stores, even if no addresses appear in text. "Our Team" with named captions means leadership IS shown.

If you did not read the page where something would appear, say "not_checked" — never "absent".
If the page exists but the content is in images you cannot fully read, say "present_but_unreadable" — never "absent".
A false absence claim is a critical failure. When uncertain, choose the weaker claim.

Return ONLY JSON:
{
 "business_model": "B2B_SERVICES|B2B_PRODUCT|D2C_RETAIL|MANUFACTURING|MARKETPLACE",
 "what_they_actually_do": "in their own words, from the site",
 "services_listed": ["exactly as listed"],
 "industries_served": [],
 "clients_named": ["only names actually printed on the site"],
 "team_members_listed": [ {"name":"","title":"","page_url":""} ],
 "certifications_claimed": [],
 "locations_listed": [],
 "size_indicators": "any headcount/scale claim they make, or null",
 "recent_activity": [ {"item":"","date":"","page_url":""} ],
 "open_roles": [ {"role":"","page_url":""} ],
 "absence_findings": [ { "item": "...", "status": "absent|not_checked|present_but_unreadable|present", "evidence": "exactly what you saw or did not see", "page_url": "..." } ],
 "tone_and_positioning": "how they present themselves",
 "claims_with_no_evidence": ["anything they assert without proof"]
}

For team_members_listed and locations_listed: names and places that appear ONLY as image captions still count — include them, and note the page_url.
For EVERY field, only include what appears above. Empty array or null is the correct answer when the site does not say it.
Never output a phone number. Never claim a source you were not given.`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45_000)
  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
        }),
        signal: controller.signal,
      },
    )
    if (!resp.ok) {
      console.error(`[site-walkthrough] gemini ${resp.status}: ${(await resp.text()).slice(0, 300)}`)
      return { result: null, tokens: 0 }
    }
    const data = await resp.json()
    const text = (data.candidates?.[0]?.content?.parts ?? [])
      .map((p: { text?: string }) => p.text ?? '').join('')
    const tokens = data.usageMetadata?.totalTokenCount ?? 0

    const cleaned = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
    const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}')
    if (s === -1 || e <= s) return { result: null, tokens }
    try { return { result: JSON.parse(cleaned.slice(s, e + 1)), tokens } } catch { return { result: null, tokens } }
  } catch (err) {
    console.error(`[site-walkthrough] gemini failed: ${String(err).slice(0, 200)}`)
    return { result: null, tokens: 0 }
  } finally {
    clearTimeout(timer)
  }
}

// ════════════════════════════════════════════════════════════════════════════
// HANDLER
// ════════════════════════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!geminiKey) return json({ error: 'Server misconfigured: GEMINI_API_KEY missing' }, 500, req)

  // ── Auth: require a valid Supabase JWT ──
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401, req)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401, req)
  const userId = userData.user.id

  let body: { domain?: string; companyName?: string; force?: boolean }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400, req) }

  const domain = normaliseDomain(String(body.domain ?? ''))
  const companyName = String(body.companyName ?? domain ?? 'the company').slice(0, 120)

  // No website at all is a real, reportable finding — not an error.
  if (!domain) {
    return json({
      walkthrough: null, pagesRead: [], extracted: null,
      status: 'unreachable' as ReadStatus, cached: false,
      note: 'No usable website address on this lead.',
    }, 200, req)
  }

  // ── Cache: shared across ALL users, 30 days ──
  if (!body.force) {
    const { data: cached } = await admin
      .from('site_cache')
      .select('walkthrough, pages_read, status, fetched_at')
      .eq('domain', domain)
      .maybeSingle()

    if (cached?.fetched_at) {
      const ageDays = (Date.now() - Date.parse(cached.fetched_at as string)) / 86_400_000
      if (ageDays < CACHE_DAYS) {
        const pr = cached.pages_read as { pages?: unknown; extracted?: unknown } | null
        return json({
          walkthrough: cached.walkthrough,
          pagesRead: (pr?.pages ?? []),
          extracted: (pr?.extracted ?? null),
          status: cached.status as ReadStatus,
          cached: true,
        }, 200, req)
      }
    }
  }

  const deadline = Date.now() + TOTAL_BUDGET_MS
  const origin = `https://${domain}`

  // ── robots.txt ──
  const allowed = await robotsAllows(origin)
  if (!allowed) {
    const payload = { walkthrough: null, pagesRead: [], extracted: null, status: 'blocked' as ReadStatus, cached: false }
    await admin.from('site_cache').upsert({
      domain, walkthrough: null, pages_read: { pages: [], extracted: null }, status: 'blocked', fetched_at: new Date().toISOString(),
    })
    return json(payload, 200, req)
  }

  // ── Root Status Check (Detect 403 / 429 Bot Blocks) ──
  let rootStatus = 200
  try {
    const rootResp = await fetchWithTimeout(origin, PAGE_TIMEOUT_MS)
    if (rootResp) {
      rootStatus = rootResp.status
    }
  } catch {
    rootStatus = 500
  }

  if (rootStatus === 403 || rootStatus === 429) {
    const payload = { walkthrough: null, pagesRead: [], extracted: null, status: 'blocked' as ReadStatus, cached: false }
    await admin.from('site_cache').upsert({
      domain, walkthrough: null, pages_read: { pages: [], extracted: null }, status: 'blocked', fetched_at: new Date().toISOString(),
    })
    return json(payload, 200, req)
  }

  // ── Fetch pages, all groups in parallel ──
  let pages: FetchedPage[] = []
  try {
    const results = await Promise.all(PATH_GROUPS.map(g => tryGroup(origin, g)))
    const raw = results.filter((p): p is FetchedPage => p !== null)

    // ── DEDUPE BY FINAL URL ──
    // Many sites (Shopify, most SPAs) redirect every unknown path to "/".
    // With redirect:'follow', /about /team /blog all came back 200 — as the
    // HOMEPAGE. We recorded five "pages read" when we had read one page five
    // times, then reported "no team page" and "no about page" as findings.
    //
    // A page only counts if its FINAL url is one we haven't already got.
    const seen = new Set<string>()
    const canon = (u: string) => u.replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase()

    // Home first so it always wins the homepage URL; the rest are then judged
    // against it and a redirect-to-home is correctly discarded.
    const ordered = [...raw].sort((a, b) => (a.kind === 'home' ? -1 : b.kind === 'home' ? 1 : 0))
    for (const page of ordered) {
      const key = canon(page.url)
      if (seen.has(key)) continue          // same page under a different path
      seen.add(key)
      pages.push(page)
    }
  } catch { /* individual failures already swallowed */ }

  // Homepage missing = the site is effectively unreadable.
  if (pages.length === 0) {
    await admin.from('site_cache').upsert({
      domain, walkthrough: null, pages_read: { pages: [], extracted: null }, status: 'unreachable', fetched_at: new Date().toISOString(),
    })
    return json({ walkthrough: null, pagesRead: [], extracted: null, status: 'unreachable' as ReadStatus, cached: false }, 200, req)
  }

  // ── Sitemap fallback when the path guesses under-delivered ──
  if (pages.length < 4 && Date.now() < deadline - 6000) {
    const extra = await pathsFromSitemap(origin)
    const seen = new Set(pages.map(p => p.url))
    const fetched = await Promise.all(
      extra.filter(u => !seen.has(u)).slice(0, MAX_PAGES - pages.length).map(async (u) => {
        const resp = await fetchWithTimeout(u, PAGE_TIMEOUT_MS)
        if (!resp?.ok) return null
        const ctype = resp.headers.get('content-type') ?? ''
        if (!ctype.includes('html')) return null
        let html = ''
        try { html = (await resp.text()).slice(0, 400_000) } catch { return null }
        const text = htmlToText(html)
        if (text.length < 40) return null
        // Classify by URL so the corpus prioritiser still works.
        const kind: PageKind =
          /about|company/i.test(u) ? 'about'
          : /service|solution|product/i.test(u) ? 'services'
          : /team|leader|people/i.test(u) ? 'team'
          : /client|customer|case|portfolio/i.test(u) ? 'clients'
          : /career|job/i.test(u) ? 'careers'
          : /blog|news|press/i.test(u) ? 'blog'
          : /contact/i.test(u) ? 'contact' : 'home'
        return { url: resp.url || u, kind, status: resp.status, html, text }
      }),
    )
    // Same dedupe rule — a sitemap URL that redirects home is not a new page.
    const canon2 = (u: string) => u.replace(/[#?].*$/, '').replace(/\/+$/, '').toLowerCase()
    const have = new Set(pages.map(p => canon2(p.url)))
    for (const f of fetched) {
      if (!f) continue
      const k = canon2(f.url)
      if (have.has(k)) continue
      have.add(k)
      pages.push(f)
    }
    pages = pages.slice(0, MAX_PAGES)
  }

  // ── Regex extraction (no AI — cannot hallucinate) ──
  const extracted = buildSiteExtract(pages, origin)
  const pagesRead = pages.map(p => {
    const e = extractPage(p)
    return {
      url: p.url, kind: p.kind, status: p.status, chars: p.text.length,
      emails: e.emails, phones: e.phones, socials: e.socials, headings: e.headings.slice(0, 8),
    }
  })

  // ── Gemini reads what we fetched ──
  let walkthrough: unknown = null
  let tokens = 0
  if (Date.now() < deadline) {
    const out = await readWithGemini(
      companyName,
      buildCorpus(pages),
      buildVisualBlock(pages),
      pages.map(p => p.url),
      geminiKey,
    )
    walkthrough = out.result
    tokens = out.tokens
  }

  // 4+ pages is a real read; 1-3 is partial and must be labelled as such.
  const status: ReadStatus = pages.length >= 4 ? 'full' : 'partial'

  await admin.from('site_cache').upsert({
    domain,
    walkthrough,
    pages_read: { pages: pagesRead, extracted },
    status,
    fetched_at: new Date().toISOString(),
  })

  // Cost visibility in /admin/api.
  await admin.from('api_usage').insert({
    user_id: userId,
    action: 'site_walkthrough',
    model: 'gemini-flash-latest',
    tokens_used: tokens,
    calls: 1,
  })

  return json({ walkthrough, pagesRead, extracted, status, cached: false }, 200, req)
})
