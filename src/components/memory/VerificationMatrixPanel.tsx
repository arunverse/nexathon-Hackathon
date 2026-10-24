/**
 * #5 MULTI-SOURCE VERIFICATION MATRIX — an explicit 8-row checklist over data
 * the scan already produced. No new computation, no API calls.
 *
 * Unverified rows never dead-end: each carries a one-click search fallback.
 */
import { MemorySection } from './MemoryShared'
import { openExternal } from '../../lib/urlUtils'
import type { VerificationMatrix, MatrixState } from '../../lib/companyMemory'

const STATE_META: Record<MatrixState, { glyph: string; label: string; color: string; bg: string }> = {
  verified:    { glyph: '✓', label: 'Verified',    color: 'var(--success)',        bg: 'var(--success-bg)' },
  partial:     { glyph: '~', label: 'Partial',     color: 'var(--warning)',        bg: 'var(--warning-bg)' },
  unverified:  { glyph: '✗', label: 'Unverified',  color: 'var(--critical)',       bg: 'var(--critical-bg)' },
  not_checked: { glyph: '—', label: 'Not checked', color: 'var(--text-muted)',     bg: 'var(--bg-surface)' },
}

export function VerificationMatrixPanel({ matrix }: { matrix: VerificationMatrix | null }) {
  if (!matrix) return null

  return (
    <MemorySection
      id="verification"
      icon="fact_check"
      title="Verification Matrix"
      subtitle={`${matrix.verified_count} of ${matrix.total} verified`}
      action={
        <div className="text-right">
          <p className="label-xs">Confidence</p>
          <p className="text-[16px] font-bold mono-val leading-none mt-0.5"
            style={{ color: 'var(--text-primary)' }}>{matrix.confidence_score}%</p>
        </div>
      }
    >
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        {matrix.rows.map((row, i) => {
          const meta = STATE_META[row.state]
          const proved = row.state === 'verified' || row.state === 'partial'
          return (
            <div
              key={row.key}
              className="flex items-center gap-3 px-3.5 py-2.5"
              style={{
                background: 'var(--bg-elevated)',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
              }}
            >
              <span
                className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[13px] font-bold"
                style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }}
                aria-label={meta.label}
              >
                {meta.glyph}
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                  {row.label}
                </p>
                {row.detail && (
                  <p className="text-[11.5px] mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>
                    {row.detail}
                  </p>
                )}
              </div>

              <span className="text-[10px] font-bold tracking-[0.06em] uppercase shrink-0 hidden sm:inline"
                style={{ color: meta.color }}>
                {meta.label}
              </span>

              {/* A proved row links to the proof. An unproved one links to a
                  search that finds it — never a broken or invented link. */}
              {proved && row.source_url ? (
                <button
                  onClick={() => openExternal(row.source_url)}
                  className="ghost-btn px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0 inline-flex items-center gap-1"
                  title="Open the source that proved this"
                >
                  <span className="material-symbols-outlined text-[13px]">open_in_new</span>
                  <span className="hidden sm:inline">Source</span>
                </button>
              ) : row.fallback_url ? (
                <button
                  onClick={() => openExternal(row.fallback_url)}
                  className="ghost-btn px-2 py-1 rounded-lg text-[11px] font-semibold shrink-0 inline-flex items-center gap-1"
                  title="Search for this yourself"
                >
                  <span className="material-symbols-outlined text-[13px]">search</span>
                  <span className="hidden sm:inline">Find</span>
                </button>
              ) : null}
            </div>
          )
        })}
      </div>

      <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
        ✓ proved by a source · ~ found but unproved · ✗ nothing found · — not applicable
      </p>
    </MemorySection>
  )
}
