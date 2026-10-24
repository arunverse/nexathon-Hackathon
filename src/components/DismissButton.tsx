/**
 * DISMISS — "not relevant".
 *
 * Deliberately quiet: Save is the primary action, this is the escape hatch.
 * The promise it makes is absolute — a dismissed company never appears in any
 * future scan — so the undo has to be immediate and obvious.
 */

import { useState } from 'react'
import { dismissCompany, undismissCompany, DISMISS_REASONS } from '../lib/dismissal'

export function DismissButton({
  companyName, website, onDismissed, compact = false,
}: {
  companyName: string
  website?: string | null
  onDismissed?: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  async function dismiss(reason: string | null) {
    if (busy) return
    setBusy(true)
    const ok = await dismissCompany(companyName, {
      domain: website ? website.replace(/^https?:\/\/(www\.)?/, '').split('/')[0] : null,
      reason,
    })
    setBusy(false)
    setOpen(false)
    if (ok) onDismissed?.()
  }

  return (
    <div className="relative" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => setOpen(v => !v)}
        disabled={busy}
        title="Not relevant — never show this company again"
        className={`inline-flex items-center gap-1 rounded-lg font-semibold transition-colors disabled:opacity-50 ${
          compact ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]'
        }`}
        style={{ color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: compact ? 12 : 14 }}>
          {busy ? 'progress_activity' : 'do_not_disturb_on'}
        </span>
        Not relevant
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-1 z-40 rounded-xl p-1.5 w-[190px]"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-strong)',
            boxShadow: 'var(--shadow-lg)',
          }}>
          <p className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-1"
            style={{ color: 'var(--text-muted)' }}>Why? (optional)</p>
          {DISMISS_REASONS.map(r => (
            <button key={r} onClick={() => dismiss(r)}
              className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] hover:opacity-80"
              style={{ color: 'var(--text-secondary)' }}>
              {r}
            </button>
          ))}
          <button onClick={() => dismiss(null)}
            className="w-full text-left px-2 py-1.5 rounded-lg text-[12px] font-semibold"
            style={{ color: 'var(--text-primary)', borderTop: '1px solid var(--border-subtle)' }}>
            Just dismiss
          </button>
        </div>
      )}
    </div>
  )
}

/**
 * Undo toast. Dismissal is permanent, so a mistake needs an immediate way back
 * — otherwise the user has to go hunting in Settings.
 */
export function DismissUndoToast({
  companyName, onUndone, onClose,
}: {
  companyName: string
  onUndone: () => void
  onClose: () => void
}) {
  const [busy, setBusy] = useState(false)

  async function undo() {
    setBusy(true)
    const ok = await undismissCompany(companyName)
    setBusy(false)
    if (ok) onUndone()
    onClose()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[320] flex items-center gap-3 px-4 py-2.5 rounded-xl premium-glass">
      <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
        Dismissed <strong>{companyName}</strong>
      </span>
      <button onClick={undo} disabled={busy}
        className="text-[12.5px] font-bold underline disabled:opacity-50"
        style={{ color: 'var(--accent-interactive)' }}>
        {busy ? 'Undoing…' : 'Undo'}
      </button>
      <button onClick={onClose} aria-label="Dismiss notice">
        <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
      </button>
    </div>
  )
}
