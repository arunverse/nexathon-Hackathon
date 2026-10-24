import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PlanRequestForm } from '../../components/PlanRequestForm'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { currentPeriodStart, nextResetDate } from '../../lib/billingPeriod'
import {
  fetchBalance, fetchMyLedger, summarise, formatCycleEnd,
  type CreditSummary, type LedgerEntry,
} from '../../lib/credits'
import { formatDate, relativeDate } from '../../lib/dateFormat'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

interface Profile {
  plan: string | null; plan_status: string | null; credit_limit: number | null
  credits_reset_at: string | null; plan_expires_at: string | null; company_name: string | null; website: string | null
}
interface Req { id: string; kind: string | null; plan: string | null; status: string | null; created_at: string }

const STATUS_TONE: Record<string, { c: string; bg: string }> = {
  pending:   { c: 'var(--warning)', bg: 'var(--warning-bg)' },
  contacted: { c: 'var(--accent-interactive)', bg: 'var(--accent-subtle)' },
  activated: { c: 'var(--success)', bg: 'var(--success-bg)' },
  declined:  { c: 'var(--critical)', bg: 'var(--critical-bg)' },
}

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

function Ring({ used, total, label, sublabel }: {
  used: number; total: number; label: string; sublabel: string
}) {
  const left = Math.max(0, total - used)
  const pct = total > 0 ? Math.min(1, used / total) : 0
  const size = 120, stroke = 10
  const r = (size - stroke) / 2
  const circumference = 2 * Math.PI * r

  const color = left <= 0 ? 'var(--critical)'
    : total > 0 && left / total <= 0.2 ? 'var(--warning)'
    : 'var(--accent-interactive)'

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
          <span className="text-[24px] font-bold mono-val leading-none" style={{ color: 'var(--text-primary)' }}>
            {left}
          </span>
          <span className="text-[9px] tracking-[0.06em] uppercase mt-1" style={{ color: 'var(--text-muted)' }}>
            left
          </span>
        </div>
      </div>
      <p className="text-[13px] font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>{label}</p>
      <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{sublabel}</p>
    </div>
  )
}

