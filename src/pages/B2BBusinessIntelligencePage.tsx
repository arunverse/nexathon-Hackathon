import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Compass,
  FileSearch,
  Users2,
  TrendingUp,
  ShieldCheck,
  Building2,
  Briefcase,
  Layers,
  ArrowRight,
  ChevronDown,
  Target,
  Activity,
  Network,
  Cpu,
  CheckCircle2,
  XCircle
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'
import b2bContent from '../data/b2bIntelligenceContent.json'

const EASE = [0.16, 1, 0.3, 1] as const
const geist = { fontFamily: 'Geist, Inter, sans-serif' }

// ── FAQ Item Component ─────────────────────────────────────────────────────────
function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)

  return (
    <div
      className="rounded-xl border transition-all mb-3 overflow-hidden"
      style={{
        background: open ? 'var(--bg-elevated)' : 'var(--bg-surface)',
        borderColor: open ? 'var(--accent-interactive)' : 'var(--border-subtle)',
        boxShadow: open ? 'var(--shadow-sm)' : 'none'
      }}
    >
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full p-5 sm:p-6 flex items-start justify-between gap-4 text-left group cursor-pointer"
        aria-expanded={open}
      >
        <h3
          className="text-[15px] sm:text-[17px] font-semibold transition-colors group-hover:text-[var(--accent-interactive)]"
          style={{ color: 'var(--text-primary)', ...geist }}
        >
          {question}
        </h3>
        <span
          className="p-1.5 rounded-lg border transition-transform duration-200 shrink-0 mt-0.5"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: open ? 'var(--accent-interactive)' : 'var(--text-muted)',
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)'
          }}
        >
          <ChevronDown size={18} />
        </span>
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: EASE }}
          className="px-5 pb-5 sm:px-6 sm:pb-6 pt-0 border-t"
          style={{ borderColor: 'var(--border-subtle)' }}
        >
          <p
            className="text-[14px] sm:text-[15px] leading-relaxed pt-3"
            style={{ color: 'var(--text-secondary)' }}
          >
            {answer}
          </p>
        </motion.div>
      )}
    </div>
  )
}

