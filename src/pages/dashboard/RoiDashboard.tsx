/**
 * /dashboard/roi — the funnel, built from pipeline_events + company_memory.
 *
 * All real data. Nothing is estimated, extrapolated or invented: if the user
 * hasn't logged outcomes, the funnel says so instead of showing made-up numbers.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import {
  fetchCompanyMemories, fetchPipelineEvents, backfillMemoryFromLeads,
  type MemoryListRow, type PipelineEvent,
} from '../../lib/companyMemory'

/** The funnel as displayed. 'lead' is implicit — every remembered company. */
const FUNNEL: Array<{ key: 'lead' | 'contacted' | 'meeting' | 'proposal' | 'won'; label: string; icon: string }> = [
  { key: 'lead',      label: 'Leads found', icon: 'radar' },
  { key: 'contacted', label: 'Contacted',   icon: 'outgoing_mail' },
  { key: 'meeting',   label: 'Meetings',    icon: 'event' },
  { key: 'proposal',  label: 'Proposals',   icon: 'description' },
  { key: 'won',       label: 'Won',         icon: 'emoji_events' },
]

/** All six outcomes, so none of them is a button that appears to do nothing. */
const OUTCOME_CARDS: Array<{ key: string; icon: string; color: string; bg: string }> = [
  { key: 'Won',             icon: 'emoji_events',   color: 'var(--success)',    bg: 'var(--success-bg)' },
  { key: 'Excellent Match', icon: 'auto_awesome',   color: 'var(--success)',    bg: 'var(--success-bg)' },
  { key: 'Lost',            icon: 'do_not_disturb', color: 'var(--critical)',   bg: 'var(--critical-bg)' },
  { key: 'Not Interested',  icon: 'block',          color: 'var(--text-muted)', bg: 'var(--bg-surface)' },
  { key: 'Bad Match',       icon: 'thumb_down',     color: 'var(--warning)',    bg: 'var(--warning-bg)' },
  { key: 'Wrong Contact',   icon: 'person_off',     color: 'var(--critical)',   bg: 'var(--critical-bg)' },
]

function formatMoney(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}

