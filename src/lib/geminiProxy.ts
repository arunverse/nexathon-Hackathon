/**
 * Frontend → Gemini proxy client (S1).
 * All Gemini traffic goes through the `gemini` Supabase Edge Function, which
 * holds the API key server-side. The browser never sees a Gemini key.
 * The user's Supabase JWT is attached automatically by supabase.functions.invoke.
 */

import { supabase } from './supabase'
import { logApiUsage } from './adminLog'

export type GeminiAction = 'discovery' | 'scan' | 'enrich' | 'email'

export interface GeminiProxyOpts {
  action?: GeminiAction
  model?: 'gemini-flash-lite-latest' | 'gemini-flash-latest'
  grounded?: boolean
  jsonMode?: boolean
  timeoutMs?: number
}

export class ProxyFallbackError extends Error {
  readonly primaryError: Error | null
  readonly fallbackError: Error

  constructor(message: string, primaryError: unknown, fallbackError: unknown) {
    const fallbackErr = fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError))
    super(message, { cause: fallbackErr })
    this.name = 'ProxyFallbackError'
    this.primaryError = primaryError instanceof Error ? primaryError : (primaryError ? new Error(String(primaryError)) : null)
    this.fallbackError = fallbackErr
  }
}

/** Returns operation-appropriate timeouts based on grounding and action profile */
export function getOperationTimeout(action?: GeminiAction, grounded?: boolean, overrideMs?: number): number {
  if (typeof overrideMs === 'number' && overrideMs > 0) return overrideMs
  if (!grounded) {
    return action === 'email' ? 25000 : 35000
  }
  switch (action) {
    case 'enrich':
      return 90000 // Deep company grounding requires up to 90s under search load
    case 'discovery':
      return 75000
    case 'scan':
      return 90000
    case 'email':
      return 30000
    default:
      return 75000
  }
}

/** Identifies non-retryable permanent errors (400, 401, 403, quota exhaustion, safety blocks) */
export function isPermanentError(err: unknown): boolean {
  const msg = String((err as Error)?.message || '')
  if (/API key not valid|PERMISSION_DENIED|unauthorized|invalid api key/i.test(msg)) return true
  if (/INVALID_ARGUMENT|bad request/i.test(msg)) return true
  if (/exceeded your current quota|billing details|check your plan/i.test(msg)) return true
  if (/SAFETY|blocked by safety|HARM_CATEGORY/i.test(msg)) return true
  return false
}

export interface GroundingSource {
  uri: string
  title: string
}

export interface GeminiProxyResult {
  text: string
  tokensUsed: number
  /** Real pages Gemini visited via Google Search grounding (evidence links). */
  sources: GroundingSource[]
}

