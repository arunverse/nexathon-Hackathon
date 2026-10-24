/**
 * The one place the app tells you your session or connection is the problem.
 *
 * Before this, a dead token surfaced as a dozen unrelated "couldn't load"
 * messages scattered across the dashboard. Now the cause is stated once, at
 * the top, with the action that fixes it.
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  onSessionState, startConnectivityWatch, markSessionHealthy, type SessionState,
} from '../lib/sessionHealth'

export function SessionBanner() {
  const navigate = useNavigate()
  const [state, setState] = useState<SessionState>('healthy')

  useEffect(() => {
    const stopWatch = startConnectivityWatch()
    const unsub = onSessionState(setState)
    return () => { stopWatch(); unsub() }
  }, [])

  if (state === 'healthy') return null

  const offline = state === 'offline'

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[9999] px-4 py-2.5 flex flex-wrap items-center justify-center gap-x-3 gap-y-1.5"
      style={{
        background: offline ? 'var(--bg-elevated)' : 'var(--warning-bg)',
        borderBottom: `1px solid ${offline ? 'var(--border-strong)' : 'var(--warning)'}`,
      }}
      role="status"
    >
      <span className="material-symbols-outlined text-[17px]"
        style={{ color: offline ? 'var(--text-muted)' : 'var(--warning)' }}>
        {offline ? 'wifi_off' : 'lock_clock'}
      </span>

      <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
        {offline
          ? 'You appear to be offline'
          : 'Session expired: please sign in again'}
      </p>

      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
        {offline
          ? 'Nothing is wrong with your account; we will reconnect automatically.'
          : 'Your work is saved. Signing in restores everything.'}
      </p>

      {!offline && (
        <button
          onClick={() => { markSessionHealthy(); navigate('/login') }}
          className="premium-btn px-3.5 py-1.5 rounded-lg text-[12px]"
        >
          Sign in
        </button>
      )}
    </div>
  )
}
