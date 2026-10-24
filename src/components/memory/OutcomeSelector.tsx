/**
 * #10 OUTCOME FEEDBACK — usable on Company Memory AND on lead cards.
 *
 * Selecting an outcome writes: company_memory.outcome, a timeline event, a
 * pipeline event, and (for Won / Excellent Match) the rule_performance
 * conversion credit for every rule that fired on this lead.
 */
import { useState } from 'react'
import {
  OUTCOMES, setOutcome, ensureMemoryForLead, fetchMemory,
  type Outcome, type CompanyMemory,
} from '../../lib/companyMemory'
import type { ScannedLead } from '../../lib/scanEngine'

const OUTCOME_META: Record<Outcome, { icon: string; tone: 'success' | 'critical' | 'muted' }> = {
  'Won':              { icon: 'emoji_events',   tone: 'success' },
  'Excellent Match':  { icon: 'auto_awesome',   tone: 'success' },
  'Lost':             { icon: 'do_not_disturb', tone: 'critical' },
  'Not Interested':   { icon: 'block',          tone: 'muted' },
  'Wrong Contact':    { icon: 'person_off',     tone: 'critical' },
  'Bad Match':        { icon: 'thumb_down',     tone: 'muted' },
}

function toneStyle(tone: 'success' | 'critical' | 'muted', active: boolean): React.CSSProperties {
  if (!active) {
    return { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }
  }
  if (tone === 'success') return { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
  if (tone === 'critical') return { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }
  return { background: 'var(--accent-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }
}

export function OutcomeSelector({
  memory, lead, dealValue, compact = false, onSaved,
}: {
  /** Pass a memory when the caller already has one (Company Memory page). */
  memory?: CompanyMemory | null
  /** Pass a lead when the caller doesn't (lead cards) — memory is created lazily. */
  lead?: ScannedLead | null
  dealValue?: number | null
  compact?: boolean
  onSaved?: (outcome: Outcome) => void
}) {
  const [current, setCurrent] = useState<Outcome | null>(memory?.outcome ?? null)
  const [busy, setBusy] = useState<Outcome | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function choose(o: Outcome) {
    if (busy) return
    setBusy(o); setError(null)
    try {
      let target: Pick<CompanyMemory, 'id' | 'company_name' | 'company_snapshot'> | null = memory ?? null

      if (!target && lead) {
        const id = await ensureMemoryForLead(lead)
        if (id) target = await fetchMemory(id)
      }
      if (!target) {
        setError('Could not open this company’s memory.')
        return
      }

      const ok = await setOutcome(target, o, dealValue ?? null)
      if (!ok) { setError('Could not save — try again.'); return }
      setCurrent(o)
      onSaved?.(o)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className={`flex flex-wrap ${compact ? 'gap-1' : 'gap-1.5'}`}>
        {OUTCOMES.map(o => {
          const meta = OUTCOME_META[o]
          const active = current === o
          return (
            <button
              key={o}
              onClick={() => choose(o)}
              disabled={busy !== null}
              className={`inline-flex items-center gap-1 rounded-full font-semibold transition-all disabled:opacity-60 ${
                compact ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-[11.5px]'
              }`}
              style={toneStyle(meta.tone, active)}
              title={active ? `Current outcome: ${o}` : `Mark as ${o}`}
            >
              <span className="material-symbols-outlined"
                style={{ fontSize: compact ? 13 : 15, fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>
                {busy === o ? 'progress_activity' : meta.icon}
              </span>
              {o}
            </button>
          )
        })}
      </div>
      {error && (
        <p className="text-[11.5px] mt-1.5" style={{ color: 'var(--critical)' }}>{error}</p>
      )}
    </div>
  )
}
