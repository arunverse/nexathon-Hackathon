import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { EbextaLogo } from '../components/common/EbextaLogo'
import { fetchBalance } from '../lib/credits'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

interface Feature { icon: string; title: string; desc: string }
interface Chapter { kicker: string; title: string; blurb: string; features: Feature[] }

// The 18 things EBEXTA surfaces on every lead, grouped into guided chapters.
const CHAPTERS: Chapter[] = [
  {
    kicker: 'The match',
    title: 'Why this company is right for you',
    blurb: 'Every lead opens with the reasoning: not just a name on a list.',
    features: [
      { icon: 'target', title: 'Why this is your exact match', desc: 'A plain-English case for the fit, tailored to what you do.' },
      { icon: 'flag', title: 'Strategic Needs (Right Now)', desc: 'The specific gaps you can fill for them this quarter.' },
      { icon: 'trending_up', title: 'Future Scope', desc: 'Where they’re heading and how you fit their roadmap.' },
      { icon: 'groups', title: 'Who Else Would Be Interested', desc: 'Other stakeholders inside who would champion you.' },
    ],
  },
  {
    kicker: 'The company, decoded',
    title: 'The full picture, verified',
    blurb: 'Financials, size and momentum, pulled together and checked.',
    features: [
      { icon: 'payments', title: 'Financial & Funding', desc: 'Rounds, investors and financial health.' },
      { icon: 'monitoring', title: 'Revenue', desc: 'Estimated revenue and growth trajectory.' },
      { icon: 'badge', title: 'Employees', desc: 'Team size and hiring momentum.' },
      { icon: 'stairs', title: 'Stage', desc: 'Funding and company stage at a glance.' },
      { icon: 'location_on', title: 'Location', desc: 'HQ and the markets that matter.' },
      { icon: 'rocket_launch', title: 'Major Projects', desc: 'Active initiatives and launches worth knowing.' },
    ],
  },
  {
    kicker: 'Live intelligence',
    title: 'Fresh signals, not stale lists',
    blurb: 'Up-to-the-week context so you reach out at the right moment.',
    features: [
      { icon: 'radar', title: 'Recent Signals', desc: 'This week’s funding, hiring and expansion moves.' },
      { icon: 'lightbulb', title: 'Additional Intel', desc: 'Extra context that sharpens your pitch.' },
    ],
  },
  {
    kicker: 'The right people',
    title: 'Reach a real human',
    blurb: 'Decision-makers and companies, verified with multi-source evidence.',
    features: [
      { icon: 'contacts', title: 'Key Contacts', desc: 'The decision-makers who actually matter.' },
      { icon: 'verified_user', title: 'Request Verified Contact', desc: 'Human-verified details, delivered within 24h.' },
    ],
  },
  {
    kicker: 'Trust & proof',
    title: 'Nothing hallucinated',
    blurb: 'Every claim is scored, checked and backed by evidence.',
    features: [
      { icon: 'workspace_premium', title: 'Trust Score', desc: 'A transparent confidence score for the lead.' },
      { icon: 'shield', title: 'Data Integrity', desc: 'Every field checked with zero invented data.' },
      { icon: 'filter_alt', title: 'Filtration Details', desc: 'Exactly how this lead passed our filters.' },
      { icon: 'link', title: 'Sources and Origin', desc: 'The evidence links behind every claim.' },
    ],
  },
]

const TOTAL = CHAPTERS.length + 1 // + congrats intro

