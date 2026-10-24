/**
 * /dashboard/usage — what you've used, what's left, and every movement.
 *
 * Two rings, the cycle dates, and the full ledger. Nothing is estimated: every
 * row here is a real credit movement recorded server-side.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import {
  fetchBalance, fetchMyLedger, summarise, formatCycleEnd,
  type CreditSummary, type LedgerEntry,
} from '../../lib/credits'
import { formatDate, relativeDate } from '../../lib/dateFormat'

// ─── Progress ring ────────────────────────────────────────────────────────────

function Ring({ used, total, label, sublabel }: {
  used: number; total: number; label: string; sublabel: string
}) {
  const left = Math.max(0, total - used)
  const pct = total > 0 ? Math.min(1, used / total) : 0
  const size = 132, stroke = 11
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  const color = left <= 0 ? 'var(--critical)'
    : total > 0 && left / total <= 0.2 ? 'var(--warning)'
    : 'var(--accent)'

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--bg-surface)" strokeWidth={stroke} />
          <motion.circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke={color} strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: circumference * (1 - pct) }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[26px] font-bold mono-val leading-none" style={{ color: 'var(--text-primary)' }}>
            {left}
          </span>
          <span className="text-[10px] tracking-[0.06em] uppercase mt-1" style={{ color: 'var(--text-muted)' }}>
            left
          </span>
        </div>
      </div>
      <p className="text-[13.5px] font-semibold mt-3" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
    </div>
  )
}

// ─── Ledger row meta ──────────────────────────────────────────────────────────

const ACTION_META: Record<string, { icon: string; label: string }> = {
  scan:              { icon: 'radar',         label: 'Scan' },
  verified_contact:  { icon: 'verified_user', label: 'Verified contact' },
  refund:            { icon: 'undo',          label: 'Refund' },
  admin_grant:       { icon: 'card_giftcard', label: 'Credits granted' },
  topup:             { icon: 'add_card',      label: 'Top-up' },
  reset:             { icon: 'autorenew',     label: 'Cycle renewed' },
  site_walkthrough:  { icon: 'travel_explore', label: 'Site walkthrough' },
  email:             { icon: 'mail',          label: 'Email' },
  proposal:          { icon: 'description',   label: 'Proposal' },
}

export default function UsagePage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [paused, setPaused] = useState<{ on: boolean; reason: string | null }>({ on: false, reason: null })
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!user) return
    // force: this page exists to show the current balance, so it is the one
    // caller that should bypass the shared cache rather than read it.
    const [snap, rows] = await Promise.all([fetchBalance(true), fetchMyLedger(150)])
    setSummary(summarise(snap.credits))
    setPaused({ on: snap.paused, reason: snap.pauseReason })
    setLedger(rows)
    setLoading(false)
  }, [user])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]"
              style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>toll</span>
            <h1 className="text-[26px] font-bold tracking-[-0.03em]"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Usage
            </h1>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            What you've used this cycle, and every credit movement on your account.
          </p>
        </motion.div>

        {paused.on && (
          <div className="mb-5 rounded-xl px-4 py-3 flex items-start gap-2.5"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--warning)' }}>pause_circle</span>
            <p className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>
              {paused.reason || 'EBEXTA is temporarily paused. New scans will resume shortly.'}
            </p>
          </div>
        )}

        {loading ? (
          <div className="h-[240px] rounded-2xl animate-pulse"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
        ) : !summary ? (
          <div className="rounded-2xl premium-card px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[34px] mb-3 block"
              style={{ color: 'var(--text-muted)' }}>toll</span>
            <p className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              No credit account yet.
            </p>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              This appears once your plan is active. Nothing is being metered right now.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Rings + cycle */}
            <div className="rounded-2xl premium-card px-5 py-6" style={{ borderRadius: 16 }}>
              <div className="flex flex-wrap items-center justify-around gap-8">
                <Ring
                  used={summary.scansUsed} total={summary.scansTotal}
                  label="Scans"
                  sublabel={`${summary.scansUsed} of ${summary.scansTotal} used`}
                />
                <Ring
                  used={summary.verifiedUsed} total={summary.verifiedTotal}
                  label="Verified contacts"
                  sublabel={`${summary.verifiedUsed} of ${summary.verifiedTotal} used`}
                />

                <div className="text-center">
                  <p className="label-xs mb-1">Cycle</p>
                  <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {summary.daysLeft} day{summary.daysLeft === 1 ? '' : 's'} left
                  </p>
                  <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Renews {formatCycleEnd(summary.cycleEnd)}
                  </p>
                  <button onClick={() => navigate('/dashboard/renew')}
                    className="premium-btn mt-3 px-4 py-2 rounded-xl text-[12.5px]">
                    Add credits
                  </button>
                </div>
              </div>

              {summary.suspended && (
                <p className="text-[12.5px] mt-4 px-3 py-2 rounded-lg"
                  style={{ background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}>
                  {summary.suspendReason || 'Your account is paused. Please contact support.'}
                </p>
              )}
            </div>

            {/* Ledger */}
            <div className="rounded-2xl premium-card px-5 py-4" style={{ borderRadius: 16 }}>
              <h2 className="text-[15px] font-semibold mb-3"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                Activity
              </h2>

              {ledger.length === 0 ? (
                <p className="text-[12.5px] py-4" style={{ color: 'var(--text-muted)' }}>
                  Nothing yet. Your scans and verified-contact requests will appear here as you use them.
                </p>
              ) : (
                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                  {ledger.map((row, i) => {
                    const meta = ACTION_META[row.action] ?? { icon: 'circle', label: row.action }
                    const positive = row.amount > 0
                    return (
                      <div key={row.id}
                        className="flex items-center gap-3 px-3.5 py-2.5"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                        }}>
                        <span className="material-symbols-outlined text-[16px] shrink-0"
                          style={{ color: positive ? 'var(--success)' : 'var(--text-muted)' }}>
                          {meta.icon}
                        </span>

                        <div className="min-w-0 flex-1">
                          <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {meta.label}
                          </p>
                          {row.note && (
                            <p className="text-[11.5px] truncate" style={{ color: 'var(--text-muted)' }}>
                              {row.note}
                            </p>
                          )}
                        </div>

                        <div className="text-right shrink-0 hidden sm:block" style={{ minWidth: 92 }}>
                          <p className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                            {formatDate(row.created_at)}
                          </p>
                          <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {relativeDate(row.created_at)}
                          </p>
                        </div>

                        <span className="text-[13px] font-bold mono-val shrink-0" style={{
                          width: 42, textAlign: 'right',
                          color: positive ? 'var(--success)' : 'var(--text-primary)',
                        }}>
                          {positive ? '+' : ''}{row.amount}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
