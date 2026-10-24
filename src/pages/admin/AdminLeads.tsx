/**
 * /admin/leads — Leads Monitor across ALL users.
 * Quality-control view: shows whether the two-pass link-precision fix
 * is actually working across ALL leads (avg valid links per lead).
 */

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, KpiCard, Th, Td, Pill } from './shared'
import { fmtDate, verificationTone, validLinkCount } from './adminUtils'
import { adminDeleteRow } from './adminActions'
import { logAdminAction } from '../../lib/adminLog'

interface LeadRow {
  id: string
  user_id: string | null
  company_name: string | null
  industry: string | null
  location: string | null
  employee_count: number | null
  funding_stage: string | null
  intent_score: number | null
  confidence_score: number | null
  verification_status: string | null
  website: string | null
  linkedin_url: string | null
  company_linkedin: string | null
  evidence_source_url: string | null
  funding_source_url: string | null
  ebexta_verified?: boolean | null
  stakeholders: Array<{ name: string; title: string; email?: string | null; linkedin_url?: string | null }> | null
  contacts: Array<{ name?: string; role?: string; email?: string | null; linkedInUrl?: string | null; sourceUrl?: string | null }> | null
  created_at: string
  [key: string]: unknown
}

/** One "[EBEXTA] Funnel: …" line from system_logs. */
interface FunnelRow {
  message: string
  metadata: { funnel?: Record<string, number> } | null
  created_at: string
}

// ── Verify panel (Task 8A/B): review + correct stakeholders → verified_leads pool ──

interface EditableStakeholder {
  checked: boolean
  name: string
  role: string
  email: string
  linkedin: string
}

