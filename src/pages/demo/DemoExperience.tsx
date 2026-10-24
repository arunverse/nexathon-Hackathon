/**
 * EBEXTA — PUBLIC DEMO (fully isolated).
 *
 * A single self-contained page that walks a prospect through the entire EBEXTA
 * flow using hardcoded sample data:
 *   intro → profile → filters → (animated) scan → results → lead detail.
 *
 * It deliberately imports NOTHING from the live app except visual primitives it
 * defines inline. No auth, no Supabase, no Gemini, no credits. Safe to open at
 * /demo without a session. The real dashboard/scan code is never touched.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { DEMO_LEADS, DEMO_PROFILE, DEMO_FILTERS, type DemoLead } from '../../lib/demoLeads'

type Step = 'intro' | 'profile' | 'filters' | 'scan' | 'results'
const geo = { fontFamily: 'Geist, Inter, sans-serif' }

const SCAN_STEPS = [
  { label: 'Cache check', icon: 'memory' },
  { label: 'Live discovery', icon: 'travel_explore' },
  { label: 'Signal filtration', icon: 'filter_alt' },
  { label: 'Intent matching', icon: 'join_inner' },
  { label: 'Compiling dossiers', icon: 'cloud_done' },
]

const SCAN_PHRASES = [
  'Retrieving sample market intelligence…',
  'Mapping funding, hiring and intent signals…',
  'Separating real buyers from noise…',
  'Matching against your exact profile…',
  'Packaging verified lead dossiers…',
]

// ── Persistent demo banner ────────────────────────────────────────────────────
function DemoBanner({ onExit }: { onExit: () => void }) {
  const navigate = useNavigate()
  return (
    <div className="fixed top-0 left-0 w-full z-[200] h-11 flex items-center justify-center gap-3 px-4"
      style={{ background: 'linear-gradient(90deg, var(--accent), #7C3AED)', color: '#fff' }}>
      <span className="material-symbols-outlined text-[18px]">science</span>
      <span className="text-[12px] font-bold tracking-[0.04em]">DEMO MODE — sample data, no signup, nothing is charged</span>
      <button onClick={() => navigate('/signup')}
        className="ml-2 text-[12px] font-bold px-3 py-1 rounded-md bg-white/20 hover:bg-white/30 transition-colors">
        Sign up to run it for real
      </button>
      <button onClick={onExit}
        className="text-[12px] font-semibold px-3 py-1 rounded-md hover:bg-white/15 transition-colors">
        Exit demo
      </button>
    </div>
  )
}

const scoreColor = (n: number) => (n >= 85 ? 'var(--accent)' : n >= 70 ? '#7C3AED' : '#f59e0b')
const impressionMeta: Record<string, { label: string; color: string; icon: string }> = {
  good: { label: 'Strong champion likely', color: 'var(--success)', icon: 'sentiment_very_satisfied' },
  none: { label: 'No clear owner yet', color: '#f59e0b', icon: 'sentiment_neutral' },
  bad: { label: 'Expect skepticism', color: '#DC2626', icon: 'sentiment_dissatisfied' },
}

export default function DemoExperience({ onClose }: { onClose?: () => void }) {
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('intro')
  const [company, setCompany] = useState(DEMO_PROFILE.companyName)
  const [mission, setMission] = useState(DEMO_PROFILE.mission)
  const [selected, setSelected] = useState<DemoLead | null>(null)
  const [showPaywall, setShowPaywall] = useState(false)
  const [tab, setTab] = useState<'intel' | 'contact' | 'dossier'>('intel')

  // scan animation state
  const [pct, setPct] = useState(0)
  const [scanStep, setScanStep] = useState(0)

  useEffect(() => {
    if (step !== 'scan') return
    setPct(0); setScanStep(0)
    const total = 3600
    const start = Date.now()
    const t = setInterval(() => {
      const elapsed = Date.now() - start
      const p = Math.min(100, Math.round((elapsed / total) * 100))
      setPct(p)
      setScanStep(Math.min(SCAN_STEPS.length - 1, Math.floor((p / 100) * SCAN_STEPS.length)))
      if (p >= 100) {
        clearInterval(t)
        setTimeout(() => setStep('results'), 500)
      }
    }, 60)
    return () => clearInterval(t)
  }, [step])

  const exit = () => (onClose ? onClose() : navigate('/home'))

  return (
    <div className="min-h-screen bg-background text-on-surface" style={{ paddingTop: 44 }}>
      <DemoBanner onExit={exit} />

      <div className="max-w-[1180px] mx-auto px-6 py-10">
        <AnimatePresence mode="wait">

          {/* ─────────────── INTRO ─────────────── */}
          {step === 'intro' && (
            <motion.div key="intro" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="text-center max-w-2xl mx-auto pt-10">
              <div className="inline-flex items-center gap-2 bg-surface-container-low border border-outline-variant px-4 py-2 rounded-full mb-6">
                <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>bolt</span>
                <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">INTERACTIVE PRODUCT TOUR</span>
              </div>
              <h1 className="text-[44px] font-bold leading-tight mb-4" style={geo}>See exactly how EBEXTA finds your next customer</h1>
              <p className="text-[17px] text-on-surface-variant mb-8">
                You'll go through the real flow — set your profile, choose filters, watch the scan, and open fully-detailed leads with signals, verified contacts and dossiers. It's built on sample data, so nothing is charged and no account is needed.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 text-left">
                {[
                  { icon: 'schedule', t: 'Saves hours', d: 'What takes a team days of research, EBEXTA compresses into one scan.' },
                  { icon: 'verified', t: 'Verified, not hallucinated', d: 'Every lead is backed by real signals and source-checked contacts.' },
                  { icon: 'target', t: 'Ranked by intent', d: 'Leads are scored on how likely they are to actually buy — now.' },
                ].map(f => (
                  <div key={f.t} className="p-5 rounded-xl border border-outline-variant bg-surface-container-low">
                    <span className="material-symbols-outlined text-primary text-[26px] mb-2 block">{f.icon}</span>
                    <p className="text-[15px] font-semibold mb-1" style={geo}>{f.t}</p>
                    <p className="text-[13px] text-on-surface-variant">{f.d}</p>
                  </div>
                ))}
              </div>
              <button onClick={() => setStep('profile')}
                className="bg-primary text-on-primary text-[16px] font-semibold px-9 h-12 rounded-lg hover:brightness-110 transition-all active:scale-95 inline-flex items-center gap-2" style={geo}>
                Start the tour <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </motion.div>
          )}

          {/* ─────────────── PROFILE ─────────────── */}
          {step === 'profile' && (
            <motion.div key="profile" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="max-w-xl mx-auto pt-6">
              <StepDots i={0} />
              <h2 className="text-[28px] font-bold mb-1" style={geo}>Tell EBEXTA about your company</h2>
              <p className="text-[14px] text-on-surface-variant mb-8">This is how EBEXTA understands who to match you with. (Pre-filled for the demo — edit if you like.)</p>
              <label className="block text-[12px] font-bold tracking-[0.04em] text-on-surface-variant uppercase mb-2">Company name</label>
              <input value={company} onChange={e => setCompany(e.target.value)}
                className="w-full px-4 py-3 rounded-lg text-[15px] outline-none bg-surface-container-lowest border border-outline-variant focus:ring-1 focus:ring-primary/30 mb-6" />
              <label className="block text-[12px] font-bold tracking-[0.04em] text-on-surface-variant uppercase mb-2">What you do</label>
              <textarea value={mission} onChange={e => setMission(e.target.value)} rows={3}
                className="w-full px-4 py-3 rounded-lg text-[15px] outline-none bg-surface-container-lowest border border-outline-variant focus:ring-1 focus:ring-primary/30 mb-8 resize-none" />
              <div className="flex justify-between">
                <button onClick={() => setStep('intro')} className="text-[14px] font-semibold text-on-surface-variant hover:text-on-surface px-4">Back</button>
                <button onClick={() => setStep('filters')} className="bg-primary text-on-primary text-[15px] font-semibold px-7 h-11 rounded-lg hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-2" style={geo}>
                  Continue <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ─────────────── FILTERS ─────────────── */}
          {step === 'filters' && (
            <motion.div key="filters" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }} className="max-w-xl mx-auto pt-6">
              <StepDots i={1} />
              <h2 className="text-[28px] font-bold mb-1" style={geo}>Refine who you're looking for</h2>
              <p className="text-[14px] text-on-surface-variant mb-8">EBEXTA uses these to target the right companies. (Sample values selected for the demo.)</p>
              <FilterRow label="Industry" value={DEMO_FILTERS.industry} />
              <FilterRow label="Company size" value={DEMO_FILTERS.sizeRange} />
              <FilterRow label="Geography" value={DEMO_FILTERS.country} />
              <div className="mb-8">
                <p className="text-[12px] font-bold tracking-[0.04em] text-on-surface-variant uppercase mb-2">Funding stage</p>
                <div className="flex flex-wrap gap-2">
                  {DEMO_FILTERS.stages.map(s => (
                    <span key={s} className="px-3 py-1.5 rounded-full text-[13px] font-semibold bg-primary/10 text-primary border border-primary/30">{s}</span>
                  ))}
                </div>
              </div>
              <div className="flex justify-between">
                <button onClick={() => setStep('profile')} className="text-[14px] font-semibold text-on-surface-variant hover:text-on-surface px-4">Back</button>
                <button onClick={() => setStep('scan')} className="bg-primary text-on-primary text-[15px] font-semibold px-7 h-11 rounded-lg hover:brightness-110 active:scale-95 transition-all inline-flex items-center gap-2" style={geo}>
                  Run the scan <span className="material-symbols-outlined text-[20px]">radar</span>
                </button>
              </div>
            </motion.div>
          )}

          {/* ─────────────── SCAN ─────────────── */}
          {step === 'scan' && (
            <motion.div key="scan" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center pt-8 gap-8">
              <h2 className="text-[26px] font-bold text-center" style={geo}>Hunting your best-fit companies…</h2>
              <div className="relative flex items-center justify-center" style={{ width: 180, height: 180 }}>
                <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90 absolute">
                  <circle cx="80" cy="80" r="64" fill="none" strokeWidth="6" stroke="var(--border-subtle)" />
                  <circle cx="80" cy="80" r="64" fill="none" strokeWidth="6" strokeLinecap="round"
                    stroke={scoreColor(pct)} strokeDasharray={2 * Math.PI * 64}
                    strokeDashoffset={(2 * Math.PI * 64) * (1 - pct / 100)}
                    style={{ transition: 'stroke-dashoffset 0.2s linear' }} />
                </svg>
                <span className="text-[40px] font-extrabold" style={{ ...geo, color: scoreColor(pct) }}>{pct}<span className="text-[16px]">%</span></span>
              </div>
              <p className="text-[14px] italic" style={{ color: '#5B3FA3' }}>{SCAN_PHRASES[scanStep]}</p>
              <div className="w-full max-w-md flex flex-col gap-2.5">
                {SCAN_STEPS.map((s, i) => {
                  const done = scanStep > i || pct === 100
                  const active = scanStep === i && pct < 100
                  return (
                    <div key={s.label} className="flex items-center gap-3 px-4 py-2.5 rounded-xl border"
                      style={{ borderColor: done || active ? 'var(--accent-subtle)' : 'var(--border-subtle)', background: done || active ? 'var(--accent-subtle)' : 'transparent' }}>
                      <span className="material-symbols-outlined text-[18px]" style={{ color: done ? '#7C3AED' : active ? 'var(--accent)' : 'var(--border-strong)', fontVariationSettings: done ? "'FILL' 1" : "'FILL' 0" }}>
                        {done ? 'check_circle' : s.icon}
                      </span>
                      <span className="text-[13px] font-semibold" style={{ color: done ? '#7C3AED' : active ? 'var(--text-primary)' : 'var(--text-muted)' }}>{s.label}</span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {/* ─────────────── RESULTS ─────────────── */}
          {step === 'results' && (
            <motion.div key="results" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}>
              <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
                <div>
                  <h2 className="text-[28px] font-bold" style={geo}>{DEMO_LEADS.length} verified matches for {company}</h2>
                  <p className="text-[14px] text-on-surface-variant">Ranked by fit and buying intent. Click any company to open its full dossier.</p>
                </div>
                <button onClick={() => setStep('filters')} className="text-[13px] font-semibold border border-outline-variant rounded-lg px-4 h-10 hover:bg-surface-container transition-colors inline-flex items-center gap-1.5">
                  <span className="material-symbols-outlined text-[18px]">tune</span> Adjust filters
                </button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {DEMO_LEADS.map((l, i) => (
                  <motion.button key={l.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                    onClick={() => { setSelected(l); setTab('intel') }}
                    className="text-left p-5 rounded-xl border border-outline-variant bg-surface-container-low hover:border-primary/40 hover:bg-surface-container transition-all group">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-11 h-11 rounded-xl flex items-center justify-center text-[18px] font-bold shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{l.logoInitial}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[16px] font-bold truncate" style={geo}>{l.company}</p>
                        <p className="text-[12px] text-on-surface-variant truncate">{l.industry} · {l.location}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[22px] font-extrabold leading-none" style={{ color: scoreColor(l.matchScore) }}>{l.matchScore}</p>
                        <p className="text-[9px] font-bold tracking-[0.06em] text-on-surface-variant">MATCH</p>
                      </div>
                    </div>
                    <p className="text-[13px] text-on-surface-variant line-clamp-2 mb-3">{l.summary}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--accent-subtle)', color: '#5B3FA3' }}>{l.intentLabel} · {l.intentScore}</span>
                      <span className="text-[12px] font-semibold text-primary inline-flex items-center gap-1 group-hover:gap-2 transition-all">Open dossier <span className="material-symbols-outlined text-[16px]">arrow_forward</span></span>
                    </div>
                  </motion.button>
                ))}
              </div>
              <div className="mt-10 p-6 rounded-xl border border-primary/30 bg-primary/5 text-center">
                <p className="text-[16px] font-semibold mb-1" style={geo}>This is a fraction of what EBEXTA surfaces live.</p>
                <p className="text-[13px] text-on-surface-variant mb-4">Create an account to run real scans against your market with verified, up-to-the-week signals.</p>
                <button onClick={() => navigate('/signup')} className="bg-primary text-on-primary text-[14px] font-bold px-7 h-11 rounded-lg hover:brightness-110 active:scale-95 transition-all">Get started free</button>
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>

      {/* ─────────────── LEAD DETAIL DRAWER ─────────────── */}
      <AnimatePresence>
        {selected && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] bg-black/40" onClick={() => setSelected(null)} />
            <motion.div initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'tween', duration: 0.3 }}
              className="fixed right-0 top-0 h-full w-full max-w-[560px] z-[220] bg-background border-l border-outline-variant overflow-y-auto">
              <div className="p-6">
                <div className="flex items-start gap-3 mb-5">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center text-[20px] font-bold shrink-0" style={{ background: 'var(--accent)', color: '#fff' }}>{selected.logoInitial}</div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-[20px] font-bold" style={geo}>{selected.company}</h3>
                    <p className="text-[13px] text-on-surface-variant">{selected.website} · {selected.size} · {selected.stage}</p>
                  </div>
                  <button onClick={() => setSelected(null)} className="p-1 text-on-surface-variant hover:text-on-surface">
                    <span className="material-symbols-outlined">close</span>
                  </button>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-2 gap-3 mb-5">
                  <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-low">
                    <p className="text-[11px] font-bold tracking-[0.05em] text-on-surface-variant mb-1">MATCH SCORE</p>
                    <p className="text-[26px] font-extrabold leading-none" style={{ color: scoreColor(selected.matchScore) }}>{selected.matchScore}<span className="text-[13px] text-on-surface-variant">/100</span></p>
                  </div>
                  <div className="p-4 rounded-xl border border-outline-variant bg-surface-container-low">
                    <p className="text-[11px] font-bold tracking-[0.05em] text-on-surface-variant mb-1">INTENT</p>
                    <p className="text-[26px] font-extrabold leading-none" style={{ color: scoreColor(selected.intentScore) }}>{selected.intentScore}<span className="text-[13px] text-on-surface-variant"> · {selected.intentLabel}</span></p>
                  </div>
                </div>

                {/* Who would be impressed */}
                <div className="p-4 rounded-xl border mb-5" style={{ borderColor: impressionMeta[selected.impressed.verdict].color + '55', background: impressionMeta[selected.impressed.verdict].color + '0f' }}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="material-symbols-outlined text-[20px]" style={{ color: impressionMeta[selected.impressed.verdict].color }}>{impressionMeta[selected.impressed.verdict].icon}</span>
                    <p className="text-[13px] font-bold" style={{ color: impressionMeta[selected.impressed.verdict].color }}>{impressionMeta[selected.impressed.verdict].label}</p>
                  </div>
                  <p className="text-[13px] text-on-surface"><strong>{selected.impressed.who}</strong> — {selected.impressed.note}</p>
                </div>

                {/* Tabs */}
                <div className="flex gap-1 mb-4 border-b border-outline-variant">
                  {([['intel', 'Signals & intel'], ['contact', 'Verified contact'], ['dossier', 'Dossier']] as const).map(([k, lbl]) => (
                    <button key={k} onClick={() => setTab(k)}
                      className={`px-4 py-2.5 text-[13px] font-semibold border-b-2 -mb-px transition-colors ${tab === k ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}>{lbl}</button>
                  ))}
                </div>

                {tab === 'intel' && (
                  <div>
                    <p className="text-[14px] text-on-surface mb-4">{selected.summary}</p>
                    <p className="text-[12px] font-bold tracking-[0.05em] text-on-surface-variant mb-2">RECENT SIGNALS</p>
                    <div className="space-y-2 mb-5">
                      {selected.signals.map((s, i) => (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-surface-container-low border border-outline-variant">
                          <span className="material-symbols-outlined text-primary text-[18px] mt-0.5">{s.icon}</span>
                          <div className="flex-1">
                            <p className="text-[13px] text-on-surface">{s.text}</p>
                            <p className="text-[11px] text-on-surface-variant">{s.date}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="p-4 rounded-xl bg-surface-container-low border border-outline-variant">
                      <p className="text-[12px] font-bold tracking-[0.05em] text-primary mb-1">{selected.deepIntel.heading.toUpperCase()}</p>
                      <ul className="space-y-1.5">
                        {selected.deepIntel.points.map((p, i) => (
                          <li key={i} className="flex items-start gap-2 text-[13px] text-on-surface">
                            <span className="material-symbols-outlined text-primary text-[16px] mt-0.5">arrow_right</span>{p}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="text-[13px] text-on-surface-variant mt-4"><strong className="text-on-surface">Why matched:</strong> {selected.rationale}</p>
                  </div>
                )}

                {tab === 'contact' && (
                  <div className="p-5 rounded-xl border border-outline-variant bg-surface-container-low">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="material-symbols-outlined text-[20px]" style={{ color: selected.contact.verified ? 'var(--success)' : '#f59e0b' }}>{selected.contact.verified ? 'verified' : 'pending'}</span>
                      <span className="text-[12px] font-bold" style={{ color: selected.contact.verified ? 'var(--success)' : '#f59e0b' }}>{selected.contact.verified ? 'SOURCE-VERIFIED CONTACT' : 'UNVERIFIED — VERIFY BEFORE OUTREACH'}</span>
                    </div>
                    <p className="text-[17px] font-bold" style={geo}>{selected.contact.name}</p>
                    <p className="text-[13px] text-on-surface-variant mb-4">{selected.contact.role}</p>
                    <Row icon="mail" value={selected.contact.email} />
                    <Row icon="link" value={selected.contact.linkedin} />
                    <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-[12px] text-on-surface-variant">
                      In the live product, EBEXTA re-verifies this contact against multiple sources at scan time and flags anything stale.
                    </div>
                  </div>
                )}

                {tab === 'dossier' && (
                  <div className="space-y-4">
                    {selected.dossier.map((d, i) => (
                      <div key={i} className="p-4 rounded-xl border border-outline-variant bg-surface-container-low">
                        <p className="text-[12px] font-bold tracking-[0.05em] text-primary mb-1">{d.heading.toUpperCase()}</p>
                        <p className="text-[13px] text-on-surface">{d.body}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Actions */}
                <div className="mt-6 flex gap-3">
                  <button onClick={() => setShowPaywall(true)}
                    className="flex-1 h-11 rounded-lg text-[14px] font-bold bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all inline-flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[19px]">description</span> Generate portfolio
                  </button>
                  <button onClick={() => setTab('dossier')}
                    className="flex-1 h-11 rounded-lg text-[14px] font-bold border border-outline-variant text-on-surface hover:bg-surface-container-high active:scale-95 transition-all inline-flex items-center justify-center gap-2">
                    <span className="material-symbols-outlined text-[19px]">menu_book</span> View dossier
                  </button>
                </div>
                <p className="text-[11px] text-on-surface-variant text-center mt-2">Portfolio generation is a paid feature — the dossier above is fully open in the demo.</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ─────────────── PORTFOLIO PAYWALL ─────────────── */}
      <AnimatePresence>
        {showPaywall && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[230] bg-black/50" onClick={() => setShowPaywall(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.94, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.94 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[240] w-[92%] max-w-md rounded-2xl border border-outline-variant bg-background p-7 text-center" style={{ boxShadow: 'var(--shadow-lg)' }}>
              <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--accent), #7C3AED)' }}>
                <span className="material-symbols-outlined text-white text-[28px]">workspace_premium</span>
              </div>
              <h3 className="text-[20px] font-bold mb-2" style={geo}>Portfolios are a paid feature</h3>
              <p className="text-[14px] text-on-surface-variant mb-6">
                EBEXTA generates a tailored, ready-to-send pitch matching your strengths to <strong>{selected?.company}</strong>'s exact needs. Subscribe to unlock unlimited portfolios and live scans.
              </p>
              <div className="flex flex-col gap-2.5">
                <button onClick={() => navigate('/signup')} className="h-11 rounded-lg text-[14px] font-bold bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all">Buy a subscription</button>
                <button onClick={() => setShowPaywall(false)} className="h-11 rounded-lg text-[14px] font-semibold text-on-surface-variant hover:bg-surface-container transition-colors">Keep exploring the demo</button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── small helpers ─────────────────────────────────────────────────────────────
function StepDots({ i }: { i: number }) {
  const labels = ['Profile', 'Filters', 'Scan']
  return (
    <div className="flex items-center gap-2 mb-6">
      {labels.map((l, n) => (
        <div key={l} className="flex items-center gap-2">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${n <= i ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'}`}>{n + 1}</div>
          <span className={`text-[12px] font-semibold ${n <= i ? 'text-on-surface' : 'text-on-surface-variant'}`}>{l}</span>
          {n < labels.length - 1 && <span className="w-6 h-px bg-outline-variant mx-1" />}
        </div>
      ))}
    </div>
  )
}

function FilterRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-5">
      <p className="text-[12px] font-bold tracking-[0.04em] text-on-surface-variant uppercase mb-2">{label}</p>
      <div className="w-full px-4 py-3 rounded-lg text-[15px] bg-surface-container-lowest border border-outline-variant flex items-center justify-between">
        <span>{value}</span>
        <span className="material-symbols-outlined text-on-surface-variant text-[20px]">expand_more</span>
      </div>
    </div>
  )
}

function Row({ icon, value }: { icon: string; value: string }) {
  return (
    <div className="flex items-center gap-2 py-1.5">
      <span className="material-symbols-outlined text-on-surface-variant text-[18px]">{icon}</span>
      <span className="text-[13px] text-on-surface">{value}</span>
    </div>
  )
}
