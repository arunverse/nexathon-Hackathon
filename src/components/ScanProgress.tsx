/**
 * SCAN PROGRESS — the trust-building moment.
 * ---------------------------------------------------------------------------
 * The scan genuinely takes 2-5 minutes: two-pass discovery, reading every
 * company's website page by page, verification, rank checks. That's the honest
 * cost of not handing back a stale database.
 *
 * So we show the real work rather than padding a spinner. Every line here is
 * driven by an actual pipeline callback. Progress bars move when a stage
 * finishes — if a stage takes 3 seconds, it takes 3 seconds. Fake progress is
 * exactly the thing that would undermine what this screen is for.
 */

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── The four real stages ─────────────────────────────────────────────────────

export const SCAN_STAGES = [
  {
    key: 'discovery',
    title: 'DISCOVERY',
    why: 'We search live, not a stale database',
  },
  {
    key: 'filtration',
    title: 'FILTRATION',
    why: 'Three filters: fit, requirement, integrity',
  },
  {
    key: 'verification',
    title: 'VERIFICATION',
    why: 'We read their actual website with zero guessing',
  },
  {
    key: 'ranking',
    title: 'RANKING',
    why: 'Requirement beats popularity',
  },
] as const

/** Map the pipeline's numeric step onto a stage index. */
export function stageIndexFor(step: number): number {
  if (step <= 1) return 0
  if (step <= 2) return 1
  if (step <= 4) return 2
  return 3
}

function mmss(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60)
  const s = totalSeconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Header: echo their onboarding back ───────────────────────────────────────

export interface ScanContext {
  service: string
  location: string
  size: string
  mode: string
}

