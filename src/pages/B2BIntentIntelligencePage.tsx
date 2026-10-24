import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Compass,
  Users2,
  Cpu,
  ArrowRight,
  ChevronDown,
  CheckCircle2,
  ShieldCheck,
  Briefcase,
  Target,
  Activity,
  Sparkles,
  Award,
  Share2,
  BadgeDollarSign,
  MapPin,
  RefreshCw,
  Crosshair
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'
import intentContent from '../data/b2bIntentIntelligenceContent.json'

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
    case 'EXPANSION':
      return <MapPin size={17} className="text-blue-500" />
    case 'HIRING':
      return <Users2 size={17} className="text-emerald-500" />
    case 'LEADERSHIP':
      return <Award size={17} className="text-amber-500" />
    case 'PRODUCT':
      return <Sparkles size={17} className="text-purple-500" />
    case 'PARTNERSHIP':
      return <Share2 size={17} className="text-sky-500" />
    case 'TECHNOLOGY':
      return <Cpu size={17} className="text-cyan-500" />
    case 'FUNDING':
      return <BadgeDollarSign size={17} className="text-emerald-600" />
    case 'STRATEGY':
      return <RefreshCw size={17} className="text-orange-500" />
    default:
      return <Activity size={17} className="text-blue-500" />
  }
}

