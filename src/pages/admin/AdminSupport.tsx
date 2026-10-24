/**
 * /admin/support — tickets raised by the in-app assistant bot.
 * Filter by status, read the message + bot transcript, and triage
 * (Open → In progress → Resolved). Backed by public.support_tickets.
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, Pill } from './shared'
import { timeAgoLabel } from './adminUtils'
import { logAdminAction } from '../../lib/adminLog'

interface Ticket {
  id: string; user_id: string | null; email: string | null; subject: string | null
  message: string; source: string | null; status: 'open' | 'in_progress' | 'resolved'
  transcript: { from: string; text: string }[] | null; created_at: string
}

const STATUSES = ['all', 'open', 'in_progress', 'resolved'] as const
type Filter = typeof STATUSES[number]
const TONE: Record<string, 'amber' | 'indigo' | 'green'> = { open: 'amber', in_progress: 'indigo', resolved: 'green' }
const NEXT: Record<string, Ticket['status']> = { open: 'in_progress', in_progress: 'resolved', resolved: 'open' }
const NEXT_LABEL: Record<string, string> = { open: 'Start', in_progress: 'Resolve', resolved: 'Reopen' }

export default function AdminSupport() {
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase.from('support_tickets').select('*').order('created_at', { ascending: false }).limit(300)
    if (error) setLoadError(`${error.message} — did you run supabase/support_tickets.sql?`)
    setTickets((data ?? []) as Ticket[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => filter === 'all' ? tickets : tickets.filter(t => t.status === filter), [tickets, filter])
  const openCount = tickets.filter(t => t.status === 'open').length

  async function advance(t: Ticket) {
    setBusyId(t.id)
    const next = NEXT[t.status]
    const { error } = await supabase.from('support_tickets').update({ status: next }).eq('id', t.id)
    if (!error) {
      setTickets(ts => ts.map(x => x.id === t.id ? { ...x, status: next } : x))
      void logAdminAction(`Ticket → ${next}`, { targetType: 'support_ticket', targetId: t.id })
    }
    setBusyId(null)
  }

  if (loading) return <Loading label="Loading support tickets…" />

  return (
    <div>
      <PageHeader icon="support_agent" title="Support Tickets"
        subtitle={`${tickets.length} total · ${openCount} open: raised from the in-app assistant.`} />

      {loadError && (
        <div className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}>{loadError}</div>
      )}

      <div className="flex gap-1.5 mb-5">
        {STATUSES.map(s => (
          <button key={s} onClick={() => setFilter(s)}
            className="px-3 py-1.5 rounded-xl text-[12px] font-bold capitalize transition-all"
            style={filter === s
              ? { background: 'rgba(245,158,11,0.12)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.25)' }
              : { background: 'rgba(255,255,255,0.03)', color: 'var(--text-muted)', border: '1px solid rgba(255,255,255,0.05)' }}>
            {s.replace('_', ' ')}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <Card><EmptyState title="No tickets" hint="Tickets raised via EBEXTA Assist will appear here." /></Card>
      ) : (
        <div className="space-y-3">
          {filtered.map(t => {
            const expanded = openId === t.id
            return (
              <Card key={t.id}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <button className="min-w-0 text-left" onClick={() => setOpenId(expanded ? null : t.id)}>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Pill label={t.status.replace('_', ' ')} tone={TONE[t.status] ?? 'neutral'} />
                        <span className="text-[13.5px] font-bold break-words" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, sans-serif' }}>{t.subject || 'Ticket'}</span>
                      </div>
                      <p className="text-[12.5px] mt-1.5 break-words" style={{ color: 'var(--text-secondary)' }}>{t.message}</p>
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>{t.email || 'unknown email'} · {timeAgoLabel(t.created_at)}</p>
                    </button>
                    <button onClick={() => advance(t)} disabled={busyId === t.id}
                      className="shrink-0 text-[11.5px] font-bold px-3 py-1.5 rounded-xl"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      {busyId === t.id ? '…' : NEXT_LABEL[t.status]}
                    </button>
                  </div>
                  {expanded && t.transcript && t.transcript.length > 0 && (
                    <div className="mt-3 pt-3 space-y-1.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold uppercase tracking-wide" style={{ color: 'var(--text-muted)' }}>Bot transcript</p>
                      {t.transcript.map((m, i) => (
                        <p key={i} className="text-[12px] break-words" style={{ color: 'var(--text-secondary)' }}>
                          <strong style={{ color: m.from === 'user' ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>{m.from === 'user' ? 'User' : 'Bot'}:</strong> {m.text}
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
