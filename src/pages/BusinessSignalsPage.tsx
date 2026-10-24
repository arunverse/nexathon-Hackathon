import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Radio,
  TrendingUp,
  Users2,
  Cpu,
  FileSearch,
  Layers,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  Compass,
  ShieldCheck,
  Briefcase,
  Target,
  Activity,
  Globe,
  Search,
  Sparkles,
  Award,
  Share2,
  BadgeDollarSign,
  MapPin,
  Megaphone,
  RefreshCw,
  Eye
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'
import signalsContent from '../data/businessSignalsContent.json'

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

// Map example tag to icon
function getExampleIcon(tag: string) {
  switch (tag) {
    case 'GROWTH & EXPANSION':
      return <MapPin size={17} className="text-blue-500" />
    case 'TALENT & WORKFORCE':
      return <Users2 size={17} className="text-emerald-500" />
    case 'LEADERSHIP':
      return <Award size={17} className="text-amber-500" />
    case 'COMMERCIAL':
      return <Sparkles size={17} className="text-purple-500" />
    case 'COLLABORATION':
      return <Share2 size={17} className="text-sky-500" />
    case 'CAPITAL':
      return <BadgeDollarSign size={17} className="text-emerald-600" />
    case 'STRATEGY':
      return <Globe size={17} className="text-indigo-500" />
    case 'COMMUNICATION':
      return <Megaphone size={17} className="text-rose-500" />
    case 'OPERATIONS':
      return <Cpu size={17} className="text-cyan-500" />
    case 'TRANSFORMATION':
      return <RefreshCw size={17} className="text-orange-500" />
    default:
      return <Activity size={17} className="text-blue-500" />
  }
}

