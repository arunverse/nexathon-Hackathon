/**
 * EBEXTA Admin Console — shared UI primitives (components only).
 * Non-component helpers live in adminUtils.ts (Fast Refresh requirement).
 * Same design system as the main app (CSS var tokens, 60/30/10).
 * Real loading states, real empty states — never fake numbers.
 */

import type { ReactNode } from 'react'

export function PageHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle: string }) {
  return (
    <div className="mb-6">
      <div className="flex items-center gap-3 mb-1">
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ color: 'var(--warning)', fontVariationSettings: "'FILL' 1" }}
        >
          {icon}
        </span>
        <h1
          className="text-[26px] font-bold tracking-[-0.03em]"
          style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}
        >
          {title}
        </h1>
      </div>
      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
    </div>
  )
}

export function KpiCard({ label, value, color, sub }: { label: string; value: string | number; color?: string; sub?: string }) {
  const c = color ?? 'var(--text-primary)'
  return (
    <div
      className="rounded-xl p-4"
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      <p className="text-[26px] font-bold font-mono leading-none mb-1.5" style={{ color: c }}>{value}</p>
      <p className="text-[10px] font-bold tracking-[0.07em] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
      {sub && <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center gap-4 mt-20">
      <div
        className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
        style={{ borderColor: 'var(--warning)', borderTopColor: 'transparent' }}
      />
      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{label}</p>
    </div>
  )
}

export function EmptyState({ title = 'No data yet', hint }: { title?: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center text-center py-16">
      <p className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>{title}</p>
      {hint && <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>{hint}</p>}
    </div>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  const hasPadding = /\bp[xytrbl]?-/.test(className)
  return (
    <div
      className={`rounded-2xl transition-all shadow-sm ${hasPadding ? '' : 'p-4 sm:p-5'} ${className}`}
      style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
    >
      {children}
    </div>
  )
}

// ── Table primitives ────────────────────────────────────────────────────────────

export function Th({ children, right = false, className = '' }: { children: ReactNode; right?: boolean; className?: string }) {
  return (
    <th
      className={`${right ? 'text-right' : 'text-left'} px-3 py-2.5 text-[10px] font-bold tracking-[0.07em] uppercase whitespace-nowrap ${className}`}
      style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      {children}
    </th>
  )
}

export function Td({
  children,
  mono = false,
  right = false,
  onClick,
  className = '',
}: {
  children: ReactNode
  mono?: boolean
  right?: boolean
  onClick?: (e: React.MouseEvent) => void
  className?: string
}) {
  return (
    <td
      onClick={onClick}
      className={`px-3 py-2.5 text-[12px] align-top ${right ? 'text-right' : ''} ${className}`}
      style={{
        color: 'var(--text-secondary)',
        borderBottom: '1px solid var(--border-subtle)',
        fontFamily: mono ? 'JetBrains Mono, monospace' : undefined,
      }}
    >
      {children}
    </td>
  )
}

export function Pill({ label, tone }: { label: string; tone: 'green' | 'amber' | 'red' | 'indigo' | 'neutral' }) {
  const tones: Record<string, { bg: string; color: string; border: string }> = {
    green:   { bg: 'rgba(16,185,129,0.1)',  color: 'var(--success)',        border: 'rgba(16,185,129,0.25)' },
    amber:   { bg: 'rgba(245,158,11,0.1)',  color: 'var(--warning)',        border: 'rgba(245,158,11,0.25)' },
    red:     { bg: 'rgba(220,38,38,0.1)',   color: '#DC2626',               border: 'rgba(220,38,38,0.25)' },
    indigo:  { bg: 'rgba(99,102,241,0.1)',  color: '#4338CA',               border: 'rgba(99,102,241,0.25)' },
    neutral: { bg: 'rgba(90,90,122,0.12)',  color: 'var(--text-secondary)', border: 'rgba(90,90,122,0.25)' },
  }
  const t = tones[tone]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold whitespace-nowrap"
      style={{ background: t.bg, color: t.color, border: `1px solid ${t.border}` }}
    >
      {label}
    </span>
  )
}
