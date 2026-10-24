import type { VercelRequest, VercelResponse } from '@vercel/node'

const ALLOWED_ORIGINS = [
  'https://ebexta.com',
  'https://www.ebexta.com',
  'https://webexta.com',
  'https://www.webexta.com',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
]

function getCorsOrigin(req: VercelRequest): string {
  const origin = (req.headers.origin as string) || ''
  if (!origin) return 'https://ebexta.com'
  if (ALLOWED_ORIGINS.includes(origin)) return origin
  try {
    const host = new URL(origin).hostname.toLowerCase()
    if (host === 'ebexta.com' || host.endsWith('.ebexta.com')) return origin
    if (host === 'webexta.com' || host.endsWith('.webexta.com')) return origin
    if (host.endsWith('.vercel.app')) return origin
    if (host === 'localhost' || host === '127.0.0.1') return origin
  } catch {
    // invalid url
  }
  return 'https://ebexta.com'
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const allowOrigin = getCorsOrigin(req)
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('X-Content-Type-Options', 'nosniff')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const correlationId = Math.random().toString(36).substring(2, 10)

  try {
    const { prompt, model, jsonMode } = (req.body || {}) as {
      prompt?: string
      model?: string
      jsonMode?: boolean
    }

    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Missing prompt' })
    }

    const apiKey =
      process.env.GEMINI_API_KEY ||
      process.env.VITE_GEMINI_API_KEY ||
      ''

    if (!apiKey) {
      console.error(`[gemini ${correlationId}] GEMINI_API_KEY environment variable missing`)
      return res.status(500).json({ error: 'Server misconfiguration', correlationId })
    }

    const modelName =
      model === 'gemini-flash-latest' ? 'gemini-flash-latest' : 'gemini-flash-lite-latest'

    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`

    const bodyPayload: any = {
      contents: [{ parts: [{ text: prompt }] }],
    }
    if (jsonMode) {
      bodyPayload.generationConfig = { responseMimeType: 'application/json' }
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyPayload),
    })

    if (!response.ok) {
      const errText = await response.text()
      console.error(`[gemini ${correlationId}] Upstream error ${response.status}: ${errText.slice(0, 300)}`)
      return res.status(response.status).json({
        error: 'AI service request failed. Please try again.',
        correlationId
      })
    }

    const data = await response.json()
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const tokensUsed = data.usageMetadata?.totalTokenCount ?? 0

    return res.status(200).json({
      text,
      tokensUsed,
      sources: [],
    })
  } catch (err: any) {
    console.error(`[gemini ${correlationId}] Internal error:`, err)
    return res.status(500).json({ error: 'An unexpected server error occurred.', correlationId })
  }
}

