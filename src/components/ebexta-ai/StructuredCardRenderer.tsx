import React from 'react'
import { useNavigate } from 'react-router-dom'
import type { StructuredCard } from '../../lib/ebexta-ai/types'

interface Props {
  card: StructuredCard
  onActionClick?: (actionId: string, payload?: any) => void
}

export const StructuredCardRenderer: React.FC<Props> = ({ card, onActionClick }) => {
  const navigate = useNavigate()

  switch (card.type) {
    case 'COMPANY_LIST': {
      const items = Array.isArray(card.data) ? card.data : []
      return (
        <div className="mt-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12.5px] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[var(--accent-interactive)]">domain</span>
              {card.title}
            </span>
            {card.confidence && (
              <span className="rounded-full bg-[var(--accent-subtle)] px-2 py-0.5 text-[10px] font-bold text-[var(--accent-interactive)]">
                {card.confidence} CONFIDENCE
              </span>
            )}
          </div>

          <div className="mt-2 divide-y divide-[var(--border-subtle)] max-h-56 overflow-y-auto pr-1">
            {items.map((c: any, idx: number) => {
              const name = c.company_name || c.name || 'Account'
              const score = c.match_score || c.intent_score || 85
              const id = c.id
              return (
                <div key={idx} className="flex items-center justify-between py-2 first:pt-1 last:pb-1">
                  <div className="min-w-0 flex-1 pr-2">
                    <p className="truncate font-semibold text-[var(--text-primary)]">{name}</p>
                    <p className="truncate text-[11px] text-[var(--text-muted)]">
                      {[c.industry, c.location, c.funding_stage].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold text-[11.5px] text-[var(--success)]">
                      {score}%
                    </span>
                    {id && (
                      <button
                        onClick={() => navigate(`/dashboard/lead/${id}`)}
                        className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-base)] px-2 py-1 text-[10.5px] font-semibold text-[var(--text-secondary)] hover:border-[var(--accent-interactive)] hover:text-[var(--accent-interactive)] transition-colors"
                      >
                        View
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {card.recommendedAction && (
            <button
              onClick={() => onActionClick?.(card.recommendedAction!.id, card.recommendedAction!.params)}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent-interactive)] py-1.5 text-[11.5px] font-bold text-white shadow-sm hover:opacity-90 transition-opacity"
            >
              <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
              {card.recommendedAction.label}
            </button>
          )}
        </div>
      )
    }

    case 'SCORE_BREAKDOWN': {
      const facts = card.facts ?? []
      const d = card.data ?? {}
      return (
        <div className="mt-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12.5px] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[var(--warning)]">verified</span>
              {card.title}
            </span>
            <span className="rounded-full bg-[var(--success-bg)] px-2 py-0.5 text-[10px] font-bold text-[var(--success)]">
              VERIFIED
            </span>
          </div>

          <div className="mt-2.5 space-y-1.5">
            {facts.map((f: any, i: number) => (
              <div key={i} className="flex items-center justify-between text-[11.5px]">
                <span className="text-[var(--text-secondary)]">{f.label}</span>
                <span className="font-bold text-[var(--text-primary)]">{f.value}</span>
              </div>
            ))}
          </div>

          {Array.isArray(d.reasons) && d.reasons.length > 0 && (
            <div className="mt-2.5 border-t border-[var(--border-subtle)] pt-2">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Verified Signals</p>
              <ul className="mt-1 space-y-0.5 text-[11px] text-[var(--text-secondary)]">
                {d.reasons.slice(0, 3).map((r: string, idx: number) => (
                  <li key={idx} className="flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-[13px] text-[var(--accent-interactive)]">check_circle</span>
                    <span className="truncate">{r}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {card.recommendedAction && (
            <button
              onClick={() => onActionClick?.(card.recommendedAction!.id, card.recommendedAction!.params)}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--accent)] py-1.5 text-[11.5px] font-bold text-[var(--bg-elevated)] hover:opacity-90 transition-opacity"
            >
              {card.recommendedAction.label}
            </button>
          )}
        </div>
      )
    }

    case 'PIPELINE_METRICS': {
      const facts = card.facts ?? []
      return (
        <div className="mt-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12.5px] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[var(--accent-interactive)]">analytics</span>
              {card.title}
            </span>
          </div>

          <div className="mt-2 grid grid-cols-2 gap-2">
            {facts.map((f: any, i: number) => (
              <div key={i} className="rounded-lg bg-[var(--bg-base)] p-2 border border-[var(--border-subtle)]">
                <p className="text-[10px] text-[var(--text-muted)] truncate">{f.label}</p>
                <p className="text-[14px] font-bold text-[var(--text-primary)] mt-0.5">{f.value}</p>
              </div>
            ))}
          </div>

          {card.recommendedAction && (
            <button
              onClick={() => {
                if (card.recommendedAction?.params?.navigate) {
                  navigate(card.recommendedAction.params.navigate)
                } else {
                  onActionClick?.(card.recommendedAction!.id, card.recommendedAction!.params)
                }
              }}
              className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 text-[11.5px] font-bold text-[var(--text-primary)] hover:border-[var(--accent-interactive)] transition-colors"
            >
              {card.recommendedAction.label}
            </button>
          )}
        </div>
      )
    }

    case 'OUTREACH_PREVIEW': {
      const d = card.data ?? {}
      return (
        <div className="mt-2.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3 text-[12.5px] shadow-sm">
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2">
            <span className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[17px] text-[var(--accent-interactive)]">mail</span>
              {card.title}
            </span>
            <span className="text-[10.5px] text-[var(--text-muted)] font-medium">To: {d.recipient}</span>
          </div>

          <div className="mt-2 rounded-lg bg-[var(--bg-base)] p-2.5 font-mono text-[11px] leading-relaxed text-[var(--text-secondary)] whitespace-pre-wrap max-h-48 overflow-y-auto border border-[var(--border-subtle)]">
            {d.email}
          </div>

          <div className="mt-2.5 flex items-center gap-2">
            <button
              onClick={() => {
                navigator.clipboard.writeText(d.email || '')
              }}
              className="flex-1 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] py-1.5 text-[11.5px] font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-base)] transition-colors"
            >
              Copy to Clipboard
            </button>
            {card.recommendedAction && (
              <button
                onClick={() => {
                  if (card.recommendedAction?.params?.navigate) {
                    navigate(card.recommendedAction.params.navigate)
                  } else {
                    onActionClick?.(card.recommendedAction!.id, card.recommendedAction!.params)
                  }
                }}
                className="flex-1 rounded-lg bg-[var(--accent)] py-1.5 text-[11.5px] font-bold text-[var(--bg-elevated)] hover:opacity-90 transition-opacity"
              >
                {card.recommendedAction.label}
              </button>
            )}
          </div>
        </div>
      )
    }

    case 'EXPERT_ESCALATION': {
      const facts = card.facts ?? []
      return (
        <div className="mt-2.5 rounded-xl border border-[var(--success)] bg-[var(--success-bg)] p-3 text-[12.5px] shadow-sm">
          <div className="flex items-center gap-2 font-bold text-[var(--success)]">
            <span className="material-symbols-outlined text-[18px]">support_agent</span>
            {card.title}
          </div>
          <p className="mt-1 text-[11.5px] text-[var(--text-secondary)]">{card.subtitle}</p>
          <div className="mt-2 space-y-1 rounded-lg bg-[var(--bg-elevated)] p-2 text-[11px] border border-[var(--border-subtle)]">
            {facts.map((f: any, i: number) => (
              <div key={i} className="flex justify-between">
                <span className="text-[var(--text-muted)]">{f.label}:</span>
                <span className="font-semibold text-[var(--text-primary)]">{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      )
    }

    default:
      return null
  }
}
