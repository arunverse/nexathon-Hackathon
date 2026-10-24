import { supabase } from './supabase'

export const GOOGLE_CLIENT_ID =
  (import.meta.env.VITE_GOOGLE_CLIENT_ID as string) ||
  '536378349818-dc7n4ga6kuauepsd9sht3mb9d1sdcard.apps.googleusercontent.com'

export interface GoogleAuthResponse {
  success: boolean
  session: {
    access_token: string
    refresh_token: string
    expires_in?: number
  }
  user: {
    id: string
    email?: string
    user_metadata?: Record<string, unknown>
  }
  isNewUser?: boolean
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string
            callback: (response: { credential: string; select_by?: string }) => void
            auto_select?: boolean
            cancel_on_tap_outside?: boolean
            context?: 'signin' | 'signup' | 'use'
          }) => void
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon'
              theme?: 'outline' | 'filled_blue' | 'filled_black'
              size?: 'large' | 'medium' | 'small'
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
              shape?: 'rectangular' | 'pill' | 'circle' | 'square'
              logo_alignment?: 'left' | 'center'
              width?: number | string
              locale?: string
            }
          ) => void
          prompt: (momentListener?: (notification: unknown) => void) => void
          disableAutoSelect: () => void
        }
      }
    }
  }
}

/**
 * Wait for Google Identity Services script to be loaded
 */
export function waitForGoogleScript(timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve()
      return
    }

    const start = Date.now()
    const timer = setInterval(() => {
      if (window.google?.accounts?.id) {
        clearInterval(timer)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(timer)
        reject(new Error('Google Identity Services script failed to load. Please disable ad-blockers and reload.'))
      }
    }, 100)
  })
}

/**
 * Verifies a Google ID token on the EBEXTA backend and exchanges it for a secure session
 */
export async function verifyGoogleTokenOnBackend(
  credential: string,
  metadata?: { mode?: string; plan?: string }
): Promise<GoogleAuthResponse> {
  let resData: GoogleAuthResponse | null = null
  let lastError = 'Google authentication verification failed'

  // 1. Attempt verification via dev server / local API endpoint
  try {
    const res = await fetch('/api/auth/google/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, ...metadata }),
    })

    if (res.ok) {
      resData = (await res.json()) as GoogleAuthResponse
    } else {
      const err = await res.json().catch(() => ({}))
      const serverErrMsg = err?.error || err?.message || (res.status === 404 ? null : `Server rejected login (HTTP ${res.status})`)
      if (serverErrMsg) {
        lastError = serverErrMsg
        console.warn('[GoogleAuth Client] Verification endpoint returned:', serverErrMsg)
      }
      // If 401 (client ID mismatch or bad token), throw immediately so user sees the exact message
      if (res.status === 401 && serverErrMsg) {
        throw new Error(serverErrMsg)
      }
    }
  } catch (err: unknown) {
    if (err instanceof Error && !err.message.includes('Failed to fetch') && !err.message.includes('404')) {
      lastError = err.message
      // If explicit 401 or mismatch error, do not swallow
      if (err.message.includes('audience mismatch') || err.message.includes('expired') || err.message.includes('issuer')) {
        throw err
      }
    }
  }

  // 2. Attempt native Supabase signInWithIdToken (official production GIS flow)
  if (!resData) {
    try {
      const { data: idTokenData, error: idTokenErr } = await supabase.auth.signInWithIdToken({
        provider: 'google',
        token: credential,
      })
      if (!idTokenErr && idTokenData?.session && idTokenData?.user) {
        return {
          success: true,
          session: idTokenData.session,
          user: idTokenData.user,
          isNewUser: false,
        }
      }
      if (idTokenErr) {
        if (idTokenErr.message.includes('not enabled')) {
          lastError = 'Google provider is not enabled in Supabase. Please enable Google in Supabase Dashboard → Authentication → Providers → Google.'
        } else {
          lastError = idTokenErr.message
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error) lastError = e.message
    }
  }

  // 3. Fallback to Supabase Edge Function (auth-google)
  if (!resData) {
    try {
      const { data, error } = await supabase.functions.invoke('auth-google', {
        body: { credential, ...metadata },
      })
      if (!error && data?.session?.access_token) {
        resData = data as GoogleAuthResponse
      } else if (error && !lastError.includes('Supabase Dashboard')) {
        lastError = error.message || lastError
      }
    } catch {
      /* ignore */
    }
  }

  if (!resData?.session?.access_token || !resData?.session?.refresh_token) {
    throw new Error(lastError)
  }

  return resData
}
