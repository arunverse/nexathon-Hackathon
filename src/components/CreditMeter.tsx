/**
 * HEADER & SIDEBAR CREDIT METER — "4/40 SCANS · 0/10 VERIFIED"
 *
 * Elegantly displays the user's scan balance and verified contacts quota.
 * Full width, aligned, and color-coded based on usage thresholds.
 */

import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import {
  fetchBalance, onBalanceChange, summarise,
  type BalanceSnapshot, type CreditSummary,
} from '../lib/credits'

function toneFor(left: number, total: number): string {
  if (total <= 0) return 'var(--text-muted)'
  if (left <= 0) return 'var(--critical)'
  if (left / total <= 0.2) return 'var(--warning)'
  return 'var(--text-primary)'
}

export function CreditMeter({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [paused, setPaused] = useState(false)

  const userId = user?.id ?? null

  useEffect(() => {
    if (!userId) return
    let alive = true

    const apply = (snap: BalanceSnapshot) => {
      if (!alive) return
      setSummary(summarise(snap.credits))
      setPaused(snap.paused)
    }

    const unsubscribe = onBalanceChange(apply)
    void fetchBalance().then(apply)

    return () => { alive = false; unsubscribe() }
  }, [userId])

  if (!summary) return null

  const scanTone = toneFor(summary.scansLeft, summary.scansTotal)
  const verifiedTone = toneFor(summary.verifiedLeft, summary.verifiedTotal)

  return (
    <button
      onClick={() => navigate('/dashboard/usage')}
      title={`Plan usage: ${summary.scansUsed}/${summary.scansTotal} scans, ${summary.verifiedUsed}/${summary.verifiedTotal} verified contacts. Renews in ${summary.daysLeft} day${summary.daysLeft === 1 ? '' : 's'}. Click to view usage details.`}
      className={`w-full flex items-center justify-between rounded-xl transition-all duration-150 hover:brightness-105 active:scale-[0.99] cursor-pointer group ${
        compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
      }`}
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center w-full">
        {/* ── Scans quota ── */}
        <div className="flex items-center justify-center gap-1 min-w-0">
          <span
            className="material-symbols-outlined text-[13px] shrink-0 transition-transform duration-200 group-hover:scale-110"
            style={{ color: 'var(--accent-interactive)' }}
          >
            radar
          </span>
          <span className="text-[11px] font-bold font-mono leading-none shrink-0" style={{ color: scanTone }}>
            {summary.scansUsed}/{summary.scansTotal}
          </span>
          <span className="text-[8.5px] font-bold tracking-wider uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
            SCANS
          </span>
        </div>

        {/* ── Divider ── */}
        <div className="w-px h-3 mx-1 shrink-0" style={{ background: 'var(--border-subtle)' }} />

        {/* ── Verified contacts quota ── */}
        <div className="flex items-center justify-center gap-1 min-w-0">
          <span
            className="material-symbols-outlined text-[13px] shrink-0 transition-transform duration-200 group-hover:scale-110"
            style={{ color: 'var(--text-secondary)' }}
          >
            verified
          </span>
          <span className="text-[11px] font-bold font-mono leading-none shrink-0" style={{ color: verifiedTone }}>
            {summary.verifiedUsed}/{summary.verifiedTotal}
          </span>
          <span className="text-[8.5px] font-bold tracking-wider uppercase shrink-0" style={{ color: 'var(--text-muted)' }}>
            VERIFIED
          </span>
        </div>
      </div>

      {/* ── Status badge if paused ── */}
      {paused && (
        <span
          className="material-symbols-outlined text-[13px] ml-1 shrink-0"
          style={{ color: 'var(--warning)' }}
          title="EBEXTA is paused"
        >
          pause_circle
        </span>
      )}
    </button>
  )
}

