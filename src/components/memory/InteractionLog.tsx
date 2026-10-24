/**
 * INTERACTION LOG — every email, proposal, meeting, call and note EBEXTA
 * recorded for this company. Written automatically by the outreach flows and
 * manually from here.
 */
import { useState } from 'react'
import { MemorySection, EmptyNote } from './MemoryShared'
import { formatDate, relativeDate } from '../../lib/dateFormat'
import type { Interaction, InteractionType } from '../../lib/companyMemory'

const TYPE_META: Record<InteractionType, { icon: string; label: string }> = {
  email_sent:    { icon: 'outgoing_mail', label: 'Email sent' },
  proposal_sent: { icon: 'description',   label: 'Proposal sent' },
  reply:         { icon: 'reply',         label: 'Reply' },
  meeting:       { icon: 'event',         label: 'Meeting' },
  call:          { icon: 'call',          label: 'Call' },
  note:          { icon: 'edit_note',     label: 'Note' },
}

const MANUAL_TYPES: InteractionType[] = ['meeting', 'call', 'reply', 'note']

export function InteractionLog({
  interactions, onLog,
}: {
  interactions: Interaction[]
  onLog: (type: InteractionType, subject: string, contact: string) => Promise<void>
}) {
  const [open, setOpen] = useState(false)
  const [type, setType] = useState<InteractionType>('meeting')
  const [subject, setSubject] = useState('')
  const [contact, setContact] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit() {
    if (!subject.trim() || saving) return
    setSaving(true)
    await onLog(type, subject.trim(), contact.trim())
    setSaving(false)
    setSubject(''); setContact(''); setOpen(false)
  }

  return (
    <MemorySection
      id="interactions"
      icon="forum"
      title="Interactions"
      subtitle={interactions.length > 0
        ? `${interactions.length} recorded`
        : 'Emails, proposals, meetings and calls'}
      action={
        <button onClick={() => setOpen(v => !v)}
          className="ghost-btn px-2.5 py-1.5 rounded-lg text-[11.5px] font-semibold inline-flex items-center gap-1">
          <span className="material-symbols-outlined text-[15px]">add</span>
          Log
        </button>
      }
    >
      {open && (
        <div className="mb-4 rounded-xl p-3 space-y-2"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <div className="flex flex-wrap gap-1.5">
            {MANUAL_TYPES.map(t => (
              <button key={t} onClick={() => setType(t)}
                className="px-2.5 py-1 rounded-full text-[11.5px] font-semibold transition-colors"
                style={type === t
                  ? { background: 'var(--accent)', color: 'var(--bg-elevated)', border: '1px solid var(--accent)' }
                  : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                {TYPE_META[t].label}
              </button>
            ))}
          </div>
          <input value={subject} onChange={e => setSubject(e.target.value)}
            placeholder="What was it about?" maxLength={200}
            className="premium-input w-full px-3 py-2 rounded-lg text-[13px]" />
          <input value={contact} onChange={e => setContact(e.target.value)}
            placeholder="Who with? (optional)" maxLength={100}
            className="premium-input w-full px-3 py-2 rounded-lg text-[13px]" />
          <div className="flex items-center gap-2">
            <button onClick={submit} disabled={!subject.trim() || saving}
              className="premium-btn px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-50">
              {saving ? 'Saving…' : 'Log interaction'}
            </button>
            <button onClick={() => setOpen(false)} className="ghost-btn px-3 py-1.5 rounded-lg text-[12px]">Cancel</button>
          </div>
        </div>
      )}

      {interactions.length === 0 ? (
        <EmptyNote>
          Nothing yet. Every email and proposal you generate in EBEXTA lands here automatically —
          meetings and calls you can log yourself.
        </EmptyNote>
      ) : (
        <div className="space-y-2">
          {interactions.map(ix => {
            const meta = TYPE_META[ix.interaction_type] ?? TYPE_META.note
            return (
              <div key={ix.id} className="flex gap-3 rounded-xl px-3.5 py-2.5"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[17px] mt-0.5 shrink-0"
                  style={{ color: 'var(--accent-interactive)' }}>{meta.icon}</span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2">
                    <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{meta.label}</p>
                    {ix.contact_name && (
                      <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>· {ix.contact_name}</p>
                    )}
                    <p className="text-[11px] mono-val ml-auto" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(ix.occurred_at)} · {relativeDate(ix.occurred_at)}
                    </p>
                  </div>
                  {ix.subject && (
                    <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-primary)' }}>{ix.subject}</p>
                  )}
                  {ix.body_preview && (
                    <p className="text-[12px] mt-1 leading-relaxed line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                      {ix.body_preview}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </MemorySection>
  )
}
