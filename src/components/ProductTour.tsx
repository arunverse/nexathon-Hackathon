/**
 * ProductTour — a one-time, skippable spotlight walkthrough for first-time
 * users. Lightweight (no dependency): it dims the screen, cuts a "hole" around
 * the current target element, and shows a positioned tooltip with Next / Skip.
 *
 * Steps target elements via `data-tour="…"` selectors. If a step's target
 * isn't on screen, that step renders centered instead of being skipped, so the
 * message is never lost. Enter = Next, Esc = Skip.
 */
import { useEffect, useLayoutEffect, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'

export interface TourStep { selector?: string; title: string; body: string }

const TOOLTIP_W = 300

export function ProductTour({ steps, onFinish }: { steps: TourStep[]; onFinish: () => void }) {
  const [i, setI] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const step = steps[i]

  useLayoutEffect(() => {
    let alive = true
    function measure() {
      if (!alive) return
      const el = step?.selector ? (document.querySelector(step.selector) as HTMLElement | null) : null
      if (el) {
        const r = el.getBoundingClientRect()
        const offscreen = r.top < 60 || r.bottom > window.innerHeight - 60
        if (offscreen) el.scrollIntoView({ block: 'center', behavior: 'smooth' })
        setRect(el.getBoundingClientRect())
      } else setRect(null)
    }
    measure()
    const t = window.setTimeout(measure, 300)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    return () => { alive = false; window.clearTimeout(t); window.removeEventListener('resize', measure); window.removeEventListener('scroll', measure, true) }
  }, [i, step?.selector])

  const isLast = i >= steps.length - 1
  const next = () => (isLast ? onFinish() : setI(i + 1))
  const back = () => setI(Math.max(0, i - 1))

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onFinish()
      if (e.key === 'Enter') next()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!step) return null

  const pad = 8
  const hole = rect
    ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 }
    : null

  // Tooltip placement — ALWAYS kept fully on-screen (never pushed off the top).
  const TIP_H = 250
  let tipStyle: CSSProperties
  if (hole) {
    let top: number
    let left = hole.left
    const tall = hole.height > window.innerHeight * 0.7 // e.g. the full-height sidebar
    if (tall) {
      // Place beside a very tall target, pinned near the top.
      left = hole.left + hole.width + 12
      top = 24
    } else {
      const spaceBelow = window.innerHeight - (hole.top + hole.height)
      if (spaceBelow > TIP_H + 16) top = hole.top + hole.height + 12
      else if (hole.top > TIP_H + 16) top = hole.top - TIP_H - 12
      else top = window.innerHeight / 2 - TIP_H / 2
    }
    left = Math.min(Math.max(left, 12), window.innerWidth - TOOLTIP_W - 12)
    top = Math.min(Math.max(top, 12), window.innerHeight - TIP_H - 12)
    tipStyle = { top, left }
  } else {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }
  }

  return createPortal(
    <div className="fixed inset-0 z-[350]" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
      {/* click-capture layer (blocks the app during the tour) */}
      <div className="absolute inset-0" style={{ background: hole ? 'transparent' : 'rgba(0,0,0,0.62)' }} onClick={e => e.stopPropagation()} />

      {/* Always-reachable escape hatch — pinned top-right, never off-screen */}
      <button onClick={onFinish}
        className="absolute top-4 right-4 flex items-center gap-1.5 px-3 py-2 rounded-xl text-[12px] font-bold"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)', color: 'var(--text-secondary)', zIndex: 353 }}>
        <span className="material-symbols-outlined text-[15px]">close</span> Skip tour
      </button>

      {/* spotlight hole */}
      {hole && (
        <div className="absolute pointer-events-none transition-all duration-200"
          style={{
            top: hole.top, left: hole.left, width: hole.width, height: hole.height,
            borderRadius: 12, border: '2px solid var(--accent)',
            boxShadow: '0 0 0 9999px rgba(0,0,0,0.62)',
          }} />
      )}

      {/* tooltip */}
      <div className="absolute rounded-2xl p-5" style={{
        ...tipStyle, width: TOOLTIP_W,
        background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)', zIndex: 352,
      }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] font-bold tracking-[0.1em] uppercase" style={{ color: 'var(--accent-interactive)' }}>
            Step {i + 1} of {steps.length}
          </span>
          <button onClick={onFinish} className="text-[11px] font-semibold" style={{ color: 'var(--text-muted)' }}>Skip tour</button>
        </div>
        <p className="text-[15px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{step.title}</p>
        <p className="text-[13px] leading-snug mb-4" style={{ color: 'var(--text-secondary)' }}>{step.body}</p>

        {/* progress dots */}
        <div className="flex items-center gap-1 mb-4">
          {steps.map((_, n) => (
            <div key={n} className="h-1 rounded-full transition-all" style={{ width: n === i ? 18 : 6, background: n <= i ? 'var(--accent)' : 'var(--border-strong)' }} />
          ))}
        </div>

        <div className="flex items-center justify-between">
          <button onClick={back} disabled={i === 0}
            className="text-[13px] font-semibold disabled:opacity-0" style={{ color: 'var(--text-muted)' }}>← Back</button>
          <button onClick={next}
            className="px-5 py-2 rounded-xl text-[13px] font-bold flex items-center gap-1.5"
            style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
            {isLast ? 'Done' : 'Next'}
            {!isLast && <span className="material-symbols-outlined text-[16px]">arrow_forward</span>}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

// The 8 first-run steps (matches the product spec).
export const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="sidebar"]', title: 'Your command center', body: 'Leads, Outreach, Intent, Verified Contacts and Saved all live here.' },
  { selector: '[data-tour="mode"]', title: 'Seeker or Provider', body: 'You are a Seeker or a Provider. Switch anytime — your leads flip to match.' },
  { selector: '[data-tour="scan"]', title: 'Start with a scan', body: 'One scan finds your matched companies in minutes. This is where you begin.' },
  { selector: '[data-tour="lead-card"]', title: 'Every lead is scored', body: 'Each lead is scored and verified. Click any card to see the full intel.' },
  { selector: '[data-tour="verify-badge"]', title: 'Verification at a glance', body: 'This shows how verified a lead is. Green means fully verified.' },
  { selector: '[data-tour="save"]', title: 'Save what matters', body: 'Save any lead — find it later in Saved, tied to your account.' },
  { selector: '[data-tour="nav-verified"]', title: 'Validated Decision-Makers', body: 'Want confirmed contacts? Request verified decision-maker details cross-referenced against public registries.' },
  { title: "You're all set", body: "That's the tour. Run your first scan whenever you're ready." },
]
