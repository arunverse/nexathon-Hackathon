/**
 * /dashboard/companies — the Company Memory list.
 *
 * Every company this user has ever scanned, with what EBEXTA remembers about
 * each. These rows outlive scans: a company never starts from scratch again.
 */

import { useState, useEffect, useMemo, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import RoiDashboard from './RoiDashboard'
import {
  fetchCompanyMemories, backfillMemoryFromLeads,
  type MemoryListRow, type Outcome, OUTCOMES,
} from '../../lib/companyMemory'
import { relativeDate, formatDate } from '../../lib/dateFormat'

const OUTCOME_TONE: Record<Outcome, { bg: string; color: string }> = {
  'Won':             { bg: 'var(--success-bg)',  color: 'var(--success)' },
  'Excellent Match': { bg: 'var(--success-bg)',  color: 'var(--success)' },
  'Lost':            { bg: 'var(--critical-bg)', color: 'var(--critical)' },
  'Wrong Contact':   { bg: 'var(--critical-bg)', color: 'var(--critical)' },
  'Not Interested':  { bg: 'var(--bg-surface)',  color: 'var(--text-muted)' },
  'Bad Match':       { bg: 'var(--bg-surface)',  color: 'var(--text-muted)' },
}

function OutcomeBadge({ outcome }: { outcome: Outcome }) {
  const tone = OUTCOME_TONE[outcome] ?? OUTCOME_TONE['Not Interested']
  return (
    <span className="px-2 py-0.5 rounded-full text-[10.5px] font-bold tracking-[0.04em] uppercase shrink-0"
      style={{ background: tone.bg, color: tone.color, border: `1px solid ${tone.color}` }}>
      {outcome}
    </span>
  )
}

export default function Companies() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = searchParams.get('tab') === 'roi' ? 'roi' : 'memory'

  const [rows, setRows] = useState<MemoryListRow[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [outcomeFilter, setOutcomeFilter] = useState<'all' | Outcome | 'none'>('all')
  const [industryFilter, setIndustryFilter] = useState('all')

  const [importing, setImporting] = useState(false)
  const [importNote, setImportNote] = useState<string | null>(null)

  const runBackfill = useCallback(async (announce: boolean) => {
    setImporting(true)
    const { created, error } = await backfillMemoryFromLeads()
    setImporting(false)
    if (error) {
      setImportNote(`Couldn’t import: ${error}`)
      return 0
    }
    if (created > 0) {
      setRows(await fetchCompanyMemories())
      setImportNote(`Imported ${created} compan${created === 1 ? 'y' : 'ies'} from your past scans.`)
    } else if (announce) {
      setImportNote('No past leads left to import.')
    }
    return created
  }, [])

  const load = useCallback(async () => {
    const data = await fetchCompanyMemories()
    setRows(data)
    setLoading(false)
    if (data.length === 0) await runBackfill(false)
  }, [runBackfill])

  useEffect(() => { load() }, [load])

  const industries = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) {
      const ind = String((r.company_snapshot as Record<string, unknown> | null)?.industry ?? '').trim()
      if (ind) set.add(ind)
    }
    return [...set].sort()
  }, [rows])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return rows.filter(r => {
      const snap = (r.company_snapshot ?? {}) as Record<string, unknown>
      const industry = String(snap.industry ?? '')
      if (q && !r.company_name.toLowerCase().includes(q) && !industry.toLowerCase().includes(q)) return false
      if (outcomeFilter === 'none' && r.outcome) return false
      if (outcomeFilter !== 'all' && outcomeFilter !== 'none' && r.outcome !== outcomeFilter) return false
      if (industryFilter !== 'all' && industry !== industryFilter) return false
      return true
    })
  }, [rows, query, outcomeFilter, industryFilter])

  if (activeTab === 'roi') {
    return (
      <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
          <div className="flex items-center justify-between gap-4 mb-6 pb-4 border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSearchParams({ tab: 'memory' })}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                ← Company Memory
              </button>
              <h2 className="text-[18px] font-bold text-[var(--text-primary)]">Companies ROI Analytics</h2>
            </div>
            <button
              onClick={() => setSearchParams({ tab: 'memory' })}
              className="px-4 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)]"
            >
              View Company Memory ({rows.length})
            </button>
          </div>
          <RoiDashboard />
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="material-symbols-outlined text-[22px]"
                style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>corporate_fare</span>
              <h1 className="text-[26px] font-bold tracking-[-0.03em]"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                Company Memory
              </h1>
              {rows.length > 0 && (
                <span className="text-[13px] mono-val" style={{ color: 'var(--text-muted)' }}>{rows.length}</span>
              )}
            </div>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Everything EBEXTA remembers about every company you’ve scanned (history, contacts,
              strategy and outcomes, kept between scans).
            </p>
          </div>

          <button
            onClick={() => setSearchParams({ tab: 'roi' })}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12.5px] font-bold transition-all bg-[var(--accent-interactive)] text-white hover:opacity-90 shadow-sm cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">monitoring</span>
            View Companies ROI Analytics
          </button>
        </motion.div>

        {/* Filters */}
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 mb-5">
            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px]"
                style={{ color: 'var(--text-muted)' }}>search</span>
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search companies or industries…"
                className="premium-input w-full pl-9 pr-3 py-2 rounded-xl text-[13px]"
              />
            </div>
            <select value={outcomeFilter} onChange={e => setOutcomeFilter(e.target.value as typeof outcomeFilter)}
              className="premium-input px-3 py-2 rounded-xl text-[12.5px]">
              <option value="all">All outcomes</option>
              <option value="none">No outcome yet</option>
              {OUTCOMES.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
            {industries.length > 0 && (
              <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
                className="premium-input px-3 py-2 rounded-xl text-[12.5px]">
                <option value="all">All industries</option>
                {industries.map(i => <option key={i} value={i}>{i}</option>)}
              </select>
            )}
          </div>
        )}

        {importNote && (
          <div className="mb-4 rounded-xl px-3.5 py-2.5 flex items-center gap-2"
            style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: 'var(--accent-interactive)' }}>info</span>
            <p className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>{importNote}</p>
          </div>
        )}

        {loading || importing ? (
          <div className="space-y-2">
            {importing && (
              <p className="text-[12.5px] mb-2" style={{ color: 'var(--text-muted)' }}>
                Importing companies from your past scans…
              </p>
            )}
            {[0, 1, 2].map(i => (
              <div key={i} className="h-[72px] rounded-2xl animate-pulse"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl px-6 py-14 text-center premium-card">
            <span className="material-symbols-outlined text-[34px] mb-3 block"
              style={{ color: 'var(--text-muted)' }}>inventory_2</span>
            <p className="text-[15px] font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>
              Companies you scan will build memory here: they never start from scratch again.
            </p>
            <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
              Run a scan and every company found gets a permanent record: signals, contacts,
              interactions and outcomes. Already scanned before? Import that history now.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button onClick={() => navigate('/scan')} className="premium-btn px-4 py-2 rounded-xl text-[13px]">
                Run a scan
              </button>
              <button onClick={() => runBackfill(true)} className="ghost-btn px-4 py-2 rounded-xl text-[13px] font-semibold">
                Import past leads
              </button>
            </div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-2xl px-6 py-12 text-center premium-card">
            <p className="text-[13.5px]" style={{ color: 'var(--text-muted)' }}>
              No companies match those filters.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((r, i) => {
              const snap = (r.company_snapshot ?? {}) as Record<string, unknown>
              const industry = String(snap.industry ?? '')
              const location = String(snap.location ?? '')
              return (
                <motion.button
                  key={r.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  onClick={() => navigate(`/dashboard/companies/${r.id}`)}
                  className="w-full text-left rounded-2xl premium-card px-4 py-3.5 flex flex-wrap items-center gap-x-4 gap-y-2"
                  style={{ borderRadius: 16 }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[14.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {r.company_name}
                      </p>
                      {r.outcome && <OutcomeBadge outcome={r.outcome} />}
                    </div>
                    <p className="text-[12px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                      {[industry, location].filter(Boolean).join(' · ') || 'Details on file'}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-center">
                      <p className="text-[14px] font-bold mono-val leading-none" style={{ color: 'var(--text-primary)' }}>
                        {r.event_count}
                      </p>
                      <p className="text-[9.5px] tracking-[0.06em] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        events
                      </p>
                    </div>
                    <div className="text-center">
                      <p className="text-[14px] font-bold mono-val leading-none" style={{ color: 'var(--text-primary)' }}>
                        {r.interaction_count}
                      </p>
                      <p className="text-[9.5px] tracking-[0.06em] uppercase mt-0.5" style={{ color: 'var(--text-muted)' }}>
                        touches
                      </p>
                    </div>
                    <div className="text-right hidden sm:block" style={{ minWidth: 96 }}>
                      <p className="text-[11.5px]" style={{ color: 'var(--text-secondary)' }}>
                        {relativeDate(r.last_updated)}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                        since {formatDate(r.first_seen)}
                      </p>
                    </div>
                    <span className="material-symbols-outlined text-[19px]" style={{ color: 'var(--text-muted)' }}>
                      chevron_right
                    </span>
                  </div>
                </motion.button>
              )
            })}
          </div>
        )}
      </main>
    </div>
  )
}
