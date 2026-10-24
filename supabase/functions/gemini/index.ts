// ─── EBEXTA Gemini proxy (Edge Function) ──────────────────────────────────────
// S1: the Gemini API key lives ONLY in Supabase secrets — the browser never
//     sees it. The frontend calls supabase.functions.invoke('gemini', ...).
// S3: per-user, per-action rate limits enforced via the api_usage table.
// S5: CORS locked to allowlisted origins.
// C1: hard daily cost cap per model.
// S10: every call requires a valid Supabase JWT (verified below).
//
// Deploy:  supabase functions deploy gemini
// Secrets: supabase secrets set GEMINI_API_KEY=...   (and optionally ALLOWED_ORIGINS)
//
// Request body: { action: 'discovery'|'scan'|'enrich'|'email', prompt: string,
//                 grounded?: boolean, model?: 'gemini-2.5-flash-lite'|'gemini-2.5-flash' }
// Response:     { text: string, tokensUsed: number }

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ── Monthly billing period (mirror of src/lib/billingPeriod.ts) ──────────────
// Credits reset every month on the anniversary of the plan-start anchor.
function addMonths(d: Date, m: number): Date {
  const r = new Date(d)
  const day = r.getDate()
  r.setDate(1)
  r.setMonth(r.getMonth() + m)
  const daysInMonth = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate()
  r.setDate(Math.min(day, daysInMonth))
  return r
}
function periodStart(anchorISO?: string | null, now: Date = new Date()): Date {
  if (!anchorISO) return new Date(now.getFullYear(), now.getMonth(), 1)
  const anchor = new Date(anchorISO)
  if (isNaN(anchor.getTime())) return new Date(now.getFullYear(), now.getMonth(), 1)
  if (anchor >= now) return anchor
  let months = (now.getFullYear() - anchor.getFullYear()) * 12 + (now.getMonth() - anchor.getMonth())
  let cand = addMonths(anchor, months)
  if (cand > now) { months -= 1; cand = addMonths(anchor, months) }
  return cand
}

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
  if (!origin) return true   // non-browser callers have no Origin — JWT still gates them
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

type Action = 'discovery' | 'scan' | 'enrich' | 'email'

const MODEL_ALLOWLIST = new Set([
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
  'gemini-3.7-flash',
])

// Per-action limits: [maxCalls, windowMs]. Sized for the REAL call pattern —
// one scan makes 1 discovery call + ~10-15 enrich calls (plus retries), so
// these must be generous or a single scan trips its own limit and every lead
// degrades to a flat salvage result.
const RATE_LIMITS: Record<Action, [number, number]> = {
  scan: [40, 60 * 60 * 1000],        // 40 / hour
  discovery: [120, 60 * 60 * 1000],  // 120 / hour
  enrich: [600, 60 * 60 * 1000],     // 600 / hour (covers many scans)
  email: [120, 60 * 60 * 1000],      // 120 / hour
}

const DAILY_MODEL_CAP = 5000 // C1: generous ceiling; raise/lower once billing is set

