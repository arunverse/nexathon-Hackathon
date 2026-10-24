/**
 * /admin/requests — plan & renewal requests submitted by users (sales-led
 * activation). The admin reviews the company + contact details, arranges a
 * session, then activates credits. No online billing.
 */
import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card } from './shared'
import { adminDeleteRow } from './adminActions'
import { logAdminAction } from '../../lib/adminLog'

interface Req {
  id: string; user_id: string | null; kind: string | null; plan: string | null
  company_name: string | null; website: string | null; company_size: string | null; industry: string | null
  contact_name: string | null; contact_role: string | null; contact_phone: string | null; message: string | null
  status: string | null; created_at: string; handled_at: string | null
}

const PLAN_DEFAULT_CREDITS: Record<string, number> = { growth: 2500, pro: 7500, enterprise: 25000, starter: 2500 }
const TONE: Record<string, { c: string; bg: string }> = {
  pending:   { c: 'var(--warning)', bg: 'var(--warning-bg)' },
  contacted: { c: 'var(--accent-interactive)', bg: 'var(--accent-subtle)' },
  activated: { c: 'var(--success)', bg: 'var(--success-bg)' },
  declined:  { c: 'var(--critical)', bg: 'var(--critical-bg)' },
}

export default function AdminRequests() {
  const [reqs, setReqs] = useState<Req[]>([])
  const [emails, setEmails] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ t: string; ok: boolean } | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Req | null>(null)
  const [deleting, setDeleting] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase.from('plan_requests').select('*').order('created_at', { ascending: false })
    if (error) {
      flash(`Failed to load requests: ${error.message}`, false)
      setReqs([])
      setLoading(false)
      return
    }
    const rows = (data as Req[]) ?? []
    setReqs(rows)
    const ids = [...new Set(rows.map(r => r.user_id).filter(Boolean))] as string[]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, sender_email').in('id', ids)
      const map: Record<string, string> = {}
      for (const p of (profs as { id: string; sender_email: string | null }[]) ?? []) map[p.id] = p.sender_email ?? ''
      setEmails(map)
    }
    setLoading(false)
  }, [])
  useEffect(() => { void load() }, [load])

  const flash = (t: string, ok: boolean) => { setMsg({ t, ok }); setTimeout(() => setMsg(null), 3500) }

  async function activate(r: Req) {
    const def = PLAN_DEFAULT_CREDITS[r.plan ?? ''] ?? 300
    const cl = window.prompt(`Activate ${r.company_name ?? 'user'} on ${r.plan ?? 'plan'}: monthly credit limit:`, String(def))
    if (cl == null) return
    const days = window.prompt('Plan valid for how many days?', '30')
    if (days == null) return
    setBusy(r.id)
    const creditLimit = parseInt(cl, 10) || def
    const validDays = parseInt(days, 10) || 30
    let { error } = await supabase.rpc('ebexta_activate_request', {
      p_request_id: r.id, p_credit_limit: creditLimit, p_days: validDays,
    })
    if (error) {
      // Fallback: direct updates via RLS
      const nowIso = new Date().toISOString()
      const expiresIso = new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString()
      if (r.user_id) {
        const profilePatch: Record<string, unknown> = {
          plan: r.plan || 'starter',
          plan_status: 'active',
          plan_started_at: nowIso,
          plan_expires_at: expiresIso,
          credit_limit: creditLimit,
          credits_reset_at: nowIso,
        }
        if (r.kind === 'new') profilePatch.onboarded = false
        await supabase.from('profiles').update(profilePatch).eq('id', r.user_id)
      }
      const { error: reqErr } = await supabase.from('plan_requests').update({ status: 'activated', handled_at: nowIso }).eq('id', r.id)
      if (!reqErr) error = null
    }
    setBusy(null)
    if (error) { flash(`Activate failed: ${error.message}`, false); return }

    if (r.user_id) {
      try {
        await supabase.from('user_credits').upsert({
          user_id: r.user_id,
          plan: r.plan || 'starter',
          scan_credits: creditLimit,
          scan_credits_used: 0,
          verified_credits: 10,
          verified_credits_used: 0,
          bonus_credits: 0,
          cycle_start: new Date().toISOString(),
          cycle_end: new Date(Date.now() + validDays * 24 * 60 * 60 * 1000).toISOString(),
          is_suspended: false,
          updated_at: new Date().toISOString(),
        })
      } catch (cErr) {
        console.warn('[AdminRequests] user_credits update warning:', cErr)
      }
    }

    void logAdminAction('Activated plan request', { targetType: 'plan_request', targetId: r.id, detail: { credit_limit: creditLimit, days: validDays, user_id: r.user_id } })
    flash('Activated: the user now has access.', true); void load()
  }
  async function setStatus(r: Req, status: string) {
    setBusy(r.id)
    let { error } = await supabase.rpc('ebexta_set_request_status', { p_request_id: r.id, p_status: status })
    if (error) {
      const { error: directErr } = await supabase.from('plan_requests').update({ status, handled_at: new Date().toISOString() }).eq('id', r.id)
      if (!directErr) error = null
    }
    setBusy(null)
    if (error) { flash(`Failed: ${error.message}`, false); return }
    void logAdminAction('Set plan-request status', { targetType: 'plan_request', targetId: r.id, detail: { status } })
    flash(`Marked ${status}.`, true); void load()
  }
  async function removeReq(r: Req) {
    setDeleteTarget(r)
  }

  async function confirmDeleteReq() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleting(true)
    const err = await adminDeleteRow('plan_requests', id)
    setDeleting(false)
    if (err) {
      flash(`Delete failed: ${err}`, false)
      return
    }
    setDeleteTarget(null)
    flash('Plan request deleted permanently from database.', true)
    await load()
  }

  if (loading) return <Loading label="Loading requests…" />

  const pending = reqs.filter(r => r.status === 'pending').length

  return (
    <div>
      <PageHeader icon="assignment" title="Plan Requests"
        subtitle={`${reqs.length} total · ${pending} pending review`} />

      {msg && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold" style={{ background: msg.ok ? 'var(--success-bg)' : 'var(--critical-bg)', color: msg.ok ? 'var(--success)' : 'var(--critical)', border: `1px solid ${msg.ok ? 'var(--success)' : 'var(--critical)'}` }}>{msg.t}</div>
      )}

      <Card>
        {reqs.length === 0 ? (
          <EmptyState title="No requests yet" hint="New signups and renewals appear here." />
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
            {reqs.map(r => {
              const tone = TONE[r.status ?? 'pending'] ?? TONE.pending
              return (
                <div key={r.id} className="p-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{r.company_name || '—'}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ color: tone.c, background: tone.bg }}>{r.status}</span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ color: 'var(--text-muted)', background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>{r.kind} · {r.plan}</span>
                      </div>
                      <p className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                        {r.contact_name}{r.contact_role ? ` · ${r.contact_role}` : ''}{r.contact_phone ? ` · ${r.contact_phone}` : ''}
                      </p>
                      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        {emails[r.user_id ?? ''] || ''}{r.website ? ` · ${r.website}` : ''}{r.industry ? ` · ${r.industry}` : ''}{r.company_size ? ` · ${r.company_size}` : ''}
                      </p>
                      {r.message && <p className="text-[12.5px] mt-1.5 italic" style={{ color: 'var(--text-secondary)' }}>“{r.message}”</p>}
                      <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {r.status !== 'activated' && (
                        <button onClick={() => activate(r)} disabled={busy === r.id}
                          className="px-3 py-2 rounded-lg text-[12px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                          {busy === r.id ? '…' : 'Activate'}
                        </button>
                      )}
                      {r.status === 'pending' && (
                        <button onClick={() => setStatus(r, 'contacted')} disabled={busy === r.id}
                          className="px-3 py-2 rounded-lg text-[12px] font-bold" style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                          Mark contacted
                        </button>
                      )}
                      {r.status !== 'declined' && r.status !== 'activated' && (
                        <button onClick={() => setStatus(r, 'declined')} disabled={busy === r.id}
                          className="px-3 py-2 rounded-lg text-[12px] font-bold" style={{ background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}>
                          Decline
                        </button>
                      )}
                      <button onClick={() => removeReq(r)} disabled={busy === r.id} title="Delete permanently"
                        className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: 'var(--critical)', color: '#fff' }}>
                        <span className="material-symbols-outlined text-[18px]">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>

      {deleteTarget && (
        <DeleteReqModal
          req={deleteTarget}
          onClose={() => { if (!deleting) setDeleteTarget(null) }}
          onConfirm={confirmDeleteReq}
          deleting={deleting}
        />
      )}
    </div>
  )
}

function DeleteReqModal({
  req,
  onClose,
  onConfirm,
  deleting,
}: {
  req: Req
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !deleting) onClose() }}
    >
      <div
        className="w-full max-w-[480px] rounded-2xl p-6 shadow-2xl space-y-5"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--critical)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="material-symbols-outlined text-[24px]">delete</span>
          </div>
          <div>
            <h3 className="text-[17px] font-bold tracking-tight">Delete Plan Request?</h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              This will permanently remove this request from the database.
            </p>
          </div>
        </div>

        <div className="p-3.5 rounded-xl space-y-1.5 text-[12px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Company:</span>
            <strong>{req.company_name || '—'}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Contact:</span>
            <span>{req.contact_name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Plan:</span>
            <span className="uppercase font-semibold text-[11px]">{req.plan || '—'}</span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="px-4 h-9 rounded-xl text-[12px] font-medium transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="px-5 h-9 rounded-xl text-[12px] font-bold inline-flex items-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--critical)', color: '#fff' }}
          >
            {deleting ? 'Deleting…' : 'Delete Request'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
