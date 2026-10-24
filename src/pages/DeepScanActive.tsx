import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { runScan } from '../lib/scanEngine'
import type { ScanFilters, ScannedLead } from '../lib/scanEngine'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { checkCredits, consumeCredit, refundCredit, verifyCreditLedgerOutcome, type CreditCheck } from '../lib/credits'
import { CreditBlockScreen } from '../components/CreditBlockScreen'
import { ScanProgress, type ScanContext } from '../components/ScanProgress'
import { EbextaLogo } from '../components/common/EbextaLogo'

// ─── Rotating phrases per scan stage ─────────────────────────────────────────
// Each stage has its own set. They cycle automatically every 3.5s.

const STAGE_PHRASES: Record<number, string[]> = {
  0: [
    'Checking if we\'ve seen this before…',
    'Retrieving past intelligence on this market…',
    'Scanning the knowledge vault…',
    'Pulling up what we already know…',
  ],
  1: [
    'Cross-referencing funding rounds with hiring velocity…',
    'Mapping procurement patterns across 1,200+ sectors…',
    'Reading the digital footprint of potential buyers…',
    'Tracing capital flow to companies that need you…',
    'Surfacing companies before your competitors find them…',
    'Extracting intent signals from recent job postings…',
    'Scoring companies against your exact profile…',
    'Identifying decision-makers with budget authority…',
    'Triangulating revenue growth against expansion signals…',
    'Connecting the dots across funding, hiring, and product launches…',
  ],
  2: [
    'Separating real leads from noise…',
    'Verifying every company actually exists…',
    'Stress-testing signals for authenticity…',
    'Filtering out companies that just won\'t convert…',
    'Ranking by genuine purchase intent, not vanity metrics…',
  ],
  3: [
    'Matching against live market demand signals…',
    'Checking who else is looking for exactly what you offer…',
    'Locking in your strongest mutual fits…',
    'Aligning buy signals with what you bring to the table…',
  ],
  4: [
    'Packaging your intelligence report…',
    'Sealing the results into your dashboard…',
    'Almost there: finalising your lead dossiers…',
    'Saving verified contacts and verified links…',
  ],
}

const STEP_META = [
  { label: 'Cache check',          icon: 'memory' },
  { label: 'Live discovery',       icon: 'travel_explore' },
  { label: 'Signal filtration',    icon: 'filter_alt' },
  { label: 'Intent matching',      icon: 'join_inner' },
  { label: 'Saving results',       icon: 'cloud_done' },
]

const circumference = 2 * Math.PI * 54

