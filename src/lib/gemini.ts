// Gemini model wrappers — all calls now go through the secure Edge Function
// proxy (src/lib/geminiProxy.ts). No API key and no Gemini SDK in the frontend.

import { callGeminiProxy, type GeminiAction } from './geminiProxy'

export const GEMINI_LITE_MODEL = 'gemini-flash-lite-latest' as const  // bulk discovery
export const GEMINI_FLASH_MODEL = 'gemini-flash-latest' as const      // email / proposals

/**
 * Call Gemini through the backend proxy, with automatic retry + model fallback.
 *
 * Retry strategy:
 *   Attempt 0,1 → gemini-2.5-flash-lite  (fast)
 *   Attempt 2,3 → gemini-2.5-flash        (fallback when lite is overloaded)
 * preferFlash forces flash from the start.
 *
 * Rate-limit (429) errors are NOT retried — they are surfaced to the caller.
 */
export async function callGemini(
  prompt: string,
  opts: { preferFlash?: boolean; maxRetries?: number; action?: GeminiAction } = {},
): Promise<string> {
  const { preferFlash = false, maxRetries = 1, action = 'enrich' } = opts
  let lastError: unknown

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const useFlash = preferFlash || attempt >= 2
    const model = useFlash ? GEMINI_FLASH_MODEL : GEMINI_LITE_MODEL

    try {
      const { text } = await callGeminiProxy(prompt, { action, model })
      return text.trim()
    } catch (err: unknown) {
      lastError = err
      const msg = String((err as Error)?.message ?? '')

      // Never retry a rate-limit / quota rejection — bubble it up so the UI can
      // tell the user to wait, instead of hammering the limit further.
      if (/rate limit|too many|daily api limit|429/i.test(msg)) throw err

      const isRetriable =
        msg.includes('503') || msg.includes('500') ||
        /high demand|overloaded|resource_exhausted|502|failed/i.test(msg)

      if (isRetriable && attempt < maxRetries) {
        const waitMs = 1500 * Math.pow(2, attempt)
        console.warn(`[EBEXTA] ${model} ${msg.slice(0, 60)} — retrying in ${waitMs}ms (${attempt + 1}/${maxRetries})`)
        await new Promise(r => setTimeout(r, waitMs))
        continue
      }
      throw err
    }
  }
  throw lastError
}