export default function RoiDashboard() {
  const navigate = useNavigate()
  const [memories, setMemories] = useState<MemoryListRow[]>([])
  const [pipeline, setPipeline] = useState<PipelineEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [planCost, setPlanCost] = useState('')

  const load = useCallback(async () => {
    let [m, p] = await Promise.all([fetchCompanyMemories(), fetchPipelineEvents()])
    // Same reason as the Companies page: without the backfill an existing user's
    // funnel reads "0 leads found", which is wrong, not just empty.
    if (m.length === 0) {
      const { created } = await backfillMemoryFromLeads()
      if (created > 0) m = await fetchCompanyMemories()
    }
    setMemories(m)
    setPipeline(p)
    try { setPlanCost(localStorage.getItem('ebexta_plan_cost') ?? '') } catch { /* ignore */ }
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  const stats = useMemo(() => {
    // A company counts once per stage, no matter how many events it logged.
    const reached = new Map<string, Set<string>>()
    for (const ev of pipeline) {
      if (!ev.memory_id || !ev.stage) continue
      const set = reached.get(ev.stage) ?? new Set<string>()
      set.add(ev.memory_id)
      reached.set(ev.stage, set)
    }

    const counts: Record<string, number> = {
      lead: memories.length,
      contacted: reached.get('contacted')?.size ?? 0,
      meeting: reached.get('meeting')?.size ?? 0,
      proposal: reached.get('proposal')?.size ?? 0,
      won: reached.get('won')?.size ?? 0,
    }

    // An outcome of Won is authoritative even if no stage event was logged.
    const wonMemories = memories.filter(m => m.outcome === 'Won')
    counts.won = Math.max(counts.won, wonMemories.length)

    // Revenue = the deal values actually logged on won companies. Never inferred.
    const revenue = wonMemories.reduce((sum, m) => sum + (Number(m.deal_value) || 0), 0)
    const withValue = wonMemories.filter(m => Number(m.deal_value) > 0).length

    const cost = Number(planCost.replace(/[^\d.]/g, ''))
    const hasCost = Number.isFinite(cost) && cost > 0

    // Every outcome gets a home. Previously only 'Won' surfaced anywhere, which
    // made the other five look like dead buttons.
    const byOutcome: Record<string, MemoryListRow[]> = {}
    for (const m of memories) {
      if (!m.outcome) continue
      ;(byOutcome[m.outcome] ??= []).push(m)
    }
    const outcomeCount = (o: string) => byOutcome[o]?.length ?? 0

    // Win rate only counts decided deals — companies you haven't judged yet
    // aren't losses, and 'Wrong Contact' is a data problem, not a lost deal.
    const decided = outcomeCount('Won') + outcomeCount('Lost')
      + outcomeCount('Not Interested') + outcomeCount('Bad Match')
    const winRate = decided > 0 ? (outcomeCount('Won') / decided) * 100 : null

    return {
      counts,
      revenue,
      wonCount: wonMemories.length,
      withValue,
      revenuePerLead: memories.length > 0 ? revenue / memories.length : 0,
      roiMultiple: hasCost ? revenue / cost : null,
      planCostNum: hasCost ? cost : null,
      lost: outcomeCount('Lost'),
      byOutcome,
      outcomeCount,
      decided,
      winRate,
      // Quality feedback — teaches the rule engine, doesn't touch revenue.
      excellentMatch: outcomeCount('Excellent Match'),
      wrongContact: outcomeCount('Wrong Contact'),
      totalLogged: memories.filter(m => m.outcome).length,
      // Have you told EBEXTA what happened to anything yet? Drives the nudge —
      // NOT whether the dashboard renders. Having companies is enough to show
      // the funnel, because "Leads found" is already a real number.
      anyLogged: pipeline.length > 0 || memories.some(m => m.outcome),
    }
  }, [memories, pipeline, planCost])

  const maxCount = Math.max(stats.counts.lead, 1)

  function savePlanCost(v: string) {
    setPlanCost(v)
    try { localStorage.setItem('ebexta_plan_cost', v) } catch { /* quota */ }
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]"
              style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>monitoring</span>
            <h1 className="text-[26px] font-bold tracking-[-0.03em]"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              ROI
            </h1>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Built only from what you’ve logged. EBEXTA never estimates revenue on your behalf.
          </p>
        </motion.div>

        {loading ? (
          <div className="h-[260px] rounded-2xl animate-pulse"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
        ) : memories.length === 0 ? (
          /* Nothing to measure at all — no companies yet. */
          <div className="rounded-2xl premium-card px-6 py-14 text-center">
            <span className="material-symbols-outlined text-[34px] mb-3 block"
              style={{ color: 'var(--text-muted)' }}>insights</span>
            <p className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Log outcomes on your leads to see ROI here.
            </p>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
              Run a scan first: every company found becomes a row you can track.
            </p>
            <button onClick={() => navigate('/scan')}
              className="premium-btn px-4 py-2 rounded-xl text-[13px]">
              Run a scan
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* You have companies but haven't said what happened to any of them.
                Show the real funnel anyway — hiding it made the page look broken. */}
            {!stats.anyLogged && (
              <div className="rounded-2xl px-4 py-3.5 flex flex-wrap items-center gap-3"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
                <span className="material-symbols-outlined text-[18px]"
                  style={{ color: 'var(--accent-interactive)' }}>flag</span>
                <p className="text-[12.5px] flex-1 min-w-[220px]" style={{ color: 'var(--text-primary)' }}>
                  <strong>{memories.length} compan{memories.length === 1 ? 'y' : 'ies'}</strong> tracked, but no
                  outcomes logged yet, so everything below “Leads found” is still zero. Open a company
                  and mark it Won/Lost, or use “Move to” to advance it.
                </p>
                <button onClick={() => navigate('/dashboard/companies')}
                  className="premium-btn px-3.5 py-1.5 rounded-lg text-[12.5px] shrink-0">
                  Open Company Memory
                </button>
              </div>
            )}
            {/* ── Headline numbers ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Revenue logged', value: formatMoney(stats.revenue), hint: `${stats.withValue} of ${stats.wonCount} won deals valued` },
                { label: 'Companies tracked', value: String(memories.length), hint: 'in Company Memory' },
                { label: 'Revenue per lead', value: formatMoney(stats.revenuePerLead), hint: 'across every company' },
                {
                  label: 'ROI multiple',
                  value: stats.roiMultiple != null ? `${stats.roiMultiple.toFixed(1)}×` : '0.0×',
                  hint: stats.roiMultiple != null ? `on ${formatMoney(stats.planCostNum ?? 0)} plan cost` : 'add your plan cost below',
                },
              ].map(card => (
                <div key={card.label} className="rounded-2xl premium-card px-4 py-3.5" style={{ borderRadius: 16 }}>
                  <p className="label-xs mb-1">{card.label}</p>
                  <p className="text-[22px] font-bold mono-val leading-none" style={{ color: 'var(--text-primary)' }}>
                    {card.value}
                  </p>
                  <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{card.hint}</p>
                </div>
              ))}
            </div>

            {/* ── Funnel ── */}
            <div className="rounded-2xl premium-card px-5 py-4" style={{ borderRadius: 16 }}>
              <h2 className="text-[15px] font-semibold mb-4"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                Funnel
              </h2>

              <div className="space-y-2.5">
                {FUNNEL.map((stage, i) => {
                  const count = stats.counts[stage.key] ?? 0
                  const prev = i === 0 ? null : stats.counts[FUNNEL[i - 1].key] ?? 0
                  const conv = prev && prev > 0 ? (count / prev) * 100 : null
                  const width = Math.max(2, (count / maxCount) * 100)
                  return (
                    <div key={stage.key}>
                      <div className="flex items-center gap-2.5 mb-1">
                        <span className="material-symbols-outlined text-[16px] shrink-0"
                          style={{ color: 'var(--accent-interactive)' }}>{stage.icon}</span>
                        <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {stage.label}
                        </span>
                        <span className="text-[14px] font-bold mono-val ml-auto" style={{ color: 'var(--text-primary)' }}>
                          {count}
                        </span>
                        {conv != null && (
                          <span className="text-[11.5px] mono-val shrink-0" style={{ width: 52, textAlign: 'right', color: 'var(--text-muted)' }}>
                            {conv.toFixed(0)}%
                          </span>
                        )}
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${width}%` }}
                          transition={{ duration: 0.5, delay: i * 0.06 }}
                          className="h-full rounded-full"
                          style={{ background: stage.key === 'won' ? 'var(--success)' : 'var(--accent)' }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
                Percentages are conversion to the next stage. “Leads found” counts every company in
                your memory; the rest count companies you’ve moved along the pipeline.
              </p>
            </div>

            {/* ── Outcomes ──
                The funnel only has room for Won, so without this panel the other
                five outcome buttons looked like they did nothing. Every outcome
                you log shows up here. */}
            <div className="rounded-2xl premium-card px-5 py-4" style={{ borderRadius: 16 }}>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-[15px] font-semibold"
                  style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                  Outcomes
                </h2>
                <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                  {stats.totalLogged} of {memories.length} companies judged
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {OUTCOME_CARDS.map(o => {
                  const n = stats.outcomeCount(o.key)
                  const on = n > 0
                  return (
                    <div key={o.key} className="rounded-xl px-3 py-2.5"
                      style={{
                        background: on ? o.bg : 'var(--bg-elevated)',
                        border: `1px solid ${on ? o.color : 'var(--border-subtle)'}`,
                      }}>
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="material-symbols-outlined text-[14px]"
                          style={{ color: on ? o.color : 'var(--text-muted)' }}>{o.icon}</span>
                        <span className="text-[18px] font-bold mono-val leading-none"
                          style={{ color: on ? o.color : 'var(--text-muted)' }}>{n}</span>
                      </div>
                      <p className="text-[10.5px] font-semibold leading-tight"
                        style={{ color: on ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {o.key}
                      </p>
                    </div>
                  )
                })}
              </div>

              {/* Win rate + data-quality read-outs */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 mt-3">
                <div className="rounded-xl px-3.5 py-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <p className="label-xs mb-0.5">Win rate</p>
                  <p className="text-[16px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
                    {stats.winRate != null ? `${stats.winRate.toFixed(0)}%` : '0%'}
                  </p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {stats.decided > 0 ? `of ${stats.decided} decided deals` : 'no decided deals yet'}
                  </p>
                </div>
                <div className="rounded-xl px-3.5 py-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <p className="label-xs mb-0.5">Excellent matches</p>
                  <p className="text-[16px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
                    {stats.excellentMatch}
                  </p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    teaches EBEXTA what to find more of
                  </p>
                </div>
                <div className="rounded-xl px-3.5 py-2.5"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <p className="label-xs mb-0.5">Wrong contacts</p>
                  <p className="text-[16px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
                    {stats.wrongContact}
                  </p>
                  <p className="text-[10.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    flagged for verification review
                  </p>
                </div>
              </div>

              <p className="text-[11px] mt-3" style={{ color: 'var(--text-muted)' }}>
                Only <strong>Won</strong> produces revenue. The rest still count: they train the rules
                that pick your leads, so future scans get sharper.
              </p>
            </div>

            {/* ── Plan cost input (local only) ── */}
            <div className="rounded-2xl premium-card px-5 py-4" style={{ borderRadius: 16 }}>
              <p className="label-xs mb-1.5">Your plan cost (optional)</p>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={planCost}
                  onChange={e => savePlanCost(e.target.value)}
                  inputMode="decimal"
                  placeholder="e.g. 25000"
                  className="premium-input px-3 py-2 rounded-lg text-[13px] mono-val"
                  style={{ width: 160 }}
                />
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Used only to compute the ROI multiple above. Stored on this device.
                </p>
              </div>
            </div>

            {/* ── Won deals ── */}
            {stats.wonCount > 0 && (
              <div className="rounded-2xl premium-card px-5 py-4" style={{ borderRadius: 16 }}>
                <h2 className="text-[15px] font-semibold mb-3"
                  style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                  Won deals
                </h2>
                <div className="space-y-1.5">
                  {memories.filter(m => m.outcome === 'Won').map(m => (
                    <button key={m.id} onClick={() => navigate(`/dashboard/companies/${m.id}`)}
                      className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-left"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <span className="material-symbols-outlined text-[16px]"
                        style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>emoji_events</span>
                      <span className="text-[13px] font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                        {m.company_name}
                      </span>
                      <span className="text-[13px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
                        {Number(m.deal_value) > 0 ? formatMoney(Number(m.deal_value)) : 'no value logged'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
