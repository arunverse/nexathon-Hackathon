import { useState, useRef, useEffect } from 'react'
import { Shield, Bookmark, ChevronDown, CheckCircle2, User, Zap, Users } from 'lucide-react'
import { useNavigate, Navigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion'
import { useAuth } from '../contexts/AuthContext'
import { PLANS, monthlyPrice, inr, YEARLY_DISCOUNT, type Plan } from '../lib/plans'
import DemoExperience from './demo/DemoExperience'
import { RequestDemoModal } from '../components/RequestDemoModal'
import { EbextaLogo } from '../components/common/EbextaLogo'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }
const mono = { fontFamily: '"Geist Mono", monospace' }
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

// Scroll-reveal preset (fade + rise 24px, once).
const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.6, ease: EASE },
}

// ── Count-up on first view ────────────────────────────────────────────────────
function CountUp({ to, duration = 1300, suffix = '' }: { to: number; duration?: number; suffix?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-80px' })
  const reduce = useReducedMotion()
  const [val, setVal] = useState(0)
  useEffect(() => {
    if (!inView) return
    if (reduce) { setVal(to); return }
    let raf = 0
    const start = performance.now()
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration)
      setVal(Math.round(to * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [inView, to, duration, reduce])
  return <span ref={ref} style={mono}>{val.toLocaleString('en-IN')}{suffix}</span>
}

// ── Hero Lead Card Mockup Carousel ───────────────────────────────────────────────

const CAROUSEL_LEADS = [
  { name: 'Global Logistics', initials: 'G', industry: 'Supply Chain & Freight', intent: 94, score: 98, conf: 92, 
    color: '#2D6A4F', bg: 'rgba(45,106,79,0.25)', border: 'rgba(45,106,79,0.3)', text: '#1F4D3A' },
  { name: 'Nexus IT Solutions', initials: 'N', industry: 'Enterprise Software', intent: 88, score: 91, conf: 89, 
    color: '#1D2636', bg: 'rgba(29,38,54,0.15)', border: 'rgba(29,38,54,0.3)', text: '#1D2636' },
  { name: 'Apex Health Tech', initials: 'A', industry: 'Healthcare Providers', intent: 97, score: 99, conf: 95, 
    color: '#8C5B00', bg: 'rgba(140,91,0,0.15)', border: 'rgba(140,91,0,0.3)', text: '#8C5B00' },
  { name: 'CloudScale Systems', initials: 'C', industry: 'Cloud Infrastructure', intent: 82, score: 85, conf: 80, 
    color: '#5C6B78', bg: 'rgba(147,165,180,0.15)', border: 'rgba(147,165,180,0.3)', text: '#1D2636' },
  { name: 'Quantum FinServe', initials: 'Q', industry: 'Financial Services', intent: 91, score: 94, conf: 90, 
    color: '#6F1D1B', bg: 'rgba(111,29,27,0.15)', border: 'rgba(111,29,27,0.3)', text: '#4A1311' },
]

function HeroVisual() {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % CAROUSEL_LEADS.length)
    }, 4500) // Cycle every 4.5 seconds
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative w-full h-[400px] md:h-[500px] flex items-center justify-center select-none mt-10 md:mt-0 perspective-1000">
      
      {/* Ambient background glow */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--accent-subtle)_0%,transparent_70%)] opacity-80" />

      {CAROUSEL_LEADS.map((lead, i) => {
        // Calculate relative offset
        let offset = i - activeIndex
        if (offset < 0) offset += CAROUSEL_LEADS.length
        
        const isVisible = offset < 3

        // State styles based on offset position
        // offset 0 is front. offset 1 is middle (beside left). offset 2 is back (further left).
        const x = offset === 0 ? 0 : offset === 1 ? -60 : -120
        const y = offset === 0 ? 0 : offset === 1 ? -15 : -30
        const scale = offset === 0 ? 1 : offset === 1 ? 0.9 : 0.8
        const opacity = offset === 0 ? 1 : offset === 1 ? 0.7 : 0.3
        const blur = offset === 0 ? 0 : offset === 1 ? 4 : 8
        const rotateZ = offset === 0 ? 0 : offset === 1 ? -4 : -8
        const zIndex = 30 - offset

        return (
          <motion.div 
            key={lead.name}
            initial={false}
            animate={{
              x,
              y,
              scale,
              opacity: isVisible ? opacity : 0,
              filter: `blur(${isVisible ? blur : 12}px)`,
              rotateZ,
              zIndex
            }}
            transition={{ 
              type: 'spring', 
              stiffness: 100, 
              damping: 18,
              mass: 1 
            }}
            className="absolute z-10 w-full max-w-[420px] rounded-2xl overflow-hidden shadow-2xl pointer-events-none"
            style={{
              background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))',
              border: '1px solid var(--border-subtle)',
              boxShadow: offset === 0 ? 'var(--shadow-lg)' : 'none',
              pointerEvents: offset === 0 ? 'auto' : 'none'
            }}
          >
            {/* Left accent strip */}
            <div className="absolute left-0 top-0 bottom-0 w-[3px]" style={{ background: `linear-gradient(180deg, ${lead.color}, ${lead.color}60)` }} />

            <div className="p-6 relative">
              {/* Header row */}
              <div className="flex items-start justify-between gap-3 mb-5">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center font-bold shrink-0"
                       style={{ background: lead.bg, border: `1px solid ${lead.border}`, color: 'var(--text-primary)', fontSize: 16 }}>
                    {lead.initials}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <h3 className="font-bold text-[16px] leading-tight" style={{ color: 'var(--text-primary)' }}>{lead.name}</h3>
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider flex items-center gap-1"
                            style={{ background: `${lead.color}20`, border: `1px solid ${lead.color}45`, color: lead.color }}>
                        <CheckCircle2 size={10} strokeWidth={3} /> VERIFIED
                      </span>
                    </div>
                    <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{lead.industry}</p>
                    
                    <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium"
                         style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                      <User size={10} />
                      Decision Maker Found
                    </div>
                  </div>
                </div>

                {/* Right side intent score */}
                <div className="flex flex-col items-center">
                  <div className="relative w-12 h-12 flex items-center justify-center rounded-full border-[3px]"
                       style={{ borderColor: lead.color, color: 'var(--text-primary)' }}>
                    <span className="font-bold font-mono text-[14px]">{lead.intent}</span>
                  </div>
                  <span className="text-[8px] font-bold uppercase tracking-widest mt-1" style={{ color: 'var(--text-muted)' }}>INTENT</span>
                </div>
              </div>

              {/* Scores */}
              <div className="space-y-3 mb-5">
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Match Score</span>
                    <span className="font-mono text-[var(--text-secondary)]">{lead.score}%</span>
                  </div>
                  <div className="h-[4px] rounded-full" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full" style={{ width: `${lead.score}%`, background: `linear-gradient(90deg, ${lead.color}60, ${lead.color})` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[10px] font-bold uppercase mb-1" style={{ color: 'var(--text-muted)' }}>
                    <span>Confidence Score</span>
                    <span className="font-mono text-[var(--text-secondary)]">{lead.conf}%</span>
                  </div>
                  <div className="h-[4px] rounded-full" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full" style={{ width: `${lead.conf}%`, background: 'linear-gradient(90deg, var(--border-strong), var(--accent-interactive))' }} />
                  </div>
                </div>
              </div>

              {/* Signal Badges */}
              <div className="flex flex-wrap gap-2 mb-5">
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
                     style={{ background: 'rgba(56,189,248,0.12)', border: '1px solid rgba(56,189,248,0.25)', color: 'var(--accent-interactive)' }}>
                  <Zap size={11} />
                  Recent Funding
                </div>
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-bold"
                     style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)', color: 'var(--warning)' }}>
                  <Users size={11} />
                  Hiring Surge
                </div>
              </div>

              {/* "Why am I seeing this" */}
              <div className="flex items-center gap-1.5 text-[10px] font-bold mb-4" style={{ color: 'var(--text-muted)' }}>
                <span className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--border-subtle)', color: 'var(--text-primary)' }}>?</span>
                Why am I seeing this lead?
                <ChevronDown size={12} className="ml-auto" />
              </div>

              {/* Bottom row */}
              <div className="flex justify-between items-center pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-bold"
                     style={{ background: `${lead.color}20`, border: `1px solid ${lead.color}40`, color: lead.color }}>
                  <Shield size={12} />
                  Verified
                  <span className="opacity-60 ml-0.5">{lead.conf}%</span>
                </div>
                
                <div className="flex gap-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>Series B</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>1.2k emp</span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      })}

      {/* Floating secondary indicator (bookmark icon stays static over the carousel) */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: 'spring', stiffness: 200, damping: 20 }}
        className="absolute md:-right-4 right-0 -bottom-6 z-40"
      >
        <div className="w-14 h-14 rounded-full shadow-xl flex items-center justify-center border"
             style={{ background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))', borderColor: 'var(--border-subtle)', color: 'var(--warning)' }}>
          <Bookmark size={20} strokeWidth={2.5} style={{ fontVariationSettings: "'FILL' 1" }} />
        </div>
      </motion.div>
    </div>
  )
}

