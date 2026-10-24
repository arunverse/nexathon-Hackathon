/**
 * #6 AI EXPLAINABILITY — surfaces what the scan already stored.
 * No scoring logic lives here; this only displays score_breakdown, the match
 * breakdown and rules_fired. "Why EBEXTA chose this company."
 */
import { MemorySection, EmptyNote, Pill } from './MemoryShared'

interface BreakdownItem { signal: string; points: number }

function Bars({ items, total, label }: { items: BreakdownItem[]; total: number | null; label: string }) {
  if (items.length === 0) return null
  const sum = items.reduce((s, i) => s + i.points, 0)
  const max = Math.max(...items.map(i => Math.abs(i.points)), 1)

  return (
    <div className="rounded-xl px-3.5 py-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-baseline justify-between mb-2.5">
        <p className="label-xs">{label}</p>
        <p className="text-[15px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
          {total ?? sum}
        </p>
      </div>
      <div className="space-y-1.5">
        {items.map((item, i) => {
          const negative = item.points < 0
          return (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-[12px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-secondary)' }}>
                {item.signal}
              </span>
              <span className="h-1.5 rounded-full shrink-0" style={{
                width: `${Math.round((Math.abs(item.points) / max) * 72)}px`,
                background: negative ? 'var(--critical)' : 'var(--accent-interactive)',
              }} />
              <span className="text-[12px] font-bold mono-val w-9 text-right shrink-0"
                style={{ color: negative ? 'var(--critical)' : 'var(--text-primary)' }}>
                {negative ? '' : '+'}{item.points}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex items-center justify-between mt-2.5 pt-2"
        style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-muted)' }}>Total</span>
        <span className="text-[13px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>{sum}</span>
      </div>
    </div>
  )
}

export function ScoreExplainability({ snapshot }: { snapshot: Record<string, unknown> | null }) {
  const snap = snapshot ?? {}

  const intentBreakdown = (Array.isArray(snap.score_breakdown) ? snap.score_breakdown : []) as BreakdownItem[]
  const matchBreakdown = (Array.isArray(snap.match_breakdown) ? snap.match_breakdown : []) as BreakdownItem[]
  const rulesFired = (Array.isArray(snap.rules_fired) ? snap.rules_fired : []) as string[]
  const intentScore = Number.isFinite(Number(snap.intent_score)) ? Number(snap.intent_score) : null
  const matchScore = Number.isFinite(Number(snap.match_score)) ? Number(snap.match_score) : null

  const nothing = intentBreakdown.length === 0 && matchBreakdown.length === 0 && rulesFired.length === 0

  return (
    <MemorySection
      id="explainability"
      icon="query_stats"
      title="Why EBEXTA chose this company"
      subtitle="The itemised score, exactly as it was computed"
    >
      {nothing ? (
        <EmptyNote>
          This company was recorded before scoring detail was stored. The next scan that
          touches it will fill in the breakdown.
        </EmptyNote>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            <Bars items={intentBreakdown} total={intentScore} label="Intent score" />
            <Bars items={matchBreakdown} total={matchScore} label="Requirement score" />
          </div>

          {rulesFired.length > 0 && (
            <div className="rounded-xl px-3.5 py-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              {/* "Rules that fired" read like something had gone wrong or a
                  lead had been kicked out. It's the opposite — these are the
                  reasons the lead was picked. */}
              <p className="label-xs mb-2">What matched</p>
              <div className="flex flex-wrap gap-1.5">
                {rulesFired.map((r, i) => <Pill key={i} tone="accent">{r}</Pill>)}
              </div>
            </div>
          )}
        </div>
      )}
    </MemorySection>
  )
}