export default function Welcome() {
  const navigate = useNavigate()
  const [i, setI] = useState(0) // 0 = congrats, 1..N = chapters
  const [balance, setBalance] = useState({ scanCredits: 40, verifiedCredits: 10 })

  useEffect(() => {
    let alive = true
    async function load() {
      try {
        const snap = await fetchBalance()
        if (!alive) return
        if (snap?.credits) {
          const s = (snap.credits.scan_credits ?? 40) - (snap.credits.scan_credits_used ?? 0)
          const v = (snap.credits.verified_credits ?? 10) - (snap.credits.verified_credits_used ?? 0)
          setBalance({
            scanCredits: Math.max(0, s),
            verifiedCredits: Math.max(0, v),
          })
        }
      } catch {
        /* fallback to default 40 / 10 */
      }
    }
    load()
    return () => { alive = false }
  }, [])

  const go = (n: number) => setI(Math.max(0, Math.min(TOTAL - 1, n)))
  const finish = () => {
    // Mark Welcome as seen so the gate lets them into onboarding (no loop).
    try { localStorage.setItem('ebexta_welcome_seen', '1') } catch { /* ignore */ }
    navigate('/onboarding')
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* faint grid */}
      <div className="fixed inset-0 pointer-events-none" style={{
        backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
        backgroundSize: '56px 56px', opacity: 0.35,
        maskImage: 'radial-gradient(circle at 50% 20%, black, transparent 70%)',
        WebkitMaskImage: 'radial-gradient(circle at 50% 20%, black, transparent 70%)',
      }} />

      {/* top bar */}
      <div className="relative h-16 flex items-center px-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1080px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <EbextaLogo variant="horizontal" size={28} priority />
          </div>
          <button onClick={finish} className="text-[13px] font-semibold" style={{ color: 'var(--text-muted)' }}>Skip intro →</button>
        </div>
      </div>

      {/* progress dots */}
      <div className="relative flex items-center justify-center gap-1.5 pt-6">
        {Array.from({ length: TOTAL }).map((_, n) => (
          <div key={n} className="h-1.5 rounded-full transition-all" style={{ width: n === i ? 26 : 8, background: n <= i ? 'var(--accent)' : 'var(--border-strong)' }} />
        ))}
      </div>

      {/* content */}
      <div className="relative flex-1 flex items-center justify-center px-6 py-8" style={{ perspective: 1200 }}>
        <AnimatePresence mode="wait">
          {i === 0 ? (
            <motion.div key="congrats" initial={{ opacity: 0, y: 20, rotateX: 6 }} animate={{ opacity: 1, y: 0, rotateX: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.6, ease: EASE }}
              className="text-center max-w-[640px]" style={{ transformStyle: 'preserve-3d' }}>
              <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.15, duration: 0.6, ease: EASE }}
                className="w-20 h-20 rounded-3xl mx-auto mb-6 flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, var(--navy), var(--steel))', boxShadow: 'var(--shadow-lg)' }}>
                <span className="material-symbols-outlined text-[40px]" style={{ color: '#F5F3EF', fontVariationSettings: "'FILL' 1" }}>celebration</span>
              </motion.div>
              <p className="text-[12px] font-bold tracking-[0.14em] uppercase mb-3" style={{ color: 'var(--accent-interactive)' }}>Welcome to EBEXTA</p>
              <h1 className="font-bold leading-[1.08] tracking-[-0.03em] mb-4" style={{ ...geist, fontSize: 'clamp(32px, 5vw, 52px)' }}>
                Congratulations: your plan is active.
              </h1>
              <p className="text-[17px] mb-6" style={{ color: 'var(--text-secondary)' }}>
                You now have the full intelligence engine. Before you scan, here's exactly what EBEXTA hands you on <strong style={{ color: 'var(--text-primary)' }}>every single lead</strong>.
              </p>

              {/* Active starter credits highlight */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.5, ease: EASE }}
                className="inline-flex flex-wrap items-center justify-center gap-2.5 px-4 py-2.5 mb-8 rounded-xl"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: 'var(--shadow-sm)',
                }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(45, 106, 79, 0.1)', color: '#2D6A4F' }}
                >
                  <span className="material-symbols-outlined text-[17px]">bolt</span>
                  <span className="text-[13px]">{balance.scanCredits} AI Scan Credits Ready</span>
                </div>
                <div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg font-semibold"
                  style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563EB' }}
                >
                  <span className="material-symbols-outlined text-[17px]">verified_user</span>
                  <span className="text-[13px]">{balance.verifiedCredits} Verified Contacts Available</span>
                </div>
              </motion.div>

              <div>
                <button onClick={() => go(1)} className="premium-btn h-12 px-8 rounded-lg text-[15px] inline-flex items-center gap-2">
                  Show me <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
                </button>
              </div>
            </motion.div>
          ) : (
            <ChapterView key={i} chapter={CHAPTERS[i - 1]} index={i} total={CHAPTERS.length} />
          )}
        </AnimatePresence>
      </div>

      {/* nav buttons */}
      <div className="relative pb-10 px-6">
        <div className="max-w-[1080px] mx-auto flex items-center justify-between">
          <button onClick={() => go(i - 1)} disabled={i === 0}
            className="ghost-btn h-11 px-5 rounded-lg text-[14px] font-semibold disabled:opacity-0">
            ← Back
          </button>
          {i < TOTAL - 1 ? (
            <button onClick={() => go(i + 1)} className="premium-btn h-11 px-7 rounded-lg text-[14px] inline-flex items-center gap-2">
              Next <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
            </button>
          ) : (
            <button onClick={finish} className="premium-btn h-11 px-7 rounded-lg text-[14px] inline-flex items-center gap-2">
              Set up my profile <span className="material-symbols-outlined text-[19px]">arrow_forward</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ChapterView({ chapter, index, total }: { chapter: Chapter; index: number; total: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 60, rotateY: -8 }}
      animate={{ opacity: 1, x: 0, rotateY: 0 }}
      exit={{ opacity: 0, x: -60, rotateY: 8 }}
      transition={{ duration: 0.5, ease: EASE }}
      className="w-full max-w-[880px]"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div className="text-center mb-8">
        <p className="text-[11px] font-bold tracking-[0.12em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
          {chapter.kicker} · {index}/{total}
        </p>
        <h2 className="font-bold tracking-[-0.02em]" style={{ ...geist, fontSize: 'clamp(26px, 3.5vw, 36px)' }}>{chapter.title}</h2>
        <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>{chapter.blurb}</p>
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {chapter.features.map((f, n) => (
          <motion.div key={f.title}
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + n * 0.07, duration: 0.5, ease: EASE }}
            whileHover={{ y: -3, rotateX: 2, rotateY: -2 }}
            className="rounded-2xl p-5 flex gap-4"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)', transformStyle: 'preserve-3d' }}>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent-subtle)' }}>
              <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--accent-interactive)' }}>{f.icon}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[15px] font-bold mb-0.5 break-words" style={geist}>{f.title}</p>
              <p className="text-[13px] break-words" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}