// ── FAQ accordion item ─────────────────────────────────────────────────────────
function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-center justify-between gap-4 py-5 text-left">
        <span className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>{q}</span>
        <span className="material-symbols-outlined text-[20px] shrink-0 transition-transform" style={{ color: 'var(--text-muted)', transform: open ? 'rotate(45deg)' : 'none' }}>add</span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="overflow-hidden">
            <p className="text-[14px] pb-5 pr-8" style={{ color: 'var(--text-secondary)' }}>{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })

export default function LandingPage({ forceShow = false }: { forceShow?: boolean }) {
  const navigate = useNavigate()
  const { session, loading } = useAuth()
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('monthly')
  const [scrolled, setScrolled] = useState(false)
  const [showDemo, setShowDemo] = useState(false)
  const [showDemoModal, setShowDemoModal] = useState(false)

  useEffect(() => {
    // Clear hash on reload and ensure always starting at the top of the homepage
    window.scrollTo(0, 0)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }
  // "/" sends signed-in users into the app (PlanGate routes them to /choose-plan
  // if unplanned). "/home" (forceShow) always renders for preview.
  if (session && !forceShow) return <Navigate to="/dashboard" replace />

  const goPlan = (plan?: string) => navigate(plan ? `/signup?plan=${plan}` : '/signup')

  // JSON-LD Structured Data for LandingPage + Organization + WebSite + WebPage
  const structuredData = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://www.ebexta.com/#organization',
        name: 'EBEXTA',
        url: 'https://www.ebexta.com/',
        logo: 'https://www.ebexta.com/logo-mark.svg',
        description:
          'EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.'
      },
      {
        '@type': 'WebSite',
        '@id': 'https://www.ebexta.com/#website',
        url: 'https://www.ebexta.com/',
        name: 'EBEXTA',
        description:
          'EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.',
        publisher: {
          '@id': 'https://www.ebexta.com/#organization'
        }
      },
      {
        '@type': 'WebPage',
        '@id': 'https://www.ebexta.com/#webpage',
        url: 'https://www.ebexta.com/',
        name: 'B2B Intelligence for Discovering Business Opportunities | EBEXTA',
        description:
          'EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.',
        isPartOf: {
          '@id': 'https://www.ebexta.com/#website'
        },
        about: {
          '@id': 'https://www.ebexta.com/#organization'
        },
        publisher: {
          '@id': 'https://www.ebexta.com/#organization'
        }
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://www.ebexta.com/#faq',
        mainEntity: [
          {
            '@type': 'Question',
            name: 'What is EBEXTA?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.'
            }
          },
          {
            '@type': 'Question',
            name: 'What does EBEXTA do?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EBEXTA connects business opportunity discovery with real-time business signals, commercial intent, deep company context, multi-source verification, decision-maker identification, proactive engagement, and high-trust business networking.'
            }
          },
          {
            '@type': 'Question',
            name: 'Who is EBEXTA for?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EBEXTA is built for B2B companies, founders, enterprise sales teams, agency leaders, service providers, and business seekers looking to discover high-intent counterparties, verify decision-makers, and initiate genuine commercial conversations.'
            }
          },
          {
            '@type': 'Question',
            name: 'What is B2B Business Intelligence?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'B2B Business Intelligence is the process of collecting, analyzing, and transforming public and commercial data—such as hiring surges, funding events, technology adoption, and organizational expansion—into actionable business insights that explain why and when a company is ready to buy or partner.'
            }
          },
          {
            '@type': 'Question',
            name: 'What are business signals and intent?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Business signals are real-time market indicators (e.g., leadership hiring, capital raises, regulatory filings, product expansions) that reveal a company\'s strategic priorities. Business intent measures how actively an organization is seeking solutions or allocating budget within a specific domain.'
            }
          },
          {
            '@type': 'Question',
            name: 'How does EBEXTA help discover business opportunities?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Instead of static contact directories, EBEXTA continuously scans market activity to surface companies experiencing specific commercial triggers. Every opportunity is presented with contextual evidence, timing relevance, and verified stakeholders.'
            }
          },
          {
            '@type': 'Question',
            name: 'How does EBEXTA verify companies and decision-makers?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EBEXTA validates companies through multi-source cross-referencing against official registries (MCA, GSTIN, corporate filings) and active digital presence. Decision-makers are verified to ensure current roles and valid, reachable communication channels.'
            }
          },
          {
            '@type': 'Question',
            name: 'What does Discover → Understand → Verify → Engage mean?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'It is EBEXTA\'s 4-step intelligence pipeline: Discover identifies companies with relevant opportunities; Understand analyzes signals, intent, and needs; Verify validates company evidence and decision-makers; and Engage enables direct connection with verified businesses and professionals in the EBEXTA network.'
            }
          },
          {
            '@type': 'Question',
            name: 'How does EBEXTA connect businesses?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'EBEXTA operates a bilateral business network where verified seekers and providers connect directly. Counterparties are matched based on mutual commercial alignment, verified identity, and active business needs rather than cold unsolicited outreach.'
            }
          },
          {
            '@type': 'Question',
            name: 'How is EBEXTA different from a traditional lead database?',
            acceptedAnswer: {
              '@type': 'Answer',
              text: 'Traditional lead databases sell static lists of contacts without context or timing, leading to cold outreach based on assumptions. EBEXTA begins with live opportunity discovery, unpacks verifiable business signals and intent, confirms key decision-makers, and facilitates direct high-trust bilateral connections.'
            }
          }
        ]
      }
    ]
  }

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* ── JSON-LD Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* ══════════ NAV ══════════ */}
      <nav className="fixed top-0 left-0 w-full z-50 h-16 flex items-center transition-all"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg-base) 80%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        }}>
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between">
          <button onClick={() => { window.scrollTo({ top: 0, behavior: 'smooth' }); if (window.location.hash) window.history.replaceState(null, '', window.location.pathname) }} className="flex items-center gap-2 cursor-pointer">
            <EbextaLogo variant="horizontal" size={28} priority />
          </button>
          <div className="hidden md:flex items-center gap-8">
            {[['How it works', 'how'], ['Pricing', 'pricing'], ['FAQ', 'faq']].map(([l, id]) => (
              <button key={l} onClick={() => scrollTo(id)} className="text-[13px] font-medium transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}
                onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>{l}</button>
            ))}
            <button onClick={() => navigate('/about')} className="text-[13px] font-medium transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>About</button>
            <button onClick={() => navigate('/careers')} className="text-[13px] font-medium transition-colors cursor-pointer" style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')} onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}>Careers</button>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowDemoModal(true)} className="hidden sm:inline-flex items-center gap-1.5 text-[13px] font-semibold px-2 cursor-pointer" style={{ color: 'var(--accent-interactive)' }}>
              <span className="material-symbols-outlined text-[17px]">calendar_today</span> Request Demo
            </button>
            <button onClick={() => navigate('/login')} className="ghost-btn text-[13px] font-semibold px-4 h-9 rounded-lg cursor-pointer">Sign in</button>
            <button onClick={() => goPlan()} className="premium-btn text-[13px] px-5 h-9 rounded-lg cursor-pointer">Get Started</button>
          </div>
        </div>
      </nav>

      <div id="top" />

      {/* ══════════ 1. HERO (Tuned vertical height for downside peek) ══════════ */}
      <header className="relative pt-20 md:pt-28 pb-8 md:pb-12">
        {/* faint grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '56px 56px', opacity: 0.4,
          maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)',
        }} />
        <div className="max-w-[1200px] mx-auto px-6 grid md:grid-cols-2 gap-8 md:gap-10 items-center relative">
          <div>
            <motion.p initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }}
              className="text-[11px] font-bold tracking-[0.14em] uppercase mb-4" style={{ color: 'var(--accent-interactive)' }}>
              B2B Bilateral Intelligence
            </motion.p>
            <motion.h1 initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
              className="font-bold leading-[1.05] tracking-[-0.03em]" style={{ ...geist, fontSize: 'clamp(34px, 4.8vw, 56px)' }}>
              B2B Intelligence for <span style={{ color: 'var(--accent-interactive)' }}>Discovering Business Opportunities</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
              className="text-[15px] md:text-[16.5px] mt-4 max-w-xl leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.
            </motion.p>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
              className="flex flex-wrap items-center gap-3 mt-7">
              <button onClick={() => goPlan()} className="premium-btn text-[15px] px-7 h-12 rounded-lg flex items-center gap-2 cursor-pointer">
                Get Started <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>
              <button onClick={() => setShowDemoModal(true)} className="ghost-btn text-[15px] font-semibold px-7 h-12 rounded-lg flex items-center gap-2 cursor-pointer">
                <span className="material-symbols-outlined text-[20px]">calendar_today</span> Request Demo
              </button>
              <button onClick={() => scrollTo('how')} className="text-[15px] font-semibold px-3 h-12 rounded-lg cursor-pointer" style={{ color: 'var(--text-secondary)' }}>See how it works</button>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.34 }}
              className="flex flex-wrap gap-x-6 gap-y-2 mt-6">
              {['Human-verified contacts', 'Working links guaranteed', 'Multi-source verification', 'DPDP-aware data handling'].map(t => (
                <span key={t} className="flex items-center gap-1.5 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                  <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--success)' }}>check_circle</span>{t}
                </span>
              ))}
            </motion.div>
          </div>
          <motion.div initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.8, delay: 0.2, ease: EASE }}>
            <HeroVisual />
          </motion.div>
        </div>
      </header>

      {/* ══════════ 2. FOUR-STEP MODEL: Discover → Understand → Verify → Engage ══════════ */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        {/* Subtle decorative background grid */}
        <div className="absolute inset-0 pointer-events-none opacity-40" style={{
          backgroundImage: 'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
          backgroundSize: '48px 48px'
        }} />

        <div className="max-w-[1220px] mx-auto px-6 relative z-10">
          <motion.div {...reveal} className="text-center mb-14">
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.12em] uppercase mb-4"
                 style={{ background: 'var(--navy)', color: '#FFFFFF', boxShadow: '0 2px 8px rgba(15, 23, 42, 0.15)' }}>
              <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
              The EBEXTA Intelligence Model
            </div>
            
            <h2 className="text-[28px] sm:text-[34px] md:text-[38px] font-bold tracking-tight leading-tight" style={{ ...geist, color: 'var(--text-primary)' }}>
              <span>Discover</span>
              <span className="mx-2 md:mx-3 text-[var(--accent-interactive)] font-normal">→</span>
              <span>Understand</span>
              <span className="mx-2 md:mx-3 text-[var(--accent-interactive)] font-normal">→</span>
              <span>Verify</span>
              <span className="mx-2 md:mx-3 text-[var(--accent-interactive)] font-normal">→</span>
              <span>Engage</span>
            </h2>
            
            <p className="text-[15px] md:text-[16px] mt-3.5 max-w-2xl mx-auto leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              A systematic pipeline engineered to transform scattered public signals into verified, high-trust B2B connections.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                step: '01',
                name: 'Discover',
                accentColor: '#2563EB',
                iconBg: '#EFF6FF',
                iconBorder: 'rgba(37, 99, 235, 0.2)',
                icon: 'radar',
                title: 'Market Signal Discovery',
                desc: 'Uncover genuine business opportunities and active counterparty needs across industries before they get saturated.',
                chips: ['Real-time scanning', 'Opposite-side match']
              },
              {
                step: '02',
                name: 'Understand',
                accentColor: '#4F46E5',
                iconBg: '#EEF2FF',
                iconBorder: 'rgba(79, 70, 229, 0.2)',
                icon: 'insights',
                title: 'Intent & Signal Context',
                desc: 'Analyze business intent, recent funding milestones, hiring surges, and strategic triggers behind each account.',
                chips: ['Intent scoring', 'Strategic drivers']
              },
              {
                step: '03',
                name: 'Verify',
                accentColor: '#059669',
                iconBg: '#ECFDF5',
                iconBorder: 'rgba(5, 150, 105, 0.2)',
                icon: 'verified_user',
                title: 'Evidence & Contact Shield',
                desc: 'Validate authentic decision-makers, direct contact channels, and live proof with our Hallucination Shield.',
                chips: ['Human-verified', '100% evidence backed']
              },
              {
                step: '04',
                name: 'Engage',
                accentColor: '#D97706',
                iconBg: '#FFFBEB',
                iconBorder: 'rgba(217, 119, 6, 0.2)',
                icon: 'hub',
                title: 'Network & Direct Connect',
                desc: 'Directly reach prospects and connect with business leaders, decision-makers, and peers inside the EBEXTA network.',
                chips: ['Deal-ready intros', 'Direct network access']
              },
            ].map((m, idx) => (
              <motion.div
                key={m.name}
                {...reveal}
                transition={{ ...reveal.transition, delay: idx * 0.08 }}
                className="rounded-2xl p-6 relative flex flex-col justify-between transition-all duration-300 group hover:-translate-y-1.5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  boxShadow: '0 4px 20px -2px rgba(15, 23, 42, 0.06), 0 2px 6px -1px rgba(15, 23, 42, 0.03)'
                }}
              >
                {/* Subtle top indicator on hover */}
                <div className="absolute top-0 left-6 right-6 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-full"
                     style={{ background: m.accentColor }} />

                <div>
                  {/* Step header row with dark step badge */}
                  <div className="flex items-center justify-between gap-2 mb-5">
                    <div className="flex items-center gap-2">
                      <span className="w-8 h-8 rounded-lg flex items-center justify-center text-[13px] font-bold shadow-sm"
                            style={{ ...mono, background: 'var(--navy)', color: '#FFFFFF' }}>
                        {m.step}
                      </span>
                      <span className="text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                        {m.name}
                      </span>
                    </div>

                    <div className="w-9 h-9 rounded-xl flex items-center justify-center transition-transform duration-200 group-hover:scale-110"
                         style={{ background: m.iconBg, border: `1px solid ${m.iconBorder}`, color: m.accentColor }}>
                      <span className="material-symbols-outlined text-[20px]">{m.icon}</span>
                    </div>
                  </div>

                  <h3 className="text-[17px] font-bold mb-2.5" style={{ ...geist, color: 'var(--text-primary)' }}>
                    {m.title}
                  </h3>

                  <p className="text-[13.5px] leading-relaxed mb-5" style={{ color: 'var(--text-secondary)' }}>
                    {m.desc}
                  </p>

                  {/* Dark-shaded feature chips */}
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {m.chips.map(chip => (
                      <span key={chip} className="text-[11px] font-medium px-2.5 py-1 rounded-md"
                            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Footer progress step */}
                <div className="mt-5 pt-3.5 flex items-center justify-between text-[11.5px] font-medium"
                     style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                  <span style={mono}>Stage 0{idx + 1} / 04</span>
                  {idx < 3 ? (
                    <span className="flex items-center gap-1 font-semibold transition-transform group-hover:translate-x-1" style={{ color: m.accentColor }}>
                      Forward <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 font-semibold" style={{ color: 'var(--success)' }}>
                      <span className="material-symbols-outlined text-[15px]">verified</span> Conversion
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 3. SOCIAL PROOF ══════════ */}
      <section className="py-10" style={{ borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col items-center gap-6">
          <p className="text-[12px] font-semibold tracking-[0.08em] uppercase" style={{ color: 'var(--text-muted)' }}>Built for founders, agencies and B2B teams across India</p>
          <div className="flex flex-wrap items-center justify-center gap-8 opacity-50">
            {['hexagon', 'circle', 'square', 'change_history', 'pentagon'].map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[26px]" style={{ color: 'var(--text-muted)' }}>{s}</span>
                <span className="w-16 h-2.5 rounded-full" style={{ background: 'var(--border-strong)' }} />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 3. HOW IT WORKS ══════════ */}
      <section id="how" className="py-24" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-14">
            <h2 className="text-[34px] font-bold" style={geist}>How it works</h2>
            <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>From cold market to a verified, deal-ready lead in three steps.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <motion.div {...reveal} className="premium-card rounded-2xl p-7">
              <StepNum n={1} />
              <h3 className="text-[18px] font-bold mt-4 mb-2" style={geist}>Tell us who you are</h3>
              <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Pick your side (<strong style={{ color: 'var(--text-primary)' }}>Seeker</strong> or <strong style={{ color: 'var(--text-primary)' }}>Provider</strong>) and set your filters once.</p>
            </motion.div>
            {/* Step 2 with funnel */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} className="premium-card rounded-2xl p-7">
              <StepNum n={2} />
              <h3 className="text-[18px] font-bold mt-4 mb-2" style={geist}>The engine hunts</h3>
              <p className="text-[14px] mb-4" style={{ color: 'var(--text-secondary)' }}>Live discovery, Triple Filtration and the Hallucination Shield.</p>
              <div className="space-y-2">
                {[
                  { label: 'Scanned', to: 1402, w: '100%' },
                  { label: 'Qualified', to: 38, w: '46%' },
                  { label: 'Verified', to: 10, w: '20%' },
                ].map((r, i) => (
                  <div key={r.label} className="flex items-center gap-3">
                    <div className="flex-1 h-7 rounded-md overflow-hidden relative" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                      <div className="h-full rounded-md" style={{ width: r.w, background: i === 2 ? 'var(--accent)' : 'var(--accent-interactive)', opacity: i === 2 ? 1 : 0.5 }} />
                      <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold" style={{ color: i === 2 ? '#fff' : 'var(--text-primary)' }}>{r.label}</span>
                    </div>
                    <span className="text-[13px] font-bold w-14 text-right" style={{ color: 'var(--text-primary)' }}><CountUp to={r.to} /></span>
                  </div>
                ))}
              </div>
            </motion.div>
            {/* Step 3 */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.2 }} className="premium-card rounded-2xl p-7">
              <StepNum n={3} />
              <h3 className="text-[18px] font-bold mt-4 mb-2" style={geist}>Deal-ready leads</h3>
              <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>Scores, evidence links, verified contacts and one-click outreach, ready to send.</p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ 5. SCREENSHOTS ══════════ */}
      <ScreenshotShowcase />

      {/* ══════════ 6. FEATURE GRID ══════════ */}
      <section className="py-24" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-14">
            <h2 className="text-[34px] font-bold" style={geist}>Everything, verified</h2>
            <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>Six capabilities that separate a match from a mailing list.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: 'swap_horiz', title: 'Bilateral Matching', desc: 'Seekers see providers, providers see seekers. Never competitors.' },
              { icon: 'shield', title: 'Hallucination Shield', desc: 'Every claim validated, every link checked live.', critical: true },
              { icon: 'verified', title: 'Verified by EBEXTA', desc: 'Multi-source verified companies and validated decision-makers.' },
              { icon: 'insights', title: 'Intent Scoring', desc: 'Funding, hiring and expansion signals, itemized transparently.' },
              { icon: 'dashboard', title: 'Declared Intent Board', desc: 'Private needs matched at Trust Score 100%.' },
              { icon: 'auto_awesome', title: 'Neural Outreach', desc: 'Personalized emails and rich PDF proposals with graphs.' },
            ].map((f, i) => (
              <motion.div key={f.title} {...reveal} transition={{ ...reveal.transition, delay: (i % 3) * 0.08 }}
                className="premium-card rounded-2xl p-6 group" style={{ transition: 'transform 0.2s ease' }}
                onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-3px)')}
                onMouseLeave={e => (e.currentTarget.style.transform = 'none')}>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: f.critical ? 'var(--critical-bg)' : 'var(--accent-subtle)' }}>
                  <span className="material-symbols-outlined" style={{ color: f.critical ? 'var(--critical)' : 'var(--accent-interactive)' }}>{f.icon}</span>
                </div>
                <h3 className="text-[16px] font-bold mb-1.5" style={geist}>{f.title}</h3>
                <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 6.5 INSIDE EVERY LEAD (18 layers) ══════════ */}
      <section className="py-24">
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>Not a list, a dossier</p>
            <h2 className="text-[34px] font-bold" style={geist}>18 layers of intelligence on every lead</h2>
            <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>Each match opens into a full, verified brief: here's what's inside.</p>
          </motion.div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {[
              { icon: 'target', t: 'Why it’s your exact match' },
              { icon: 'flag', t: 'Strategic needs now' },
              { icon: 'trending_up', t: 'Future scope' },
              { icon: 'groups', t: 'Who else would be interested' },
              { icon: 'payments', t: 'Financial & funding' },
              { icon: 'monitoring', t: 'Revenue' },
              { icon: 'badge', t: 'Employees' },
              { icon: 'stairs', t: 'Stage' },
              { icon: 'location_on', t: 'Location' },
              { icon: 'rocket_launch', t: 'Major projects' },
              { icon: 'radar', t: 'Recent signals' },
              { icon: 'lightbulb', t: 'Additional intel' },
              { icon: 'contacts', t: 'Key contacts' },
              { icon: 'verified_user', t: 'Request verified contact' },
              { icon: 'workspace_premium', t: 'Trust score' },
              { icon: 'shield', t: 'Data integrity' },
              { icon: 'filter_alt', t: 'Filtration details' },
              { icon: 'link', t: 'Sources and discovery origin' },
            ].map((item, i) => (
              <motion.div key={item.t}
                initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.4, delay: (i % 4) * 0.05, ease: EASE }}
                className="flex items-center gap-2.5 rounded-xl px-3.5 py-3"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[19px] shrink-0" style={{ color: 'var(--accent-interactive)' }}>{item.icon}</span>
                <span className="text-[12.5px] font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.t}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 7. INTELLIGENCE PILLARS (Clean EBEXTA Theme) ══════════ */}
      <section className="py-20 relative overflow-hidden" style={{ background: 'var(--bg-surface)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div {...reveal} className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight" style={{ ...geist, color: 'var(--text-primary)' }}>
              Built for Precision. Built for Trust.
            </h2>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1: Requirement-driven intelligence */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.05 }}
              className="premium-card rounded-2xl p-7 flex flex-col justify-between transition-all hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                     style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--border-subtle)' }}>
                  <span className="material-symbols-outlined text-[22px]">tune</span>
                </div>
                <h3 className="text-[17.5px] font-bold mb-2.5 leading-snug" style={{ ...geist, color: 'var(--text-primary)' }}>
                  Requirement-driven intelligence
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Your service, product, ideal lead profile, signals, decision-makers, qualification criteria, and target locations shape every search.
                </p>
              </div>
            </motion.div>

            {/* Card 2: Sector-specific intelligence */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}
              className="premium-card rounded-2xl p-7 flex flex-col justify-between transition-all hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                     style={{ background: 'rgba(99, 102, 241, 0.1)', color: '#4F46E5', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
                  <span className="material-symbols-outlined text-[22px]">domain</span>
                </div>
                <h3 className="text-[17.5px] font-bold mb-2.5 leading-snug" style={{ ...geist, color: 'var(--text-primary)' }}>
                  Sector-specific intelligence
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Specialized algorithms evaluate requirements, signals, triggers, gaps, and anti-signals for each sector.
                </p>
              </div>
            </motion.div>

            {/* Card 3: Evidence-backed opportunities */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.15 }}
              className="premium-card rounded-2xl p-7 flex flex-col justify-between transition-all hover:-translate-y-1">
              <div>
                <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-5"
                     style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                  <span className="material-symbols-outlined text-[22px]">verified_user</span>
                </div>
                <h3 className="text-[17.5px] font-bold mb-2.5 leading-snug" style={{ ...geist, color: 'var(--text-primary)' }}>
                  Evidence-backed opportunities
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Multiple signals, evidence, relevance, and internal intelligence are evaluated before opportunities reach you.
                </p>
              </div>
            </motion.div>

            {/* Card 4: 24h Fresh intelligence */}
            <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.2 }}
              className="premium-card rounded-2xl p-7 flex flex-col justify-between transition-all hover:-translate-y-1">
              <div>
                <div className="flex items-center justify-between mb-5">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center"
                       style={{ background: 'rgba(245, 158, 11, 0.1)', color: 'var(--warning)', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                    <span className="material-symbols-outlined text-[22px]">bolt</span>
                  </div>
                  <span className="text-[14px] font-mono font-bold px-2.5 py-1 rounded-lg text-emerald-700 dark:text-emerald-300 bg-emerald-500/15 border border-emerald-500/30">
                    24h
                  </span>
                </div>
                <h3 className="text-[17.5px] font-bold mb-2.5 leading-snug" style={{ ...geist, color: 'var(--text-primary)' }}>
                  Fresh intelligence
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Prioritizing recent business signals and actionable opportunities.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ 8. PRICING ══════════ */}
      <section id="pricing" className="py-24">
        <div className="max-w-[1200px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-8">
            <h2 className="text-[34px] font-bold" style={geist}>Pricing</h2>
            <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>Transparent pricing for verified B2B intelligence and bilateral discovery. Cancel anytime.</p>
          </motion.div>
          {/* toggle */}
          <div className="flex items-center justify-center gap-3 mb-12">
            <span className="text-[13px] font-medium" style={{ color: billing === 'monthly' ? 'var(--text-primary)' : 'var(--text-muted)' }}>Monthly</span>
            <button onClick={() => setBilling(b => (b === 'monthly' ? 'yearly' : 'monthly'))}
              className="relative w-12 h-6 rounded-full transition-colors" style={{ background: billing === 'yearly' ? 'var(--accent)' : 'var(--border-strong)' }}>
              <span className="absolute top-0.5 w-5 h-5 rounded-full bg-white transition-all" style={{ left: billing === 'yearly' ? 26 : 2, boxShadow: 'var(--shadow-sm)' }} />
            </button>
            <span className="text-[13px] font-medium" style={{ color: billing === 'yearly' ? 'var(--text-primary)' : 'var(--text-muted)' }}>Yearly <span style={{ color: 'var(--success)' }}>−15%</span></span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1280px] mx-auto justify-center items-stretch">
            {PLANS.map((p, i) => <PricingCard key={p.key} plan={p} billing={billing} delay={i * 0.06} onPick={() => (p.custom ? scrollTo('faq') : goPlan(p.key))} />)}
          </div>
        </div>
      </section>

      {/* ══════════ 9. TESTIMONIALS ══════════ */}
      <section className="py-24" style={{ background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-4">
            <h2 className="text-[34px] font-bold" style={geist}>Early members</h2>
            <p className="text-[12px] mt-2" style={{ color: 'var(--text-muted)' }}>Illustrative examples from our early-access cohort.</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-5 mt-8">
            {[
              { quote: 'The first tool that showed me buyers instead of a list of competitors.', who: 'Early member, FinTech founder' },
              { quote: 'Every contact was real. No bounces, no dead links; that alone paid for it.', who: 'Early member, B2B agency lead' },
              { quote: 'The intent scoring told me who to call first. We closed in week two.', who: 'Early member, SaaS sales head' },
            ].map((t, i) => (
              <motion.div key={i} {...reveal} transition={{ ...reveal.transition, delay: i * 0.08 }} className="premium-card rounded-2xl p-6">
                <span className="material-symbols-outlined text-[26px]" style={{ color: 'var(--accent-interactive)' }}>format_quote</span>
                <p className="text-[15px] mt-2 mb-5" style={{ color: 'var(--text-primary)' }}>{t.quote}</p>
                <p className="text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>{t.who}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ 10. FAQ (Answer Engine Optimized) ══════════ */}
      <section id="faq" className="py-24">
        <div className="max-w-[800px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-12">
            <h2 className="text-[32px] md:text-[36px] font-bold" style={geist}>Questions, answered</h2>
            <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>Direct, factual information about EBEXTA's platform and capabilities.</p>
          </motion.div>
          <motion.div {...reveal} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            {[
              {
                q: 'What is EBEXTA?',
                a: 'EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.'
              },
              {
                q: 'What does EBEXTA do?',
                a: 'EBEXTA connects business opportunity discovery with real-time business signals, commercial intent, deep company context, multi-source verification, decision-maker identification, proactive engagement, and high-trust business networking.'
              },
              {
                q: 'Who is EBEXTA for?',
                a: 'EBEXTA is built for B2B companies, founders, enterprise sales teams, agency leaders, service providers, and business seekers looking to discover high-intent counterparties, verify decision-makers, and initiate genuine commercial conversations.'
              },
              {
                q: 'What is B2B Business Intelligence?',
                a: 'B2B Business Intelligence is the process of collecting, analyzing, and transforming public and commercial data—such as hiring surges, funding events, technology adoption, and organizational expansion—into actionable business insights that explain why and when a company is ready to buy or partner.'
              },
              {
                q: 'What are business signals and intent?',
                a: 'Business signals are real-time market indicators (e.g., leadership hiring, capital raises, regulatory filings, product expansions) that reveal a company\'s strategic priorities. Business intent measures how actively an organization is seeking solutions or allocating budget within a specific domain.'
              },
              {
                q: 'How does EBEXTA help discover business opportunities?',
                a: 'Instead of static contact directories, EBEXTA continuously scans market activity to surface companies experiencing specific commercial triggers. Every opportunity is presented with contextual evidence, timing relevance, and verified stakeholders.'
              },
              {
                q: 'How does EBEXTA verify companies and decision-makers?',
                a: 'EBEXTA validates companies through multi-source cross-referencing against official registries (MCA, GSTIN, corporate filings) and active digital presence. Decision-makers are verified to ensure current roles and valid, reachable communication channels.'
              },
              {
                q: 'What does Discover → Understand → Verify → Engage mean?',
                a: 'It is EBEXTA\'s 4-step intelligence pipeline: Discover identifies companies with relevant opportunities; Understand analyzes signals, intent, and needs; Verify validates company evidence and decision-makers; and Engage enables direct connection with verified businesses and professionals in the EBEXTA network.'
              },
              {
                q: 'How does EBEXTA connect businesses?',
                a: 'EBEXTA operates a bilateral business network where verified seekers and providers connect directly. Counterparties are matched based on mutual commercial alignment, verified identity, and active business needs rather than cold unsolicited outreach.'
              },
              {
                q: 'How is EBEXTA different from a traditional lead database?',
                a: 'Traditional lead databases sell static lists of contacts without context or timing, leading to cold outreach based on assumptions. EBEXTA begins with live opportunity discovery, unpacks verifiable business signals and intent, confirms key decision-makers, and facilitates direct high-trust bilateral connections.'
              }
            ].map(f => <FaqItem key={f.q} {...f} />)}
          </motion.div>
        </div>
      </section>

      {/* ══════════ 11. FINAL CTA (navy band) ══════════ */}
      <section className="py-20" style={{ background: 'var(--navy)' }}>
        <div className="max-w-[900px] mx-auto px-6 text-center">
          <motion.h2 {...reveal} className="text-[30px] md:text-[38px] font-bold mb-6" style={{ ...geist, color: '#F5F3EF' }}>
            Your exact match is out there. EBEXTA finds it verified.
          </motion.h2>
          <motion.button {...reveal} transition={{ ...reveal.transition, delay: 0.1 }} onClick={() => goPlan()}
            className="text-[15px] font-semibold px-8 h-12 rounded-lg inline-flex items-center gap-2"
            style={{ background: '#F5F3EF', color: 'var(--navy)' }}>
            Get Started <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
          </motion.button>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="py-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => scrollTo('top')}>
            <EbextaLogo variant="horizontal" size={26} />
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            {[['How it works', 'how'], ['Pricing', 'pricing'], ['FAQ', 'faq']].map(([l, id]) => (
              <button key={l} onClick={() => scrollTo(id)} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>{l}</button>
            ))}
            <Link to="/about" className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--text-primary)' }}>About</Link>
            <Link to="/careers" className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Careers</Link>
            {[['Intelligence Guide', '/b2b-business-intelligence'], ['Business Signals', '/business-signals'], ['Intent Intelligence', '/b2b-intent-intelligence'], ['Terms', '/terms'], ['Privacy', '/privacy'], ['Refund Policy', '/refund'], ['DPDP', '/dpdp']].map(([l, path]) => (
              <Link key={l} to={path} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>{l}</Link>
            ))}
          </div>
          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>© 2026 EBEXTA. All rights reserved.</p>
        </div>
      </footer>

      {/* Interactive demo — opens inline as a full-screen overlay */}
      <AnimatePresence>
        {showDemo && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[400] overflow-y-auto" style={{ background: 'var(--bg-base)' }}>
            <DemoExperience onClose={() => setShowDemo(false)} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Request Demo Modal Registration Form */}
      <RequestDemoModal isOpen={showDemoModal} onClose={() => setShowDemoModal(false)} />
    </div>
  )
}


function StepNum({ n }: { n: number }) {
  return (
    <div className="w-9 h-9 rounded-lg flex items-center justify-center text-[15px] font-bold"
      style={{ ...mono, background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{n}</div>
  )
}

function PricingCard({ plan, billing, delay, onPick }: { plan: Plan; billing: 'monthly' | 'yearly'; delay: number; onPick: () => void }) {
  const price = monthlyPrice(plan, billing)
  const origPrice = plan.originalPriceMonthly ? (billing === 'yearly' ? Math.round(plan.originalPriceMonthly * (1 - YEARLY_DISCOUNT)) : plan.originalPriceMonthly) : null
  const popular = plan.popular

  return (
    <motion.div {...reveal} transition={{ ...reveal.transition, delay }}
      className={`rounded-2xl p-7 lg:p-8 flex flex-col relative transition-all ${popular ? 'z-10 md:scale-[1.02]' : ''}`}
      style={popular
        ? { background: 'var(--navy)', color: '#F5F3EF', border: '2px solid var(--accent-interactive)', boxShadow: 'var(--shadow-lg)' }
        : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
      {popular && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-extrabold tracking-[0.06em] px-2.5 py-0.5 rounded-full shadow-sm text-white bg-[var(--accent-interactive)] flex items-center gap-1 whitespace-nowrap">
          <span className="material-symbols-outlined text-[11px] leading-none">rocket_launch</span>
          <span>LAUNCHING OFFER · MOST POPULAR</span>
        </div>
      )}
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ color: popular ? 'var(--steel)' : 'var(--text-muted)' }}>{plan.name}</p>
        {origPrice && price != null && (
          <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full" style={{ background: popular ? 'rgba(255,255,255,0.12)' : 'var(--accent-subtle)', color: popular ? '#F5F3EF' : 'var(--accent-interactive)' }}>
            Save {inr(origPrice - price)}/mo
          </span>
        )}
      </div>

      <div className="mb-4 min-h-[48px] flex flex-col justify-end">
        {price == null ? (
          <span className="text-[34px] font-bold" style={geist}>Custom</span>
        ) : (
          <div>
            {origPrice && (
              <div className="flex items-center gap-2 mb-1">
                <span className="text-[14px] font-medium line-through opacity-60" style={{ color: popular ? 'var(--steel)' : 'var(--text-muted)' }}>{inr(origPrice)}</span>
              </div>
            )}
            <div className="flex items-baseline gap-1.5">
              <span className="text-[38px] font-extrabold leading-none" style={geist}>{inr(price)}</span>
              <span className="text-[13px] font-medium" style={{ color: popular ? 'var(--steel)' : 'var(--text-muted)' }}>/mo{billing === 'yearly' ? ', billed yearly' : ''}</span>
            </div>
          </div>
        )}
      </div>

      <p className="text-[13px] mb-6 leading-relaxed" style={{ color: popular ? 'rgba(245,243,239,0.85)' : 'var(--text-secondary)' }}>{plan.tagline}</p>
      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: popular ? 'rgba(245,243,239,0.95)' : 'var(--text-primary)' }}>
            <span className="material-symbols-outlined text-[17px] shrink-0 mt-0.5" style={{ color: popular ? 'var(--steel)' : 'var(--accent-interactive)' }}>check</span>{f}
          </li>
        ))}
      </ul>
      <button onClick={onPick}
        className="w-full h-12 rounded-xl text-[14px] font-bold transition-all active:scale-95 shadow-sm"
        style={popular
          ? { background: '#F5F3EF', color: 'var(--navy)' }
          : plan.custom
            ? { background: 'transparent', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }
            : { background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
        {plan.custom ? 'Contact sales' : `Choose ${plan.name}`}
      </button>
    </motion.div>
  )
}

