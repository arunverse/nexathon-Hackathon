/**
 * /admin/verified-leads — the Verified-by-EBEXTA pool.
 * Every admin-verified lead, filterable by industry, city, mode side, stage,
 * plus free-text search. Edit metadata or remove entries.
 * These leads are served FIRST (with the badge) to matching user scans.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, KpiCard, Th, Td, Pill } from './shared'
import { fmtDate } from './adminUtils'

interface VerifiedLead {
  id: string
  company_name: string
  industry: string | null
  city: string | null
  location: string | null
  employee_count: number | null
  funding_stage: string | null
  service_categories: string[] | null
  mode_side: string | null
  verified_stakeholders: Array<{ name: string; title: string; email?: string | null }> | null
  verified_at: string
}

export default function AdminVerifiedLeads() {
  const [rows, setRows] = useState<VerifiedLead[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [sideFilter, setSideFilter] = useState<'all' | 'provider' | 'seeker'>('all')
  const [industryFilter, setIndustryFilter] = useState('all')
  const [cityFilter, setCityFilter] = useState('all')
  const [stageFilter, setStageFilter] = useState('all')
  const [editing, setEditing] = useState<VerifiedLead | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('verified_leads')
      .select('id, company_name, industry, city, location, employee_count, funding_stage, service_categories, mode_side, verified_stakeholders, verified_at')
      .order('verified_at', { ascending: false })
    if (error) setLoadError(`${error.message} — did you run supabase/upgrade_v2.sql?`)
    setRows((data ?? []) as VerifiedLead[])
    setLoading(false)
  }
  // Fetch-on-mount; setState happens after await inside load (no sync cascade)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [])

  const industries = useMemo(() => [...new Set(rows.map(r => r.industry).filter(Boolean))] as string[], [rows])
  const cities = useMemo(() => [...new Set(rows.map(r => r.city).filter(Boolean))] as string[], [rows])
  const stages = useMemo(() => [...new Set(rows.map(r => r.funding_stage).filter(Boolean))] as string[], [rows])

  const filtered = useMemo(() => {
    let out = rows
    if (sideFilter !== 'all') out = out.filter(r => r.mode_side === sideFilter)
    if (industryFilter !== 'all') out = out.filter(r => r.industry === industryFilter)
    if (cityFilter !== 'all') out = out.filter(r => r.city === cityFilter)
    if (stageFilter !== 'all') out = out.filter(r => r.funding_stage === stageFilter)
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter(r =>
        r.company_name.toLowerCase().includes(q) ||
        (r.industry ?? '').toLowerCase().includes(q) ||
        (r.location ?? '').toLowerCase().includes(q) ||
        (r.service_categories ?? []).some(c => c.toLowerCase().includes(q))
      )
    }
    return out
  }, [rows, sideFilter, industryFilter, cityFilter, stageFilter, search])

  async function handleRemove(id: string) {
    if (!confirm('Remove this lead from the verified pool?')) return
    await supabase.from('verified_leads').delete().eq('id', id)
    setRows(prev => prev.filter(r => r.id !== id))
  }

  async function handleEditSave() {
    if (!editing) return
    await supabase.from('verified_leads').update({
      industry: editing.industry,
      city: editing.city,
      mode_side: editing.mode_side,
      funding_stage: editing.funding_stage,
      service_categories: editing.service_categories,
    }).eq('id', editing.id)
    setRows(prev => prev.map(r => r.id === editing.id ? editing : r))
    setEditing(null)
  }

  if (loading) return <Loading label="Loading verified pool…" />

  const selStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  } as const

  return (
    <div>
      <PageHeader
        icon="workspace_premium"
        title="Verified Leads"
        subtitle={`${rows.length} hand-verified lead(s): served FIRST with the "Verified by EBEXTA" badge to matching scans.`}
      />

      {loadError && (
        <div className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}>
          {loadError}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Verified" value={rows.length} color="var(--success)" />
        <KpiCard label="Providers" value={rows.filter(r => r.mode_side === 'provider').length} />
        <KpiCard label="Seekers" value={rows.filter(r => r.mode_side === 'seeker').length} />
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-5 flex-wrap">
        <input type="text" placeholder="Search company, industry, category…" value={search}
          onChange={e => setSearch(e.target.value)}
          className="min-w-[220px] px-3 py-2 rounded-xl text-[12px] outline-none" style={selStyle} />
        <select value={sideFilter} onChange={e => setSideFilter(e.target.value as typeof sideFilter)}
          className="px-3 py-2 rounded-xl text-[12px] outline-none" style={selStyle}>
          <option value="all">Side: all</option>
          <option value="provider">Providers</option>
          <option value="seeker">Seekers</option>
        </select>
        <select value={industryFilter} onChange={e => setIndustryFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-[12px] outline-none max-w-[180px]" style={selStyle}>
          <option value="all">Industry: all</option>
          {industries.map(i => <option key={i} value={i}>{i}</option>)}
        </select>
        <select value={cityFilter} onChange={e => setCityFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-[12px] outline-none" style={selStyle}>
          <option value="all">City: all</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={stageFilter} onChange={e => setStageFilter(e.target.value)}
          className="px-3 py-2 rounded-xl text-[12px] outline-none" style={selStyle}>
          <option value="all">Stage: all</option>
          {stages.map(st => <option key={st} value={st}>{st}</option>)}
        </select>
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={rows.length === 0 ? 'No verified leads yet' : 'No matches for these filters'}
            hint={rows.length === 0 ? 'Verify a lead from the Leads Monitor: click any row there.' : 'Loosen the filters or search.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Side</Th>
                  <Th>Industry</Th>
                  <Th>City</Th>
                  <Th>Stage</Th>
                  <Th>Categories</Th>
                  <Th>Verified People</Th>
                  <Th>Verified</Th>
                  <Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <Td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{r.company_name}</span></Td>
                    <Td><Pill label={(r.mode_side ?? '—').toUpperCase()} tone={r.mode_side === 'provider' ? 'indigo' : 'amber'} /></Td>
                    <Td>{r.industry ?? '—'}</Td>
                    <Td>{r.city ?? '—'}</Td>
                    <Td>{r.funding_stage ?? '—'}</Td>
                    <Td><span className="text-[11px]">{(r.service_categories ?? []).join(', ') || '—'}</span></Td>
                    <Td>
                      <span className="text-[11px]">
                        {(r.verified_stakeholders ?? []).map(s => s.name).join(', ') || '—'}
                      </span>
                    </Td>
                    <Td>{fmtDate(r.verified_at)}</Td>
                    <Td>
                      <div className="flex gap-1.5">
                        <button onClick={() => setEditing({ ...r })}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--border-strong)' }}>
                          Edit
                        </button>
                        <button onClick={() => handleRemove(r.id)}
                          className="px-2 py-1 rounded-lg text-[10px] font-bold"
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                          Remove
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Edit metadata modal */}
      {editing && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
          style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setEditing(null) }}>
          <div className="w-full max-w-[440px] rounded-2xl p-6"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
            <h3 className="text-[15px] font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Edit: {editing.company_name}
            </h3>
            <div className="space-y-3">
              {([
                ['Industry', editing.industry ?? '', (v: string) => setEditing(e => e ? { ...e, industry: v } : e)],
                ['City', editing.city ?? '', (v: string) => setEditing(e => e ? { ...e, city: v } : e)],
                ['Stage', editing.funding_stage ?? '', (v: string) => setEditing(e => e ? { ...e, funding_stage: v } : e)],
              ] as Array<[string, string, (v: string) => void]>).map(([label, value, set]) => (
                <div key={label}>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>{label}</label>
                  <input value={value} onChange={e => set(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                    style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                </div>
              ))}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>Side</label>
                <select value={editing.mode_side ?? 'provider'}
                  onChange={e => setEditing(ed => ed ? { ...ed, mode_side: e.target.value } : ed)}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                  <option value="provider">Provider</option>
                  <option value="seeker">Seeker</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1" style={{ color: 'var(--text-muted)' }}>
                  Service categories (comma-sep)
                </label>
                <input value={(editing.service_categories ?? []).join(', ')}
                  onChange={e => setEditing(ed => ed ? { ...ed, service_categories: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : ed)}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)}
                className="px-4 py-2 rounded-xl text-[12px] font-medium"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Cancel
              </button>
              <button onClick={handleEditSave}
                className="px-5 py-2 rounded-xl text-[12px] font-bold"
                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
