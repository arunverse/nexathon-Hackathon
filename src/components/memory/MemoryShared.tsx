/**
 * Shared primitives for the Company Memory sections.
 * Theme tokens only — no new colours, no new fonts.
 */
import type { ReactNode } from 'react'

/**
 * VERIFIED = we hold a source that proves it, or it happened inside EBEXTA.
 * INFERRED = AI derived it. The distinction is the whole trust story — never
 * let an inferred thing wear the verified badge.
 */
export function TrustBadge({ verified, className = '' }: { verified: boolean; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-[0.07em] uppercase shrink-0 ${className}`}
      style={verified
        ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
        : { background: 'var(--accent-subtle)', color: 'var(--text-secondary)', border: '1px solid var(--border-strong)' }}
      title={verified
        ? 'Backed by a source link or recorded inside EBEXTA'
        : 'EBEXTA Engine inference from available data — not independently verified'}
    >
      <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        {verified ? 'verified' : 'psychology'}
      </span>
      {verified ? 'Verified' : 'Inferred'}
    </span>
  )
}

/** A stacked section card. `id` is the scroll-spy anchor for the jump nav. */
export function MemorySection({
  id, icon, title, subtitle, action, children,
}: {
  id: string
  icon: string
  title: string
  subtitle?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="rounded-2xl premium-card" style={{ borderRadius: 16 }}>
        <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3"
          style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-start gap-2.5 min-w-0">
            <span className="material-symbols-outlined text-[19px] mt-0.5 shrink-0"
              style={{ color: 'var(--accent-interactive)' }}>{icon}</span>
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold leading-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>{title}</h2>
              {subtitle && (
                <div className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</div>
              )}
            </div>
          </div>
          {action && <div className="shrink-0">{action}</div>}
        </div>
        <div className="px-5 py-4">{children}</div>
      </div>
    </section>
  )
}

/** Quiet in-section empty state — explains what fills it, never scolds. */
export function EmptyNote({ children }: { children: ReactNode }) {
  return (
    <p className="text-[12.5px] leading-relaxed py-1" style={{ color: 'var(--text-muted)' }}>
      {children}
    </p>
  )
}

export function Pill({ children, tone = 'default' }: {
  children: ReactNode
  tone?: 'default' | 'accent' | 'success' | 'warning' | 'critical'
}) {
  const styles: Record<string, React.CSSProperties> = {
    default:  { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' },
    accent:   { background: 'var(--accent-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' },
    success:  { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' },
    warning:  { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' },
    critical: { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' },
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold leading-[1.4]"
      style={styles[tone]}>
      {children}
    </span>
  )
}