// ─── Animated background orbs ─────────────────────────────────────────────────
function BackgroundOrbs() {
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {/* Large slow orb top-left */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 600, height: 600,
          top: -200, left: -200,
          background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ x: [0, 40, 0], y: [0, 30, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Mid orb right */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 400, height: 400,
          top: '30%', right: -100,
          background: 'radial-gradient(circle, rgba(88,166,255,0.08) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }}
        animate={{ x: [0, -30, 0], y: [0, -40, 0] }}
        transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />
      {/* Small orb bottom */}
      <motion.div
        className="absolute rounded-full"
        style={{
          width: 300, height: 300,
          bottom: -80, left: '40%',
          background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }}
        animate={{ x: [0, 20, -20, 0], y: [0, -20, 0] }}
        transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut', delay: 5 }}
      />
    </div>
  )
}

function PhraseRotator({ step }: { step: number }) {
  const phrases = STAGE_PHRASES[step] ?? STAGE_PHRASES[1]
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % phrases.length), 3500)
    return () => clearInterval(t)
  }, [step, phrases.length])

  return (
    <div className="h-[28px] flex items-center justify-center overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.p
          key={`${step}-${idx}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          style={{
            fontSize: 14,
            color: '#5B3FA3',
            textAlign: 'center',
            fontStyle: 'italic',
            letterSpacing: '0.01em',
          }}
        >
          {phrases[idx]}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

// ─── Animated scan rings ───────────────────────────────────────────────────────
function ScanRings({ pct }: { pct: number }) {
  const offset = circumference - (pct / 100) * circumference
  const color = pct < 30 ? 'var(--accent)' : pct < 70 ? '#7C3AED' : 'var(--accent)'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 200, height: 200 }}>
      {/* Outer pulse rings */}
      {[1, 2, 3].map(n => (
        <motion.div
          key={n}
          className="absolute rounded-full border"
          style={{
            width: 140 + n * 18,
            height: 140 + n * 18,
            borderColor: `rgba(29,38,54,${0.14 - n * 0.03})`,
          }}
          animate={{ scale: [1, 1.06, 1], opacity: [0.5, 0.15, 0.5] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', delay: n * 0.55 }}
        />
      ))}

      {/* SVG progress ring */}
      <svg width="140" height="140" viewBox="0 0 140 140" className="-rotate-90 absolute">
        {/* Track */}
        <circle cx="70" cy="70" r="54" fill="none" strokeWidth="5"
          stroke="var(--border-subtle)" />
        {/* Progress */}
        <circle cx="70" cy="70" r="54" fill="none" strokeWidth="5"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ stroke: color, transition: 'stroke-dashoffset 1s ease, stroke 0.8s ease' }}
        />
      </svg>

      {/* Center content */}
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span
          key={Math.round(pct / 5) * 5}
          initial={{ scale: 0.85, opacity: 0.5 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35 }}
          style={{
            fontSize: 38,
            fontWeight: 800,
            color,
            lineHeight: 1,
            fontFamily: 'Geist, Inter, sans-serif',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {pct}
        </motion.span>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>%</span>
      </div>
    </div>
  )
}

// ─── Step list ────────────────────────────────────────────────────────────────
function StepList({ currentStep, pct }: { currentStep: number; pct: number }) {
  return (
    <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {STEP_META.map((s, i) => {
        const done   = pct === 100 || currentStep > i + 1
        const active = currentStep === i + 1 && pct < 100
        const stepProgress = done ? 100 : active ? Math.min(100, Math.max(0, (pct - i * 20) * 5)) : 0

        return (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 14px',
              borderRadius: 12,
              border: `1px solid ${done ? 'var(--accent-subtle)' : active ? 'var(--accent-subtle)' : 'var(--border-subtle)'}`,
              background: done ? 'var(--accent-subtle)' : active ? 'var(--accent-subtle)' : 'var(--border-subtle)',
              transition: 'all 0.4s ease',
            }}
          >
            {/* Icon */}
            <div style={{
              width: 32, height: 32,
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: done ? 'var(--accent-subtle)' : active ? 'var(--accent-subtle)' : 'var(--border-subtle)',
              transition: 'all 0.4s ease',
              flexShrink: 0,
            }}>
              {done
                ? <span className="material-symbols-outlined" style={{ fontSize: 16, color: '#7C3AED', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                : active
                  ? <motion.span
                      className="material-symbols-outlined"
                      style={{ fontSize: 16, color: 'var(--accent)' }}
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.4, repeat: Infinity }}
                    >{s.icon}</motion.span>
                  : <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--border-strong)' }}>{s.icon}</span>
              }
            </div>

            {/* Label + bar */}
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: done ? '#7C3AED' : active ? 'var(--text-primary)' : 'var(--text-muted)',
                  transition: 'color 0.4s',
                }}>{s.label}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: done ? '#7C3AED' : active ? 'var(--accent)' : 'var(--text-muted)',
                }}>
                  {done ? '✓' : active ? `${Math.round(stepProgress)}%` : ''}
                </span>
              </div>
              <div style={{ height: 3, borderRadius: 99, background: 'var(--border-subtle)', overflow: 'hidden' }}>
                <motion.div
                  style={{ height: '100%', borderRadius: 99, background: done ? 'var(--accent)' : 'var(--accent)' }}
                  animate={{ width: `${stepProgress}%` }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                />
              </div>
            </div>
          </motion.div>
        )
      })}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DeepScanActive() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [currentStep, setCurrentStep] = useState(0)
  const [pct, setPct] = useState(0)
  const [error, setError] = useState<string | null>(null)
  // Set when the credit gate refuses. Replaces the whole screen — a toast for
  // "you cannot do this at all" would just look like the scan hung.
  const [blocked, setBlocked] = useState<CreditCheck | null>(null)
  const [lastMsg, setLastMsg] = useState('')
  const scanStarted = useRef(false)

  // ── Honest timing ──
  // The scan really does take 2-5 minutes. We show the elapsed time, offer an
  // escape hatch past 5, and treat 8 minutes with nothing as a genuine failure
  // that must not cost a credit.
  const [emptyResult, setEmptyResult] = useState(false)
  const [finished, setFinished] = useState(false)
  const [finishedCount, setFinishedCount] = useState(0)
  const [finalElapsed, setFinalElapsed] = useState(0)
  const [leadsReady, setLeadsReady] = useState(0)
  const scanStartedAt = useRef<number>(Date.now())
  const partialLeads = useRef<ScannedLead[]>([])
  const scanIdRef = useRef<string>((typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'scan_' + Date.now()))
  const [creditOutcome, setCreditOutcome] = useState<string | null>(null)

  // What the user told us during onboarding — read back so they can see EBEXTA
  // understood them before it spends five minutes on their behalf.
  const scanCtx: ScanContext = (() => {
    let f: Record<string, unknown> = {}
    try { f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { /* defaults below */ }
    const cities = Array.isArray(f.cities) ? (f.cities as string[]) : []
    const countries = Array.isArray(f.countries) && f.countries.length > 0
      ? (f.countries as string[])
      : f.country ? String(f.country).split(',').map((s: string) => s.trim()).filter(Boolean) : ['India']
    const min = Number(f.employeeMin), max = Number(f.employeeMax)

    let locationStr: string
    if (cities.length > 0) {
      const cityList = cities.length <= 3 ? cities.join(', ') : `${cities.slice(0, 3).join(', ')} +${cities.length - 3}`
      const ctryList = countries.length <= 2 ? countries.join(', ') : `${countries.slice(0, 2).join(', ')} +${countries.length - 2}`
      locationStr = countries.length > 0 ? `${cityList} (${ctryList})` : cityList
    } else {
      locationStr = countries.join(', ') || String(f.country ?? 'India')
    }

    return {
      service: String(f.productName || f.companyName || f.mission || 'B2B services').slice(0, 60),
      location: locationStr,
      size: Number.isFinite(min) && Number.isFinite(max) ? `${min}–${max >= 1000 ? '1,000+' : max} employees` : '',
      mode: f.mode === 'provider' ? 'Provider mode' : f.mode === 'seeker' ? 'Seeker mode' : '',
    }
  })()

  // ── 8-MINUTE FAILURE WATCHDOG ──
  // Past 8 minutes with nothing to show, the scan has failed. The user must not
  // pay for that. Refund first, then say so.
  useEffect(() => {
    if (finished || error) return
    const timer = setTimeout(() => {
      if (partialLeads.current.length === 0) {
        void refundCredit('scan', 'Scan exceeded 8 minutes with no results')
        setError('SCAN_TIMEOUT')
      }
    }, 8 * 60 * 1000)
    return () => clearTimeout(timer)
  }, [finished, error])

  /** Hand over whatever finished, and let the rest keep running. */
  function showWhatIsReady() {
    try {
      if (partialLeads.current.length > 0) {
        let f: Record<string, unknown> = {}
        try { f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { /* ignore */ }
        const scanMode = (f.mode === 'provider' ? 'provider' : 'seeker')
        localStorage.setItem(`ebexta_leads_${scanMode}`, JSON.stringify(partialLeads.current))
        localStorage.setItem('ebexta_scan_results', JSON.stringify(partialLeads.current))
      }
    } catch { /* quota */ }
    navigate('/dashboard')
  }

  const startScan = useCallback(async () => {
    const raw = localStorage.getItem('ebexta_scan_filters')
    const filters: ScanFilters = raw ? JSON.parse(raw) : {
      mission: 'B2B technology services',
      employeeMin: 10,
      employeeMax: 500,
      country: 'India',
      countries: ['India'],
      companyStages: ['Series A', 'Series B'],
    }

    // ── CREDIT GATE ──
    // Decided server-side. If this says no, the scan never starts and no API
    // call is made. The Gemini proxy carries the same check, so bypassing this
    // screen still gets refused where the money is actually spent.
    const gate = await checkCredits('scan')
    if (!gate.allowed) {
      setBlocked(gate)
      return
    }

    let consumed = false
    const scanMode = (filters.mode === 'provider' ? 'provider' : 'seeker')
    try {
      // 1. Explicit scan status in database: mark 'running'
      if (user) {
        try {
          await supabase.from('scans').upsert({
            id: scanIdRef.current,
            user_id: user.id,
            filters,
            status: 'running',
            mode: scanMode,
            created_at: new Date().toISOString(),
          })
        } catch { /* non-fatal lifecycle init */ }
      }

      const leads = await runScan(
        filters,
        // Login is compulsory — ProtectedRoute guarantees a session here.
        user!.id,
        (step, message, partials) => {
          setCurrentStep(step)
          setLastMsg(message)
          setPct(Math.round((step / 5) * 100))
          if (partials && partials.length > 0) {
            partialLeads.current = partials
            setLeadsReady(partials.length)

            // Incremental candidate persistence: save progress immediately
            try {
              localStorage.setItem(`ebexta_partial_scan_${scanIdRef.current}`, JSON.stringify(partials))
              localStorage.setItem(`ebexta_leads_${scanMode}`, JSON.stringify(partials))
              localStorage.setItem('ebexta_scan_results', JSON.stringify(partials))
            } catch { /* quota */ }

            if (user) {
              void supabase.from('scans').upsert({
                id: scanIdRef.current,
                user_id: user.id,
                filters,
                status: 'partially_completed',
                mode: scanMode,
              })
            }
          } else {
            const n = message.match(/\b(\d+)\s+(?:of|verified|companies|leads)\b/i)
            if (n) setLeadsReady(Number(n[1]))
          }
        },
        { scanId: scanIdRef.current }
      )

      partialLeads.current = leads
      setLeadsReady(leads.length)

      // A scan that found nothing cost us API calls but gave the user nothing.
      // Charge for it, then immediately refund — the ledger shows both, so the
      // real cost stays visible while the user is made whole.
      await consumeCredit('scan', {
        apiCalls: Math.max(1, leads.length),
        note: `Scan — ${leads.length} leads`,
        referenceId: scanIdRef.current,
      })
      consumed = true

      // ── ZERO LEADS IS AN ACTIONABLE STATE, NOT A BLANK DASHBOARD ──
      // Refund first, then say what happened and what to change. Dropping the
      // user on an empty dashboard tells them nothing and charges them for it.
      if (leads.length === 0) {
        await refundCredit('scan', 'Scan returned no leads', scanIdRef.current)
        consumed = false
        if (user) {
          const audit = await verifyCreditLedgerOutcome(user.id, scanIdRef.current)
          setCreditOutcome(`0 credits charged (Confirmed in database ledger. Verified balance: ${audit.currentBalance ?? 'active'}).`)
        } else {
          setCreditOutcome('0 credits charged — no charge when zero leads match.')
        }
        setEmptyResult(true)
        return
      }
      // Freeze the timer and show the real duration for a beat before handing
      // over — the number is honest either way.
      setFinalElapsed(Math.floor((Date.now() - scanStartedAt.current) / 1000))
      setFinishedCount(leads.length)
      setFinished(true)

      // Per-mode storage — seekers and providers each keep their own results
      localStorage.setItem(`ebexta_leads_${scanMode}`, JSON.stringify(leads))
      localStorage.removeItem('ebexta_scan_results')  // legacy single-key cache
      try { localStorage.removeItem(`ebexta_partial_scan_${scanIdRef.current}`) } catch { /* ignore */ }

      if (user) {
        try {
          await supabase.from('profiles').update({ mode: scanMode }).eq('id', user.id)
          await supabase.from('scans').upsert({
            id: scanIdRef.current,
            user_id: user.id,
            filters,
            status: 'completed',
            mode: scanMode,
          })
        } catch { /* ignore */ }
      }
      try {
        const currentFilters = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
        localStorage.setItem('ebexta_scan_filters', JSON.stringify({ ...currentFilters, mode: scanMode }))
      } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('ebexta_mode_changed', { detail: { mode: scanMode } }))
      window.dispatchEvent(new Event('ebexta_profile_updated'))

      setPct(100)
      // Brief completion beat so the real duration is readable.
      setTimeout(() => navigate('/dashboard'), 1500)
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Scan failed. Please try again.'

      // The user must never lose a credit for OUR failure.
      if (consumed) {
        await refundCredit('scan', `Scan failed: ${raw.slice(0, 200)}`, scanIdRef.current)
      }

      // Verify the real ledger outcome directly against database transactions
      if (user) {
        const audit = await verifyCreditLedgerOutcome(user.id, scanIdRef.current)
        if (audit.refunded) {
          setCreditOutcome(`1 credit refunded (Confirmed in database ledger. Current balance: ${audit.currentBalance ?? 'restored'}).`)
        } else if (!audit.deducted) {
          setCreditOutcome(`0 credits deducted (Confirmed in database ledger. Current balance: ${audit.currentBalance ?? 'uncharged'}).`)
        } else {
          setCreditOutcome('Credit adjustment recorded in database transaction ledger.')
        }
      } else {
        setCreditOutcome(consumed ? '1 credit refunded to your account.' : '0 credits deducted — your balance is uncharged.')
      }

      // Preserve partial results discovered before failure so the user never loses progress
      if (partialLeads.current.length > 0) {
        try {
          localStorage.setItem(`ebexta_leads_${scanMode}`, JSON.stringify(partialLeads.current))
          localStorage.setItem('ebexta_scan_results', JSON.stringify(partialLeads.current))
        } catch { /* quota */ }
      }

      // Record persistent scan failure lifecycle state
      if (user) {
        try {
          await supabase.from('scans').upsert({
            id: scanIdRef.current,
            user_id: user.id,
            filters,
            status: partialLeads.current.length > 0 ? 'partially_completed' : 'failed',
            mode: scanMode,
          })
        } catch { /* ignore */ }
      }

      // A 402 from the proxy means credits ran out mid-scan — show the block
      // screen rather than a raw error the user can do nothing about.
      if (/out of credits|no credits|402|used all/i.test(raw)) {
        setBlocked({ allowed: false, reason: raw, code: 'NO_CREDITS' })
        return
      }

      // Translate Google's daily-quota 429 and timeout errors into clear, actionable messages.
      let friendly = raw
      if (/exceeded your current quota|billing details|check your plan/i.test(raw)) {
        friendly = "You've reached today's EBEXTA Engine limit. Please try again after the daily reset, or contact your admin to raise your limit."
      } else if (/signal timed out|timed out|abort/i.test(raw)) {
        friendly = "Live market intelligence took longer than expected to verify leads. Any leads discovered before the timeout have been preserved in your workspace."
      }
      setError(friendly)
    }
  }, [user, navigate])

  useEffect(() => {
    if (scanStarted.current) return
    scanStarted.current = true
    startScan()
  }, [startScan])

  // ── Error state ──
  // Out of credits / paused / suspended — nothing ran, nothing was charged.
  if (blocked) return <CreditBlockScreen check={blocked} />

  // Nothing matched. Say so plainly, confirm the refund, and give them the two
  // changes most likely to work.
  if (emptyResult) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-[440px] rounded-2xl premium-card px-7 py-9 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)' }}>
            <span className="material-symbols-outlined text-[26px]" style={{ color: 'var(--text-muted)' }}>search_off</span>
          </div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em] mb-2"
            style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
            No companies matched your exact criteria
          </h1>
          <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            Your scan credit has been returned. The usual cause is a filter combination
            that is narrower than it looks — headcount and location together rule out
            most of a market very quickly.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => navigate('/onboarding/filters')}
              className="premium-btn px-5 py-2.5 rounded-xl text-[13px]">Broaden filters</button>
            <button onClick={() => navigate('/onboarding/filters?focus=location')}
              className="ghost-btn px-5 py-2.5 rounded-xl text-[13px] font-semibold">Try a different location</button>
          </div>
        </div>
      </div>
    )
  }

  // ── THE SCAN SCREEN ──
  // Real stages, real elapsed time, honest options when it runs long.
  if (!error) {
    return (
      <ScanProgress
        ctx={scanCtx}
        statusMessage={lastMsg || 'Starting your scan…'}
        step={currentStep}
        leadsReady={leadsReady}
        finished={finished}
        finishedCount={finishedCount}
        elapsedOverride={finished ? finalElapsed : undefined}
        onShowPartial={showWhatIsReady}
      />
    )
  }

  // Timed out with nothing — say it plainly and confirm the refund.
  if (error === 'SCAN_TIMEOUT') {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg-base)' }}>
        <div className="w-full max-w-[440px] rounded-2xl premium-card px-7 py-9 text-center">
          <div className="w-14 h-14 rounded-full mx-auto mb-5 flex items-center justify-center"
            style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
            <span className="material-symbols-outlined text-[26px]"
              style={{ color: 'var(--warning)', fontVariationSettings: "'FILL' 1" }}>schedule</span>
          </div>
          <h1 className="text-[21px] font-bold tracking-[-0.02em] mb-2"
            style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
            Scan couldn't complete: no credit used
          </h1>
          <p className="text-[13.5px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            It ran past eight minutes without producing a single verified lead, so we stopped it and
            returned your credit. This usually means the filters are too narrow, or an upstream
            service is struggling.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button onClick={() => window.location.reload()}
              className="premium-btn px-5 py-2.5 rounded-xl text-[13px]">Try again</button>
            <button onClick={() => navigate('/onboarding/filters')}
              className="ghost-btn px-5 py-2.5 rounded-xl text-[13px] font-semibold">Adjust filters</button>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    const isCredit = /QUOTA_EXCEEDED|used all|credit limit|recharge/i.test(error)
    const isBlocked = /ACCOUNT_BLOCKED|account is blocked/i.test(error)
    const isTimeout = /signal timed out|timeout|aborted/i.test(error)
    const cleanMsg = error.replace(/^(QUOTA_EXCEEDED|ACCOUNT_BLOCKED):\s*/i, '')
    const title = isBlocked ? 'Account blocked' : isCredit ? 'Out of credits' : isTimeout ? 'Intelligence scan timed out' : 'Intelligence scan interrupted'
    const partialCount = partialLeads.current.length

    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--bg-base)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 18, padding: 24,
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: isTimeout ? 'rgba(234, 179, 8, 0.12)' : 'rgba(239,68,68,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: isTimeout ? '#D97706' : '#DC2626' }}>
            {isTimeout ? 'schedule' : 'error_outline'}
          </span>
        </div>
        {/* Explicit Scan Lifecycle Status Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 12px', borderRadius: 99,
          background: partialCount > 0 ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: partialCount > 0 ? '#B45309' : '#DC2626',
          fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: partialCount > 0 ? '#B45309' : '#DC2626' }} />
          <span>Status: {partialCount > 0 ? 'Partially Completed' : 'Failed'}</span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>{title}</h2>
        <p style={{ fontSize: 14, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 440, lineHeight: 1.5 }}>
          {cleanMsg}
        </p>

        {/* Credit ledger reassurance indicator */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 16px', borderRadius: 99,
          background: 'var(--accent-subtle)',
          border: '1px solid var(--border-subtle)',
          fontSize: 13, color: 'var(--text-secondary)',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent)' }}>verified_user</span>
          <span>{creditOutcome || '0 credits charged — your balance is untouched.'}</span>
        </div>

        {/* Partial results recovery banner */}
        {partialCount > 0 && (
          <div style={{
            padding: '12px 18px', borderRadius: 12,
            background: 'var(--accent-subtle)',
            border: '1px solid var(--border-subtle)',
            maxWidth: 440, width: '100%', textAlign: 'center',
          }}>
            <p style={{ fontSize: 13.5, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 4 }}>
              {partialCount} prospect{partialCount > 1 ? 's were' : ' was'} verified and preserved
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Data retrieved before the interruption is safely saved in your workspace.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginTop: 8 }}>
          {partialCount > 0 && (
            <button
              onClick={showWhatIsReady}
              style={{
                padding: '10px 22px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >
              View {partialCount} Saved Lead{partialCount > 1 ? 's' : ''}
            </button>
          )}
          {isCredit && (
            <button
              onClick={() => navigate('/dashboard/renew')}
              style={{
                padding: '10px 22px', borderRadius: 10, border: 'none',
                background: 'var(--accent)', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}
            >Request more credits</button>
          )}
          {!isBlocked && (
            <button
              onClick={() => {
                scanStarted.current = false
                setError(null); setPct(0); setCurrentStep(0); setLastMsg('')
                startScan()
              }}
              style={{
                padding: '10px 22px', borderRadius: 10,
                border: (partialCount > 0 || isCredit) ? '1px solid var(--border-subtle)' : 'none',
                background: (partialCount > 0 || isCredit) ? 'transparent' : 'var(--accent)',
                color: (partialCount > 0 || isCredit) ? 'var(--text-secondary)' : '#fff',
                fontWeight: 600, fontSize: 14, cursor: 'pointer',
              }}
            >Retry scan</button>
          )}
          <button
            onClick={() => navigate('/onboarding/filters')}
            style={{
              padding: '10px 22px', borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >Adjust filters</button>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              padding: '10px 22px', borderRadius: 10,
              border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >Go to Dashboard</button>
        </div>
      </div>
    )
  }

  // ── Loading state ──
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)', position: 'relative', overflow: 'hidden' }}>
      <BackgroundOrbs />

      {/* Subtle grid overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'linear-gradient(var(--accent-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--accent-subtle) 1px, transparent 1px)',
        backgroundSize: '48px 48px',
      }} />

      <div style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: '40px 24px',
        gap: 36,
      }}>

        {/* Logo mark */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: -8 }}
        >
          <EbextaLogo variant="horizontal" size={28} priority />
        </motion.div>

        {/* Headline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{ textAlign: 'center' }}
        >
          <h1 style={{
            fontSize: 'clamp(24px, 4vw, 34px)',
            fontWeight: 800,
            color: 'var(--text-primary)',
            letterSpacing: '-0.02em',
            marginBottom: 10,
            fontFamily: 'Geist, Inter, sans-serif',
          }}>
            Hunting your best leads
          </h1>
          <PhraseRotator step={currentStep} />
        </motion.div>

        {/* Ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <ScanRings pct={pct} />
        </motion.div>

        {/* Step list */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ width: '100%', maxWidth: 420 }}
        >
          <StepList currentStep={currentStep} pct={pct} />
        </motion.div>

        {/* Live status pill */}
        <AnimatePresence mode="wait">
          {lastMsg && (
            <motion.div
              key={lastMsg}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.3 }}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 16px',
                borderRadius: 99,
                background: 'var(--accent-subtle)',
                border: '1px solid var(--accent-subtle)',
              }}
            >
              <motion.div
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }}
                animate={{ opacity: [1, 0.3, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
              />
              <span style={{ fontSize: 12, color: '#5B3FA3', fontFamily: 'monospace' }}>
                {lastMsg}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footnote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.35 }}
          transition={{ delay: 1, duration: 0.8 }}
          style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', marginTop: -16 }}
        >
          Using live web search: first scan typically takes 30–90s
        </motion.p>

      </div>
    </div>
  )
}
