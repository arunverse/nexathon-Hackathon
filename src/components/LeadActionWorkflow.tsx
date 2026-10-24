import { useState } from 'react'
import type { ScannedLead, LeadActionStatus } from '../lib/scanEngine'
import { updateLeadActionStatus } from '../lib/companyMemory'
import { useToast } from '../contexts/ToastContext'

const STATUS_OPTIONS: Array<LeadActionStatus['status']> = [
  'New',
  'Qualified',
  'Contacted',
  'Replied',
  'Meeting Scheduled',
  'Converted',
  'Not Relevant',
  'In Discussion',
  'Follow-Up Needed',
  'Closed',
  'Unresponsive',
]

const STATUS_THEME: Record<LeadActionStatus['status'], { bg: string; border: string; text: string }> = {
  'New':               { bg: 'var(--bg-surface)', border: 'var(--border-subtle)', text: 'var(--text-secondary)' },
  'Qualified':         { bg: 'rgba(37, 99, 235, 0.08)', border: 'rgba(37, 99, 235, 0.25)', text: '#1D4ED8' },
  'Contacted':         { bg: 'rgba(124, 58, 237, 0.08)', border: 'rgba(124, 58, 237, 0.25)', text: '#7C3AED' },
  'Replied':           { bg: 'rgba(14, 165, 233, 0.08)', border: 'rgba(14, 165, 233, 0.25)', text: '#0284C7' },
  'Meeting Scheduled': { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.25)', text: '#D97706' },
  'Converted':         { bg: 'rgba(5, 150, 105, 0.08)', border: 'rgba(5, 150, 105, 0.25)', text: '#059669' },
  'Not Relevant':      { bg: 'rgba(107, 114, 128, 0.08)', border: 'rgba(107, 114, 128, 0.25)', text: '#6B7280' },
  'In Discussion':     { bg: 'rgba(217, 119, 6, 0.08)', border: 'rgba(217, 119, 6, 0.25)', text: '#D97706' },
  'Follow-Up Needed':  { bg: 'rgba(234, 88, 12, 0.08)', border: 'rgba(234, 88, 12, 0.25)', text: '#EA580C' },
  'Closed':            { bg: 'rgba(5, 150, 105, 0.08)', border: 'rgba(5, 150, 105, 0.25)', text: '#059669' },
  'Unresponsive':      { bg: 'rgba(107, 114, 128, 0.08)', border: 'rgba(107, 114, 128, 0.25)', text: '#6B7280' },
}

interface LeadActionWorkflowProps {
  lead: ScannedLead
  compact?: boolean
  onUpdated?: (updated: LeadActionStatus) => void
}

export function LeadActionWorkflow({ lead, compact = false, onUpdated }: LeadActionWorkflowProps) {
  const toast = useToast()
  const initialStatus: LeadActionStatus['status'] = lead.action_status?.status ?? 'New'
  const [status, setStatus] = useState<LeadActionStatus['status']>(initialStatus)
  const [notes, setNotes] = useState<string>(lead.action_status?.notes ?? '')
  const [followUpDate, setFollowUpDate] = useState<string>(lead.action_status?.follow_up_date ?? '')
  const [saving, setSaving] = useState(false)
  const [savedBeat, setSavedBeat] = useState(false)

  const currentTheme = STATUS_THEME[status] ?? STATUS_THEME['New']

  async function handleSave() {
    setSaving(true)
    const payload: LeadActionStatus = {
      status,
      notes: notes.trim(),
      follow_up_date: followUpDate || undefined,
      last_activity_at: new Date().toISOString(),
    }

    try {
      await updateLeadActionStatus(lead, payload)
      onUpdated?.(payload)
      setSavedBeat(true)
      toast(`Action saved: Marked as ${status}`)
      setTimeout(() => setSavedBeat(false), 2000)
    } catch {
      toast('Could not save status. Changes kept locally.')
    } finally {
      setSaving(false)
    }
  }

  if (compact) {
    return (
      <div className="flex items-center gap-2 flex-wrap text-[11px]" onClick={e => e.stopPropagation()}>
        <span className="font-semibold text-[var(--text-muted)]">Status:</span>
        <select
          value={status}
          onChange={async e => {
            const next = e.target.value as LeadActionStatus['status']
            setStatus(next)
            const payload: LeadActionStatus = {
              status: next,
              notes,
              follow_up_date: followUpDate || undefined,
              last_activity_at: new Date().toISOString(),
            }
            await updateLeadActionStatus(lead, payload)
            onUpdated?.(payload)
            toast(`Lead status set to ${next}`)
          }}
          className="px-2 py-0.5 rounded-lg border outline-none font-semibold text-[11px] cursor-pointer"
          style={{
            background: currentTheme.bg,
            borderColor: currentTheme.border,
            color: currentTheme.text,
          }}
        >
          {STATUS_OPTIONS.map(opt => (
            <option key={opt} value={opt} style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)' }}>
              {opt}
            </option>
          ))}
        </select>
      </div>
    )
  }

  return (
    <div
      className="p-4 rounded-xl space-y-3.5"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[17px]" style={{ color: 'var(--accent-interactive)' }}>
            assignment_turned_in
          </span>
          <h4 className="text-[12px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-primary)' }}>
            Lead Pipeline & Outreach Status
          </h4>
        </div>
        <span
          className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{
            background: currentTheme.bg,
            border: `1px solid ${currentTheme.border}`,
            color: currentTheme.text,
          }}
        >
          {status}
        </span>
      </div>

      {/* Status Pills */}
      <div>
        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">
          Current Pipeline Stage
        </label>
        <div className="flex flex-wrap gap-1.5">
          {STATUS_OPTIONS.map(opt => {
            const isSelected = status === opt
            const theme = STATUS_THEME[opt]
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setStatus(opt)}
                className="px-2.5 py-1 rounded-lg text-[11.5px] font-medium transition-all cursor-pointer"
                style={
                  isSelected
                    ? {
                        background: theme.bg,
                        border: `1px solid ${theme.border}`,
                        color: theme.text,
                        fontWeight: 700,
                      }
                    : {
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }
                }
              >
                {opt}
              </button>
            )
          })}
        </div>
      </div>

      {/* Follow-up Date */}
      <div>
        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Next Follow-Up Date
        </label>
        <input
          type="date"
          value={followUpDate}
          onChange={e => setFollowUpDate(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg text-[12px] outline-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Outreach Notes */}
      <div>
        <label className="block text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1">
          Outreach Notes & Activity Log
        </label>
        <textarea
          rows={3}
          value={notes}
          onChange={e => setNotes(e.target.value)}
          placeholder="e.g. Sent connection request to VP Eng on LinkedIn; agreed to review brief on Thursday..."
          className="w-full px-3 py-2 rounded-xl text-[12.5px] outline-none resize-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      {/* Save Action */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-[12px] font-bold inline-flex items-center gap-1.5 cursor-pointer transition-all"
          style={{
            background: savedBeat ? 'var(--success)' : 'var(--accent)',
            color: '#fff',
          }}
        >
          <span className="material-symbols-outlined text-[15px]">
            {savedBeat ? 'check' : saving ? 'hourglass_empty' : 'save'}
          </span>
          {savedBeat ? 'Saved' : saving ? 'Saving…' : 'Save Status & Notes'}
        </button>
      </div>
    </div>
  )
}