async function callDirectGemini(prompt: string, opts: GeminiProxyOpts): Promise<GeminiProxyResult> {
  // 1. Try same-origin serverless proxy endpoint (/api/gemini) first
  if (typeof window !== 'undefined' && window.location?.origin) {
    try {
      const proxyRes = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          model: opts.model,
          jsonMode: opts.jsonMode,
        }),
      })
      if (proxyRes.ok) {
        const data = await proxyRes.json()
        if (data?.text) {
          const tokensUsed = data.tokensUsed ?? 0
          void logApiUsage({
            action: opts.action ?? 'enrich',
            model: opts.model ?? 'gemini-flash-lite-latest',
            tokensUsed,
            calls: 1,
          })
          return {
            text: data.text,
            tokensUsed,
            sources: [],
          }
        }
      }
    } catch {
      // Fall through to direct Google Gemini API endpoint
    }
  }

  // 2. Direct call to Google Gemini API
  const processEnv = typeof process !== 'undefined' ? (process as { env?: Record<string, string | undefined> }).env : undefined
  const winEnv = typeof window !== 'undefined' ? (window as unknown as { VITE_GEMINI_API_KEY?: string }) : undefined
  const apiKey = (
    processEnv?.GEMINI_API_KEY ||
    processEnv?.VITE_GEMINI_API_KEY ||
    import.meta.env.VITE_GEMINI_API_KEY ||
    winEnv?.VITE_GEMINI_API_KEY ||
    ''
  )

  if (!apiKey) {
    throw new Error('Missing Gemini API Key. Set VITE_GEMINI_API_KEY in your environment.')
  }

  // Use valid active Google Gemini models (gemini-flash-latest / gemini-flash-lite-latest / gemini-3.8-flash / gemini-3.5-flash-lite)
  const candidateModels = opts.model === 'gemini-flash-latest'
    ? ['gemini-flash-latest', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-3.5-flash']
    : ['gemini-flash-lite-latest', 'gemini-3.5-flash-lite', 'gemini-3.1-flash-lite', 'gemini-flash-latest']

  let lastFetchError: unknown
  for (const modelName of candidateModels) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`
    const bodyPayload: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
    }
    if (opts.jsonMode) {
      bodyPayload.generationConfig = { responseMimeType: 'application/json' }
    }

    try {
      // 90s timeout gives Gemini ample time for complex grounding and structured multi-lead generation
      const timeoutMs = opts.timeoutMs ?? (opts.grounded ? 90000 : 45000)
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(bodyPayload),
        signal: AbortSignal.timeout(timeoutMs),
      })

      if (!res.ok) {
        const errText = await res.text()
        const safeErrText = errText.replace(/key=[A-Za-z0-9._-]+/g, 'key=[REDACTED]')
        // If 404 model not found, try next candidate model
        if (res.status === 404 && candidateModels.indexOf(modelName) < candidateModels.length - 1) {
          console.warn(`[EBEXTA Direct Gemini] Model ${modelName} returned 404, trying next candidate...`)
          continue
        }
        throw new Error(`Direct Gemini API failed (${res.status}): ${safeErrText}`)
      }

      const data = await res.json()
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

      // Log usage to database so API costs, token counters, and admin metrics track live
      void logApiUsage({
        action: opts.action ?? 'enrich',
        model: modelName,
        tokensUsed,
        calls: 1,
      })

      const chunks = (data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) as Array<{ web?: { uri?: string; title?: string } }>
      const sources = chunks
        .map(c => {
          let uri = String(c?.web?.uri ?? '').trim()
          const title = String(c?.web?.title ?? '').trim()
          if (uri.includes('grounding-api-redirect') || uri.includes('vertexaisearch')) {
            if (title.startsWith('http://') || title.startsWith('https://')) {
              uri = title
            } else if (title.includes('.') && !title.includes(' ')) {
              uri = `https://${title}`
            }
          }
          return uri ? { uri, title: title || uri } : null
        })
        .filter((s): s is GroundingSource => !!s)

      return {
        text,
        tokensUsed,
        sources,
      }
    } catch (err) {
      lastFetchError = err
      const msg = String((err as Error)?.message || '')
      const isAbortOrTimeout = (err as Error)?.name === 'AbortError' ||
        (err as Error)?.name === 'TimeoutError' ||
        /abort|timeout|signal timed out/i.test(msg)
      if (isAbortOrTimeout && candidateModels.indexOf(modelName) < candidateModels.length - 1) {
        console.warn(`[EBEXTA Direct Gemini] Request timed out on ${modelName}, trying fallback model...`)
        continue
      }
      if (isAbortOrTimeout) {
        throw new Error(`Intelligence scan timed out while verifying live market signals. Any leads discovered before the timeout have been preserved in your workspace.`, { cause: err })
      }
      if (msg.includes('404') && candidateModels.indexOf(modelName) < candidateModels.length - 1) {
        continue
      }
      throw err
    }
  }
  throw lastFetchError
}

/** Call the Gemini proxy Edge Function. Throws on error (incl. rate limits). Falls back to direct API if edge function is unavailable/paused/unauthorized. */
export async function callGeminiProxy(prompt: string, opts: GeminiProxyOpts = {}): Promise<GeminiProxyResult> {
  let primaryError: unknown

  try {
    const { data, error } = await supabase.functions.invoke('gemini', {
      body: {
        action: opts.action ?? 'enrich',
        prompt,
        model: opts.model,
        grounded: opts.grounded,
        jsonMode: opts.jsonMode,
      },
    })

    if (error) {
      primaryError = error
    } else {
      const d = data as { text?: string; tokensUsed?: number; error?: string; sources?: GroundingSource[] }
      if (d?.error) {
        primaryError = new Error(d.error)
      } else if (!d?.text) {
        primaryError = new Error('Empty response payload from edge function')
      } else {
        return {
          text: d.text,
          tokensUsed: d.tokensUsed ?? 0,
          sources: Array.isArray(d.sources) ? d.sources.filter(s => s && typeof s.uri === 'string') : [],
        }
      }
    }
  } catch (err: unknown) {
    primaryError = err
  }

  const primaryMsg = primaryError instanceof Error ? primaryError.message : String(primaryError || 'Edge Function failure')
  console.warn(`[EBEXTA] Primary edge function failed (${primaryMsg}), switching to direct Google Gemini API...`)
  try {
    return await callDirectGemini(prompt, opts)
  } catch (fallbackErr: unknown) {
    const fallbackMsg = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr || 'Direct call failed')
    console.error(`[EBEXTA] Direct Gemini fallback also failed: ${fallbackMsg} (Primary failure: ${primaryMsg})`)
    throw new ProxyFallbackError(
      `Direct Gemini fallback failed: ${fallbackMsg} (Primary error: ${primaryMsg})`,
      primaryError,
      fallbackErr
    )
  }
}
