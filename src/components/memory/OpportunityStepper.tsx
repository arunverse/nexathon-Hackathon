/**
 * #4 OPPORTUNITY TIMELINE — horizontal stepper.
 * Rules-based, no Gemini call. Derived from funding stage + signals +
 * business_impact.estimated_decision_days.
 */
import { MemorySection, TrustBadge } from './MemoryShared'
import { OPP_STAGES } from '../../lib/dealIntel'
import type { OpportunityTimeline } from '../../lib/companyMemory'

export function OpportunityStepper({ timeline }: { timeline: OpportunityTimeline | null }) {
  if (!timeline) return null
  const currentIdx = OPP_STAGES.findIndex(s => s.key === timeline.current_stage)

  return (
    <MemorySection
      id="opportunity"
      icon="timeline"
      title="Opportunity Timeline"
      subtitle="Where they likely are in the buying cycle"
      action={<TrustBadge verified={false} />}
    >
      {/* Stepper */}
      <div className="flex items-start gap-0 overflow-x-auto no-scrollbar pb-1">
        {OPP_STAGES.map((stage, i) => {
          const done = i < currentIdx
          const active = i === currentIdx
          return (
            <div key={stage.key} className="flex items-start shrink-0" style={{ minWidth: 0 }}>
              <div className="flex flex-col items-center gap-1.5" style={{ width: 96 }}>
                <div className="relative flex items-center justify-center w-full">
                  {/* Connector to the left */}
                  {i > 0 && (
                    <span className="absolute right-1/2 h-px" style={{
                      left: -48, top: 11,
                      background: done || active ? 'var(--accent)' : 'var(--border-subtle)',
                    }} />
                  )}
                  <span
                    className="relative w-[22px] h-[22px] rounded-full flex items-center justify-center z-10"
                    style={{
                      background: active ? 'var(--accent)' : done ? 'var(--accent-interactive)' : 'var(--bg-elevated)',
                      border: `1px solid ${active || done ? 'var(--accent)' : 'var(--border-strong)'}`,
                      boxShadow: active ? 'var(--shadow-md)' : 'none',
                    }}
                  >
                    {done ? (
                      <span className="material-symbols-outlined text-[13px]" style={{ color: 'var(--bg-elevated)' }}>check</span>
                    ) : (
                      <span className="text-[10px] font-bold mono-val"
                        style={{ color: active ? 'var(--bg-elevated)' : 'var(--text-muted)' }}>{i + 1}</span>
                    )}
                  </span>
                </div>
                <p className="text-[10.5px] text-center leading-tight px-1"
                  style={{
                    color: active ? 'var(--text-primary)' : 'var(--text-muted)',
                    fontWeight: active ? 700 : 500,
                  }}>
                  {stage.label}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3 items-start">
        <div className="rounded-xl px-3.5 py-2.5"
          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
          <p className="label-xs mb-0.5">Best contact window</p>
          <p className="text-[15px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
            next {timeline.window_days} days
          </p>
        </div>
        <div className="rounded-xl px-3.5 py-2.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
          <p className="label-xs mb-0.5">Why</p>
          <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{timeline.why}</p>
        </div>
      </div>
    </MemorySection>
  )
}
