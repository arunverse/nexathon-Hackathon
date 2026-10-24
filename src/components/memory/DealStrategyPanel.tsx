/**
 * #3 AI DEAL STRATEGY — cards per field, plus "Use in outreach" which pre-fills
 * the email generator with the opening line and the pitch angle.
 */
import { MemorySection, TrustBadge, EmptyNote } from './MemoryShared'
import type { DealStrategy } from '../../lib/companyMemory'

function Card({ icon, label, children }: { icon: string; label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl px-3.5 py-3"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
      <div className="flex items-center gap-1.5 mb-1.5">
        <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--accent-interactive)' }}>{icon}</span>
        <p className="label-xs">{label}</p>
      </div>
      <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{children}</div>
    </div>
  )
}

export function DealStrategyPanel({
  strategy, generating, onGenerate, onUseInOutreach,
}: {
  strategy: DealStrategy | null
  generating: boolean
  onGenerate: () => void
  onUseInOutreach: () => void
}) {
  return (
    <MemorySection
      id="strategy"
      icon="strategy"
      title="Deal Strategy"
      subtitle="How to run this specific deal"
      action={
        <div className="flex items-center gap-2">
          <TrustBadge verified={false} />
          {strategy && (
            <button onClick={onUseInOutreach}
              className="premium-btn px-2.5 py-1.5 rounded-lg text-[11.5px] inline-flex items-center gap-1">
              <span className="material-symbols-outlined text-[15px]">send</span>
              Use in outreach
            </button>
          )}
        </div>
      }
    >
      {generating ? (
        <EmptyNote>Building the strategy for this company…</EmptyNote>
      ) : !strategy ? (
        <div className="space-y-2">
          <EmptyNote>No strategy generated yet for this company.</EmptyNote>
          <button onClick={onGenerate} className="ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold">
            Generate deal strategy
          </button>
        </div>
      ) : (
        <div className="space-y-2.5">
          {strategy.opening_line && (
            <div className="rounded-xl px-3.5 py-3"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
              <p className="label-xs mb-1.5">Opening line</p>
              <p className="text-[13.5px] leading-relaxed italic" style={{ color: 'var(--text-primary)' }}>
                “{strategy.opening_line}”
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {strategy.why_now && <Card icon="schedule" label="Why now">{strategy.why_now}</Card>}
            {strategy.likely_problem && <Card icon="report_problem" label="Likely problem">{strategy.likely_problem}</Card>}
            {strategy.pitch_first && <Card icon="campaign" label="Pitch this first">{strategy.pitch_first}</Card>}
            {strategy.roi_angle && <Card icon="trending_up" label="ROI angle">{strategy.roi_angle}</Card>}
            {strategy.pricing_model && <Card icon="payments" label="Pricing model">{strategy.pricing_model}</Card>}
          </div>

          {strategy.likely_objections.length > 0 && (
            <div className="rounded-xl px-3.5 py-3"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--accent-interactive)' }}>forum</span>
                <p className="label-xs">Likely objections</p>
              </div>
              <div className="space-y-2.5">
                {strategy.likely_objections.map((o, i) => (
                  <div key={i} className="pl-3" style={{ borderLeft: '2px solid var(--border-strong)' }}>
                    <p className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>“{o.objection}”</p>
                    <p className="text-[12.5px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{o.response}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </MemorySection>
  )
}
