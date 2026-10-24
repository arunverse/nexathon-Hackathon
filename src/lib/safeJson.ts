/**
 * SAFE JSON — the one parser every Gemini response goes through.
 * ---------------------------------------------------------------------------
 * Models truncate. They wrap output in fences, add a sentence of preamble,
 * leave a trailing comma, or stop mid-string when they hit a token limit. Every
 * one of those used to reach JSON.parse unguarded and throw a SyntaxError that
 * took a whole lead view down with it.
 *
 * A malformed response is a normal operating condition, not an exception. This
 * module treats it that way: try hard to recover the JSON, and when it truly
 * cannot be recovered, return null so the caller can degrade to "Intelligence
 * unavailable" instead of a white screen.
 */

/**
 * Parse JSON from model output. Returns null rather than throwing.
 *
 * Handles: markdown fences, prose before or after the JSON, trailing commas,
 * smart quotes, and a response cut off mid-object.
 */
export function safeParseJSON<T = unknown>(text: string | null | undefined): T | null {
  if (!text) return null

  let t = String(text)
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  // Find the outermost JSON value, ignoring any prose wrapped around it.
  const starts = [t.indexOf('{'), t.indexOf('[')].filter(i => i >= 0)
  if (starts.length === 0) return null
  const s = Math.min(...starts)
  const e = Math.max(t.lastIndexOf('}'), t.lastIndexOf(']'))
  if (e < s) return null

  t = t.slice(s, e + 1)

  try {
    return JSON.parse(t) as T
  } catch { /* fall through to repairs */ }

  // Repair 1 — trailing commas before a closing brace or bracket.
  try {
    return JSON.parse(t.replace(/,\s*([}\]])/g, '$1')) as T
  } catch { /* fall through */ }

  // Repair 2 — smart quotes the model used inside otherwise valid JSON.
  try {
    const straightened = t
      .replace(/[“”]/g, '"')
      .replace(/[‘’]/g, "'")
      .replace(/,\s*([}\]])/g, '$1')
    return JSON.parse(straightened) as T
  } catch { /* fall through */ }

  // Repair 3 — truncated output. Close whatever is still open.
  // This is the "re_scope": . case: the response stopped mid-value. We salvage
  // the complete portion rather than lose the whole object.
  try {
    const repaired = closeTruncated(t)
    if (repaired) return JSON.parse(repaired) as T
  } catch { /* give up honestly */ }

  return null
}

/**
 * Close an object or array that the model stopped writing mid-way.
 *
 * Walks the text tracking string state and nesting, cuts back to the last
 * complete key/value pair, then closes every structure still open.
 */
function closeTruncated(text: string): string | null {
  const stack: string[] = []
  let inString = false
  let escaped = false
  /** Index just past the last complete top-level-ish value. */
  let lastSafe = -1

  for (let i = 0; i < text.length; i++) {
    const c = text[i]

    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }

    if (c === '"') { inString = !inString; continue }
    if (inString) continue

    if (c === '{' || c === '[') {
      stack.push(c === '{' ? '}' : ']')
    } else if (c === '}' || c === ']') {
      stack.pop()
      lastSafe = i
    } else if (c === ',') {
      lastSafe = i
    }
  }

  if (stack.length === 0) return null       // nothing was left open
  if (lastSafe < 0) return null             // nothing complete to salvage

  // Drop the incomplete tail, including the comma that introduced it.
  let body = text.slice(0, text[lastSafe] === ',' ? lastSafe : lastSafe + 1)
  body = body.replace(/,\s*$/, '')

  // Re-derive what is still open after the cut.
  const open: string[] = []
  inString = false
  escaped = false
  for (let i = 0; i < body.length; i++) {
    const c = body[i]
    if (escaped) { escaped = false; continue }
    if (c === '\\') { escaped = true; continue }
    if (c === '"') { inString = !inString; continue }
    if (inString) continue
    if (c === '{') open.push('}')
    else if (c === '[') open.push(']')
    else if (c === '}' || c === ']') open.pop()
  }

  return body + open.reverse().join('')
}

/**
 * Parse a Gemini response, and if it is unparseable, ask once more for strict
 * JSON before giving up.
 *
 * `retry` should re-run the same call with the given instruction prepended.
 * Returns null when both attempts fail — callers must handle that by showing
 * "Intelligence unavailable — retry", never by throwing.
 */
export async function parseOrRetry<T = unknown>(
  text: string,
  retry: (strictInstruction: string) => Promise<string>,
  label = 'response',
): Promise<T | null> {
  const first = safeParseJSON<T>(text)
  if (first !== null) return first

  console.info(`[EBEXTA] Malformed JSON in ${label} — retrying once with a strict-JSON instruction`)
  try {
    const second = await retry(STRICT_JSON_INSTRUCTION)
    const parsed = safeParseJSON<T>(second)
    if (parsed !== null) return parsed
    console.info(`[EBEXTA] ${label} still unparseable after retry — degrading gracefully`)
  } catch (err) {
    console.info(`[EBEXTA] Retry for ${label} failed:`, err)
  }
  return null
}

export const STRICT_JSON_INSTRUCTION =
  'Return ONLY valid JSON. No prose, no markdown, no code fences, no commentary before or after.'