function VerifyLeadModal({ lead, onClose, onSaved }: { lead: LeadRow; onClose: () => void; onSaved: (id: string) => void }) {
  const initialStakeholders: EditableStakeholder[] = (() => {
    const fromContacts = (lead.contacts ?? []).map(c => ({
      checked: false, name: c.name ?? '', role: c.role ?? '', email: c.email ?? '', linkedin: c.linkedInUrl ?? '',
    }))
    const fromStake = (lead.stakeholders ?? []).map(s => ({
      checked: false, name: s.name ?? '', role: s.title ?? '', email: s.email ?? '', linkedin: s.linkedin_url ?? '',
    }))
    const seen = new Set<string>()
    const merged = [...fromContacts, ...fromStake].filter(s => {
      const k = s.name.toLowerCase()
      if (!k || seen.has(k)) return false
      seen.add(k)
      return true
    })
    return merged.length > 0 ? merged : [{ checked: false, name: '', role: '', email: '', linkedin: '' }]
  })()

  const [stakeholders, setStakeholders] = useState<EditableStakeholder[]>(initialStakeholders)
  const [modeSide, setModeSide] = useState<'provider' | 'seeker'>('provider')
  const [city, setCity] = useState((lead.location ?? '').split(',')[0]?.trim() ?? '')
  const [categories, setCategories] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  // Existing pool row for this lead (if it was verified before) so re-opening
  // shows the SAVED data instead of a blank form.
  const [existingId, setExistingId] = useState<string | null>(null)
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null)
  const [loadingExisting, setLoadingExisting] = useState(true)
  const [restored, setRestored] = useState(false)   // an unsaved draft was recovered
  const [ready, setReady] = useState(false)          // initial load done → drafts may persist

  const draftKey = `ebexta_admin_verify_draft_${lead.id}`

  useEffect(() => {
    let alive = true
    supabase
      .from('verified_leads')
      .select('id, city, mode_side, service_categories, verified_stakeholders, verified_at')
      .eq('source_lead_id', lead.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        if (data) {
          setExistingId(data.id as string)
          setLastSavedAt((data.verified_at as string) ?? null)
          const saved = (data.verified_stakeholders ?? []) as Array<{ name?: string; title?: string; email?: string | null; linkedin_url?: string | null }>
          if (saved.length > 0) {
            // MERGE: previously verified people (ticked) + the lead's remaining
            // candidates (unticked) — so the admin can verify person 2 and 3
            // later without losing person 1 or the untouched candidates.
            const savedRows: EditableStakeholder[] = saved.map(s => ({
              checked: true, name: s.name ?? '', role: s.title ?? '', email: s.email ?? '', linkedin: s.linkedin_url ?? '',
            }))
            const savedNames = new Set(savedRows.map(s => s.name.trim().toLowerCase()))
            const remaining = initialStakeholders.filter(c => !savedNames.has(c.name.trim().toLowerCase()))
            setStakeholders([...savedRows, ...remaining])
          }
          if (data.city) setCity(data.city as string)
          if (data.mode_side) setModeSide(data.mode_side as 'provider' | 'seeker')
          setCategories(((data.service_categories ?? []) as string[]).join(', '))
        }
        // DRAFT RECOVERY: if the admin was mid-entry when the tab/screen reset,
        // the newest local draft wins over what's in the database.
        try {
          const raw = localStorage.getItem(draftKey)
          if (raw) {
            const d = JSON.parse(raw) as { stakeholders?: EditableStakeholder[]; modeSide?: 'provider' | 'seeker'; city?: string; categories?: string }
            if (Array.isArray(d.stakeholders) && d.stakeholders.length > 0) setStakeholders(d.stakeholders)
            if (d.modeSide) setModeSide(d.modeSide)
            if (typeof d.city === 'string') setCity(d.city)
            if (typeof d.categories === 'string') setCategories(d.categories)
            setRestored(true)
          }
        } catch { /* ignore corrupt draft */ }
        setLoadingExisting(false)
        setReady(true)
      })
    return () => { alive = false }
  }, [lead.id])

  // AUTOSAVE the draft on every change — survives tab switches, screen
  // unmounts, even a full page reload. Cleared only on successful save.
  useEffect(() => {
    if (!ready) return
    try {
      localStorage.setItem(draftKey, JSON.stringify({ stakeholders, modeSide, city, categories }))
    } catch { /* storage full — non-fatal */ }
  }, [ready, draftKey, stakeholders, modeSide, city, categories])

  function patch(i: number, field: keyof EditableStakeholder, value: string | boolean) {
    setStakeholders(prev => prev.map((s, si) => si === i ? { ...s, [field]: value } : s))
  }

  async function handleSave() {
    const verified = stakeholders
      .filter(s => s.checked && s.name.trim())
      .map((s, i) => ({
        name: s.name.trim(),
        title: s.role.trim() || 'Decision Maker',
        email: s.email.trim() || null,
        linkedin_url: s.linkedin.trim() || null,
        priority_score: 100 - i * 5,
        ebexta_verified: true,
      }))
    if (verified.length === 0) { setError('Tick at least one verified stakeholder.'); return }

    setSaving(true)
    const payload = {
      source_lead_id: lead.id,
      company_name: lead.company_name ?? 'Unknown',
      industry: lead.industry ?? null,
      city: city || null,
      location: lead.location ?? null,
      employee_count: lead.employee_count ?? null,
      funding_stage: lead.funding_stage ?? null,
      service_categories: categories.split(',').map(s => s.trim()).filter(Boolean),
      mode_side: modeSide,
      lead_data: { ...lead, stakeholders: verified, ebexta_verified: true },
      verified_stakeholders: verified,
      verified_at: new Date().toISOString(),
    }

    // COLLISION-PROOF: remove any previous pool entry for this lead, then insert
    // the fresh one. Re-verifying can never hit the unique index again, and
    // partial saves (person 1 today, person 2 tomorrow) always replace cleanly.
    await supabase.from('verified_leads').delete().eq('source_lead_id', lead.id)
    const { error: insErr } = await supabase.from('verified_leads').insert(payload)

    if (insErr) {
      setSaving(false)
      setError(`Save failed: ${insErr.message} — did you run supabase/verified_badge.sql?`)
      return
    }
    void existingId

    // Stamp the ORIGINAL lead so the monitor shows it as verified and the user's
    // dashboard renders the "Verified by EBEXTA" badge.
    const { error: flagErr } = await supabase.from('leads').update({
      ebexta_verified: true,
      verified_at: new Date().toISOString(),
      verification_status: 'VERIFIED',
      trust_score: 100,
    }).eq('id', lead.id)

    setSaving(false)
    if (flagErr) {
      setError(`Saved to the pool, but flagging the lead failed: ${flagErr.message} — run supabase/verified_badge.sql.`)
      return
    }
    // Work is safely in the database — the local draft is no longer needed.
    try { localStorage.removeItem(draftKey) } catch { /* ignore */ }
    void logAdminAction('Verified lead', {
      targetType: 'lead', targetId: lead.id,
      detail: { company: lead.company_name, side: modeSide, verified_people: verified.length },
    })
    onSaved(lead.id)
    onClose()
  }

  const inputStyle = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  } as const

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[760px] max-h-[88vh] overflow-y-auto rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>

        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]"
              style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>verified</span>
            <h2 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Verify Lead: {lead.company_name}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
          </button>
        </div>
        <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
          {lead.industry ?? '—'} · {lead.location ?? '—'} · {lead.funding_stage ?? '—'} · {lead.employee_count ?? '?'} emp.
          Review each person, correct the details, tick the verified ones, then save to the Verified-by-EBEXTA pool.
        </p>
        {loadingExisting ? (
          <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>Loading saved verification…</p>
        ) : (
          <>
            {existingId && (
              <div className="mb-2 px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-2"
                style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)' }}>
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                Already verified: saved people are ticked below; remaining candidates stay listed for later entry.
                {lastSavedAt && (
                  <span className="ml-auto font-normal" style={{ color: 'var(--text-muted)' }}>
                    Last saved {new Date(lastSavedAt).toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {restored && (
              <div className="mb-4 px-3 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-2"
                style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)' }}>
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>history</span>
                Unsaved work recovered: everything you typed before the tab switch is restored. Save to keep it.
              </div>
            )}
          </>
        )}

        {/* Stakeholder editor */}
        <div className="space-y-3 mb-5">
          {stakeholders.map((s, i) => (
            <div key={i} className="rounded-xl p-3"
              style={{
                background: s.checked ? 'rgba(16,185,129,0.05)' : 'var(--bg-surface)',
                border: s.checked ? '1px solid rgba(16,185,129,0.3)' : '1px solid var(--border-subtle)',
              }}>
              <div className="flex items-center gap-3 mb-2">
                <input type="checkbox" checked={s.checked}
                  onChange={e => patch(i, 'checked', e.target.checked)}
                  className="w-4 h-4 accent-emerald-600 cursor-pointer" />
                <span className="text-[11px] font-bold uppercase tracking-[0.06em]"
                  style={{ color: s.checked ? 'var(--success)' : 'var(--text-muted)' }}>
                  {s.checked ? '✓ Verified by admin' : 'Untick = excluded'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input value={s.name} onChange={e => patch(i, 'name', e.target.value)}
                  placeholder="Name" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                <input value={s.role} onChange={e => patch(i, 'role', e.target.value)}
                  placeholder="Role / Title" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                <input value={s.email} onChange={e => patch(i, 'email', e.target.value)}
                  placeholder="Verified email" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
                <input value={s.linkedin} onChange={e => patch(i, 'linkedin', e.target.value)}
                  placeholder="LinkedIn URL" className="px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
              </div>
            </div>
          ))}
          <button
            onClick={() => setStakeholders(prev => [...prev, { checked: true, name: '', role: '', email: '', linkedin: '' }])}
            className="text-[12px] font-semibold px-3 py-1.5 rounded-lg"
            style={{ color: 'var(--accent-interactive)', border: '1px dashed var(--border-strong)' }}>
            + Add person
          </button>
        </div>

        {/* Pool metadata */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              This company IS a…
            </label>
            <select value={modeSide} onChange={e => setModeSide(e.target.value as 'provider' | 'seeker')}
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle}>
              <option value="provider">PROVIDER (serves seekers)</option>
              <option value="seeker">SEEKER (serves providers)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--text-muted)' }}>City</label>
            <input value={city} onChange={e => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.06em] mb-1.5" style={{ color: 'var(--text-muted)' }}>
              Service categories (comma-sep)
            </label>
            <input value={categories} onChange={e => setCategories(e.target.value)}
              placeholder="web design, devops" className="w-full px-3 py-2 rounded-lg text-[12px] outline-none" style={inputStyle} />
          </div>
        </div>

        {error && <p className="text-[12px] font-medium mb-3" style={{ color: '#DC2626' }}>{error}</p>}

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2"
            style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.35)' }}>
            <span className="material-symbols-outlined text-[16px]">verified</span>
            {saving ? 'Saving…' : 'Save as Verified'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}

type StatusFilter = 'all' | 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MANUAL_REVIEW_NEEDED'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'all',                  label: 'All' },
  { key: 'VERIFIED',             label: 'Verified' },
  { key: 'PARTIALLY_VERIFIED',   label: 'Partial' },
  { key: 'MANUAL_REVIEW_NEEDED', label: 'Review' },
]

// ── Feasibility gate monitoring ──
type FeasFilter = 'all' | 'ready' | 'unknown' | 'none'

const FEAS_TABS: { key: FeasFilter; label: string }[] = [
  { key: 'all',     label: 'Any feasibility' },
  { key: 'ready',   label: 'Ready' },
  { key: 'unknown', label: 'Unknown' },
  { key: 'none',    label: 'Gate off' },
]

interface ExclusionRow {
  id: string
  scan_id: string | null
  company_name: string | null
  prerequisite: string | null
  reason: string | null
  created_at: string
}

export default function AdminLeads() {
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [feasFilter, setFeasFilter] = useState<FeasFilter>('all')
  // How many leads the feasibility gate removed. If this climbs, the gate is
  // over-filtering and must be loosened — never left to silently starve users.
  const [exclusions, setExclusions] = useState<ExclusionRow[]>([])
  // Scan funnels, newest first — written by runScan on every scan so that
  // over-filtering shows up here instead of as a user complaint.
  const [funnels, setFunnels] = useState<FunnelRow[]>([])
  const [verifyTarget, setVerifyTarget] = useState<LeadRow | null>(null)
  const [savedToast, setSavedToast] = useState(false)

  useEffect(() => {
    async function load() {
      const [leadsRes, profilesRes, exclRes, funnelRes] = await Promise.all([
        supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(500),
        supabase.from('profiles').select('id, company_name, sender_email'),
        // Best-effort: the table may not exist until feasibility_gate.sql is run.
        supabase.from('feasibility_exclusions')
          .select('id, scan_id, company_name, prerequisite, reason, created_at')
          .order('created_at', { ascending: false }).limit(200),
        supabase.from('system_logs')
          .select('message, metadata, created_at')
          .eq('event_type', 'scan')
          .ilike('message', '%Funnel:%')
          .order('created_at', { ascending: false }).limit(40),
      ])
      setExclusions((exclRes.data ?? []) as ExclusionRow[])
      setFunnels((funnelRes.data ?? []) as FunnelRow[])
      const map: Record<string, string> = {}
      ;(profilesRes.data ?? []).forEach(p => {
        map[p.id] = p.company_name ?? p.sender_email ?? p.id.slice(0, 8)
      })
      setUserMap(map)
      const rows = (leadsRes.data ?? []) as LeadRow[]
      setLeads(rows)
      setLoading(false)
      // If a verify panel was open when the screen remounted (tab switch,
      // refresh), reopen the SAME lead — combined with the draft autosave the
      // admin lands exactly where they left off.
      try {
        const openId = localStorage.getItem('ebexta_admin_verify_open')
        if (openId) {
          const target = rows.find(r => r.id === openId)
          if (target) setVerifyTarget(target)
        }
      } catch { /* ignore */ }
    }
    load()
  }, [])

  function markVerified(id: string) {
    setLeads(prev => prev.map(l => l.id === id
      ? { ...l, ebexta_verified: true, verification_status: 'VERIFIED', trust_score: 100 }
      : l))
  }

  async function removeLead(id: string) {
    if (!confirm('Delete this lead permanently?')) return
    const err = await adminDeleteRow('leads', id)
    if (err) { alert(err); return }
    setLeads(prev => prev.filter(l => l.id !== id))
  }

  if (loading) return <Loading label="Loading all leads…" />

  // ── Quality strip (across ALL leads, not just filtered) ──
  const total = leads.length
  const verified = leads.filter(l => l.verification_status === 'VERIFIED').length
  const partial = leads.filter(l => l.verification_status === 'PARTIALLY_VERIFIED').length
  const review = leads.filter(l => l.verification_status === 'MANUAL_REVIEW_NEEDED').length
  const pct = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0
  const avgConfidence = total > 0
    ? Math.round(leads.reduce((s, l) => s + (l.confidence_score ?? 0), 0) / total)
    : 0
  const avgLinks = total > 0
    ? (leads.reduce((s, l) => s + validLinkCount(l), 0) / total).toFixed(1)
    : '0.0'

  // ── Feasibility gate stats ──
  const feasReady = leads.filter(l => l.feasibility_status === 'ready').length
  const feasUnknown = leads.filter(l => l.feasibility_status === 'unknown').length
  const gatedLeads = feasReady + feasUnknown
  const excludedTotal = exclusions.length
  // Per-scan average — the number that tells you if the gate is too aggressive.
  const scansWithExclusions = new Set(exclusions.map(e => e.scan_id).filter(Boolean)).size
  const avgExcludedPerScan = scansWithExclusions > 0
    ? (excludedTotal / scansWithExclusions).toFixed(1)
    : '0'

  // Summed across the recent scans. The pair that matters is discovered vs
  // final — if final is a small fraction of discovered, a gate needs loosening.
  const funnelTotals = funnels.reduce(
    (acc, f) => {
      const m = f.metadata?.funnel ?? {}
      acc.discovered += m.discovered ?? 0
      acc.competitorsDropped += m.competitorsDropped ?? 0
      acc.descriptionDropped += m.descriptionDropped ?? 0
      acc.feasibilityDropped += m.feasibilityDropped ?? 0
      acc.rankDropped += m.rankDropped ?? 0
      acc.looselyMatched += m.looselyMatched ?? 0
      acc.final += m.final ?? 0
      return acc
    },
    { discovered: 0, competitorsDropped: 0, descriptionDropped: 0, feasibilityDropped: 0, rankDropped: 0, looselyMatched: 0, final: 0 },
  )

  const byStatus = filter === 'all' ? leads : leads.filter(l => l.verification_status === filter)
  const filtered = feasFilter === 'all'
    ? byStatus
    : feasFilter === 'none'
      ? byStatus.filter(l => !l.feasibility_status)
      : byStatus.filter(l => l.feasibility_status === feasFilter)

  return (
    <div>
      <PageHeader
        icon="travel_explore"
        title="Leads Monitor"
        subtitle={`${total} lead${total !== 1 ? 's' : ''} across all users: link-precision quality control.`}
      />

      {/* Quality strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 mb-6">
        <KpiCard label="% Verified" value={`${pct(verified)}%`} color="var(--success)" sub={`${verified} leads`} />
        <KpiCard label="% Partial" value={`${pct(partial)}%`} color="var(--warning)" sub={`${partial} leads`} />
        <KpiCard label="% Review" value={`${pct(review)}%`} color={review > 0 ? '#DC2626' : undefined} sub={`${review} leads`} />
        <KpiCard label="Avg Confidence" value={avgConfidence} sub="out of 100" />
        <KpiCard
          label="Avg Valid Links / Lead"
          value={avgLinks}
          color="var(--accent-interactive, var(--text-primary))"
          sub="two-pass fix tracker"
        />
      </div>

      {/* ── SCAN FUNNEL MONITOR ──
          Every scan logs its funnel. Over-filtering used to be invisible
          until a user reported an empty dashboard; now the gap between
          "discovered" and "final" is the first thing on this page. */}
      {funnels.length > 0 && (
        <div className="mb-6 rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[17px]"
              style={{ color: 'var(--accent-interactive)' }}>filter_alt</span>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Scan funnel
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              last {funnels.length} scans: a large drop between discovered and final means a gate is too tight
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-3">
            <KpiCard label="Discovered" value={funnelTotals.discovered} sub="top of funnel" />
            <KpiCard label="Competitors" value={funnelTotals.competitorsDropped}
              color={funnelTotals.competitorsDropped > funnelTotals.final ? '#DC2626' : undefined}
              sub="hard drop" />
            <KpiCard label="Description" value={funnelTotals.descriptionDropped}
              color={funnelTotals.descriptionDropped > funnelTotals.final ? '#DC2626' : undefined}
              sub="held in reserve" />
            <KpiCard label="Gates" value={funnelTotals.feasibilityDropped + funnelTotals.rankDropped}
              sub="feasibility + rank" />
            <KpiCard label="Final" value={funnelTotals.final}
              color={funnelTotals.final === 0 ? '#DC2626' : 'var(--success)'}
              sub={`${funnelTotals.looselyMatched} loosely matched`} />
          </div>

          <div className="space-y-1">
            {funnels.slice(0, 6).map((f, i) => (
              <p key={i} className="text-[11.5px] font-mono truncate" style={{ color: 'var(--text-secondary)' }}>
                {f.message}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* ── Feasibility gate monitor ──
          Only shown once the gate is actually in use by someone. If
          "Excluded" climbs relative to "Ready", the rule is too tight. */}
      {(gatedLeads > 0 || excludedTotal > 0) && (
        <div className="mb-6 rounded-xl p-4"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span className="material-symbols-outlined text-[17px]"
              style={{ color: 'var(--accent-interactive)' }}>foundation</span>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
              Feasibility gate
            </p>
            <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              prerequisite checks: watch that this isn't over-filtering
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <KpiCard label="Ready" value={feasReady} color="var(--success)" sub="prerequisite present" />
            <KpiCard label="Unknown" value={feasUnknown} color="var(--warning)" sub="shown, ranked lower" />
            <KpiCard
              label="Excluded"
              value={excludedTotal}
              color={excludedTotal > gatedLeads ? '#DC2626' : undefined}
              sub="not viable (hidden)"
            />
            <KpiCard label="Excluded / scan" value={avgExcludedPerScan} sub={`across ${scansWithExclusions} scans`} />
          </div>

          {excludedTotal > 0 && (
            <div className="mt-3 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-1.5"
                style={{ color: 'var(--text-muted)' }}>Recently excluded</p>
              <div className="space-y-1">
                {exclusions.slice(0, 6).map(e => (
                  <div key={e.id} className="flex flex-wrap items-baseline gap-x-2 text-[12px]">
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{e.company_name}</span>
                    <span style={{ color: 'var(--text-muted)' }}>needs {e.prerequisite}:</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{e.reason}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {excludedTotal > gatedLeads && gatedLeads > 0 && (
            <p className="text-[12px] mt-3 font-semibold" style={{ color: '#DC2626' }}>
              The gate is now removing more leads than it keeps. Loosen the rule before users
              start seeing empty scans.
            </p>
          )}
        </div>
      )}

      {/* Status filter */}
      <div className="flex gap-1.5 mb-5">
        {STATUS_TABS.map(tab => {
          const isActive = filter === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                color: isActive ? 'var(--warning)' : 'var(--text-muted)',
                border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Feasibility filter — only useful once the gate is in play */}
      {gatedLeads > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-5">
          {FEAS_TABS.map(tab => {
            const isActive = feasFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => setFeasFilter(tab.key)}
                className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all"
                style={{
                  background: isActive ? 'var(--accent-subtle)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: isActive ? '1px solid var(--border-strong)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {tab.label}
              </button>
            )
          })}
        </div>
      )}

      <Card>
        {filtered.length === 0 ? (
          <EmptyState title="No leads yet" hint="Run a scan: leads will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>User</Th>
                  <Th>Intent</Th>
                  <Th>Confidence</Th>
                  <Th>Status</Th>
                  <Th>Valid Links</Th>
                  <Th>Created</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(l => {
                  const links = validLinkCount(l)
                  return (
                    <tr key={l.id}
                      onClick={() => { setVerifyTarget(l); try { localStorage.setItem('ebexta_admin_verify_open', l.id) } catch { /* ignore */ } }}
                      className="cursor-pointer transition-colors"
                      onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)' }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                      title="Click to review & verify this lead">
                      <Td>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                          {l.company_name ?? '—'}
                        </span>
                        {l.ebexta_verified === true && (
                          <span className="ml-2 px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-[0.06em] inline-flex items-center gap-1"
                            style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: 'var(--success)' }}>
                            <span className="material-symbols-outlined text-[10px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                            EBEXTA
                          </span>
                        )}
                      </Td>
                      <Td>{l.user_id ? (userMap[l.user_id] ?? l.user_id.slice(0, 8)) : '—'}</Td>
                      <Td mono>{l.intent_score ?? '—'}</Td>
                      <Td mono>{l.confidence_score ?? '—'}</Td>
                      <Td>
                        <Pill
                          label={l.verification_status === 'VERIFIED' ? 'VERIFIED' : l.verification_status === 'PARTIALLY_VERIFIED' ? 'PARTIAL' : 'REVIEW'}
                          tone={verificationTone(l.verification_status)}
                        />
                      </Td>
                      <Td>
                        <span
                          className="font-mono font-bold"
                          style={{ color: links >= 3 ? 'var(--success)' : links >= 1 ? 'var(--warning)' : '#DC2626' }}
                        >
                          {links}
                        </span>
                      </Td>
                      <Td>{fmtDate(l.created_at)}</Td>
                      <Td>
                        <button onClick={e => { e.stopPropagation(); removeLead(l.id) }} title="Delete lead" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--critical-bg)', color: 'var(--critical)' }}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Verify panel */}
      {verifyTarget && (
        <VerifyLeadModal
          lead={verifyTarget}
          onClose={() => { setVerifyTarget(null); try { localStorage.removeItem('ebexta_admin_verify_open') } catch { /* ignore */ } }}
          onSaved={(id) => { markVerified(id); setSavedToast(true); setTimeout(() => setSavedToast(false), 3000) }}
        />
      )}
      {savedToast && (
        <div className="fixed bottom-6 right-6 z-[400] px-5 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-2"
          style={{ background: 'var(--bg-surface)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--text-primary)', boxShadow: 'var(--shadow-lg)' }}>
          <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
          Saved to the Verified-by-EBEXTA pool.
        </div>
      )}
    </div>
  )
}
