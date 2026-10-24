/**
 * CompareModal — put two companies side by side.
 *
 * The user picks Company A and Company B from the leads currently on their
 * board (two dropdowns at the top). Below, every metric that matters is laid
 * out row by row; for numeric rows the stronger side is highlighted so the
 * "who's the better bet" answer is obvious at a glance.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScannedLead } from '../lib/scanEngine'

type Better = 'high' | 'low' | null

interface Row {
  label: string
  icon: string
  /** 'score' renders a bar, 'num' a plain number, 'text' a string, 'list' bullets */
  kind: 'score' | 'num' | 'text' | 'list' | 'badge'
  better?: Better
  /** raw comparable value for highlighting (number) */
  value: (l: ScannedLead) => number | null
  /** what to show */
  render: (l: ScannedLead) => string | string[]
}

const dash = (v: unknown) => {
  const s = v == null ? '' : String(v).trim()
  return s.length ? s : '—'
}

const dealSize = (l: ScannedLead) => {
  const b = l.business_impact
  if (!b) return '—'
  const a = (b.expected_deal_size_min || '').trim()
  const c = (b.expected_deal_size_max || '').trim()
  if (!a && !c) return '—'
  return a && c ? `${a} – ${c}` : a || c
}

const ROWS: Row[] = [
  { label: 'Intent score', icon: 'bolt', kind: 'score', better: 'high',
    value: l => l.intent_score ?? null, render: l => String(l.intent_score ?? '—') },
  { label: 'Match score', icon: 'target', kind: 'score', better: 'high',
    value: l => l.match_score ?? null, render: l => String(l.match_score ?? '—') },
  { label: 'Confidence', icon: 'verified', kind: 'score', better: 'high',
    value: l => l.confidence_score ?? null, render: l => String(l.confidence_score ?? '—') },
  { label: 'Trust score', icon: 'workspace_premium', kind: 'score', better: 'high',
    value: l => l.trust_score ?? null, render: l => String(l.trust_score ?? '—') },
  { label: 'Verified by EBEXTA', icon: 'shield', kind: 'badge', better: 'high',
    value: l => (l.ebexta_verified ? 1 : 0), render: l => (l.ebexta_verified ? 'Verified' : 'Not yet') },
  { label: 'Industry', icon: 'category', kind: 'text',
    value: () => null, render: l => dash(l.industry) },
  { label: 'Location', icon: 'location_on', kind: 'text',
    value: () => null, render: l => dash(l.location) },
  { label: 'Employees', icon: 'groups', kind: 'num', better: 'high',
    value: l => l.employee_count ?? null, render: l => (l.employee_count ? l.employee_count.toLocaleString() : '—') },
  { label: 'Revenue', icon: 'monitoring', kind: 'text',
    value: () => null, render: l => dash(l.annual_revenue) },
  { label: 'Stage', icon: 'stairs', kind: 'text',
    value: () => null, render: l => dash(l.funding_stage) },
  { label: 'Funding', icon: 'payments', kind: 'text',
    value: () => null, render: l => dash(l.funding_details) },
  { label: 'Expected deal size', icon: 'sell', kind: 'text',
    value: () => null, render: l => dealSize(l) },
  { label: 'Win probability', icon: 'trending_up', kind: 'score', better: 'high',
    value: l => l.business_impact?.success_probability ?? null,
    render: l => (l.business_impact?.success_probability != null ? `${l.business_impact.success_probability}%` : '—') },
  { label: 'Reply probability', icon: 'forum', kind: 'score', better: 'high',
    value: l => l.business_impact?.response_probability ?? null,
    render: l => (l.business_impact?.response_probability != null ? `${l.business_impact.response_probability}%` : '—') },
  { label: 'Est. decision time', icon: 'schedule', kind: 'num', better: 'low',
    value: l => l.business_impact?.estimated_decision_days ?? null,
    render: l => (l.business_impact?.estimated_decision_days != null ? `${l.business_impact.estimated_decision_days} days` : '—') },
  { label: 'Recent signals', icon: 'radar', kind: 'list',
    value: () => null, render: l => (l.recent_signals?.length ? l.recent_signals.slice(0, 4) : ['—']) },
  { label: 'Why it matches', icon: 'lightbulb', kind: 'list',
    value: () => null,
    render: l => {
      const r = (l.match_reason?.length ? l.match_reason : l.business_impact?.match_reasons) ?? []
      return r.length ? r.slice(0, 4) : (l.requirement_theme ? [l.requirement_theme] : ['—'])
    } },
]

/** which side wins this row: 'a' | 'b' | null (tie / non-numeric) */
function winner(row: Row, a: ScannedLead, b: ScannedLead): 'a' | 'b' | null {
  if (!row.better) return null
  const va = row.value(a); const vb = row.value(b)
  if (va == null || vb == null || va === vb) return null
  if (row.better === 'high') return va > vb ? 'a' : 'b'
  return va < vb ? 'a' : 'b'
}

function ScoreBar({ v, on }: { v: number | null; on: boolean }) {
  const pct = Math.max(0, Math.min(100, v ?? 0))
  return (
    <div className="h-1.5 rounded-full mt-1.5 w-full" style={{ background: 'var(--border-subtle)' }}>
      <div className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: on ? 'var(--accent)' : 'var(--text-muted)' }} />
    </div>
  )
}