export default function BusinessSignalsPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Structured Data (JSON-LD) authoritative management in head
  useEffect(() => {
    let script = document.getElementById('business-signals-jsonld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'business-signals-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(signalsContent.structuredData)
    return () => {
      if (window.location.pathname !== '/business-signals') {
        script?.remove()
      }
    }
  }, [])

  const faqItems = signalsContent.section9.faqs

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
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Intelligence Guide
            </Link>
            <Link
              to="/business-signals"
              className="text-[13px] font-semibold transition-colors"
              style={{ color: 'var(--accent-interactive)' }}
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
                className="primary-btn text-[13px] font-semibold px-4 h-9 rounded-lg cursor-pointer flex items-center gap-1.5"
              >
                <span>Get Started</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════ MAIN CONTENT CONTAINER ══════════ */}
      <main className="max-w-[1000px] mx-auto px-6 pt-32 pb-24 space-y-24">

        {/* ── HERO / INTRO HEADER ── */}
        <header className="space-y-6 text-left">
          <nav aria-label="Breadcrumb" className="text-[13px] flex items-center gap-2" style={{ color: 'var(--text-muted)' }}>
            <Link to="/" className="hover:text-[var(--accent-interactive)] transition-colors">Home</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>Business Signals</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            <Radio size={13} className="animate-pulse" />
            <span>{signalsContent.badge}</span>
          </div>

          <h1
            className="text-[36px] sm:text-[46px] md:text-[54px] font-extrabold tracking-tight leading-[1.12]"
            style={{ ...geist, color: 'var(--text-primary)' }}
          >
            {signalsContent.h1}
          </h1>

          <p
            className="text-[17px] sm:text-[19px] leading-relaxed max-w-[820px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {signalsContent.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              onClick={() => navigate('/signup')}
              className="primary-btn px-6 py-3 rounded-xl font-bold text-[14px] flex items-center gap-2 shadow-sm cursor-pointer"
            >
              <span>Discover Business Signals</span>
              <ArrowRight size={16} />
            </button>
            <Link
              to="/b2b-business-intelligence"
              className="ghost-btn px-6 py-3 rounded-xl font-semibold text-[14px] border inline-flex items-center gap-2"
              style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              <span>Explore B2B Intelligence</span>
            </Link>
          </div>
        </header>

        {/* ── SECTION 1: What Are Business Signals? ── */}
        <section aria-labelledby="what-are-business-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Compass size={14} />
              <span>{signalsContent.section1.badge}</span>
            </div>
            <h2
              id="what-are-business-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section1.h2}
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section1.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
            {signalsContent.section1.traits.map((trait, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500 mb-1">
                  {trait.num}
                </div>
                <h3 className="text-[17px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  {trait.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {trait.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: What Are B2B Buying Signals? ── */}
        <section aria-labelledby="what-are-b2b-buying-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-indigo-500">
              <Layers size={14} />
              <span>{signalsContent.section2.badge}</span>
            </div>
            <h2
              id="what-are-b2b-buying-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section2.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section2.intro}
          </p>

          {/* Distinction cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div
              className="p-6 md:p-7 rounded-2xl border"
              style={{
                background: 'rgba(59, 130, 246, 0.04)',
                borderColor: 'rgba(59, 130, 246, 0.25)',
              }}
            >
              <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-bold text-[13px] uppercase tracking-wider mb-2">
                <Activity size={18} />
                <span>{signalsContent.section2.distinction.businessSignal.title}</span>
              </div>
              <div className="text-[18px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                {signalsContent.section2.distinction.businessSignal.formula}
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {signalsContent.section2.distinction.businessSignal.desc}
              </p>
            </div>

            <div
              className="p-6 md:p-7 rounded-2xl border"
              style={{
                background: 'rgba(16, 185, 129, 0.04)',
                borderColor: 'rgba(16, 185, 129, 0.25)',
              }}
            >
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-bold text-[13px] uppercase tracking-wider mb-2">
                <Target size={18} />
                <span>{signalsContent.section2.distinction.buyingSignal.title}</span>
              </div>
              <div className="text-[18px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                {signalsContent.section2.distinction.buyingSignal.formula}
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {signalsContent.section2.distinction.buyingSignal.desc}
              </p>
            </div>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section2.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>
        </section>

        {/* ── SECTION 3: Examples of Business Signals ── */}
        <section aria-labelledby="examples-of-business-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-emerald-500">
              <Eye size={14} />
              <span>{signalsContent.section3.badge}</span>
            </div>
            <h2
              id="examples-of-business-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section3.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section3.intro}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            {signalsContent.section3.examples.map((item, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    {item.tag}
                  </span>
                  <span className="text-[11px] font-mono text-emerald-500 font-semibold">Public Evidence</span>
                </div>
                <h3 className="text-[16px] font-bold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  {getExampleIcon(item.tag)}
                  <span>{item.title}</span>
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: How Business Signals Help Discover Opportunities ── */}
        <section aria-labelledby="how-signals-help-discover-opportunities" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <TrendingUp size={14} />
              <span>{signalsContent.section4.badge}</span>
            </div>
            <h2
              id="how-signals-help-discover-opportunities"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section4.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section4.intro}
          </p>

          <div className="space-y-4">
            {signalsContent.section4.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-4"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="w-10 h-10 rounded-xl flex items-center justify-center font-mono font-bold text-[14px] bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0">
                  {st.num}
                </div>
                <div className="space-y-1">
                  <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {st.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {st.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="text-[13.5px] italic pt-2" style={{ color: 'var(--text-muted)' }}>
            {signalsContent.section4.disclaimer}
          </p>
        </section>

        {/* ── SECTION 5: Business Signals vs Buying Intent ── */}
        <section aria-labelledby="business-signals-vs-buying-intent" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2 text-amber-500">
              <ShieldCheck size={14} />
              <span>{signalsContent.section5.badge}</span>
            </div>
            <h2
              id="business-signals-vs-buying-intent"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section5.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section5.intro}
          </p>

          {/* Detailed comparison table */}
          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-left border-collapse text-[14px]">
              <thead>
                <tr style={{ background: 'var(--bg-surface)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <th className="p-4 font-bold" style={{ color: 'var(--text-primary)' }}>Dimension</th>
                  <th className="p-4 font-bold text-blue-600 dark:text-blue-400">Business Signal</th>
                  <th className="p-4 font-bold text-emerald-600 dark:text-emerald-400">Buying Intent</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {signalsContent.section5.comparison.map((row, idx) => (
                  <tr key={idx} style={{ background: idx % 2 === 0 ? 'var(--bg-elevated)' : 'var(--bg-base)' }}>
                    <td className="p-4 font-semibold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                      {row.aspect}
                    </td>
                    <td className="p-4" style={{ color: 'var(--text-secondary)' }}>
                      {row.signal}
                    </td>
                    <td className="p-4" style={{ color: 'var(--text-secondary)' }}>
                      {row.intent}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="p-5 sm:p-6 rounded-2xl border"
            style={{
              background: 'rgba(37, 99, 235, 0.04)',
              borderColor: 'rgba(37, 99, 235, 0.2)'
            }}
          >
            <p className="text-[14.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {signalsContent.section5.summary}
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
                Next In Cluster
              </div>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Explore B2B Intent Intelligence &amp; Buyer Intent
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Learn how to interpret observable company movements, evaluate buyer intent signals, and discover verified B2B opportunities without behavioral surveillance.
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
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Next In Cluster
              </div>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Explore B2B Company Intelligence &amp; Research
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Discover how comprehensive company research connects operational models, observed business signals, and verified decision-maker context.
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
              <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Network &amp; Engagement Layer
              </div>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Connect Through the EBEXTA B2B Business Network
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Discover how observable business signals translate into verified commercial relationships across the EBEXTA business network.
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

        {/* ── SECTION 6: How EBEXTA Finds and Surfaces Business Signals ── */}
        <section aria-labelledby="how-ebexta-finds-and-surfaces-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Search size={14} />
              <span>{signalsContent.section6.badge}</span>
            </div>
            <h2
              id="how-ebexta-finds-and-surfaces-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section6.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section6.intro}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {signalsContent.section6.capabilities.map((cap, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <CheckCircle2 size={18} />
                </div>
                <h3 className="text-[16.5px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  {cap.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {cap.desc}
                </p>
              </div>
            ))}
          </div>

          <div
            className="p-5 rounded-xl border flex items-start gap-3"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
          >
            <ShieldCheck size={20} className="text-emerald-500 shrink-0 mt-0.5" />
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {signalsContent.section6.groundingNote}
            </p>
          </div>
        </section>

        {/* ── SECTION 7: From Business Signals to Business Opportunities ── */}
        <section aria-labelledby="from-signals-to-opportunities" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Layers size={14} />
              <span>{signalsContent.section7.badge}</span>
            </div>
            <h2
              id="from-signals-to-opportunities"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section7.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section7.intro}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
            {signalsContent.section7.framework.map((fw, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border flex flex-col justify-between"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div>
                  <div className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-500 mb-1">
                    {fw.stage}
                  </div>
                  <div className="text-[18px] font-extrabold mb-1" style={{ color: 'var(--accent-interactive)', ...geist }}>
                    {fw.action}
                  </div>
                  <h3 className="text-[14px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                    {fw.title}
                  </h3>
                  <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {fw.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2">
            <Link
              to="/b2b-business-intelligence"
              className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-blue-600 dark:text-blue-400 hover:underline"
            >
              <span>Explore how the full EBEXTA intelligence lifecycle works in our B2B Business Intelligence Guide</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── SECTION 8: Who Uses Business Signals? ── */}
        <section aria-labelledby="who-uses-business-signals" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <Users2 size={14} />
              <span>{signalsContent.section8.badge}</span>
            </div>
            <h2
              id="who-uses-business-signals"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section8.h2}
            </h2>
          </div>

          <p className="text-[15px] sm:text-[16.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {signalsContent.section8.intro}
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {signalsContent.section8.audiences.map((aud, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-blue-500/10 text-blue-600 dark:text-blue-400">
                  <Briefcase size={18} />
                </div>
                <h3 className="text-[16px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  {aud.role}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                  {aud.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 9: Frequently Asked Questions ── */}
        <section aria-labelledby="frequently-asked-questions" className="space-y-8 border-t pt-16" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] mb-2" style={{ color: 'var(--accent-interactive)' }}>
              <FileSearch size={14} />
              <span>{signalsContent.section9.badge}</span>
            </div>
            <h2
              id="frequently-asked-questions"
              className="text-[28px] sm:text-[34px] font-extrabold tracking-tight"
              style={{ ...geist, color: 'var(--text-primary)' }}
            >
              {signalsContent.section9.h2}
            </h2>
            <p className="text-[15px] leading-relaxed mt-2" style={{ color: 'var(--text-secondary)' }}>
              {signalsContent.section9.intro}
            </p>
          </div>

          <div className="pt-2">
            {faqItems.map((faq, idx) => (
              <FaqItem key={idx} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>

        {/* ── CALL TO ACTION ── */}
        <section
          className="p-8 sm:p-12 rounded-3xl text-center relative overflow-hidden border"
          style={{
            background: 'linear-gradient(135deg, #0F172A 0%, #1E293B 100%)',
            borderColor: 'rgba(255, 255, 255, 0.1)',
            boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3)'
          }}
        >
          <div className="relative z-10 space-y-4 max-w-[640px] mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Sparkles size={13} />
              <span>{signalsContent.cta.badge}</span>
            </div>

            <h2 className="text-[28px] sm:text-[36px] font-extrabold text-white tracking-tight leading-tight" style={geist}>
              {signalsContent.cta.h2}
            </h2>

            <p className="text-[15px] sm:text-[16.5px] leading-relaxed text-slate-300">
              {signalsContent.cta.desc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate(signalsContent.cta.primary.href)}
                className="px-7 py-3.5 rounded-xl font-bold text-[14px] bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <span>{signalsContent.cta.primary.text}</span>
                <ArrowRight size={16} />
              </button>
              <Link
                to={signalsContent.cta.secondary.href}
                className="px-7 py-3.5 rounded-xl font-semibold text-[14px] bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all inline-flex items-center gap-2"
              >
                <span>{signalsContent.cta.secondary.text}</span>
              </Link>
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
            <Link to="/b2b-business-intelligence" className="hover:text-[var(--text-primary)] transition-colors">Intelligence Guide</Link>
            <Link to="/business-signals" className="hover:text-[var(--text-primary)] transition-colors font-semibold" style={{ color: 'var(--accent-interactive)' }}>Business Signals</Link>
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
