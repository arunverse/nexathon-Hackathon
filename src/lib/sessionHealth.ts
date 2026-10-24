/**
 * SESSION HEALTH — one place that decides what a 401/403 means.
 * ---------------------------------------------------------------------------
 * The failure this exists to stop: the Supabase token refresh fails, the client
 * keeps the dead token, and every subsequent query returns 403. The user sees a
 * dashboard full of "couldn't load" errors and has no idea their session is the
 * problem. Cascading 403s are not a data problem and must never be reported as
 * one.
 *
 * The rules:
 *   1. Offline beats everything. If the network is down, nothing is wrong with
 *      the session and signing the user out would be actively harmful.
 *   2. One refresh attempt. Tokens expire routinely; a single retry fixes most
 *      of these silently.
 *   3. If the refresh fails, sign out cleanly and say why. A dead session left
 *      running is worse than being asked to log in again.
 */

import { supabase, registerAuthFailureHandler } from './supabase'

export type SessionState = 'healthy' | 'offline' | 'expired'

type Listener = (state: SessionState) => void

const listeners = new Set<Listener>()
let current: SessionState = 'healthy'
/** Guards against a burst of parallel 403s all triggering their own recovery. */
let recovering: Promise<boolean> | null = null

export function sessionState(): SessionState {
  return current
}

export function onSessionState(fn: Listener): () => void {
  listeners.add(fn)
  fn(current)
  return () => { listeners.delete(fn) }
}

function set(state: SessionState) {
  if (current === state) return
  current = state
  listeners.forEach(fn => fn(state))
}

/** Is this an auth failure, as opposed to a genuine data error? */
export function isAuthError(err: unknown): boolean {
  if (!err) return false
  const e = err as { status?: number; code?: string; message?: string }
  if (e.status === 401) return true
  if (e.code === 'PGRST301') return true
  const m = (e.message ?? '').toLowerCase()
  return m.includes('jwt expired')
    || m.includes('invalid claim')
    || m.includes('token is expired')
    || m.includes('not authenticated')
}

/** Is this the browser having no connection, rather than anything server-side? */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true
  const m = ((err as Error)?.message ?? '').toLowerCase()
  return m.includes('failed to fetch')
    || m.includes('networkerror')
    || m.includes('err_internet_disconnected')
    || m.includes('err_timed_out')
}

/**
 * Handle a suspected auth failure. Returns true if the session was recovered.
 *
 * Safe to call from anywhere, as often as you like — concurrent callers share
 * one recovery attempt.
 */
export async function handleAuthFailure(detail = ''): Promise<boolean> {
  // Offline is not an expired session. Say the true thing.
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    set('offline')
    return false
  }

  if (recovering) return recovering

  recovering = (async () => {
    try {
      console.warn(`[EBEXTA] Auth failure${detail ? ` (${detail})` : ''} — attempting one session refresh`)
      const { data, error } = await supabase.auth.refreshSession()
      if (!error && data.session) {
        console.info('[EBEXTA] Session refreshed — carrying on')
        set('healthy')
        return true
      }

      // The refresh itself failed because the connection dropped mid-flight.
      // That is a network problem, not an expired session.
      if (isOfflineError(error)) {
        set('offline')
        return false
      }

      console.warn('[EBEXTA] Session could not be refreshed — signing out cleanly')
      set('expired')
      await supabase.auth.signOut().catch(() => { /* already gone */ })
      try {
        Object.keys(localStorage)
          .filter(k => k.startsWith('ebexta_'))
          .forEach(k => localStorage.removeItem(k))
      } catch { /* ignore */ }
      return false
    } finally {
      // Allow a future failure to try again.
      setTimeout(() => { recovering = null }, 2000)
    }
  })()

  return recovering
}

/** Wire browser connectivity into the same state machine. */
export function startConnectivityWatch(): () => void {
  if (typeof window === 'undefined') return () => {}

  const goOffline = () => set('offline')
  const goOnline = () => {
    // Back online — the session may simply have gone stale while we were away.
    if (current === 'offline') set('healthy')
    void supabase.auth.getSession()
  }

  if (navigator.onLine === false) set('offline')
  window.addEventListener('offline', goOffline)
  window.addEventListener('online', goOnline)
  return () => {
    window.removeEventListener('offline', goOffline)
    window.removeEventListener('online', goOnline)
  }
}

/** Clear the expired flag once the user has signed in again. */
export function markSessionHealthy() {
  set('healthy')
}

// Every 401/403 from a data request now lands here, wherever it came from.
registerAuthFailureHandler(detail => { void handleAuthFailure(detail) })
