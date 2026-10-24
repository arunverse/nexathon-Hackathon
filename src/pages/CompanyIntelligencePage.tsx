import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Compass,
  Users2,
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Briefcase,
  Activity,
  Sparkles,
  Layers,
  Building2,
  ArrowUpRight
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'
import companyContent from '../data/companyIntelligenceContent.json'

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

export default function CompanyIntelligencePage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Structured Data (JSON-LD) authoritative management in head
  useEffect(() => {
    let script = document.getElementById('company-intelligence-jsonld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'company-intelligence-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }
    script.textContent = JSON.stringify(companyContent.structuredData)
    return () => {
      if (window.location.pathname !== '/company-intelligence') {
        script?.remove()
      }
    }
  }, [])

  const faqItems = companyContent.section10.faqs

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

          <div className="hidden md:flex items-center gap-6">
            <Link
              to="/b2b-business-intelligence"
              className="text-[13.5px] font-medium transition-colors hover:text-[var(--accent-interactive)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Intelligence Guide
            </Link>
            <Link
              to="/business-signals"
              className="text-[13.5px] font-medium transition-colors hover:text-[var(--accent-interactive)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Business Signals
            </Link>
            <Link
              to="/b2b-intent-intelligence"
              className="text-[13.5px] font-medium transition-colors hover:text-[var(--accent-interactive)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Intent Intelligence
            </Link>
            <Link
              to="/company-intelligence"
              className="text-[13.5px] font-semibold text-[var(--accent-interactive)]"
            >
              Company Intelligence
            </Link>
            <Link
              to="/b2b-business-network"
              className="text-[13.5px] font-medium transition-colors hover:text-[var(--accent-interactive)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Business Network
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg border transition-all cursor-pointer"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                background: 'var(--bg-surface)'
              }}
            >
              Sign In
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="px-4 py-2 text-[13px] font-semibold rounded-lg text-white transition-all cursor-pointer flex items-center gap-1.5"
              style={{
                background: 'var(--accent-interactive)',
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              Get Started
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO SECTION ══════════ */}
      <header className="pt-32 pb-20 px-6 relative border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[940px] mx-auto text-center">
          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="flex items-center justify-center gap-2 mb-6 text-[13px]">
            <Link to="/" className="text-[var(--accent-interactive)] hover:underline">
              Home
            </Link>
            <span style={{ color: 'var(--text-muted)' }}>/</span>
            <span style={{ color: 'var(--text-secondary)' }}>Company Intelligence</span>
          </nav>

          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase mb-6"
            style={{
              background: 'color-mix(in srgb, var(--accent-interactive) 10%, transparent)',
              color: 'var(--accent-interactive)',
              border: '1px solid color-mix(in srgb, var(--accent-interactive) 20%, transparent)'
            }}
          >
            <Compass size={13} />
            {companyContent.badge}
          </div>

          <h1
            className="text-[34px] sm:text-[46px] lg:text-[54px] font-bold tracking-tight leading-[1.12] mb-6"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.h1}
          </h1>

          <p
            className="text-[17px] sm:text-[20px] leading-relaxed max-w-[820px] mx-auto mb-8"
            style={{ color: 'var(--text-secondary)' }}
          >
            {companyContent.subtitle}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="px-6 py-3 rounded-xl font-semibold text-[14px] text-white flex items-center gap-2 shadow-sm transition-all cursor-pointer"
              style={{ background: 'var(--accent-interactive)' }}
            >
              Start Discovering Opportunities
              <ArrowRight size={16} />
            </button>
            <a
              href="#what-is-company-intelligence"
              className="px-6 py-3 rounded-xl font-semibold text-[14px] border transition-all"
              style={{
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)',
                background: 'var(--bg-surface)'
              }}
            >
              Read Company Intelligence Guide ↓
            </a>
          </div>

          {/* Positioning statement banner */}
          <div
            className="mt-12 p-4 rounded-xl border text-left max-w-[800px] mx-auto text-[13.5px] leading-relaxed flex items-start gap-3"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            <ShieldCheck size={20} className="text-[var(--accent-interactive)] shrink-0 mt-0.5" />
            <p>
              <strong style={{ color: 'var(--text-primary)' }}>EBEXTA Operating Principles:</strong> {companyContent.positioning}
            </p>
          </div>
        </div>
      </header>

      {/* ══════════ MAIN CONTENT ══════════ */}
      <main className="max-w-[940px] mx-auto px-6 py-16 space-y-24">

        {/* SECTION 1: What Is Company Intelligence? */}
        <section id={companyContent.section1.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section1.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section1.h2}
          </h2>
          {companyContent.section1.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
            {companyContent.section1.pillars.map((pil, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border flex flex-col justify-between"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div>
                  <span className="text-[12px] font-mono font-bold text-[var(--accent-interactive)] block mb-2">
                    {pil.num}
                  </span>
                  <h3 className="text-[16px] font-semibold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                    {pil.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {pil.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 2: What Is B2B Company Intelligence? */}
        <section id={companyContent.section2.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section2.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section2.h2}
          </h2>
          {companyContent.section2.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {companyContent.section2.dimensions.map((dim, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Building2 size={16} className="text-[var(--accent-interactive)]" />
                  <h3 className="text-[15.5px] font-semibold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {dim.label}
                  </h3>
                </div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {dim.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 3: What Information Matters When Researching a Company? */}
        <section id={companyContent.section3.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section3.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section3.h2}
          </h2>
          {companyContent.section3.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="space-y-4 mt-8">
            {companyContent.section3.layers.map((layer, idx) => (
              <div
                key={idx}
                className="p-5 sm:p-6 rounded-xl border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <h3 className="text-[17px] font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  <Layers size={17} className="text-[var(--accent-interactive)]" />
                  {layer.title}
                </h3>
                <p className="text-[14.5px] font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  {layer.summary}
                </p>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {layer.details}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 4: Company Intelligence vs Company Data */}
        <section id={companyContent.section4.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section4.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section4.h2}
          </h2>
          <p className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            {companyContent.section4.intro}
          </p>

          <div className="overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-left text-[13.5px] border-collapse" style={{ background: 'var(--bg-surface)' }}>
              <thead>
                <tr className="border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-elevated)' }}>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]" style={{ color: 'var(--text-muted)' }}>Dimension</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[11px]" style={{ color: 'var(--text-muted)' }}>Raw Company Data</th>
                  <th className="p-3.5 font-bold uppercase tracking-wider text-[11px] text-[var(--accent-interactive)]">B2B Company Intelligence</th>
                </tr>
              </thead>
              <tbody>
                {companyContent.section4.comparisonTable.map((row, idx) => (
                  <tr key={idx} className="border-b last:border-b-0" style={{ borderColor: 'var(--border-subtle)' }}>
                    <td className="p-3.5 font-semibold align-top" style={{ color: 'var(--text-primary)' }}>
                      {row.dimension}
                    </td>
                    <td className="p-3.5 align-top" style={{ color: 'var(--text-secondary)' }}>
                      {row.data}
                    </td>
                    <td className="p-3.5 align-top font-medium" style={{ color: 'var(--text-primary)' }}>
                      {row.intelligence}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="mt-6 p-4 rounded-xl border text-[13.5px] leading-relaxed"
            style={{
              background: 'color-mix(in srgb, var(--accent-interactive) 5%, transparent)',
              borderColor: 'color-mix(in srgb, var(--accent-interactive) 20%, transparent)',
              color: 'var(--text-primary)'
            }}
          >
            <strong>Key Distinction:</strong> {companyContent.section4.takeaway}
          </div>
        </section>

        {/* SECTION 5: How Company Signals Improve Company Research */}
        <section id={companyContent.section5.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section5.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section5.h2}
          </h2>
          {companyContent.section5.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {companyContent.section5.signalCategories.map((sig, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border flex flex-col justify-between"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Activity size={16} className="text-[var(--accent-interactive)]" />
                    <h3 className="text-[15.5px] font-semibold" style={{ color: 'var(--text-primary)', ...geist }}>
                      {sig.title}
                    </h3>
                  </div>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {sig.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <p className="mt-6 text-[13.5px] italic border-l-2 pl-3" style={{ color: 'var(--text-muted)', borderColor: 'var(--accent-interactive)' }}>
            {companyContent.section5.contextRule}
          </p>
        </section>

        {/* SECTION 6: Why Decision-Maker Context Matters */}
        <section id={companyContent.section6.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section6.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section6.h2}
          </h2>
          {companyContent.section6.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4 whitespace-pre-line" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="space-y-4 mt-8">
            {companyContent.section6.principles.map((pr, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <h3 className="text-[16px] font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  <Users2 size={16} className="text-[var(--accent-interactive)]" />
                  {pr.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {pr.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 7: How EBEXTA Approaches Company Intelligence */}
        <section id={companyContent.section7.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section7.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section7.h2}
          </h2>
          {companyContent.section7.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {companyContent.section7.phases.map((ph, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border flex flex-col justify-between"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div>
                  <span className="text-[12px] font-mono font-bold text-[var(--accent-interactive)] block mb-1">
                    {ph.phase}
                  </span>
                  <h3 className="text-[16px] font-semibold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                    {ph.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {ph.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div
            className="mt-8 p-5 rounded-xl border text-[13.5px] leading-relaxed"
            style={{
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-secondary)'
            }}
          >
            <h4 className="font-semibold text-[14px] mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
              <ShieldCheck size={16} className="text-[var(--accent-interactive)]" />
              {companyContent.section7.dataPhilosophy.title}
            </h4>
            <p>{companyContent.section7.dataPhilosophy.text}</p>
          </div>
        </section>

        {/* SECTION 8: From Company Research to Opportunity Discovery */}
        <section id={companyContent.section8.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section8.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section8.h2}
          </h2>
          {companyContent.section8.paragraphs.map((p, idx) => (
            <p key={idx} className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-4" style={{ color: 'var(--text-secondary)' }}>
              {p}
            </p>
          ))}

          <div className="space-y-3 mt-8">
            {companyContent.section8.steps.map((st, idx) => (
              <div
                key={idx}
                className="p-4 sm:p-5 rounded-xl border flex items-start gap-4"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 text-[13px] font-bold"
                  style={{
                    background: 'color-mix(in srgb, var(--accent-interactive) 10%, transparent)',
                    color: 'var(--accent-interactive)'
                  }}
                >
                  {idx + 1}
                </div>
                <div>
                  <h3 className="text-[15.5px] font-semibold mb-1" style={{ color: 'var(--text-primary)', ...geist }}>
                    {st.title}
                  </h3>
                  <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {st.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 9: Who Uses Company Intelligence? */}
        <section id={companyContent.section9.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section9.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section9.h2}
          </h2>
          <p className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            {companyContent.section9.intro}
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {companyContent.section9.audiences.map((aud, idx) => (
              <div
                key={idx}
                className="p-5 rounded-xl border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <h3 className="text-[16px] font-semibold mb-2 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  <Briefcase size={16} className="text-[var(--accent-interactive)]" />
                  {aud.role}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {aud.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* SECTION 10: Frequently Asked Questions */}
        <section id={companyContent.section10.id} className="scroll-mt-24">
          <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--accent-interactive)] mb-2">
            {companyContent.section10.badge}
          </div>
          <h2
            className="text-[26px] sm:text-[32px] font-bold tracking-tight mb-5"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {companyContent.section10.h2}
          </h2>
          <p className="text-[15.5px] sm:text-[16.5px] leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
            {companyContent.section10.intro}
          </p>

          <div className="space-y-3">
            {faqItems.map((item, idx) => (
              <FaqItem key={idx} question={item.q} answer={item.a} />
            ))}
          </div>
        </section>

        {/* SECTION 11: Discover Companies with EBEXTA */}
        <section
          id={companyContent.section11.id}
          className="rounded-2xl p-8 sm:p-12 text-center text-white relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, #091326 0%, #0d1f40 50%, #08214d 100%)',
            boxShadow: 'var(--shadow-lg)'
          }}
        >
          <div
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider uppercase mb-5"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              color: '#93c5fd',
              border: '1px solid rgba(255, 255, 255, 0.15)'
            }}
          >
            <Sparkles size={12} />
            {companyContent.section11.badge}
          </div>

          <h2
            className="text-[28px] sm:text-[36px] font-bold tracking-tight mb-4 text-white"
            style={geist}
          >
            {companyContent.section11.h2}
          </h2>

          <p className="text-[15px] sm:text-[17px] text-slate-300 max-w-[620px] mx-auto mb-8 leading-relaxed">
            {companyContent.section11.intro}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate(companyContent.section11.ctaUrl)}
              className="px-6 py-3 rounded-xl font-semibold text-[14px] text-slate-900 bg-white hover:bg-slate-100 transition-all cursor-pointer flex items-center gap-2"
            >
              {companyContent.section11.ctaText}
              <ArrowRight size={16} />
            </button>
            <Link
              to={companyContent.section11.secondaryCtaUrl}
              className="px-6 py-3 rounded-xl font-semibold text-[14px] text-white border border-slate-600 hover:bg-white/10 transition-all"
            >
              {companyContent.section11.secondaryCtaText}
            </Link>
          </div>
        </section>

        {/* ══════════ CROSS-CLUSTER TOPICAL AUTHORITY LINKS ══════════ */}
        <section className="pt-8 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <h3 className="text-[17px] font-semibold mb-4" style={{ color: 'var(--text-primary)', ...geist }}>
            EBEXTA B2B Intelligence & Signals Series
          </h3>
          <p className="text-[14px] leading-relaxed mb-6" style={{ color: 'var(--text-secondary)' }}>
            Explore how company intelligence connects with broader B2B business intelligence, observable buying signals, and intent evaluation across the EBEXTA knowledge cluster:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/b2b-business-intelligence"
              className="p-4 rounded-xl border transition-all hover:border-[var(--accent-interactive)] block group"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive)]">Foundation</span>
                <ArrowUpRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--accent-interactive)] transition-colors" />
              </div>
              <h4 className="text-[15px] font-semibold mb-1 group-hover:text-[var(--accent-interactive)] transition-colors" style={{ color: 'var(--text-primary)', ...geist }}>
                B2B Business Intelligence
              </h4>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Comprehensive guide to B2B business intelligence, company context, and opportunity discovery.
              </p>
            </Link>

            <Link
              to="/business-signals"
              className="p-4 rounded-xl border transition-all hover:border-[var(--accent-interactive)] block group"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive)]">Observable Activity</span>
                <ArrowUpRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--accent-interactive)] transition-colors" />
              </div>
              <h4 className="text-[15px] font-semibold mb-1 group-hover:text-[var(--accent-interactive)] transition-colors" style={{ color: 'var(--text-primary)', ...geist }}>
                B2B Buying Signals
              </h4>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                How observable corporate signals and changes indicate emerging commercial needs.
              </p>
            </Link>

            <Link
              to="/b2b-intent-intelligence"
              className="p-4 rounded-xl border transition-all hover:border-[var(--accent-interactive)] block group"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive)]">Commercial Intent</span>
                <ArrowUpRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--accent-interactive)] transition-colors" />
              </div>
              <h4 className="text-[15px] font-semibold mb-1 group-hover:text-[var(--accent-interactive)] transition-colors" style={{ color: 'var(--text-primary)', ...geist }}>
                B2B Intent Intelligence
              </h4>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Interpreting intent signals, avoiding surveillance pitfalls, and qualifying opportunities responsibly.
              </p>
            </Link>

            <Link
              to="/b2b-business-network"
              className="p-4 rounded-xl border transition-all hover:border-[var(--accent-interactive)] block group"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--accent-interactive)]">Engagement Layer</span>
                <ArrowUpRight size={15} className="text-[var(--text-muted)] group-hover:text-[var(--accent-interactive)] transition-colors" />
              </div>
              <h4 className="text-[15px] font-semibold mb-1 group-hover:text-[var(--accent-interactive)] transition-colors" style={{ color: 'var(--text-primary)', ...geist }}>
                B2B Business Network
              </h4>
              <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Connecting verified companies, sector leaders, and professionals for direct commercial engagement.
              </p>
            </Link>
          </div>
        </section>

      </main>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="border-t py-12 px-6" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1200px] mx-auto flex flex-col md:flex-row items-center justify-between gap-6 text-[13px]">
          <div className="flex items-center gap-3">
            <EbextaLogo variant="horizontal" size={24} priority />
            <span style={{ color: 'var(--text-muted)' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>B2B Company Intelligence & Business Network</span>
          </div>

          <div className="flex items-center gap-6 flex-wrap justify-center" style={{ color: 'var(--text-secondary)' }}>
            <Link to="/about" className="hover:text-[var(--accent-interactive)] transition-colors">About</Link>
            <Link to="/careers" className="hover:text-[var(--accent-interactive)] transition-colors">Careers</Link>
            <Link to="/b2b-business-intelligence" className="hover:text-[var(--accent-interactive)] transition-colors">Intelligence Guide</Link>
            <Link to="/business-signals" className="hover:text-[var(--accent-interactive)] transition-colors">Business Signals</Link>
            <Link to="/b2b-intent-intelligence" className="hover:text-[var(--accent-interactive)] transition-colors">Intent Intelligence</Link>
            <Link to="/company-intelligence" className="text-[var(--accent-interactive)] font-semibold">Company Intelligence</Link>
            <Link to="/b2b-business-network" className="hover:text-[var(--accent-interactive)] transition-colors">Business Network</Link>
            <Link to="/terms" className="hover:text-[var(--accent-interactive)] transition-colors">Terms</Link>
            <Link to="/privacy" className="hover:text-[var(--accent-interactive)] transition-colors">Privacy</Link>
            <Link to="/dpdp" className="hover:text-[var(--accent-interactive)] transition-colors">DPDP</Link>
          </div>

          <p style={{ color: 'var(--text-muted)' }}>
            © {new Date().getFullYear()} EBEXTA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
