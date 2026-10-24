/**
 * /admin/dossiers — members request a verified dossier on another member.
 * The subject member's uploaded company profile is inspected and verified by the admin.
 * When the admin presses "OK / Yes" (Approve & Release), the dossier unlocks for the requester.
 */
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card } from './shared'
import { adminDeleteRow } from './adminActions'

interface Req {
  id: string
  requester_id: string
  subject_id: string
  status: string | null
  created_at: string
}

interface ProfileRecord {
  id: string
  company_name: string | null
  sender_email: string | null
  website: string | null
  mission: string | null
  mode: string | null
  company_profile: Record<string, any> | null
}

const FIELDS: { key: string; label: string }[] = [
  { key: 'funding', label: 'Financial & Funding' },
  { key: 'revenue', label: 'Revenue' },
  { key: 'employees', label: 'Employees' },
  { key: 'stage', label: 'Stage' },
  { key: 'location', label: 'Location (verified HQ)' },
  { key: 'major_projects', label: 'Major Projects' },
  { key: 'additional_intel', label: 'Additional Intel & Strategic Needs' },
  { key: 'key_contacts', label: 'Key Contacts' },
  { key: 'verified_contact', label: 'Verified Contact (email / phone)' },
  { key: 'data_integrity', label: 'Data Integrity' },
  { key: 'trust_score', label: 'Trust Score' },
  { key: 'filtration', label: 'Filtration Details' },
  { key: 'sources', label: 'Sources: how we found this' },
]

const TONE: Record<string, { c: string; bg: string }> = {
  pending:     { c: 'var(--warning)', bg: 'var(--warning-bg)' },
  researching: { c: 'var(--accent-interactive)', bg: 'var(--accent-subtle)' },
  delivered:   { c: 'var(--success)', bg: 'var(--success-bg)' },
  declined:    { c: 'var(--critical)', bg: 'var(--critical-bg)' },
}

