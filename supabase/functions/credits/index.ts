// ─── EBEXTA Credit enforcement (Edge Function) ────────────────────────────────
// The authority on whether a user may run a costly action.
//
// Why this exists: runScan() executes in the browser, so a check made there is
// bypassable. This function holds the service role and is the only path that
// can move a balance — user_credits has a SELECT policy and nothing else, so a
// user cannot grant themselves credits through the REST API.
//
// Deploy:  supabase functions deploy credits
// Secrets: none beyond the defaults Supabase injects.
//
// Request:  { op: 'check'|'consume'|'refund'|'balance',
//             action?: 'scan'|'verified_contact', apiCalls?, tokens?,
//             referenceId?, note? }
// Response: check   → { allowed, reason, code, remaining, cycle_end }
//           consume → { ok, remaining, cost_inr }
//           refund  → { ok, remaining }
//           balance → { credits, limits }

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
    status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' },
  })
}

type Op = 'check' | 'consume' | 'refund' | 'balance'
type CreditAction = 'scan' | 'verified_contact'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Auth — the user id comes from the verified JWT, never from the request body.
  // This is what stops one user consuming or refunding another's credits.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401, req)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401, req)
  const userId = userData.user.id

  let body: {
    op?: string; action?: string; apiCalls?: number; tokens?: number
    referenceId?: string | null; note?: string | null
  }
  try { body = await req.json() } catch { return json({ error: 'Invalid JSON body' }, 400, req) }

  const op = (body.op ?? 'check') as Op
  const action: CreditAction = body.action === 'verified_contact' ? 'verified_contact' : 'scan'
  const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const referenceId = body.referenceId && uuidRe.test(body.referenceId) ? body.referenceId : null

  try {
    if (op === 'check') {
      const { data, error } = await admin.rpc('ebexta_check_credits', { p_user: userId, p_action: action })
      if (error) throw error
      return json(data, 200, req)
    }

    if (op === 'consume') {
      const { data, error } = await admin.rpc('ebexta_consume_credit', {
        p_user: userId, p_action: action,
        p_api_calls: Math.max(0, Math.min(500, Number(body.apiCalls ?? 0))),
        p_tokens: Math.max(0, Number(body.tokens ?? 0)),
        p_reference: referenceId,
        p_note: (body.note ?? '').slice(0, 300) || null,
      })
      if (error) throw error
      return json(data, 200, req)
    }

    if (op === 'refund') {
      const { data, error } = await admin.rpc('ebexta_refund_credit', {
        p_user: userId, p_action: action,
        p_reference: referenceId,
        p_note: (body.note ?? '').slice(0, 300) || null,
      })
      if (error) throw error
      return json(data, 200, req)
    }

    // balance — everything the header and usage page need, in one round trip.
    const [{ data: credits }, { data: limits }] = await Promise.all([
      admin.from('user_credits').select('*').eq('user_id', userId).maybeSingle(),
      admin.from('system_limits').select('global_scans_paused, pause_reason').eq('id', 1).maybeSingle(),
    ])
    return json({ credits: credits ?? null, limits: limits ?? null }, 200, req)
  } catch (err) {
    const cid = crypto.randomUUID().slice(0, 8)
    console.error(`[credits ${cid}] ${op} failed: ${String(err).slice(0, 300)}`)
    // Fail OPEN on a check: an outage in the credit system must not lock every
    // user out of the product. Fail QUIET on consume/refund so a ledger hiccup
    // never breaks a scan that already succeeded.
    if (op === 'check') {
      return json({ allowed: true, degraded: true, reason: '', remaining: null }, 200, req)
    }
    return json({ ok: false, error: 'Credit operation failed', cid }, 200, req)
  }
})
