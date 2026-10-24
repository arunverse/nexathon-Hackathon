/**
 * InfoTip — a small (i) icon that clarifies EBEXTA vocabulary in one line.
 * Shows on hover (desktop) and tap (mobile). Never blocks the data — it only
 * sits beside a term. Pass a known glossary `term`, or a custom `text`.
 */
import { useState, useRef, useEffect, type CSSProperties } from 'react'

export const GLOSSARY: Record<string, string> = {
  intent: 'How ready this company is to buy now, based on real signals.',
  match: 'How well this company fits your criteria.',
  confidence: 'How much of this lead we could verify.',
  trust: 'Overall confidence in this lead, across every checked field.',
  declared_intent: 'A company that privately stated it needs what you offer.',
  verified_by_ebexta: 'A human confirmed this contact is real and reachable.',
  seeker_provider: 'Seeker = you need a service. Provider = you offer one.',
  seeker: 'You need a service — EBEXTA shows you providers.',
  provider: 'You offer a service — EBEXTA shows you seekers (clients).',
  honesty: 'Percentage of firmographics that are verified or double-pass consistent.',
}

export function InfoTip({ term, text, size = 14 }: { term?: keyof typeof GLOSSARY | string; text?: string; size?: number }) {
  const body = text ?? (term ? GLOSSARY[term] : '') ?? ''
  const [open, setOpen] = useState(false)
  const [above, setAbove] = useState(false)
  const ref = useRef<HTMLSpanElement>(null)

  // Flip above the icon if there isn't room below (keeps it on-screen on mobile).
  useEffect(() => {
    if (open && ref.current) {
      const r = ref.current.getBoundingClientRect()
      setAbove(r.bottom + 90 > window.innerHeight)
    }
  }, [open])

  // Tap-outside to close (mobile).
  useEffect(() => {
    if (!open) return
    const close = (e: Event) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [open])

  if (!body) return null

  return (
    <span ref={ref} className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)}>
      <button type="button" aria-label="More info"
        onClick={e => { e.stopPropagation(); e.preventDefault(); setOpen(o => !o) }}
        className="inline-flex items-center justify-center cursor-help"
        style={{ color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: size }}>info</span>
      </button>
      {open && (
        <span
          className="absolute z-[300] left-1/2 -translate-x-1/2 px-3 py-2 rounded-lg text-[12px] font-medium leading-snug"
          style={{
            ...(above ? { bottom: 'calc(100% + 6px)' } : { top: 'calc(100% + 6px)' }) as CSSProperties,
            width: 'max-content', maxWidth: 220,
            background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)',
            color: 'var(--text-secondary)', boxShadow: 'var(--shadow-lg)',
            fontFamily: 'Geist, Inter, sans-serif', whiteSpace: 'normal',
          }}>
          {body}
        </span>
      )}
    </span>
  )
}