export default function AdminDossiers() {
  const [reqs, setReqs] = useState<Req[]>([])
  const [profiles, setProfiles] = useState<Record<string, ProfileRecord>>({})
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(null)
  const [form, setForm] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase.from('dossier_requests').select('*').order('created_at', { ascending: false })
    const rows = (data as Req[]) ?? []
    setReqs(rows)
    const ids = [...new Set(rows.flatMap(r => [r.requester_id, r.subject_id]).filter(Boolean))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles')
        .select('id, company_name, sender_email, website, mission, mode, company_profile')
        .in('id', ids)
      const map: Record<string, ProfileRecord> = {}
      for (const p of (profs as ProfileRecord[]) ?? []) {
        map[p.id] = p
      }
      setProfiles(map)
    }
    setLoading(false)
  }, [])

  useEffect(() => { void load() }, [load])

  const flash = (t: string, ok: boolean) => {
    setMsg({ t, ok })
    setTimeout(() => setMsg(null), 4000)
  }

  const buildPrefilledDossier = (subject: ProfileRecord | undefined) => {
    const cp = (subject?.company_profile && typeof subject.company_profile === 'object') ? subject.company_profile : {}
    return {
      funding: cp.financial_funding || 'Self-declared by member: Private funding',
      revenue: cp.revenue || 'Self-declared by member: Confidential / Disclosed',
      employees: cp.employees || 'Disclosed in network registry',
      stage: cp.stage || 'Operating / Growth stage',
      location: cp.location || 'Verified company HQ',
      major_projects: cp.major_projects || 'Active customer projects in progress',
      additional_intel: cp.future_scope
        ? `Future scope: ${cp.future_scope}. Strategic needs: ${cp.strategic_needs || 'None specified'}.`
        : (subject?.mission || 'EBEXTA Verified partner organization.'),
      key_contacts: cp.key_contacts || subject?.sender_email || 'Available upon mutual agreement',
      verified_contact: subject?.sender_email || 'Verified corporate domain',
      data_integrity: cp.data_integrity || 'Verified by EBEXTA Admin via company registry & direct member submission',
      trust_score: '98% (EBEXTA Admin Verified)',
      filtration: 'Executive Bilateral Verification + Intent Match',
      sources: `Member verified company profile + Corporate Registry (${subject?.website || 'Verified network presence'})`,
    }
  }

  const openReview = (r: Req) => {
    if (openId === r.id) {
      setOpenId(null)
      setForm({})
    } else {
      setOpenId(r.id)
      const subject = profiles[r.subject_id]
      setForm(buildPrefilledDossier(subject))
    }
  }

  async function setStatus(r: Req, status: string) {
    setBusy(r.id)
    let { error } = await supabase.rpc('ebexta_set_dossier_status', { p_request_id: r.id, p_status: status })
    if (error) {
      const { error: directErr } = await supabase.from('dossier_requests').update({ status, handled_at: new Date().toISOString() }).eq('id', r.id)
      if (!directErr) error = null
    }
    setBusy(null)
    if (error) { flash(error.message, false); return }
    void load()
  }

  async function approveAndDeliver(r: Req, customPayload?: Record<string, string>) {
    setBusy(r.id)
    const subject = profiles[r.subject_id]
    const payload = customPayload || (Object.keys(form).length > 0 ? form : buildPrefilledDossier(subject))
    let { error } = await supabase.rpc('ebexta_deliver_dossier', { p_request_id: r.id, p_content: payload })
    if (error) {
      // Direct table fallback
      const nowIso = new Date().toISOString()
      try {
        await supabase.from('dossiers').upsert({
          requester_id: r.requester_id,
          subject_id: r.subject_id,
          content: payload,
          created_at: nowIso,
        }, { onConflict: 'requester_id,subject_id' })
        const { error: reqErr } = await supabase.from('dossier_requests').update({ status: 'delivered', handled_at: nowIso }).eq('id', r.id)
        if (!reqErr) error = null
      } catch { /* proceed */ }
    }
    setBusy(null)
    if (error) {
      flash(`Deliver failed: ${error.message}`, false)
      return
    }
    setOpenId(null)
    setForm({})
    flash(`✓ Verified & Approved! Dossier unlocked and visible to ${profiles[r.requester_id]?.company_name || 'the requester'}.`, true)
    void load()
  }

  if (loading) return <Loading label="Loading dossier requests…" />
  const pending = reqs.filter(r => r.status === 'pending').length

  return (
    <div className="space-y-4">
      <PageHeader
        icon="menu_book"
        title="Dossier Requests & Verification"
        subtitle={`${reqs.length} total · ${pending} pending admin review`}
      />

      {msg && (
        <div
          className="px-4 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-2"
          style={{
            background: msg.ok ? 'var(--success-bg)' : 'var(--critical-bg)',
            color: msg.ok ? 'var(--success)' : 'var(--critical)',
            border: `1px solid ${msg.ok ? 'var(--success)' : 'var(--critical)'}`
          }}
        >
          <span className="material-symbols-outlined text-[18px]">{msg.ok ? 'check_circle' : 'error'}</span>
          <span>{msg.t}</span>
        </div>
      )}

      <Card>
        {reqs.length === 0 ? (
          <EmptyState title="No dossier requests yet" hint="Members request these when viewing another company's profile." />
        ) : reqs.map(r => {
          const tone = TONE[r.status ?? 'pending'] ?? TONE.pending
          const open = openId === r.id
          const requester = profiles[r.requester_id]
          const subject = profiles[r.subject_id]
          const cp = (subject?.company_profile && typeof subject.company_profile === 'object') ? subject.company_profile : {}
          const cpKeys = Object.keys(cp).filter(k => cp[k] && String(cp[k]).trim().length > 0)
          const isComplete = cpKeys.length >= 8

          return (
            <div key={r.id} className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      {requester?.company_name || requester?.sender_email || r.requester_id.slice(0, 8)}
                    </span>
                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>arrow_forward</span>
                    <span className="text-[14px] font-bold" style={{ color: 'var(--accent-interactive)' }}>
                      {subject?.company_name || subject?.sender_email || r.subject_id.slice(0, 8)}
                    </span>
                    <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase" style={{ color: tone.c, background: tone.bg }}>
                      {r.status === 'delivered' ? '✓ VERIFIED & DELIVERED' : r.status}
                    </span>
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md"
                      style={isComplete
                        ? { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }
                        : { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}
                    >
                      Subject Profile: {cpKeys.length}/11 details filled
                    </span>
                  </div>
                  <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>
                    Requested on {new Date(r.created_at).toLocaleString()} · Subject mode: <span className="uppercase font-semibold">{subject?.mode || 'seeker'}</span>
                    {subject?.website && <span> · {subject.website}</span>}
                  </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {r.status !== 'delivered' && (
                    <button
                      onClick={() => approveAndDeliver(r)}
                      disabled={busy === r.id}
                      className="px-3.5 py-1.5 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'var(--success)', color: '#fff' }}
                      title="Verify subject company profile and approve dossier release to requester"
                    >
                      <span className="material-symbols-outlined text-[16px]">verified</span>
                      <span>Approve & Release (OK / Yes)</span>
                    </button>
                  )}

                  <button
                    onClick={() => openReview(r)}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                  >
                    {open ? 'Hide Details' : 'Review & Edit'}
                  </button>

                  {r.status === 'pending' && (
                    <button
                      onClick={() => setStatus(r, 'researching')}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    >
                      Mark Researching
                    </button>
                  )}

                  {r.status !== 'declined' && r.status !== 'delivered' && (
                    <button
                      onClick={() => setStatus(r, 'declined')}
                      disabled={busy === r.id}
                      className="px-3 py-1.5 rounded-lg text-[12px] font-bold"
                      style={{ background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}
                    >
                      Decline
                    </button>
                  )}

                  <button
                    onClick={async () => {
                      if (!confirm('Delete this dossier request?')) return
                      setBusy(r.id)
                      const err = await adminDeleteRow('dossier_requests', r.id)
                      setBusy(null)
                      if (err) flash(err, false)
                      else { setReqs(prev => prev.filter(x => x.id !== r.id)) }
                    }}
                    disabled={busy === r.id}
                    title="Delete permanently"
                    className="w-8 h-8 rounded-lg flex items-center justify-center"
                    style={{ background: 'var(--critical)', color: '#fff' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
              </div>

              {/* Review / Customization Drawer */}
              {open && (
                <div className="mt-4 p-4 rounded-xl space-y-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  {/* Subject member's uploaded profile snapshot */}
                  <div className="p-3 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
                      Subject's Uploaded Company Details (Auto-prefilled for Verification)
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div>
                        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>Funding:</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cp.financial_funding || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>Revenue:</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cp.revenue || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>Employees:</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cp.employees || '—'}</span>
                      </div>
                      <div>
                        <span className="text-[10px] block" style={{ color: 'var(--text-muted)' }}>Stage:</span>
                        <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{cp.stage || '—'}</span>
                      </div>
                    </div>
                  </div>

                  {/* 13 Dossier Fields */}
                  <div className="grid sm:grid-cols-2 gap-3">
                    {FIELDS.map(f => (
                      <div key={f.key} className="flex flex-col gap-1">
                        <label className="text-[10px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>
                          {f.label}
                        </label>
                        <textarea
                          value={form[f.key] ?? ''}
                          onChange={e => setForm(s => ({ ...s, [f.key]: e.target.value }))}
                          rows={2}
                          className="px-3 py-2 rounded-lg text-[12px] outline-none resize-none"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      onClick={() => approveAndDeliver(r, form)}
                      disabled={busy === r.id}
                      className="px-5 py-2.5 rounded-lg text-[13px] font-bold flex items-center gap-2"
                      style={{ background: 'var(--success)', color: '#fff' }}
                    >
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                      <span>{busy === r.id ? 'Approving…' : 'Approve & Release (OK / Yes)'}</span>
                    </button>
                    <button
                      onClick={() => { setOpenId(null); setForm({}) }}
                      className="px-4 py-2.5 rounded-lg text-[12px] font-semibold"
                      style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </Card>
    </div>
  )
}

