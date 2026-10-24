/**
 * FEASIBILITY DISPLAY — can this company actually deploy what you sell?
 *
 * Two shapes:
 *  - <FeasibilityLine>  compact, for the lead card
 *  - <FeasibilityRow>   full verdict + evidence + source, for lead detail
 *
 * A judgement inferred from business type is NEVER shown as verified fact —
 * only evidence read off their own website earns the verified treatment.
 */

import { openExternal } from '../lib/urlUtils'
import { feasibilityLabel } from '../lib/feasibility'
import type { FeasibilityStatus, FeasibilityEvidence } from '../lib/feasibility'

function tone(status: FeasibilityStatus) {
  switch (status) {
    case 'ready':      return { color: 'var(--success)',    bg: 'var(--success-bg)',  icon: 'check_circle' }
    case 'not_viable': return { color: 'var(--critical)',   bg: 'var(--critical-bg)', icon: 'block' }
    default:           return { color: 'var(--warning)',    bg: 'var(--warning-bg)',  icon: 'help' }
  }
}

// ─── Compact — lead card ─────────────────────────────────────────────────────

export function FeasibilityLine({
  status, prerequisite, evidence,
}: {
  status: FeasibilityStatus | undefined
  prerequisite: string | undefined
  evidence?: FeasibilityEvidence[]
}) {
  // Nothing to say for sellers who declared no prerequisite.
  if (!status || !prerequisite) return null

  const t = tone(status)
  const label = feasibilityLabel(status, prerequisite)
  const proof = (evidence ?? []).find(e => e.is_verified && e.source_url)

  return (
    <div className="flex items-center gap-1.5 mt-2 px-2 py-1 rounded-lg"
      style={{ background: t.bg, border: `1px solid ${t.color}` }}>
      <span className="material-symbols-outlined text-[13px] shrink-0"
        style={{ color: t.color, fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
      <span className="text-[10.5px] font-semibold leading-tight truncate" style={{ color: t.color }}>
        {label}
      </span>
      {proof && (
        <button
          onClick={e => { e.stopPropagation(); openExternal(proof.source_url) }}
          title={`Proved by ${proof.source_url}`}
          className="shrink-0 ml-auto"
        >
          <span className="material-symbols-outlined text-[12px]" style={{ color: t.color }}>open_in_new</span>
        </button>
      )}
    </div>
  )
}

// ─── Full — lead detail ──────────────────────────────────────────────────────

export function FeasibilityRow({
  status, prerequisite, evidence, score,
}: {
  status: FeasibilityStatus | undefined
  prerequisite: string | undefined
  evidence?: FeasibilityEvidence[]
  score?: number
}) {
  if (!status || !prerequisite) return null

  const t = tone(status)
  const items = evidence ?? []
  const verified = items.some(e => e.is_verified)

  return (
    <div className="rounded-xl p-4" style={{ background: t.bg, border: `1px solid ${t.color}` }}>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <span className="material-symbols-outlined text-[17px]"
          style={{ color: t.color, fontVariationSettings: "'FILL' 1" }}>{t.icon}</span>
        <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          {feasibilityLabel(status, prerequisite)}
        </p>

        {/* The provenance badge — inference never masquerades as fact. */}
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-[0.06em] uppercase"
          style={verified
            ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
            : { background: 'var(--accent-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}>
          <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
            {verified ? 'verified' : 'psychology'}
          </span>
          {verified ? 'From their website' : 'EBEXTA Engine inferred'}
        </span>

        {typeof score === 'number' && score > 0 && (
          <span className="text-[11px] font-bold mono-val ml-auto" style={{ color: t.color }}>
            +{score}
          </span>
        )}
      </div>

      <div className="space-y-1.5 pl-6">
        {items.map((e, i) => (
          <div key={i} className="flex items-start gap-2">
            <span className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {e.detail}
            </span>
            {e.source_url && (
              <button onClick={() => openExternal(e.source_url)}
                className="text-[11px] underline shrink-0" style={{ color: 'var(--accent-interactive)' }}>
                source
              </button>
            )}
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-[12.5px]" style={{ color: 'var(--text-muted)' }}>
            No evidence either way: treat this as unconfirmed.
          </p>
        )}
      </div>

      {status === 'unknown' && (
        <p className="text-[11.5px] mt-2.5 pl-6" style={{ color: 'var(--text-muted)' }}>
          EBEXTA shows unconfirmed leads rather than hiding them, but check this before you spend
          time on the pitch.
        </p>
      )}
    </div>
  )
}
