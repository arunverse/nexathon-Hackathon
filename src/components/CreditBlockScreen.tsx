/**
 * OUT-OF-CREDITS BLOCK SCREEN.
 *
 * Replaces the scan screen rather than firing a toast — a toast can be missed,
 * and the user needs to understand why nothing is happening.
 *
 * Everything they already paid for stays reachable: leads, saved leads, company
 * memory. Only NEW scans are blocked.
 */

import { useNavigate } from 'react-router-dom'
import { formatCycleEnd } from '../lib/credits'
import type { CreditCheck, BlockCode } from '../lib/credits'

const COPY: Record<BlockCode, { icon: string; title: string; tone: 'critical' | 'warning' }> = {
  NO_CREDITS: { icon: 'toll',            title: 'You\'re out of scans',        tone: 'critical' },
  PAUSED:     { icon: 'pause_circle',    title: 'EBEXTA is paused',             tone: 'warning' },
  DAILY_CAP:  { icon: 'schedule',        title: 'Daily capacity reached',      tone: 'warning' },
  BUDGET:     { icon: 'account_balance', title: 'Monthly capacity reached',    tone: 'warning' },
  SUSPENDED:  { icon: 'block',           title: 'Your account is paused',      tone: 'critical' },
  THROTTLED:  { icon: 'speed',           title: 'Slow down for a moment',      tone: 'warning' },
}

export function CreditBlockScreen({ check }: { check: CreditCheck }) {
  const navigate = useNavigate()
  const meta = COPY[check.code ?? 'NO_CREDITS'] ?? COPY.NO_CREDITS
  const color = meta.tone === 'critical' ? 'var(--critical)' : 'var(--warning)'
  const bg = meta.tone === 'critical' ? 'var(--critical-bg)' : 'var(--warning-bg)'

  const renews = check.cycle_end ? formatCycleEnd(check.cycle_end) : null

  return (
    <div className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'var(--bg-base)' }}>
      <div className="w-full max-w-[520px] rounded-2xl premium-card px-7 py-9 text-center"
        style={{ borderRadius: 18 }}>

        <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
          style={{ background: bg, border: `1px solid ${color}` }}>
          <span className="material-symbols-outlined text-[26px]"
            style={{ color, fontVariationSettings: "'FILL' 1" }}>{meta.icon}</span>
        </div>

        <h1 className="text-[21px] font-bold tracking-[-0.02em] mb-2"
          style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
          {meta.title}
        </h1>

        <p className="text-[13.5px] leading-relaxed mb-1" style={{ color: 'var(--text-secondary)' }}>
          {check.reason || 'You have used all your scans for this cycle.'}
        </p>

        {renews && check.code === 'NO_CREDITS' && (
          <p className="text-[13px] mb-1" style={{ color: 'var(--text-muted)' }}>
            Renews on {renews}.
          </p>
        )}

        {/* The reassurance that matters most — nothing they already have is gone. */}
        <p className="text-[12.5px] mt-4 mb-6 px-3 py-2.5 rounded-xl leading-relaxed"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
          Your leads, saved leads and company memory are all still here. Only new scans are paused.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-2">
          {check.code === 'NO_CREDITS' && (
            <button onClick={() => navigate('/dashboard/renew')}
              className="premium-btn px-5 py-2.5 rounded-xl text-[13px]">
              Add 10 scans (₹990)
            </button>
          )}
          <button onClick={() => navigate('/dashboard')}
            className="ghost-btn px-5 py-2.5 rounded-xl text-[13px] font-semibold">
            Back to my leads
          </button>
          <button onClick={() => navigate('/dashboard/usage')}
            className="ghost-btn px-5 py-2.5 rounded-xl text-[13px] font-semibold">
            See my usage
          </button>
        </div>

        {check.code === 'SUSPENDED' && (
          <button onClick={() => navigate('/dashboard/settings')}
            className="mt-4 text-[12.5px] underline" style={{ color: 'var(--accent-interactive)' }}>
            Talk to us
          </button>
        )}
      </div>
    </div>
  )
}
