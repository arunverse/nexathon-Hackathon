import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string) || ''
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || ''

// Whether the critical Supabase env vars are present. Exported so the app can
// render a clear configuration-error screen instead of a broken/blank UI.
export const supabaseConfigured = !!supabaseUrl && !!supabaseAnonKey
const configured = supabaseConfigured

if (!configured) {
  // Don't hard-crash the whole app (that shows a blank white page on Vercel).
  // Log loudly instead — the fix is to set the env vars in the host.
  console.error(
    '[EBEXTA] Missing Supabase env vars. Set VITE_SUPABASE_URL and ' +
    'VITE_SUPABASE_ANON_KEY in Vercel → Settings → Environment Variables, then redeploy.'
  )
}

/**
 * A single place that sees every 401/403, so no query has to remember to check.
 *
 * sessionHealth registers the real handler at startup. It is kept as a
 * registration rather than a direct import because sessionHealth needs this
 * client — importing it here would be circular.
 */
type AuthFailureHandler = (detail: string) => void
let authFailureHandler: AuthFailureHandler | null = null

export function registerAuthFailureHandler(fn: AuthFailureHandler) {
  authFailureHandler = fn
}

/**
 * Wraps fetch so auth failures are recognised as auth failures.
 *
 * Without this, a dead session produced a stream of 403s that every screen
 * reported as "couldn't load your data" — sending the user to look for a
 * problem in the wrong place entirely.
 */
const trackedFetch: typeof fetch = async (input, init) => {
  try {
    const res = await fetch(input, init)
    // Only 401 Unauthorized indicates a dead/expired JWT.
    // 403 Forbidden is an RLS/permission check on data and must NOT destroy the user's session.
    if (res.status === 401) {
      const url = typeof input === 'string' ? input : String((input as Request)?.url ?? input)
      if (!url.includes('/auth/v1/')) {
        authFailureHandler?.(`401 on ${url.split('?')[0].split('/').pop() ?? 'request'}`)
      }
    }
    return res
  } catch (err) {
    // Refresh calls that die mid-flight land here — the TypeError: Failed to
    // fetch inside _refreshAccessToken. Treat it as connectivity, not identity.
    const url = typeof input === 'string' ? input : String((input as Request)?.url ?? input)
    if (url.includes('/auth/v1/token')) {
      authFailureHandler?.('token refresh failed')
    }
    throw err
  }
}

// Use safe placeholders when unset so createClient never throws at import time
// (an import-time throw is exactly what turns the whole site into a blank page).
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: trackedFetch },
  },
)

// Seamlessly route ebexta_ RPC calls to legacy ebexta_ functions if the database schema is pending migration
const origRpc = supabase.rpc.bind(supabase)
// @ts-ignore - transparent wrapper preserving signature
supabase.rpc = (fnName: string, args?: any, options?: any) => {
  return origRpc(fnName as any, args, options).then(async (res: any) => {
    if (res.error && res.error.code === 'PGRST202' && typeof fnName === 'string' && fnName.startsWith('ebexta_')) {
      const fallback = fnName.replace(/^ebexta_/, 'ketag_')
      const r2 = await origRpc(fallback as any, args, options)
      if (!r2.error || r2.error.code !== 'PGRST202') return r2
    }
    return res
  })
}

// Session probe on startup — avoids querying tables that require specific RLS filters
if (configured) {
  void supabase.auth.getSession()
}