export default function RenewPlan() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [reqs, setReqs] = useState<Req[]>([])
  const [used, setUsed] = useState(0)
  const [summary, setSummary] = useState<CreditSummary | null>(null)
  const [ledger, setLedger] = useState<LedgerEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [sent, setSent] = useState(false)

  const load = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    const [{ data: p }, { data: rs }, { data: use }, snap, rows] = await Promise.all([
      supabase.from('profiles').select('plan, plan_status, credit_limit, credits_reset_at, plan_expires_at, company_name, website').eq('id', user.id).maybeSingle(),
      supabase.from('plan_requests').select('id, kind, plan, status, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
      supabase.from('api_usage').select('calls, created_at').eq('user_id', user.id).gte('created_at', monthStart.toISOString()),
      fetchBalance(true),
      fetchMyLedger(150),
    ])
    setProfile((p as Profile) ?? null)
    setReqs((rs as Req[]) ?? [])
    const since = currentPeriodStart((p as Profile)?.credits_reset_at ?? null)
    const u = ((use as { calls: number | null; created_at: string }[]) ?? [])
      .filter(r => new Date(r.created_at) >= since).reduce((s, r) => s + (r.calls ?? 1), 0)
    setUsed(u)
    setSummary(summarise(snap.credits))
    setLedger(rows)
    setLoading(false)
  }, [user])

  useEffect(() => { void load() }, [load])

  const limit = profile?.credit_limit ?? 0
  const remaining = Math.max(0, limit - used)
  const pct = limit > 0 ? Math.min(100, Math.round((used / limit) * 100)) : 0
  const planName = (profile?.plan || 'starter').toUpperCase()
  const expires = profile?.plan_expires_at ? new Date(profile.plan_expires_at) : null
  const reset = nextResetDate(profile?.credits_reset_at ?? null)
  const sender = resolveSenderProfile({ company_name: profile?.company_name, website: profile?.website })

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />
      <main className="ml-0 md:ml-[240px] flex-1 p-4 md:p-8 pt-16 md:pt-8 min-h-screen max-w-full overflow-x-hidden">
        <div className="mb-6 max-w-[840px]">
          <h1 className="text-[28px] font-bold text-on-surface" style={geist}>Your Plan, Usage & Renewal</h1>
          <p className="text-[13px] text-on-surface-variant">
            Track credit metering, cycle resets, ledger activity, and top up credits with the EBEXTA team.
          </p>
        </div>

        {loading ? (
          <p className="text-[13px] text-on-surface-variant">Loading plan &amp; credit details…</p>
        ) : (
          <div className="max-w-[840px] space-y-6">
            {/* Current plan cards */}
            <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Current plan</p>
                <p className="text-[24px] font-bold" style={geist}>{planName}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  {profile?.plan_status === 'active' ? (expires ? `Active until ${expires.toLocaleDateString()}` : 'Active') : profile?.plan_status === 'trial' ? 'Trial' : profile?.plan_status ?? 'Inactive'}
                </p>
              </div>
              <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Credits left</p>
                <p className="text-[24px] font-bold" style={geist}>{remaining.toLocaleString()}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>of {limit.toLocaleString()} this cycle</p>
              </div>
              <div className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[11px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Resets on</p>
                <p className="text-[24px] font-bold" style={geist}>{reset.toLocaleDateString()}</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>{pct}% used</p>
              </div>
            </section>

            {/* Credit Rings Breakdown (From Usage Page) */}
            {summary && (
              <section className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <h2 className="text-[14px] font-bold mb-4" style={geist}>Cycle Credit Usage Breakdown</h2>
                <div className="flex flex-wrap items-center justify-around gap-6">
                  <Ring
                    used={summary.scansUsed} total={summary.scansTotal}
                    label="Scans"
                    sublabel={`${summary.scansUsed} of ${summary.scansTotal} used`}
                  />
                  <Ring
                    used={summary.verifiedUsed} total={summary.verifiedTotal}
                    label="Verified Contacts"
                    sublabel={`${summary.verifiedUsed} of ${summary.verifiedTotal} used`}
                  />
                  <div className="text-center">
                    <p className="text-[10px] font-bold uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--text-muted)' }}>Cycle Status</p>
                    <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {summary.daysLeft} day{summary.daysLeft === 1 ? '' : 's'} left
                    </p>
                    <p className="text-[11.5px] mt-1" style={{ color: 'var(--text-muted)' }}>
                      Renews {formatCycleEnd(summary.cycleEnd)}
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Usage Progress Bar */}
            <section className="p-5 rounded-2xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex justify-between items-center mb-2">
                <span className="text-[13px] font-semibold text-on-surface">Credit usage this cycle</span>
                <span className="text-[13px] font-mono text-on-surface-variant">{used.toLocaleString()} / {limit.toLocaleString()}</span>
              </div>
              <div className="h-2.5 w-full rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: pct >= 90 ? 'var(--critical)' : pct >= 70 ? 'var(--warning)' : 'var(--accent-interactive)' }} />
              </div>
            </section>

            {/* Renewal / session request */}
            {sent ? (
              <section className="p-6 rounded-2xl text-center" style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
                <span className="material-symbols-outlined text-[30px]" style={{ color: 'var(--success)' }}>mark_email_read</span>
                <p className="text-[15px] font-bold mt-2" style={{ color: 'var(--success)' }}>Request sent</p>
                <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>The EBEXTA team will reach out to schedule your session.</p>
              </section>
            ) : showForm ? (
              <PlanRequestForm
                plan={profile?.plan || 'growth'}
                kind="renew"
                prefill={{ company_name: sender.companyName !== 'Your Company' ? sender.companyName : '', website: sender.website, contact_name: user?.email?.split('@')[0] }}
                onSubmitted={() => { setShowForm(false); setSent(true); void load() }}
              />
            ) : (
              <section className="p-6 rounded-2xl flex flex-wrap items-center justify-between gap-4" style={{ background: 'var(--navy)' }}>
                <div>
                  <p className="text-[16px] font-bold" style={{ ...geist, color: '#F5F3EF' }}>Need more credits or a renewal?</p>
                  <p className="text-[13px] mt-0.5" style={{ color: 'var(--steel)' }}>Request a session: we'll review your usage and top you up.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="h-11 px-6 rounded-lg text-[14px] font-bold cursor-pointer" style={{ background: '#F5F3EF', color: 'var(--navy)' }}>
                  Request a session
                </button>
              </section>
            )}

            {/* Real-time Credit Ledger Activity (From Usage Page) */}
            <section className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <h2 className="text-[15px] font-semibold mb-3" style={geist}>
                Credit Movement Activity Ledger
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
            </section>

            {/* Request history */}
            {reqs.length > 0 && (
              <section className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                <div className="px-5 py-3" style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h2 className="text-[14px] font-bold" style={geist}>Your requests</h2>
                </div>
                {reqs.map(r => {
                  const tone = STATUS_TONE[r.status ?? 'pending'] ?? STATUS_TONE.pending
                  return (
                    <div key={r.id} className="px-5 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                      <div>
                        <p className="text-[13px] font-semibold text-on-surface capitalize">{r.kind} · {r.plan ?? 'Custom'}</p>
                        <p className="text-[11px] text-on-surface-variant">{new Date(r.created_at).toLocaleString()}</p>
                      </div>
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full capitalize" style={{ color: tone.c, background: tone.bg }}>{r.status}</span>
                    </div>
                  )
                })}
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
