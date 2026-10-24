/**
 * #1 TRUST HISTORY — the vertical event timeline inside Company Memory.
 * Newest first. Never loses old events; a re-scan only appends what's new.
 */
import { useState } from 'react'
import { MemorySection, TrustBadge, EmptyNote } from './MemoryShared'
import { formatDate, relativeDate } from '../../lib/dateFormat'
import { openExternal } from '../../lib/urlUtils'
import type { TimelineEvent, EventType } from '../../lib/companyMemory'

const EVENT_ICON: Record<EventType, string> = {
  scan:         'radar',
  funding:      'payments',
  hiring:       'group_add',
  expansion:    'travel_explore',
  launch:       'rocket_launch',
  verification: 'verified_user',
  contact:      'mail',
  proposal:     'description',
  meeting:      'event',
  note:         'edit_note',
  outcome:      'flag',
}

export function TrustHistory({
  events, onAddNote, busy,
}: {
  events: TimelineEvent[]
  onAddNote: (title: string, detail: string) => Promise<void>
  busy?: boolean
}) {
  const [adding, setAdding] = useState(false)
  const [title, setTitle] = useState('')
  const [detail, setDetail] = useState('')
  const [saving, setSaving] = useState(false)

  const verifiedCount = events.filter(e => e.is_verified).length

  async function submit() {
    const t = title.trim()
    if (!t || saving) return
    setSaving(true)
    await onAddNote(t, detail.trim())
    setSaving(false)
    setTitle(''); setDetail(''); setAdding(false)
  }

  return (
    <MemorySection
      id="timeline"
      icon="history"
      title="Trust History"
      subtitle={events.length > 0
        ? `${events.length} event${events.length === 1 ? '' : 's'} · ${verifiedCount} verified`
        : 'Every dated thing EBEXTA knows about this company'}
      action={
        <button
          onClick={() => setAdding(v => !v)}
          disabled={busy}
          className="ghost-btn px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1 disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[15px]">add</span>
          Add note
        </button>
      }
    >
      {adding && (
        <div className="mb-4 rounded-xl p-3 space-y-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="What happened? e.g. Spoke to Priya about Q3 budget"
            maxLength={200}
            className="premium-input w-full px-3 py-2 rounded-lg text-[13px]"
          />
          <textarea
            value={detail}
            onChange={e => setDetail(e.target.value)}
            placeholder="Detail (optional)"
            rows={2}
            className="premium-input w-full px-3 py-2 rounded-lg text-[13px] resize-none"
          />
          <div className="flex items-center gap-2">
            <button onClick={submit} disabled={!title.trim() || saving}
              className="premium-btn px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-50">
              {saving ? 'Saving…' : 'Add to timeline'}
            </button>
            <button onClick={() => { setAdding(false); setTitle(''); setDetail('') }}
              className="ghost-btn px-3 py-1.5 rounded-lg text-[12px]">Cancel</button>
          </div>
        </div>
      )}

      {events.length === 0 ? (
        <EmptyNote>
          Nothing recorded yet. Scans, verifications, emails and your own notes all land here —
          this is what turns a one-off lead into a company you actually know.
        </EmptyNote>
      ) : (
        <ol className="relative">
          {/* The spine */}
          <div className="absolute left-[11px] top-2 bottom-2 w-px"
            style={{ background: 'var(--border-subtle)' }} aria-hidden />

          {events.map(ev => (
            <li key={ev.id} className="relative pl-9 pb-4 last:pb-0">
              <span
                className="absolute left-0 top-0 w-[23px] h-[23px] rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--bg-elevated)',
                  border: `1px solid ${ev.is_verified ? 'var(--success)' : 'var(--border-strong)'}`,
                }}
              >
                <span className="material-symbols-outlined text-[13px]"
                  style={{ color: ev.is_verified ? 'var(--success)' : 'var(--text-muted)' }}>
                  {EVENT_ICON[ev.event_type] ?? 'circle'}
                </span>
              </span>

              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mb-0.5">
                <span className="mono-val text-[11px]" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(ev.event_date ?? ev.created_at)}
                </span>
                <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                  {relativeDate(ev.event_date ?? ev.created_at)}
                </span>
                <TrustBadge verified={ev.is_verified} />
              </div>

              <p className="text-[13.5px] font-medium leading-snug" style={{ color: 'var(--text-primary)' }}>
                {ev.event_title}
              </p>

              {ev.event_detail && (
                <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {ev.event_detail}
                </p>
              )}

              {ev.source_url && (
                <button
                  onClick={() => openExternal(ev.source_url, `${ev.event_title} source verification`)}
                  className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-semibold underline cursor-pointer"
                  style={{ color: 'var(--accent-interactive)' }}
                >
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  View source
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
    </MemorySection>
  )
}