// ── "Watch EBEXTA work" — a lead card that assembles itself on loop ────────────
const SHOWCASE_LEADS = [
  { company: 'Porter', industry: 'Logistics Tech', location: 'Bangalore, India',
    person: 'Vikas Choudhary', role: 'Chief Executive Officer', intent: 92, match: 88, conf: 94,
    evidence: ['Hiring 40+ operations engineers', 'Raised ₹5,000 Cr Series F', 'Expanding to 3 new cities'] },
  { company: 'Ultrahuman', industry: 'HealthTech & Wearables', location: 'Bengaluru, India',
    person: 'Mohit Kumar', role: 'CEO & Co-Founder', intent: 86, match: 90, conf: 83,
    evidence: ['New product launch: Ring Air', 'Series C funding, Dec 2025', 'Hiring supply-chain leads'] },
  { company: 'Chargebee', industry: 'B2B SaaS', location: 'Chennai, India',
    person: 'Krish Subramanian', role: 'CEO & Co-Founder', intent: 78, match: 84, conf: 88,
    evidence: ['Crossed $100M ARR milestone', 'Hired VP Sales from Salesforce', 'Entering new verticals'] },
]

function ScreenshotShowcase() {
  const reduce = useReducedMotion()
  const [idx, setIdx] = useState(0)
  const [step, setStep] = useState(reduce ? 6 : 0)
  const lead = SHOWCASE_LEADS[idx]

  useEffect(() => {
    if (reduce) { setStep(6); return }
    setStep(0)
    let s = 0
    let hold: ReturnType<typeof setTimeout>
    const iv = setInterval(() => {
      s += 1
      if (s <= 6) setStep(s)
      else { clearInterval(iv); hold = setTimeout(() => setIdx(p => (p + 1) % SHOWCASE_LEADS.length), 1800) }
    }, 650)
    return () => { clearInterval(iv); clearTimeout(hold) }
  }, [idx, reduce])

  const on = (n: number) => step >= n
  const rise = (n: number) => ({
    opacity: on(n) ? 1 : 0,
    transform: on(n) ? 'translateY(0)' : 'translateY(8px)',
    transition: 'opacity .45s ease, transform .45s cubic-bezier(0.16,1,0.3,1)',
  })
  const R = 26, CIRC = 2 * Math.PI * R
  const shown = on(2) ? lead.intent : 0
  const dashOff = CIRC - (shown / 100) * CIRC

  return (
    <section className="py-24">
      <div className="max-w-[1100px] mx-auto px-6">
        <motion.div {...reveal} className="text-center mb-3">
          <h2 className="text-[34px] font-bold" style={geist}>Watch EBEXTA work</h2>
          <p className="text-[15px] mt-2" style={{ color: 'var(--text-secondary)' }}>
            Every lead assembles itself: scored, verified, and backed by real evidence.
          </p>
        </motion.div>

        <motion.div {...reveal} className="max-w-[520px] mx-auto mt-10">
          <div className="rounded-2xl p-6 relative overflow-hidden min-h-[360px]"
            style={{ background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>

            {!on(1) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[12px]" style={{ ...mono, color: 'var(--text-muted)' }}>scanning the market…</span>
              </div>
            )}

            {/* Identity + intent ring */}
            <div className="flex items-start justify-between gap-3" style={rise(1)}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>{lead.company}</h3>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-[0.06em]"
                    style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.4)', color: 'var(--success)',
                             opacity: on(4) ? 1 : 0, transform: on(4) ? 'scale(1)' : 'scale(0.6)',
                             transition: 'opacity .4s ease, transform .5s cubic-bezier(0.34,1.56,0.64,1)' }}>
                    <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                    Verified by EBEXTA
                  </span>
                </div>
                <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{lead.industry} · {lead.location}</p>
                <span className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-[10px] font-medium"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--text-primary)', ...rise(6) }}>
                  <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  {lead.person} · {lead.role}
                </span>
              </div>
              <div className="shrink-0 flex flex-col items-center" style={{ opacity: on(2) ? 1 : 0, transition: 'opacity .4s ease' }}>
                <svg width="64" height="64" viewBox="0 0 64 64">
                  <circle cx="32" cy="32" r={R} fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
                  <circle cx="32" cy="32" r={R} fill="none" stroke="var(--success)" strokeWidth="4" strokeLinecap="round"
                    strokeDasharray={CIRC} strokeDashoffset={dashOff}
                    style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)', transform: 'rotate(-90deg)', transformOrigin: 'center' }} />
                  <text x="32" y="37" textAnchor="middle" fontSize="17" fontWeight="700" fill="var(--text-primary)" style={mono}>{Math.round(shown)}</text>
                </svg>
                <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--success)' }}>Intent</span>
              </div>
            </div>

            {/* Score bars */}
            <div className="mt-4 space-y-2.5" style={rise(3)}>
              {([['Match', lead.match], ['Confidence', lead.conf]] as const).map(([lbl, val]) => (
                <div key={lbl}>
                  <div className="flex justify-between text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>
                    <span>{lbl}</span><span style={mono} className="text-[var(--text-secondary)]">{val}%</span>
                  </div>
                  <div className="h-[3px] rounded-full mt-1" style={{ background: 'var(--border-subtle)' }}>
                    <div className="h-full rounded-full" style={{ width: on(3) ? `${val}%` : '0%', background: 'var(--text-primary)', transition: 'width 1s cubic-bezier(0.16,1,0.3,1)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Evidence */}
            <div className="mt-4 pt-3" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-[9px] font-bold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--text-muted)', ...rise(5) }}>Evidence found</p>
              {lead.evidence.map((e, i) => (
                <div key={e} className="flex items-start gap-2 mb-1.5"
                  style={{ opacity: on(5) ? 1 : 0, transform: on(5) ? 'translateX(0)' : 'translateX(-6px)',
                           transition: `opacity .4s ease ${i * 0.15}s, transform .4s ease ${i * 0.15}s` }}>
                  <span className="material-symbols-outlined text-[13px] shrink-0" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>link</span>
                  <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{e}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-center gap-1.5 mt-5">
            {SHOWCASE_LEADS.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full transition-all"
                style={{ width: i === idx ? 18 : 6, background: i === idx ? '#2D6A4F' : 'var(--border-strong)' }} />
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  )
}
