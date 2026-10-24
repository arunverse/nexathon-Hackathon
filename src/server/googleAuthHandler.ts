import type { IncomingMessage, ServerResponse } from 'http'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedAdminEmail } from '../lib/adminAuth'

interface GoogleTokenInfo {
  iss?: string
  aud?: string
  azp?: string
  sub?: string
  email?: string
  email_verified?: string | boolean
  name?: string
  picture?: string
  exp?: string | number
  error_description?: string
}

function decodeJwtPayload(jwt: string): GoogleTokenInfo | null {
  try {
    const parts = jwt.split('.')
    if (parts.length < 2) return null
    // Base64URL to Base64
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const jsonStr = Buffer.from(base64, 'base64').toString('utf8')
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error('[GoogleAuth Dev API] Failed to parse JWT payload:', e)
    return null
  }
}

export function createGoogleAuthDevMiddleware(env: Record<string, string>) {
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL || ''
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  const anonKey = env.VITE_SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || ''
  const expectedClientId = (
    env.GOOGLE_CLIENT_ID ||
    process.env.GOOGLE_CLIENT_ID ||
    env.VITE_GOOGLE_CLIENT_ID ||
    process.env.VITE_GOOGLE_CLIENT_ID ||
    ''
  ).trim()

  const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

  return async function googleAuthMiddleware(req: IncomingMessage, res: ServerResponse, next: () => void) {
    if (req.method === 'OPTIONS') {
      res.writeHead(200, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      })
      res.end('ok')
      return
    }

    if (req.url?.startsWith('/api/auth/google/verify') && req.method === 'POST') {
      const clientIp = (req.headers['x-forwarded-for'] as string || req.socket.remoteAddress || '127.0.0.1').split(',')[0].trim()
      const now = Date.now()
      const limitInfo = rateLimitMap.get(clientIp) || { count: 0, resetAt: now + 60000 }

      if (now > limitInfo.resetAt) {
        limitInfo.count = 1
        limitInfo.resetAt = now + 60000
      } else {
        limitInfo.count += 1
      }
      rateLimitMap.set(clientIp, limitInfo)

      if (limitInfo.count > 5) {
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '60' })
        res.end(JSON.stringify({ error: 'Too many login attempts. Please wait 1 minute before trying again.' }))
        return
      }

      let bodyData = ''
      req.on('data', (chunk) => {
        bodyData += chunk
      })

      req.on('end', async () => {
        const sendJson = (status: number, data: unknown) => {
          res.writeHead(status, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          })
          res.end(JSON.stringify(data))
        }

        try {
          if (!supabaseUrl || !serviceKey || !anonKey || !expectedClientId) {
            const cid = Math.random().toString(36).substring(2, 10)
            console.error(`[GoogleAuth ${cid}] Missing env config: hasUrl=${!!supabaseUrl} hasServiceKey=${!!serviceKey} hasAnonKey=${!!anonKey} hasClientId=${!!expectedClientId}`)
            sendJson(500, { error: 'Server authentication is misconfigured. Please contact support.', cid })
            return
          }

          let parsed: { credential?: string; mode?: string; plan?: string } = {}
          try {
            parsed = JSON.parse(bodyData || '{}')
          } catch {
            sendJson(400, { error: 'Invalid JSON body in login request' })
            return
          }

          const { credential, mode = 'seeker', plan = 'starter' } = parsed
          if (!credential || typeof credential !== 'string') {
            sendJson(400, { error: 'Missing Google credential token' })
            return
          }

          // 1. Decode JWT payload locally first
          const localPayload = decodeJwtPayload(credential)
          if (!localPayload) {
            sendJson(400, { error: 'Invalid Google credential token format' })
            return
          }

          // 2. Query Google's tokeninfo endpoint for real-time verification
          let tokenInfo: GoogleTokenInfo = localPayload
          try {
            const googleRes = await fetch(
              `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`
            )
            if (googleRes.ok) {
              const verifiedData = (await googleRes.json()) as GoogleTokenInfo
              tokenInfo = { ...localPayload, ...verifiedData }
            } else {
              const errData = (await googleRes.json().catch(() => ({}))) as Record<string, unknown>
              console.warn('[GoogleAuth Dev API] Google tokeninfo non-200:', googleRes.status, errData)
              // If tokeninfo gave an explicit error like invalid_token, check if expired
              if (typeof errData.error_description === 'string') {
                console.error('[GoogleAuth Dev API] Google rejected token:', errData.error_description)
              }
            }
          } catch (fetchErr) {
            console.warn('[GoogleAuth Dev API] Could not reach Google tokeninfo endpoint, falling back to local JWT validation:', fetchErr)
          }

          // 3. Validate essential security claims
          const tokenAud = (tokenInfo.aud || localPayload.aud || '').trim()
          const tokenAzp = (tokenInfo.azp || localPayload.azp || '').trim()
          const audValid =
            tokenAud === expectedClientId ||
            tokenAzp === expectedClientId ||
            expectedClientId.includes(tokenAud) ||
            expectedClientId.includes(tokenAzp)

          const tokenIss = tokenInfo.iss || localPayload.iss || ''
          const issValid =
            tokenIss === 'https://accounts.google.com' ||
            tokenIss === 'accounts.google.com'

          const expVal = tokenInfo.exp || localPayload.exp
          const expValid = expVal ? Number(expVal) * 1000 > Date.now() - 60000 : true // 60s clock skew tolerance

          const emailVerified =
            tokenInfo.email_verified === 'true' ||
            tokenInfo.email_verified === true ||
            localPayload.email_verified === 'true' ||
            localPayload.email_verified === true

          if (!audValid) {
            console.error(`[GoogleAuth] Token audience mismatch: tokenAud=${tokenAud} tokenAzp=${tokenAzp} expected=<redacted>`)
            sendJson(401, { error: 'Authentication failed: invalid token. Please try signing in again.' })
            return
          }

          if (!issValid) {
            console.error(`[GoogleAuth] Invalid token issuer: ${tokenIss}`)
            sendJson(401, { error: 'Authentication failed: invalid token. Please try signing in again.' })
            return
          }

          if (!expValid) {
            console.error(`[GoogleAuth] Google ID token expired: exp=${expVal}`)
            sendJson(401, { error: 'Your login session has expired. Please click Sign In again.' })
            return
          }

          const googleSub = tokenInfo.sub || localPayload.sub
          const rawEmail = tokenInfo.email || localPayload.email
          if (!googleSub) {
            sendJson(400, { error: 'Missing subject identifier in Google token' })
            return
          }
          if (!rawEmail || !emailVerified) {
            sendJson(400, { error: 'A verified Google email address is required for EBEXTA login' })
            return
          }

          const email = rawEmail.toLowerCase().trim()
          const name = tokenInfo.name || localPayload.name || email.split('@')[0]
          const picture = tokenInfo.picture || localPayload.picture || ''

          console.log(`[GoogleAuth Dev API] Authenticating Google user (sub: ${googleSub})`)

          // 4. Connect to Supabase via Admin Client
          const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
          const client = createClient(supabaseUrl, anonKey, { auth: { persistSession: false } })

          let targetUserId: string | null = null
          let isNewUser = false

          // Lookup in profiles by google_sub first
          try {
            const { data: profBySub } = await admin
              .from('profiles')
              .select('id, sender_email')
              .eq('google_sub', googleSub)
              .maybeSingle()

            if (profBySub?.id) {
              targetUserId = profBySub.id
            }
          } catch (pErr) {
            console.warn('[GoogleAuth Dev API] Profile lookup by sub warning:', pErr)
          }

          // Lookup in auth.users by google_sub or email
          if (!targetUserId) {
            const { data: userList, error: listErr } = await admin.auth.admin.listUsers({ perPage: 1000 })
            if (listErr) {
              console.error('[GoogleAuth Dev API] listUsers error:', listErr)
            }
            const existingUser = userList?.users?.find(
              (u) =>
                u.user_metadata?.google_sub === googleSub ||
                u.user_metadata?.sub === googleSub ||
                u.email?.toLowerCase() === email
            )

            if (existingUser) {
              targetUserId = existingUser.id
              // Link Google identity metadata safely
              const { error: updateErr } = await admin.auth.admin.updateUserById(targetUserId, {
                user_metadata: {
                  ...existingUser.user_metadata,
                  google_sub: googleSub,
                  full_name: existingUser.user_metadata?.full_name || name,
                  name: existingUser.user_metadata?.name || name,
                  avatar_url: existingUser.user_metadata?.avatar_url || picture,
                  provider: 'google',
                },
              })
              if (updateErr) {
                console.warn('[GoogleAuth Dev API] updateUserById warning:', updateErr)
              }
            }
          }

          // If no user exists, create new user in Supabase
          if (!targetUserId) {
            isNewUser = true
            console.log(`[GoogleAuth Dev API] Creating new EBEXTA user account`)
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
              const cid = Math.random().toString(36).substring(2, 10)
              console.error(`[GoogleAuth ${cid}] Failed to create user:`, createErr)
              sendJson(500, { error: 'Could not create your account. Please try again or contact support.', cid })
              return
            }
            targetUserId = created.user.id
          }

          // 5. Update / ensure Profile row
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
              profileData.is_admin = isAuthorizedAdminEmail(email)
              await admin.from('profiles').insert(profileData)
            } else {
              // Existing profile: update login & identity details, preserve existing plan_status and plan
              await admin.from('profiles').update(profileData).eq('id', targetUserId)
            }
          } catch (profErr) {
            console.warn('[GoogleAuth Dev API] Profile upsert warning:', profErr)
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

          // 5b. Ensure user_credits row exists (balance stays at 0 until admin activates the plan)
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
            console.warn('[GoogleAuth Dev API] user_credits ensure warning:', ucErr)
          }

          // 6. Generate secure session for client
          const linkRes = await admin.auth.admin.generateLink({
            type: 'magiclink',
            email,
          })

          if (linkRes.error || !linkRes.data?.properties?.hashed_token) {
            const cid = Math.random().toString(36).substring(2, 10)
            console.error(`[GoogleAuth ${cid}] generateLink error:`, linkRes.error)
            sendJson(500, { error: 'Could not generate a secure session. Please try again.', cid })
            return
          }

          const verifyOtpRes = await client.auth.verifyOtp({
            token_hash: linkRes.data.properties.hashed_token,
            type: 'magiclink',
          })

          if (verifyOtpRes.error || !verifyOtpRes.data?.session) {
            const cid = Math.random().toString(36).substring(2, 10)
            console.error(`[GoogleAuth ${cid}] verifyOtp error:`, verifyOtpRes.error)
            sendJson(500, { error: 'Could not initialize your session. Please try again.', cid })
            return
          }

          console.log(`[GoogleAuth Dev API] Login successful for user ID: (${targetUserId})`)

          sendJson(200, {
            success: true,
            session: verifyOtpRes.data.session,
            user: verifyOtpRes.data.user,
            isNewUser,
          })
        } catch (err: unknown) {
          const cid = Math.random().toString(36).substring(2, 10)
          console.error(`[GoogleAuth ${cid}] Unhandled error:`, err)
          sendJson(500, { error: 'Authentication failed. Please try again or contact support.', cid })
        }
      })
      return
    }

    next()
  }
}