export default function B2BBusinessIntelligencePage() {
  const navigate = useNavigate()
  const prefersReduced = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Structured Data (JSON-LD) authoritative management in head
  useEffect(() => {
    let script = document.getElementById('b2b-bi-jsonld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'b2b-bi-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(b2bContent.structuredData)
    return () => {
      if (window.location.pathname !== '/b2b-business-intelligence') {
        script?.remove()
      }
    }
  }, [])

  const faqItems = b2bContent.section8.faqs

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >

      {/* ══════════ STICKY NAVIGATION ══════════ */}
      <nav
        className="fixed top-0 left-0 w-full z-50 h-16 flex items-center transition-all"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg-base) 88%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent'
        }}
      >
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/home" className="flex items-center gap-2" aria-label="EBEXTA Homepage">
              <EbextaLogo variant="horizontal" size={26} priority />
            </Link>
          </div>

          <div className="flex items-center gap-6">
            <Link
              to="/about"
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              About
            </Link>
            <Link
              to="/b2b-business-intelligence"
              className="text-[13px] font-semibold transition-colors"
              style={{ color: 'var(--accent-interactive)' }}
            >
              Intelligence Guide
            </Link>
            <Link
              to="/business-signals"
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Business Signals
            </Link>
            <Link
              to="/b2b-intent-intelligence"
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Intent Intelligence
            </Link>
            <Link
              to="/company-intelligence"
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Company Intelligence
            </Link>
            <Link
              to="/b2b-business-network"
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Business Network
            </Link>
            <div className="hidden sm:flex items-center gap-3">
              <button
                onClick={() => navigate('/login')}
                className="ghost-btn text-[13px] font-semibold px-4 h-9 rounded-lg cursor-pointer"
              >
                Sign in
              </button>
              <button
                onClick={() => navigate('/signup')}
                className="premium-btn text-[13px] px-5 h-9 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <span>Get Started</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO SECTION ══════════ */}
      <header className="relative pt-32 md:pt-40 pb-20 px-6 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Subtle EBEXTA architectural grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            opacity: 0.35,
            maskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 30%, black, transparent 75%)'
          }}
        />

        <div className="max-w-[1050px] mx-auto text-center relative z-10">
          {/* Breadcrumb Pill */}
          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold tracking-[0.14em] uppercase mb-6"
            style={{
              background: 'var(--navy)',
              color: '#38BDF8',
              border: '1px solid rgba(56,189,248,0.3)',
              boxShadow: '0 2px 8px rgba(15,23,42,0.1)'
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[#38BDF8] animate-pulse" />
            <span>EBEXTA Framework · Discover → Understand → Verify → Engage</span>
          </motion.div>

          {/* Canonical H1 */}
          <motion.h1
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.08, ease: EASE }}
            className="text-[34px] sm:text-[46px] md:text-[56px] font-extrabold tracking-tight leading-[1.12] mb-6"
            style={{ ...geist, color: 'var(--text-primary)' }}
          >
            B2B Business Intelligence for Discovering Business Opportunities
          </motion.h1>

          <motion.p
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.16, ease: EASE }}
            className="text-[17px] sm:text-[19px] max-w-[800px] mx-auto leading-relaxed mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            How modern commercial enterprises move beyond static contact databases to evaluate operational signals, business intent, and verified decision-makers before engaging.
          </motion.p>

          <motion.div
            initial={prefersReduced ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.24, ease: EASE }}
            className="flex flex-wrap items-center justify-center gap-4"
          >
            <button
              onClick={() => navigate('/signup')}
              className="premium-btn text-[15px] px-7 h-12 rounded-xl flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Explore Opportunities</span>
              <ArrowRight size={16} />
            </button>
            <Link
              to="/about"
              className="ghost-btn text-[15px] font-semibold px-7 h-12 rounded-xl flex items-center gap-2"
            >
              <span>About EBEXTA</span>
            </Link>
          </motion.div>
        </div>
      </header>

      {/* ══════════ MAIN CONTENT CONTAINER ══════════ */}
      <main className="max-w-[1100px] mx-auto px-6 py-16 space-y-24">

        {/* ── SECTION 1: What Is B2B Business Intelligence? ── */}
        <section aria-labelledby="what-is-b2b-bi" className="space-y-8">
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Compass size={14} />
              <span>Core Definition</span>
            </div>
            <h2
              id="what-is-b2b-bi"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              What Is B2B Business Intelligence?
            </h2>
          </div>

          <div className="space-y-5 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              <strong>B2B business intelligence</strong> is the continuous discovery, synthesis, and interpretation of commercial context, corporate requirements, and operational indicators across business ecosystems. Unlike consumer intelligence, which relies on demographic generalities, business-to-business intelligence evaluates how enterprises operate, scale, allocate capital, and select commercial partners.
            </p>
            <p>
              At its core, B2B business intelligence addresses the fundamental gap in commercial growth: knowing not just that a company exists, but understanding <em>why</em> they have a present need, <em>what</em> problem they are attempting to solve, and <em>who</em> among their leadership possesses the authority to evaluate solutions.
            </p>
          </div>

          {/* 3 Pillar Cards in EBEXTA elevated styling */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <Target size={20} />
              </div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500 mb-1">
                Pillar 01
              </div>
              <h3 className="text-[17px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                Precision Context
              </h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Understanding the exact operating context and sector needs of a company before initiating commercial dialogue.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <Activity size={20} />
              </div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-emerald-500 mb-1">
                Pillar 02
              </div>
              <h3 className="text-[17px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                Live Business Signals
              </h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Tracking real-world operational changes, expansion efforts, hiring shifts, and procurement indicators in real time.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 bg-sky-500/10 text-sky-600 dark:text-sky-400">
                <ShieldCheck size={20} />
              </div>
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-500 mb-1">
                Pillar 03
              </div>
              <h3 className="text-[17px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                Verified Decision-Makers
              </h3>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Confirming executive mandates and authentic decision-makers through cross-referenced public records and verified networks.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 2: Why Traditional B2B Data Isn't Enough ── */}
        <section aria-labelledby="why-traditional-data-fails" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-amber-500">
              <Layers size={14} />
              <span>The Evolution of Data</span>
            </div>
            <h2
              id="why-traditional-data-fails"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              Why Traditional B2B Data Isn't Enough
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              For decades, B2B sales and marketing teams relied on static contact directories and scraped lead databases. These repositories typically deliver lists of names, job titles, and email addresses organized by broad industry tags. However, in today's sophisticated business landscape, static contact data suffers from critical structural flaws:
            </p>
          </div>

          {/* EBEXTA Contrast Module: Red Flaws vs Green Advantage */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="p-6 md:p-7 rounded-2xl border"
              style={{
                background: 'rgba(239, 68, 68, 0.04)',
                borderColor: 'rgba(239, 68, 68, 0.25)',
              }}
            >
              <div className="flex items-center gap-2 text-red-500 font-bold text-[13px] uppercase tracking-wider mb-4">
                <XCircle size={18} />
                <span>Traditional Static Databases</span>
              </div>
              <ul className="space-y-3.5 text-[14px] leading-relaxed text-red-950 dark:text-red-200">
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Absence of Timing &amp; Context:</strong> An email address reveals nothing about whether a company has budget, active projects, or urgent priorities.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Rapid Data Decay:</strong> Corporate roles change constantly, leading to 30–50% bounce rates and wasted sales development effort.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-red-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Generic Cold Mass Outreach:</strong> Spray-and-pray emails that end up in spam folders and erode corporate reputation.</span>
                </li>
              </ul>
            </div>

            <div
              className="p-6 md:p-7 rounded-2xl border"
              style={{
                background: 'rgba(16, 185, 129, 0.04)',
                borderColor: 'rgba(16, 185, 129, 0.25)',
              }}
            >
              <div className="flex items-center gap-2 text-emerald-500 font-bold text-[13px] uppercase tracking-wider mb-4">
                <CheckCircle2 size={18} />
                <span>EBEXTA Contextual Intelligence</span>
              </div>
              <ul className="space-y-3.5 text-[14px] leading-relaxed text-emerald-950 dark:text-emerald-200">
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Signal-Driven Timing:</strong> Engagements triggered by observable expansion, procurement disclosures, and executive mandates.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Verified Decision-Makers:</strong> Cross-referenced public evidence ensures you engage legitimate stakeholders with active purchasing mandate.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                  <span><strong>Bilateral Network Engagement:</strong> Direct handshakes with sector leaders and professionals who are active members of the EBEXTA network.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* ── SECTION 3: The Signals Behind Business Opportunities ── */}
        <section aria-labelledby="business-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Activity size={14} />
              <span>Market Observation</span>
            </div>
            <h2
              id="business-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              The Signals Behind Business Opportunities
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              Every commercial transaction is triggered by real-world events. <strong>Business signals</strong> are observable indicators extracted from public company activity, regulatory filings, corporate announcements, procurement tenders, and industry movements that reveal commercial momentum:
            </p>
          </div>

          {/* 4 EBEXTA Signal Simulation Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div
              className="p-5 sm:p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                  SIGNAL · EXPANSION
                </span>
                <span className="text-[11px] font-mono text-emerald-500 font-semibold">Match: 96%</span>
              </div>
              <h3 className="text-[16px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                <TrendingUp size={17} className="text-blue-500" />
                <span>Expansion &amp; Growth Indicators</span>
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                New facility openings, regional market entries, capital investments, and capacity expansions signaling growing vendor requirements.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                  SIGNAL · LEADERSHIP
                </span>
                <span className="text-[11px] font-mono text-emerald-500 font-semibold">Verified</span>
              </div>
              <h3 className="text-[16px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                <Users2 size={17} className="text-emerald-500" />
                <span>Leadership &amp; Executive Transitions</span>
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                New executive appointments (CEOs, CTOs, heads of procurement) frequently bring new operational priorities and partner evaluations.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-sky-500/10 text-sky-600 dark:text-sky-400 border border-sky-500/20">
                  SIGNAL · TECH ADOPTION
                </span>
                <span className="text-[11px] font-mono text-sky-500 font-semibold">Active</span>
              </div>
              <h3 className="text-[16px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                <Cpu size={17} className="text-sky-500" />
                <span>Technology &amp; Process Modernization</span>
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Digital transformation disclosures, infrastructure shifts, and tool adoptions highlighting active technical and service needs.
              </p>
            </div>

            <div
              className="p-5 sm:p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  SIGNAL · TENDERS
                </span>
                <span className="text-[11px] font-mono text-amber-500 font-semibold">Urgent</span>
              </div>
              <h3 className="text-[16px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                <FileSearch size={17} className="text-amber-500" />
                <span>Procurement &amp; Public Tenders</span>
              </h3>
              <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Published requests for proposals, supplier requirements, and statutory disclosures demonstrating immediate purchasing readiness.
              </p>
            </div>
          </div>

          {/* Contextual link to /business-signals */}
          <div
            className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="space-y-1">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Deep Dive Guide
              </div>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Explore B2B Buying Signals &amp; Business Signals
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Understand how observable company activity differs from buying intent and how public data across the web surfaces genuine commercial opportunities.
              </p>
            </div>
            <Link
              to="/business-signals"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-interactive, #2563eb)' }}
            >
              <span>Explore Business Signals</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── SECTION 4: Business Intent and Company Intelligence ── */}
        <section aria-labelledby="intent-and-intelligence" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-emerald-500">
              <Target size={14} />
              <span>Commercial Intent</span>
            </div>
            <h2
              id="intent-and-intelligence"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              Business Intent and Company Intelligence
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            <p>
              When combined with deep company research, <strong>business intent</strong> transforms how enterprises prioritize their pipeline. Intent indicators reveal an organization’s active focus on specific categories, problems, or technological solutions.
            </p>
            <p>
              Rather than scattering business development resources evenly across an entire addressable market, company intelligence allows revenue teams to focus on the subset of counterparties currently demonstrating commercial momentum. By understanding a company's strategic focus, recent achievements, and immediate requirements beforehand, business leaders can craft proposals that resonate immediately with executive decision-makers.
            </p>
          </div>

          {/* Contextual link to /b2b-intent-intelligence */}
          <div
            className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-6"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
              boxShadow: 'var(--shadow-sm)'
            }}
          >
            <div className="space-y-1">
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Intent Intelligence Guide
              </div>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Explore B2B Intent Data &amp; Buyer Intent Signals
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Discover how B2B intent intelligence connects observable business signals and company context to interpret potential buyer intent without invasive tracking.
              </p>
            </div>
            <Link
              to="/b2b-intent-intelligence"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-interactive, #2563eb)' }}
            >
              <span>Explore Intent Intelligence</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Contextual link to /company-intelligence */}
          <div
            className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
            }}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive, #2563eb)]">
                Next in Series · Company Research &amp; Intelligence
              </span>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Explore B2B Company Intelligence &amp; Decision-Maker Research
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Learn how company intelligence combines organizational structures, business signals, and verified decision-maker context to discover enterprise opportunities.
              </p>
            </div>
            <Link
              to="/company-intelligence"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-interactive, #2563eb)' }}
            >
              <span>Explore Company Intelligence</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {/* Contextual link to /b2b-business-network */}
          <div
            className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
            }}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive, #2563eb)]">
                Network &amp; Engagement Layer
              </span>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Connect Through the EBEXTA B2B Business Network
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Discover how EBEXTA connects business intelligence and observable signals with a bilateral network of verified enterprises, sector leaders, and professionals.
              </p>
            </div>
            <Link
              to="/b2b-business-network"
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-semibold text-white shrink-0 transition-opacity hover:opacity-90"
              style={{ background: 'var(--accent-interactive, #2563eb)' }}
            >
              <span>Explore Business Network</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── SECTION 5: From Discovery to Engagement ── */}
        <section aria-labelledby="discovery-to-engagement" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Compass size={14} />
              <span>The Commercial Lifecycle</span>
            </div>
            <h2
              id="discovery-to-engagement"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              From Discovery to Engagement
            </h2>
            <p className="text-[15px] sm:text-[16.5px] leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
              Successful B2B partnerships do not happen by chance; they follow a structured progression from market discovery to meaningful commercial dialogue. EBEXTA coordinates this transition into four core stages:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Stage 01: Discover */}
            <div
              className="p-6 sm:p-7 rounded-2xl border transition-all"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  STAGE 01
                </span>
                <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
                  01 / 04
                </span>
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-bold mb-2.5" style={{ ...geist, color: 'var(--text-primary)' }}>
                Discover: Relevant Opportunities
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Identify companies demonstrating active commercial momentum, industry growth, and relevant strategic initiatives. Rather than scanning passive lists, business development teams surface high-potential counterparties based on genuine market dynamics.
              </p>
            </div>

            {/* Stage 02: Understand */}
            <div
              className="p-6 sm:p-7 rounded-2xl border transition-all"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  STAGE 02
                </span>
                <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
                  02 / 04
                </span>
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-bold mb-2.5" style={{ ...geist, color: 'var(--text-primary)' }}>
                Understand: Signals, Intent & Context
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Analyze the context behind those signals—ongoing technology initiatives, organizational priorities, and specific commercial requirements. Understanding the why behind an account allows teams to formulate relevant solutions.
              </p>
            </div>

            {/* Stage 03: Verify */}
            <div
              className="p-6 sm:p-7 rounded-2xl border transition-all"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md" style={{ background: 'rgba(5, 150, 105, 0.1)', color: 'var(--success)' }}>
                  STAGE 03
                </span>
                <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
                  03 / 04
                </span>
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-bold mb-2.5" style={{ ...geist, color: 'var(--text-primary)' }}>
                Verify: Companies & Decision-Makers
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Confirm the credibility of the enterprise, the validity of the business opportunity, and identify accountable leaders responsible for key initiatives. Multi-layer verification eliminates wasted outreach and outdated points of contact.
              </p>
            </div>

            {/* Stage 04: Engage */}
            <div
              className="p-6 sm:p-7 rounded-2xl border transition-all"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span className="text-[11px] font-mono font-bold px-2.5 py-1 rounded-md" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  STAGE 04
                </span>
                <span className="text-[12px] font-mono font-semibold" style={{ color: 'var(--text-muted)' }}>
                  04 / 04
                </span>
              </div>
              <h3 className="text-[18px] sm:text-[20px] font-bold mb-2.5" style={{ ...geist, color: 'var(--text-primary)' }}>
                Engage: Strategic Bilateral Dialogue
              </h3>
              <p className="text-[14px] sm:text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Initiate contextual, bilateral dialogue with executive stakeholders through a trusted network. By engaging with verified facts and shared business context, discussions bypass cold barriers and advance directly to commercial evaluation.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 6: How EBEXTA Approaches B2B Business Intelligence ── */}
        <section aria-labelledby="ebexta-approach" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Network size={14} />
              <span>Platform Integration</span>
            </div>
            <h2
              id="ebexta-approach"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              How EBEXTA Approaches B2B Business Intelligence
            </h2>
          </div>

          <div className="space-y-6 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {/* The exact approved brand positioning quote block */}
            <div
              className="p-6 md:p-8 rounded-2xl border"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500 mb-3">
                Official EBEXTA Positioning
              </div>
              <p
                className="text-[16px] md:text-[18px] leading-relaxed font-semibold italic"
                style={{ color: 'var(--text-primary)' }}
              >
                "EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network."
              </p>
            </div>

            <p>
              Unlike isolated intelligence tools that stop at delivering data points, EBEXTA bridges the critical gap between intelligence and execution by pairing deep company research with the interactive <strong>EBEXTA B2B Network</strong>.
            </p>
            <p>
              On EBEXTA, enterprises do not merely consume analytical dossiers; they can directly identify, connect, and collaborate with verified founders, CEOs, procurement heads, and sector leaders who are active platform members. This bilateral model ensures that intelligence translates smoothly into genuine, high-trust commercial relationships.
            </p>

            <div className="pt-2">
              <Link
                to="/about"
                className="inline-flex items-center gap-2 text-[14px] font-semibold text-blue-500 hover:text-blue-600 transition-colors"
              >
                <span>Learn more about EBEXTA's vision and architecture on the About page</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>

        {/* ── SECTION 7: Who Is B2B Business Intelligence For? ── */}
        <section aria-labelledby="who-is-it-for" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Users2 size={14} />
              <span>Target Stakeholders</span>
            </div>
            <h2
              id="who-is-it-for"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              Who Is B2B Business Intelligence For?
            </h2>
            <p className="text-[15px] sm:text-[16.5px] leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
              Actionable intelligence creates leverage across every department engaged in commercial growth:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Briefcase size={18} />
                </div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  B2B Sales &amp; Revenue Teams
                </h3>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Prioritize prospects based on active signals and intent rather than arbitrary contact lists, maximizing deal velocity and executive response rates.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp size={18} />
                </div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  Business Development Teams
                </h3>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Identify emerging expansion programs, public tenders, and supply-chain requirements early, establishing advantageous counterparty positions.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Building2 size={18} />
                </div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  Founders &amp; Executive Leadership
                </h3>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Map competitor ecosystems, evaluate strategic partners, and connect directly with fellow founders and sector leaders across the EBEXTA network.
              </p>
            </div>

            <div
              className="p-6 rounded-2xl border"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Target size={18} />
                </div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  Marketing &amp; Partnerships Teams
                </h3>
              </div>
              <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                Ground account-based marketing (ABM) campaigns in verifiable intent data and identify synergistic alliances with complementary enterprises.
              </p>
            </div>
          </div>
        </section>

        {/* ── SECTION 8: Frequently Asked Questions ── */}
        <section aria-labelledby="frequently-asked-questions" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <FileSearch size={14} />
              <span>Search Intent Answers</span>
            </div>
            <h2
              id="frequently-asked-questions"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              Frequently Asked Questions
            </h2>
            <p className="text-[15px] sm:text-[16.5px] leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
              Concise, factual answers regarding B2B business intelligence, business signals, and the EBEXTA platform.
            </p>
          </div>

          <div className="space-y-1">
            {faqItems.map(faq => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>

        {/* ── CTA: Call to Action Module ── */}
        <section className="pt-8">
          <div
            className="rounded-3xl p-8 sm:p-12 text-center relative overflow-hidden"
            style={{
              background: 'var(--navy)',
              color: '#F5F3EF',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              boxShadow: 'var(--shadow-lg)'
            }}
          >
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider mb-5 bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <SparklesIcon />
              <span>Transform Your Commercial Discovery</span>
            </div>

            <h2
              className="text-[28px] sm:text-[38px] font-extrabold tracking-tight mb-4 text-white"
              style={geist}
            >
              Discover Verified B2B Opportunities on EBEXTA
            </h2>

            <p className="text-[15px] sm:text-[17px] max-w-[650px] mx-auto text-slate-300 leading-relaxed mb-8">
              Move beyond static contact lists. Harness business signals, evaluate commercial intent, and connect directly with verified decision-makers across the EBEXTA network.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <button
                onClick={() => navigate('/signup')}
                className="px-7 py-3.5 rounded-xl text-[14px] font-bold bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 shadow-lg transition-colors cursor-pointer"
              >
                <span>Get Started with EBEXTA</span>
                <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="px-7 py-3.5 rounded-xl text-[14px] font-semibold bg-white/10 hover:bg-white/15 text-white transition-colors cursor-pointer border border-white/15"
              >
                <span>Sign In to Platform</span>
              </button>
            </div>
          </div>
        </section>

      </main>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t py-12 px-6" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <EbextaLogo variant="horizontal" size={22} priority />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-6 text-[13px]" style={{ color: 'var(--text-secondary)' }}>
            <Link to="/home" className="hover:text-[var(--text-primary)] transition-colors">Home</Link>
            <Link to="/about" className="hover:text-[var(--text-primary)] transition-colors">About</Link>
            <Link to="/business-signals" className="hover:text-[var(--text-primary)] transition-colors">Business Signals</Link>
            <Link to="/b2b-intent-intelligence" className="hover:text-[var(--text-primary)] transition-colors">Intent Intelligence</Link>
            <Link to="/company-intelligence" className="hover:text-[var(--text-primary)] transition-colors">Company Intelligence</Link>
            <Link to="/b2b-business-network" className="hover:text-[var(--text-primary)] transition-colors">Business Network</Link>
            <Link to="/terms" className="hover:text-[var(--text-primary)] transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-[var(--text-primary)] transition-colors">Privacy</Link>
            <Link to="/dpdp" className="hover:text-[var(--text-primary)] transition-colors">DPDP</Link>
          </div>

          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} EBEXTA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}

function SparklesIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-blue-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
      <path d="M5 3v4"/>
      <path d="M19 17v4"/>
      <path d="M3 5h4"/>
      <path d="M17 19h4"/>
    </svg>
  )
}