function json(body: unknown, status: number, req: Request) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const geminiKey = Deno.env.get('GEMINI_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  if (!geminiKey) return json({ error: 'Server misconfigured: GEMINI_API_KEY missing' }, 500, req)

  // ── Auth (S10): require a valid Supabase JWT ──
  const authHeader = req.headers.get('Authorization') ?? ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401, req)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401, req)
  const userId = userData.user.id

  // ── Parse & validate input ──
  let body: { action?: string; prompt?: string; grounded?: boolean; model?: string }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400, req) }

  const action = (body.action ?? 'enrich') as Action
  if (!RATE_LIMITS[action]) return json({ error: 'Invalid action' }, 400, req)
  const prompt = String(body.prompt ?? '')
  if (!prompt.trim()) return json({ error: 'Missing prompt' }, 400, req)
  if (prompt.length > 24000) return json({ error: 'Prompt too large' }, 413, req)
  const model = body.model && MODEL_ALLOWLIST.has(body.model) ? body.model : 'gemini-flash-lite-latest'
  const grounded = body.action === 'enrich' ? body.grounded !== false : !!body.grounded

  // ── Account status + per-user credit limit (admin-controlled) ──
  const { data: prof } = await admin
    .from('profiles')
    .select('credit_limit, is_blocked, credits_reset_at')
    .eq('id', userId)
    .maybeSingle()

  // Blocked users can't use AI features.
  if (prof?.is_blocked === true) {
    return json({ error: 'ACCOUNT_BLOCKED: Your account is blocked. Please contact support.' }, 403, req)
  }

  const creditLimit = (prof?.credit_limit ?? null) as number | null
  if (creditLimit != null) {
    // Monthly plans reset every month on the ANNIVERSARY of the plan-start
    // anchor (credits_reset_at, set at purchase / admin reset). Computed lazily
    // — no cron needed. Falls back to the calendar month for anchorless users.
    // (Mirror of src/lib/billingPeriod.ts.)
    const since = periodStart((prof?.credits_reset_at as string | null) ?? null)
    const { count: used } = await admin
      .from('api_usage')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', since.toISOString())
    if ((used ?? 0) >= creditLimit) {
      return json({ error: `QUOTA_EXCEEDED: You've used all ${creditLimit} credits. Recharge to continue, or ask your admin to reset.` }, 429, req)
    }
  }

  // ── CREDIT GUARD ──
  // The scan runs in the browser, so a credit check made there is bypassable.
  // This is the choke point: no credits, no Gemini — whatever the caller does.
  // Fails OPEN if the credit system is unreachable or not installed yet, so a
  // credit outage can never take the whole product down.
  try {
    const { data: gate } = await admin.rpc('ebexta_check_credits', {
      p_user: userId,
      p_action: 'scan',
    })
    const g = gate as { allowed?: boolean; reason?: string; code?: string } | null
    if (g && g.allowed === false) {
      return json({ error: g.reason ?? 'Out of credits.', code: g.code ?? 'NO_CREDITS' }, 402, req)
    }
  } catch {
    // credit_system.sql not run yet → behave exactly as before.
  }

  // ── Rate limit (S3): count this user's calls for this action in the window ──
  const [maxCalls, windowMs] = RATE_LIMITS[action]
  const windowStart = new Date(Date.now() - windowMs).toISOString()
  const { count: actionCount } = await admin
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('action', action)
    .gte('created_at', windowStart)
  if ((actionCount ?? 0) >= maxCalls) {
    return json({ error: `Rate limit reached for ${action}. Try again later.` }, 429, req)
  }

  // ── Cost cap (C1): global daily calls for this model ──
  const dayStart = new Date().toISOString().split('T')[0] + 'T00:00:00.000Z'
  const { count: modelCount } = await admin
    .from('api_usage')
    .select('*', { count: 'exact', head: true })
    .eq('model', model)
    .gte('created_at', dayStart)
  if ((modelCount ?? 0) >= DAILY_MODEL_CAP) {
    return json({ error: 'Daily API limit approaching. Try again tomorrow.' }, 429, req)
  }

  // ── Call Gemini (key server-side only) ──
  const genConfig: Record<string, unknown> = grounded ? { temperature: 0.1 } : {}
  if (body.jsonMode === true) {
    genConfig.responseMimeType = 'application/json'
  }
  const reqBody: Record<string, unknown> = {
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: genConfig,
  }
  if (grounded) reqBody.tools = [{ google_search: {} }]

  let text = ''
  let tokensUsed = 0
  // Real sources Gemini consulted via Google Search grounding (the pages it
  // actually visited). These become the lead's evidence links — genuine, and
  // distinct from any funding URL the model writes into its JSON.
  let sources: Array<{ uri: string; title: string }> = []
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 90_000)
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reqBody),
        signal: controller.signal,
      },
    )
    clearTimeout(timer)
    if (!resp.ok) {
      const errText = await resp.text()
      const cid = crypto.randomUUID().slice(0, 8)
      // Full upstream detail (keys, model names, quotas) stays SERVER-SIDE only —
      // it goes to the Supabase function logs, never to the browser.
      console.error(`[gemini ${cid}] upstream ${resp.status}: ${errText.slice(0, 500)}`)
      // Preserve ONLY the quota signal the client needs for a friendly message.
      if (resp.status === 429 && /quota|billing|exceeded|limit/i.test(errText)) {
        return json({ error: 'QUOTA_EXCEEDED: exceeded your current quota — try again after the daily reset.', code: 'QUOTA', cid }, 429, req)
      }
      return json({ error: 'The AI service is temporarily unavailable. Please try again shortly.', code: 'UPSTREAM', cid }, 502, req)
    }
    const data = await resp.json()
    text = (data.candidates?.[0]?.content?.parts ?? []).map((p: { text?: string }) => p.text ?? '').join('')
    tokensUsed = data.usageMetadata?.totalTokenCount ?? 0
    // Capture the grounding sources (the URLs Gemini actually visited).
    const chunks = (data.candidates?.[0]?.groundingMetadata?.groundingChunks ?? []) as Array<{ web?: { uri?: string; title?: string } }>
    sources = chunks
      .map(c => (c?.web?.uri ? { uri: String(c.web.uri), title: String(c.web.title ?? '') } : null))
      .filter((s): s is { uri: string; title: string } => !!s)
  } catch (err) {
    const cid = crypto.randomUUID().slice(0, 8)
    console.error(`[gemini ${cid}] request failed: ${String(err).slice(0, 200)}`)
    return json({ error: 'The AI service is temporarily unavailable. Please try again shortly.', code: 'UPSTREAM', cid }, 502, req)
  }

  // ── Log usage (feeds admin API tracking + rate limit + cost cap) ──
  await admin.from('api_usage').insert({
    user_id: userId,
    action,
    model,
    tokens_used: tokensUsed,
    calls: 1,
  })

  return json({ text, tokensUsed, sources }, 200, req)
})