function Cell({ row, lead, win }: { row: Row; lead: ScannedLead; win: boolean }) {
  const out = row.render(lead)
  const numVal = row.value(lead)
  return (
    <div className="flex-1 min-w-0 rounded-xl px-3.5 py-2.5"
      style={{
        background: win ? 'var(--accent-subtle)' : 'var(--bg-base)',
        border: `1px solid ${win ? 'var(--accent)' : 'var(--border-subtle)'}`,
      }}>
      {row.kind === 'list' ? (
        <ul className="space-y-1">
          {(out as string[]).map((t, i) => (
            <li key={i} className="text-[12.5px] leading-snug flex gap-1.5 break-words" style={{ color: 'var(--text-secondary)' }}>
              {t !== '—' && <span className="mt-[6px] w-1 h-1 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}
              <span className="min-w-0">{t}</span>
            </li>
          ))}
        </ul>
      ) : row.kind === 'badge' ? (
        <span className="inline-flex items-center gap-1 text-[12.5px] font-bold"
          style={{ color: win ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>
          {win && <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>}
          {out as string}
        </span>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <span className="text-[15px] font-bold break-words" style={{ color: win ? 'var(--accent-interactive)' : 'var(--text-primary)' }}>
              {out as string}
            </span>
            {win && <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--accent)' }}>arrow_upward</span>}
          </div>
          {row.kind === 'score' && <ScoreBar v={numVal} on={win} />}
        </>
      )}
    </div>
  )
}

export function CompareModal({ leads, initialA, initialB, onClose }: {
  leads: ScannedLead[]
  initialA?: string
  initialB?: string
  onClose: () => void
}) {
  const first = initialA ?? leads[0]?.id ?? ''
  const second = initialB ?? leads.find(l => l.id !== first)?.id ?? leads[1]?.id ?? ''
  const [aId, setAId] = useState(first)
  const [bId, setBId] = useState(second)

  const a = leads.find(l => l.id === aId)
  const b = leads.find(l => l.id === bId)

  const selectStyle = {
    background: 'var(--bg-base)', border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  } as const

  // headline: who leads on the four core scores
  const coreWins = a && b
    ? ROWS.slice(0, 4).reduce((acc, r) => {
        const w = winner(r, a, b); if (w === 'a') acc.a++; else if (w === 'b') acc.b++; return acc
      }, { a: 0, b: 0 })
    : { a: 0, b: 0 }
  const leader = a && b ? (coreWins.a > coreWins.b ? a : coreWins.b > coreWins.a ? b : null) : null

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-start justify-center p-4 overflow-y-auto custom-scrollbar"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[860px] my-6 rounded-2xl"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>

        {/* header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--accent-interactive)' }}>compare_arrows</span>
            <div className="min-w-0">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Compare companies</h2>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Side by side — the stronger side is highlighted on each row.</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
          </button>
        </div>

        {/* pickers */}
        <div className="flex gap-3 px-6 pt-4">
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--text-muted)' }}>Company A</label>
            <select value={aId} onChange={e => setAId(e.target.value)} className="w-full text-[13px] rounded-xl px-3 py-2.5 outline-none cursor-pointer" style={selectStyle}>
              {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
            </select>
          </div>
          <div className="flex items-end pb-2.5">
            <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>swap_horiz</span>
          </div>
          <div className="flex-1 min-w-0">
            <label className="block text-[10px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--text-muted)' }}>Company B</label>
            <select value={bId} onChange={e => setBId(e.target.value)} className="w-full text-[13px] rounded-xl px-3 py-2.5 outline-none cursor-pointer" style={selectStyle}>
              {leads.map(l => <option key={l.id} value={l.id}>{l.company_name}</option>)}
            </select>
          </div>
        </div>

        {a && b && aId === bId && (
          <p className="px-6 pt-3 text-[12.5px] font-medium" style={{ color: 'var(--warning)' }}>Pick two different companies to compare.</p>
        )}

        {a && b && aId !== bId && (
          <div className="px-6 py-5">
            {/* verdict */}
            {leader && (
              <div className="rounded-xl px-4 py-3 mb-4 flex items-center gap-2.5"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>emoji_events</span>
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--accent-interactive)' }}>{leader.company_name}</strong> leads on the core scores ({Math.max(coreWins.a, coreWins.b)} of 4).
                </p>
              </div>
            )}

            {/* company name headers */}
            <div className="flex gap-3 mb-3">
              <div className="w-[128px] shrink-0" />
              {[a, b].map((l, i) => (
                <div key={i} className="flex-1 min-w-0 text-center">
                  <p className="text-[14px] font-bold break-words" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>{l.company_name}</p>
                  {l.strongly_recommended && (
                    <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-[0.08em] px-2 py-0.5 rounded-full"
                      style={{ background: 'var(--warning)', color: '#1a1205' }}>Recommended</span>
                  )}
                </div>
              ))}
            </div>

            {/* rows */}
            <div className="space-y-2.5">
              {ROWS.map(row => {
                const w = winner(row, a, b)
                return (
                  <div key={row.label} className="flex gap-3 items-stretch">
                    <div className="w-[128px] shrink-0 flex items-center gap-1.5 pt-1">
                      <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--text-muted)' }}>{row.icon}</span>
                      <span className="text-[11.5px] font-semibold leading-tight" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
                    </div>
                    <Cell row={row} lead={a} win={w === 'a'} />
                    <Cell row={row} lead={b} win={w === 'b'} />
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