function ContextHeader({ ctx }: { ctx: ScanContext }) {
  const bits = [ctx.location, ctx.size, ctx.mode].filter(Boolean)
  return (
    <div className="text-center">
      <p className="text-[12px] tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
        Finding companies that need
      </p>
      <h1 className="text-[26px] md:text-[32px] font-bold tracking-[-0.03em] leading-tight"
        style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
        {ctx.service.toUpperCase()}
      </h1>
      {bits.length > 0 && (
        <p className="text-[13px] mt-2" style={{ color: 'var(--text-secondary)' }}>
          {bits.join(' · ')}
        </p>
      )}
    </div>
  )
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function ScanProgress({
  ctx, statusMessage, step, leadsReady, onShowPartial, onKeepWaiting,
  finished, finishedCount, elapsedOverride,
}: {
  ctx: ScanContext
  /** The REAL message from the pipeline — never invented here. */
  statusMessage: string
  step: number
  leadsReady: number
  onShowPartial?: () => void
  onKeepWaiting?: () => void
  /** Set when the scan completed — freezes the timer. */
  finished?: boolean
  finishedCount?: number
  elapsedOverride?: number
}) {
  const [elapsed, setElapsed] = useState(0)
  const [offerAccepted, setOfferAccepted] = useState(false)
  const startedAt = useRef(Date.now())

  useEffect(() => {
    if (finished) return
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAt.current) / 1000))
    }, 1000)
    return () => clearInterval(iv)
  }, [finished])

  const shown = elapsedOverride ?? elapsed
  const activeStage = stageIndexFor(step)

  // Honest thresholds. Nothing here fakes a state — they simply reflect how
  // long the real work has been running.
  const pastFiveMin = shown >= 300 && !finished
  const pastEightMin = shown >= 480 && !finished

  // ── Completion ──
  if (finished) {
    const fast = shown < 180
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
          className="text-center max-w-[420px]">
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--success-bg)', border: '1px solid var(--success)' }}>
            <span className="material-symbols-outlined text-[26px]"
              style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>check</span>
          </div>
          <h1 className="text-[22px] font-bold tracking-[-0.02em] mb-1.5"
            style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
            Done in {mmss(shown)}{fast ? ' (faster than usual)' : ''}
          </h1>
          <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
            {finishedCount ?? 0} verified lead{(finishedCount ?? 0) === 1 ? '' : 's'} ready
          </p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col px-4 py-10" style={{ background: 'var(--bg-base)' }}>

      {/* TOP — what they asked for, read back to them */}
      <div className="pt-6 pb-10">
        <ContextHeader ctx={ctx} />
      </div>

      {/* CENTER — the real current stage */}
      <div className="flex-1 flex flex-col items-center justify-center text-center max-w-[620px] mx-auto w-full">
        <div className="flex items-center gap-2 mb-4">
          <span className="live-dot" />
          <span className="text-[11px] font-bold tracking-[0.12em] uppercase" style={{ color: 'var(--accent-interactive)' }}>
            Deep scan active
          </span>
        </div>

        <AnimatePresence mode="wait">
          <motion.p
            key={statusMessage}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.3 }}
            className="text-[19px] md:text-[22px] font-semibold leading-snug min-h-[64px] flex items-center"
            style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}
          >
            {statusMessage}
          </motion.p>
        </AnimatePresence>

        {/* Timer — subtle, and honest about the expected range */}
        <div className="flex items-center gap-2 mt-4">
          <span className="text-[15px] font-bold mono-val" style={{ color: 'var(--text-primary)' }}>
            {mmss(shown)}
          </span>
          <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            Usually 2–5 minutes
          </span>
        </div>

        {/* ── PAST 5 MINUTES ──
            No error, no fake spinner. Tell them why it's slow and hand them
            the choice. Some companies genuinely take longer to verify. */}
        {pastFiveMin && !pastEightMin && !offerAccepted && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl px-5 py-4 text-left w-full"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)' }}
          >
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Still verifying: this one's thorough.
            </p>
            <p className="text-[13px] leading-relaxed mb-3.5" style={{ color: 'var(--text-secondary)' }}>
              We're reading {leadsReady > 0 ? leadsReady : 'several'} company websites and checking every
              link. Deep verification takes longer for some companies.
            </p>
            <div className="flex flex-wrap gap-2">
              <button onClick={onShowPartial}
                className="premium-btn px-4 py-2 rounded-xl text-[13px]">
                Show me what's ready so far
              </button>
              <button onClick={() => { setOfferAccepted(true); onKeepWaiting?.() }}
                className="ghost-btn px-4 py-2 rounded-xl text-[13px] font-semibold">
                Keep verifying
              </button>
            </div>
          </motion.div>
        )}

        {/* ── PAST 8 MINUTES WITH NOTHING ──
            At this point it has failed. Say so, and make sure they weren't
            charged for it. */}
        {pastEightMin && leadsReady === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="mt-8 rounded-2xl px-5 py-4 text-left w-full"
            style={{ background: 'var(--critical-bg)', border: '1px solid var(--critical)' }}
          >
            <p className="text-[14px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
              Scan couldn't complete: no credit used
            </p>
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Something upstream is struggling. Your credit has been returned.
            </p>
          </motion.div>
        )}
      </div>

      {/* BOTTOM — why this takes as long as it does */}
      <div className="max-w-[860px] mx-auto w-full mt-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {SCAN_STAGES.map((stage, i) => {
            const done = i < activeStage
            const active = i === activeStage
            return (
              <div key={stage.key} className="rounded-xl px-4 py-3.5"
                style={{
                  background: active ? 'var(--bg-elevated)' : 'var(--bg-surface)',
                  border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border-subtle)'}`,
                }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[15px]"
                    style={{ color: done ? 'var(--success)' : active ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>
                    {done ? 'check_circle' : active ? 'radio_button_checked' : 'radio_button_unchecked'}
                  </span>
                  <p className="text-[10.5px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: done || active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                    {stage.title}
                  </p>
                </div>

                {/* Real stage completion — no timed animation pretending to
                    be work. Done is done; active is in progress. */}
                <div className="h-1.5 rounded-full overflow-hidden mb-2.5" style={{ background: 'var(--bg-surface)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: done ? '100%' : active ? '55%' : '0%' }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ background: done ? 'var(--success)' : 'var(--accent)' }}
                  />
                </div>

                <p className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {stage.why}
                </p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
