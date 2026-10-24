/**
 * Input sanitization (S4). Every user-supplied string that reaches a database
 * write, a Gemini prompt, a URL, or the DOM must pass through sanitizeText().
 *
 * - Strips ALL HTML (DOMPurify with no allowed tags) → blocks stored XSS.
 * - Trims, removes null bytes, and caps length → blocks oversized/abusive input.
 * Supabase's SDK already parameterizes queries, so this focuses on XSS + abuse.
 */

import DOMPurify from 'dompurify'

const DEFAULT_MAX = 2000

/**
 * Cap for the company/service description ("what does your company do?").
 *
 * This is the single most important field in EBEXTA — it drives the whole
 * description-first matching pipeline. A generous limit is deliberate: more
 * detail here produces a sharper buyer profile and better leads.
 *
 * Defined once so the input, the counter, the DB write and the Gemini prompt
 * can never drift apart. If they did, a long description would be silently
 * truncated somewhere in the middle of matching.
 */
export const MISSION_MAX = 5000

function getPurify() {
  if (typeof (DOMPurify as any)?.sanitize === 'function') return DOMPurify as any
  if (typeof (DOMPurify as any)?.default?.sanitize === 'function') return (DOMPurify as any).default
  if (typeof window !== 'undefined' && typeof (DOMPurify as any) === 'function') {
    return (DOMPurify as any)(window)
  }
  return null
}

/** Strip all HTML, trim, remove null bytes, and cap length. */
export function sanitizeText(input: unknown, maxLen: number = DEFAULT_MAX): string {
  if (input == null) return ''
  let clean = String(input)
  // Remove null bytes first (can break downstream parsers / DB drivers).
  clean = clean.replace(/\0/g, '')
  // Strip ALL HTML tags and attributes.
  const purify = getPurify()
  if (purify && typeof purify.sanitize === 'function') {
    clean = purify.sanitize(clean, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] })
  } else {
    // Robust fallback for non-browser / test / SSR runtimes
    clean = clean
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
      .replace(/<[^>]*>/g, '')
  }
  clean = clean.trim()
  if (clean.length > maxLen) clean = clean.slice(0, maxLen)
  return clean
}

/** Sanitize a comma-separated tag list → array of clean, deduped, short tags. */
export function sanitizeTags(input: string, maxTags = 12, maxLen = 40): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const raw of String(input).split(',')) {
    const t = sanitizeText(raw, maxLen)
    if (t && !seen.has(t.toLowerCase())) {
      seen.add(t.toLowerCase())
      out.push(t)
      if (out.length >= maxTags) break
    }
  }
  return out
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const URL_RE = /^https?:\/\/[^\s.]+\.[^\s]{2,}$/i

/** RFC-lite email validation. */
export function isEmail(input: string): boolean {
  const v = sanitizeText(input, 320)
  return EMAIL_RE.test(v)
}

/** http(s) URL validation. */
export function isURL(input: string): boolean {
  const v = sanitizeText(input, 2048)
  return URL_RE.test(v)
}

/** Sanitize + normalize a URL (adds https:// if missing). Returns '' if invalid. */
export function sanitizeUrl(input: string): string {
  let v = sanitizeText(input, 2048)
  if (!v) return ''
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`
  return isURL(v) ? v : ''
}
