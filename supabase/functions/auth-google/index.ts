// ─── EBEXTA Google Auth Verification (Edge Function) ──────────────────────────
// Server-side verification of Google Identity Services (GIS) ID Tokens.
// Never trusts client-decoded data. Validates signature, issuer, audience,
// expiration, and verified email directly against Google.
//
// Deploy: supabase functions deploy auth-google

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ═══════════════════════════════════════════════════════════════════════════
// CORS — ONE ALLOWLIST, COPIED VERBATIM INTO EVERY EDGE FUNCTION
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_ALLOWED = [
  // Production
  'https://ebexta.com', 'https://www.ebexta.com',
  'https://webexta.com', 'https://www.webexta.com',
  // Local development. vite.config.ts pins the dev server to port 8000
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

interface GoogleTokenInfo {
  iss?: string
  aud?: string
  sub?: string
  email?: string
  email_verified?: string | boolean
  name?: string
  picture?: string
  exp?: string | number
  error_description?: string
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(req) })
  if (!isOriginAllowed(req)) return json({ error: 'Origin not allowed' }, 403, req)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405, req)

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || Deno.env.get('VITE_SUPABASE_URL')
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('VITE_SUPABASE_ANON_KEY')
    const expectedClientId = Deno.env.get('GOOGLE_CLIENT_ID') || Deno.env.get('VITE_GOOGLE_CLIENT_ID')

    if (!supabaseUrl || !serviceKey || !anonKey || !expectedClientId) {
      return json({ error: 'Server authentication configuration is incomplete' }, 500, req)
    }

    let body: { credential?: string; mode?: string; plan?: string }
    try {
      body = await req.json()
    } catch {
      return json({ error: 'Invalid request body' }, 400, req)
    }

    const { credential, mode = 'seeker', plan = 'starter' } = body
    if (!credential || typeof credential !== 'string') {
      return json({ error: 'Missing Google credential' }, 400, req)
    }

    // 1. Verify Google ID token with Google's verification endpoint
    const verifyRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`)
    if (!verifyRes.ok) {
      return json({ error: 'Google ID token verification failed' }, 401, req)
    }

    const tokenInfo: GoogleTokenInfo = await verifyRes.json()

    // 2. Validate essential security claims
    const audValid = tokenInfo.aud === expectedClientId
    const issValid = tokenInfo.iss === 'https://accounts.google.com' || tokenInfo.iss === 'accounts.google.com'
    const expValid = tokenInfo.exp ? Number(tokenInfo.exp) * 1000 > Date.now() : false
    const emailVerified = tokenInfo.email_verified === 'true' || tokenInfo.email_verified === true

    if (!audValid) {
      return json({ error: 'Token audience does not match configured Google Client ID' }, 401, req)
    }
    if (!issValid) {
      return json({ error: 'Invalid token issuer' }, 401, req)
    }
    if (!expValid) {
      return json({ error: 'Google ID token has expired' }, 401, req)
    }
    if (!tokenInfo.sub) {
      return json({ error: 'Missing unique subject (sub) in Google identity' }, 400, req)
    }
    if (!tokenInfo.email || !emailVerified) {
      return json({ error: 'A verified Google email address is required' }, 400, req)
    }

    const googleSub = tokenInfo.sub
    const email = tokenInfo.email.toLowerCase().trim()
    const name = tokenInfo.name ?? email.split('@')[0]
    const picture = tokenInfo.picture ?? ''

    // 3. Connect to Supabase via Admin Client
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
    const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

    // Check if user exists by Google sub in profiles or auth.users
    let targetUserId: string | null = null
    let isNewUser = false

    // Try profiles table lookup by google_sub
    try {
      const { data: profBySub } = await admin
        .from('profiles')
        .select('id, sender_email, email')
        .eq('google_sub', googleSub)
        .maybeSingle()

      if (profBySub?.id) {
        targetUserId = profBySub.id
      }
    } catch {
      // Column might not exist yet if migration is pending
    }

    // If not found by google_sub, check auth.users metadata & email
    if (!targetUserId) {
      const { data: userList } = await admin.auth.admin.listUsers()
      const existingUser = userList?.users?.find(
        (u) =>
          u.user_metadata?.google_sub === googleSub ||
          u.user_metadata?.sub === googleSub ||
          u.email?.toLowerCase() === email
      )

      if (existingUser) {
        targetUserId = existingUser.id
        // Link Google metadata if not already present
        await admin.auth.admin.updateUserById(targetUserId, {
          user_metadata: {
            ...existingUser.user_metadata,
            google_sub: googleSub,
            full_name: existingUser.user_metadata?.full_name || name,
            avatar_url: existingUser.user_metadata?.avatar_url || picture,
            provider: 'google',
          },
        })
      }
    }

    // If still not found, create new Supabase user
    if (!targetUserId) {
      isNewUser = true
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: {
          google_sub: googleSub,
          full_name: name,
          name,
          avatar_url: picture,
          provider: 'google',
        },
      })

      if (createErr || !created?.user) {
        return json({ error: createErr?.message || 'Failed to create user account' }, 500, req)
      }
      targetUserId = created.user.id
    }

    // 4. Update / ensure Profile record
    const nowIso = new Date().toISOString()
    const thirtyDaysFromNow = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()

    try {
      const { data: profile } = await admin
        .from('profiles')
        .select('id, credits, credit_limit, plan_status, plan')
        .eq('id', targetUserId)
        .maybeSingle()

      const profileData: Record<string, unknown> = {
        sender_email: email,
        email,
        google_sub: googleSub,
        email_verified: true,
        name,
        profile_image_url: picture,
        last_login_at: nowIso,
        authentication_provider: 'google',
        updated_at: nowIso,
      }

      if (!profile) {
        profileData.id = targetUserId
        profileData.mode = mode
        profileData.plan = plan || 'starter'
        profileData.plan_status = 'none'
        profileData.credits = 0
        profileData.credit_limit = 0
        await admin.from('profiles').insert(profileData)
      } else {
        // Existing profile: update login & identity details, preserve existing plan_status and plan
        await admin.from('profiles').update(profileData).eq('id', targetUserId)
      }
    } catch {
      // Fallback for pending migration columns
      try {
        await admin
          .from('profiles')
          .upsert({
            id: targetUserId,
            sender_email: email,
            updated_at: nowIso,
          })
      } catch {
        /* non-fatal */
      }
    }

    // 4b. Ensure user_credits row exists (balance stays at 0 until admin activates the plan)
    try {
      const { data: uc } = await admin
        .from('user_credits')
        .select('user_id')
        .eq('user_id', targetUserId)
        .maybeSingle()

      if (!uc) {
        await admin.from('user_credits').insert({
          user_id: targetUserId,
          plan: plan || 'starter',
          scan_credits: 0,
          scan_credits_used: 0,
          verified_credits: 0,
          verified_credits_used: 0,
          bonus_credits: 0,
          cycle_start: nowIso,
          cycle_end: thirtyDaysFromNow,
          is_suspended: false,
        })
      }
    } catch (ucErr) {
      console.warn('[auth-google] user_credits ensure warning:', ucErr)
    }

    // 5. Generate secure session for client
    const linkRes = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email,
    })

    if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
      return json({ error: 'Failed to generate secure session' }, 500, req)
    }

    const verifyOtpRes = await client.auth.verifyOtp({
      token_hash: linkRes.data.properties.hashed_token,
      type: 'magiclink',
    })

    if (verifyOtpRes.error || !verifyOtpRes.data?.session) {
      return json({ error: 'Failed to initialize session tokens' }, 500, req)
    }

    return json(
      {
        success: true,
        session: verifyOtpRes.data.session,
        user: verifyOtpRes.data.user,
        isNewUser,
      },
      200,
      req
    )
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal authentication error'
    return json({ error: message }, 500, req)
  }
})