export default function B2BIntentIntelligencePage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Structured Data (JSON-LD) authoritative management in head
  useEffect(() => {
    let script = document.getElementById('b2b-intent-jsonld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'b2b-intent-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(intentContent.structuredData)
    return () => {
      if (window.location.pathname !== '/b2b-intent-intelligence') {
        script?.remove()
      }
    }
  }, [])

  const faqItems = intentContent.section9.faqs

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
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Business Signals
            </Link>
            <Link
              to="/b2b-intent-intelligence"
              className="text-[13px] font-semibold transition-colors"
              style={{ color: 'var(--accent-interactive)' }}
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
                className="premium-btn text-[13px] font-semibold px-4 h-9 rounded-lg cursor-pointer"
              >
                Get Started
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <main className="max-w-[1100px] mx-auto px-6 pt-28 pb-20 space-y-20">

        {/* ── HERO / HEADER ── */}
        <header className="space-y-6 pt-4 pb-8 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--text-muted)' }}>
            <Link to="/home" className="hover:text-[var(--accent-interactive)] transition-colors">Home</Link>
            <span>/</span>
            <Link to="/business-signals" className="hover:text-[var(--accent-interactive)] transition-colors">Business Signals</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>B2B Intent Intelligence</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
            <Crosshair size={13} />
            <span>{intentContent.badge}</span>
          </div>

          <h1
            className="text-[34px] sm:text-[46px] lg:text-[52px] font-extrabold tracking-tight leading-[1.12]"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {intentContent.h1}
          </h1>

          <p
            className="text-[17px] sm:text-[19px] leading-relaxed max-w-[880px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {intentContent.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/signup')}
              className="premium-btn px-6 py-3 rounded-xl font-semibold text-[14px] flex items-center gap-2 cursor-pointer"
            >
              <span>Explore Potential Opportunities</span>
              <ArrowRight size={16} />
            </button>
            <Link
              to="/business-signals"
              className="ghost-btn px-6 py-3 rounded-xl font-semibold text-[14px] border inline-flex items-center gap-2"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <Activity size={15} />
              <span>Explore Business Signals</span>
            </Link>
            <Link
              to="/b2b-business-intelligence"
              className="ghost-btn px-6 py-3 rounded-xl font-semibold text-[14px] border inline-flex items-center gap-2"
              style={{ borderColor: 'var(--border-subtle)' }}
            >
              <Compass size={15} />
              <span>B2B Business Intelligence</span>
            </Link>
          </div>

          <div
            className="p-4 rounded-xl border text-[13px] flex items-start gap-3 mt-4"
            style={{
              background: 'color-mix(in srgb, var(--accent-subtle) 40%, transparent)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            <Target size={18} className="shrink-0 text-blue-500 mt-0.5" />
            <p className="leading-relaxed">
              <strong style={{ color: 'var(--text-primary)' }}>Ethical &amp; Transparent Intelligence: </strong>
              {intentContent.positioning}
            </p>
          </div>
        </header>

        {/* ── SECTION 1: What Is B2B Intent Data? ── */}
        <section id={intentContent.section1.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section1.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section1.h2}
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {intentContent.section1.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
            {intentContent.section1.principles.map(item => (
              <div
                key={item.num}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="text-[11px] font-mono font-bold text-blue-500 uppercase tracking-wider">
                  {item.num}
                </div>
                <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  {item.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {item.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: What Is Buyer Intent? ── */}
        <section id={intentContent.section2.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section2.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section2.h2}
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {intentContent.section2.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          {/* 4-Stage Continuum */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {intentContent.section2.stages.map((stg, idx) => (
              <div
                key={stg.stage}
                className="p-5 rounded-2xl border flex flex-col justify-between relative"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: idx === 2 ? 'var(--accent-interactive)' : 'var(--border-subtle)',
                  boxShadow: idx === 2 ? 'var(--shadow-sm)' : 'none'
                }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                      {stg.stage}
                    </span>
                    {idx < 3 && <ArrowRight size={14} className="text-slate-400 hidden lg:block" />}
                  </div>
                  <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {stg.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {stg.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p
            className="text-[13px] italic p-4 rounded-xl border"
            style={{
              background: 'var(--bg-elevated)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)'
            }}
          >
            {intentContent.section2.disclaimer}
          </p>
        </section>

        {/* ── SECTION 3: Business Signals vs B2B Intent ── */}
        <section id={intentContent.section3.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section3.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section3.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section3.intro}
            </p>
          </div>

          {/* Detailed 3-Way Comparison Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {intentContent.section3.comparison.map(item => (
              <div
                key={item.concept}
                className="p-6 rounded-2xl border space-y-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: item.concept === 'Business Intent' ? 'var(--accent-interactive)' : 'var(--border-subtle)'
                }}
              >
                <div className="space-y-1">
                  <div className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                    Dimension
                  </div>
                  <h3 className="text-[19px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {item.concept}
                  </h3>
                </div>

                <div className="space-y-3 text-[13.5px]">
                  <div>
                    <span className="font-semibold block text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Definition
                    </span>
                    <p className="leading-snug pt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {item.definition}
                    </p>
                  </div>

                  <div>
                    <span className="font-semibold block text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Nature
                    </span>
                    <p className="leading-snug pt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      {item.nature}
                    </p>
                  </div>

                  <div className="p-3 rounded-lg border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                    <span className="font-semibold block text-[11px] uppercase tracking-wider text-blue-500">
                      Real-World Example
                    </span>
                    <p className="text-[12.5px] leading-snug pt-1" style={{ color: 'var(--text-primary)' }}>
                      {item.example}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Contextual Link to /business-signals */}
          <div
            className="p-5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)'
            }}
          >
            <p className="text-[14px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section3.crossLink.text}{' '}
              <Link
                to={intentContent.section3.crossLink.href}
                className="font-bold underline transition-colors"
                style={{ color: 'var(--accent-interactive)' }}
              >
                {intentContent.section3.crossLink.linkText}
              </Link>.
            </p>
            <Link
              to={intentContent.section3.crossLink.href}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-semibold text-white shrink-0"
              style={{ background: 'var(--accent-interactive)' }}
            >
              <span>Explore Signals</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </section>

        {/* ── SECTION 4: Examples of B2B Intent Signals ── */}
        <section id={intentContent.section4.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section4.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section4.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section4.intro}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {intentContent.section4.examples.map(ex => (
              <div
                key={ex.title}
                className="p-5 rounded-2xl border flex flex-col justify-between space-y-3"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                      {ex.tag}
                    </span>
                    {getExampleIcon(ex.tag)}
                  </div>
                  <h3 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {ex.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {ex.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p
            className="text-[13px] p-4 rounded-xl border text-[var(--text-muted)] italic"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            {intentContent.section4.note}
          </p>
        </section>

        {/* ── SECTION 5: How B2B Intent Intelligence Helps Discover Opportunities ── */}
        <section id={intentContent.section5.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section5.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section5.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section5.intro}
            </p>
          </div>

          <div className="space-y-3 pt-2">
            {intentContent.section5.steps.map(step => (
              <div
                key={step.num}
                className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center gap-5 transition-all"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-bold text-[18px] text-blue-600 shrink-0 border"
                  style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
                >
                  {step.num}
                </div>
                <div className="space-y-1">
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {step.title}
                  </h3>
                  <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {step.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p
            className="text-[13px] p-4 rounded-xl border text-[var(--text-muted)] italic"
            style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
          >
            {intentContent.section5.disclaimer}
          </p>
        </section>

        {/* ── SECTION 6: How EBEXTA Approaches B2B Intent Intelligence ── */}
        <section id={intentContent.section6.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section6.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section6.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section6.intro}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {intentContent.section6.framework.map(col => (
              <div
                key={col.stage}
                className="p-6 rounded-2xl border flex flex-col justify-between space-y-4"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-blue-500">
                      {col.stage}
                    </span>
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                      {col.action}
                    </span>
                  </div>
                  <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {col.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {col.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="p-4 rounded-xl border flex items-center gap-3"
            style={{
              background: 'color-mix(in srgb, var(--accent-subtle) 30%, transparent)',
              borderColor: 'var(--border-subtle)'
            }}
          >
            <ShieldCheck size={20} className="text-emerald-500 shrink-0" />
            <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <strong style={{ color: 'var(--text-primary)' }}>Privacy &amp; Compliance Grounding: </strong>
              {intentContent.section6.grounding}
            </p>
          </div>
        </section>

        {/* ── SECTION 7: Why Context Matters in B2B Intent ── */}
        <section id={intentContent.section7.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section7.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section7.h2}
            </h2>
          </div>

          <div className="space-y-4 text-[15px] sm:text-[16px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {intentContent.section7.paragraphs.map((p, idx) => (
              <p key={idx}>{p}</p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
            {intentContent.section7.dimensions.map(dim => (
              <div
                key={dim.title}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-blue-500 shrink-0" />
                  <h3 className="text-[16.5px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {dim.title}
                  </h3>
                </div>
                <p className="text-[13.5px] leading-relaxed pl-6" style={{ color: 'var(--text-secondary)' }}>
                  {dim.desc}
                </p>
              </div>
            ))}
          </div>

          <p
            className="text-[14px] p-4 rounded-xl border font-medium text-blue-600 bg-blue-50/50 dark:bg-blue-950/20"
            style={{ borderColor: 'rgba(37, 99, 235, 0.2)' }}
          >
            {intentContent.section7.takeaway}
          </p>
        </section>

        {/* ── SECTION 8: Who Uses B2B Intent Intelligence? ── */}
        <section id={intentContent.section8.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section8.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section8.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section8.intro}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
            {intentContent.section8.audiences.map(aud => (
              <div
                key={aud.role}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Briefcase size={17} />
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {aud.role}
                  </h3>
                </div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {aud.desc}
                </p>
              </div>
            ))}
          </div>

          {/* Contextual Link to /company-intelligence */}
          <div
            className="p-5 sm:p-6 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)',
            }}
          >
            <div className="space-y-1">
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Topical Authority Cluster
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
              <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
                Network &amp; Engagement Layer
              </span>
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                Connect Through the EBEXTA B2B Business Network
              </h3>
              <p className="text-[13px] leading-relaxed max-w-[620px]" style={{ color: 'var(--text-muted)' }}>
                Move from evaluating buyer intent to active, bilateral engagement across a verified network of companies, sector leaders, and professionals.
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

        {/* ── SECTION 9: Frequently Asked Questions ── */}
        <section id={intentContent.section9.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {intentContent.section9.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {intentContent.section9.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {intentContent.section9.intro}
            </p>
          </div>

          <div className="pt-2">
            {faqItems.map(faq => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
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
              <span>{intentContent.cta.badge}</span>
            </div>

            <h2 className="text-[28px] sm:text-[36px] font-extrabold text-white tracking-tight leading-tight" style={geist}>
              {intentContent.cta.h2}
            </h2>

            <p className="text-[15px] sm:text-[16.5px] leading-relaxed text-slate-300">
              {intentContent.cta.desc}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate(intentContent.cta.primary.href)}
                className="px-7 py-3.5 rounded-xl font-bold text-[14px] bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <span>{intentContent.cta.primary.text}</span>
                <ArrowRight size={16} />
              </button>
              <Link
                to={intentContent.cta.secondary.href}
                className="px-7 py-3.5 rounded-xl font-semibold text-[14px] bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all inline-flex items-center gap-2"
              >
                <span>{intentContent.cta.secondary.text}</span>
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
            <Link to="/business-signals" className="hover:text-[var(--text-primary)] transition-colors">Business Signals</Link>
            <Link to="/b2b-intent-intelligence" className="hover:text-[var(--text-primary)] transition-colors font-semibold" style={{ color: 'var(--accent-interactive)' }}>Intent Intelligence</Link>
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
