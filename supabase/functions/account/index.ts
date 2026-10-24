// ─── EBEXTA account actions (Edge Function) ───────────────────────────────────
// Privileged profile writes that the client is NOT allowed to make directly
// (is_admin / credits / credit_limit / plan / is_blocked). All go through here
// with proper server-side authorization.
//
//   redeem_coupon → validates the coupon code SERVER-SIDE, grants credits to the
//                   caller. (Code is never shipped to the browser.)
//   admin_update  → caller must be is_admin; updates a target user's plan/credits/
//                   limit/block/reset. Only these fields are writable.
//
// Deploy: supabase functions deploy account

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// CORS restricted to an allowlist (never "*"); production domains baked in,
// extend via ALLOWED_ORIGINS. The Supabase JWT is the primary auth gate.
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
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(req), 'Content-Type': 'application/json' } })
}

// ── Server-side coupon table (NEVER in the frontend bundle) ──
const COUPONS: Record<string, { credits: number }> = {
  'Ebexta@2026': { credits: 200 },
}
// Fields an admin is allowed to change on another user.
const ADMIN_FIELDS = new Set(['plan', 'credits', 'credit_limit', 'is_blocked', 'credits_reset_at', 'plan_valid_until'])

Deno.serve(async (req) => {
  // Preflight first, always — a browser that cannot get past OPTIONS will
  // never show you the real error underneath.
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  try {

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return json({ error: 'Unauthorized' }, 401, req)

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: userData, error: userErr } = await admin.auth.getUser(token)
  if (userErr || !userData?.user) return json({ error: 'Unauthorized' }, 401, req)
  const callerId = userData.user.id

  let body: Record<string, unknown>
  try { body = await req.json() } catch { return json({ error: 'Invalid body' }, 400, req) }
  const action = String(body.action ?? '')

  // ── Redeem a coupon (grants credits to the caller) ──
  if (action === 'redeem_coupon') {
    const code = String(body.code ?? '').trim()
    const coupon = COUPONS[code]
    if (!coupon) return json({ error: 'Invalid coupon code.' }, 400, req)

    // Single-use per user: record the redemption FIRST. A duplicate (same
    // user+code) violates the coupon_redemptions primary key and is rejected.
    // Requires the table from supabase/SECURITY_FIXES_2026-07-18.sql. This
    // fails CLOSED — if the table is missing, the coupon simply won't grant,
    // rather than allowing unlimited reuse.
    const { error: redErr } = await admin
      .from('coupon_redemptions')
      .insert({ user_id: callerId, code })
    if (redErr) {
      if ((redErr as { code?: string }).code === '23505') {
        return json({ error: 'This coupon has already been redeemed.' }, 409, req)
      }
      const cid = crypto.randomUUID().slice(0, 8)
      console.error(`[account ${cid}] coupon record failed: ${redErr.message}`)
      return json({ error: 'Could not redeem coupon. Please try again.', cid }, 400, req)
    }

    // Grant credits by RAISING the monthly cap — never overwrite it and never
    // reset credits_reset_at (resetting the billing anchor would wipe the usage
    // window and hand out effectively unlimited API calls).
    const { data: prof } = await admin
      .from('profiles').select('credit_limit').eq('id', callerId).maybeSingle()
    const newLimit = (Number(prof?.credit_limit) || 0) + coupon.credits
    await admin.from('profiles').update({ credit_limit: newLimit }).eq('id', callerId)
    return json({ success: true, credits: coupon.credits, credit_limit: newLimit }, 200, req)
  }

  // ── Admin updates another user's account ──
  if (action === 'admin_update') {
    // Caller must be a real admin (checked server-side).
    const { data: me } = await admin.from('profiles').select('is_admin').eq('id', callerId).maybeSingle()
    if (me?.is_admin !== true) return json({ error: 'Forbidden' }, 403, req)

    const targetUserId = String(body.targetUserId ?? '')
    const patchIn = (body.patch ?? {}) as Record<string, unknown>
    if (!targetUserId) return json({ error: 'Missing targetUserId' }, 400, req)

    // Whitelist the fields — ignore anything not admin-editable.
    const patch: Record<string, unknown> = {}
    for (const k of Object.keys(patchIn)) if (ADMIN_FIELDS.has(k)) patch[k] = patchIn[k]
    if (Object.keys(patch).length === 0) return json({ error: 'No editable fields' }, 400, req)

    const { error } = await admin.from('profiles').update(patch).eq('id', targetUserId)
    if (error) {
      const cid = crypto.randomUUID().slice(0, 8)
      console.error(`[account ${cid}] admin_update failed: ${error.message}`)
      return json({ error: 'Update failed. Please try again.', cid }, 400, req)
    }
    return json({ success: true }, 200, req)
  }

  // ── Delete account — wipes the user's data + auth account (GDPR/DPDP) ──
  if (action === 'delete_account') {
    // Best-effort delete across every table that holds this user's data.
    const tables: Array<[string, string]> = [
      ['outreach', 'user_id'], ['leads', 'user_id'], ['scans', 'user_id'],
      ['saved_leads', 'user_id'], ['declared_intents', 'user_id'],
      ['verification_requests', 'user_id'], ['verified_contacts', 'user_id'],
      ['signal_watches', 'user_id'], ['signal_matches', 'user_id'],
      ['payments', 'user_id'], ['api_usage', 'user_id'], ['system_logs', 'user_id'],
    ]
    for (const [t, col] of tables) {
      try { await admin.from(t).delete().eq(col, callerId) } catch { /* table may not exist */ }
    }
    try { await admin.from('profiles').delete().eq('id', callerId) } catch { /* ignore */ }
    // Remove the auth user last (irreversible).
    const { error: delErr } = await admin.auth.admin.deleteUser(callerId)
    if (delErr) {
      const cid = crypto.randomUUID().slice(0, 8)
      console.error(`[account ${cid}] delete_account failed: ${delErr.message}`)
      return json({ error: 'Account deletion failed. Please contact support.', cid }, 400, req)
    }
    return json({ success: true }, 200, req)
  }

  return json({ error: 'Unknown action' }, 400, req)
  } catch (err) {
    // An uncaught throw returns a bare 500 with NO CORS headers, so the browser
    // reports a CORS failure and hides the actual cause. Every exit from this
    // function must carry the headers.
    const cid = crypto.randomUUID().slice(0, 8)
    console.error(`[account ${cid}] request failed: ${String(err).slice(0, 300)}`)
    return json({ error: 'Account operation failed', cid }, 500, req)
  }
})
