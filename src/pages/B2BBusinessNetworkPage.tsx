import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  ChevronDown,
  ShieldCheck,
  Briefcase,
  Activity,
  Sparkles,
  Layers,
  Building2,
  ArrowUpRight,
  Network,
  Share2,
  Compass
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'
import networkContent from '../data/businessNetworkContent.json'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="border-b transition-colors"
      style={{ borderColor: 'var(--border-subtle)' }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full py-5 text-left flex items-center justify-between gap-4 cursor-pointer group"
        aria-expanded={open}
      >
        <span
          className="text-[16px] sm:text-[17px] font-semibold transition-colors group-hover:text-[var(--accent-interactive)]"
          style={{ color: 'var(--text-primary)', ...geist }}
        >
          {question}
        </span>
        <span
          className="p-1 rounded-md transition-transform duration-200 shrink-0"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: 'var(--text-muted)'
          }}
        >
          <ChevronDown size={18} />
        </span>
      </button>
      {open && (
        <div className="pb-5 pr-6 text-[14.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          <p>{answer}</p>
        </div>
      )}
    </div>
  )
}

export default function B2BBusinessNetworkPage() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // SEO document tags
  useEffect(() => {
    document.title = 'B2B Business Network & Business Connections | EBEXTA'

    const metaDesc = document.querySelector('meta[name="description"]')
    if (metaDesc) {
      metaDesc.setAttribute(
        'content',
        'Discover a B2B business network for finding companies, professionals and relevant business relationships. EBEXTA connects intelligence, signals, verification and engagement.'
      )
    }

    let canonical = document.querySelector('link[rel="canonical"]')
    if (!canonical) {
      canonical = document.createElement('link')
      canonical.setAttribute('rel', 'canonical')
      document.head.appendChild(canonical)
    }
    canonical.setAttribute('href', 'https://www.ebexta.com/b2b-business-network')

    // Inject JSON-LD Schema
    const scriptId = 'b2b-network-jsonld'
    let scriptTag = document.getElementById(scriptId) as HTMLScriptElement | null
    if (!scriptTag) {
      scriptTag = document.createElement('script')
      scriptTag.id = scriptId
      scriptTag.type = 'application/ld+json'
      scriptTag.text = JSON.stringify(networkContent.structuredData)
      document.head.appendChild(scriptTag)
    }

    return () => {
      const existing = document.getElementById(scriptId)
      if (existing) existing.remove()
    }
  }, [])

  const faqItems = networkContent.section10.faqs

  return (
    <div
      className="min-h-screen relative selection:bg-blue-500/10 selection:text-blue-500"
      style={{
        background: 'var(--bg-canvas, #ffffff)',
        color: 'var(--text-primary, #0f172a)'
      }}
    >
      {/* ══════════ STICKY HEADER ══════════ */}
      <nav
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 h-16 flex items-center"
        style={{
          background: scrolled ? 'var(--bg-surface)' : 'transparent',
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
              className="text-[13px] font-semibold transition-colors"
              style={{ color: 'var(--accent-interactive, #2563eb)' }}
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
          <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-[13px] flex-wrap" style={{ color: 'var(--text-muted)' }}>
            <Link to="/home" className="hover:text-[var(--accent-interactive)] transition-colors">Home</Link>
            <span>/</span>
            <Link to="/b2b-business-intelligence" className="hover:text-[var(--accent-interactive)] transition-colors">B2B Business Intelligence</Link>
            <span>/</span>
            <Link to="/business-signals" className="hover:text-[var(--accent-interactive)] transition-colors">Business Signals</Link>
            <span>/</span>
            <Link to="/b2b-intent-intelligence" className="hover:text-[var(--accent-interactive)] transition-colors">Intent Intelligence</Link>
            <span>/</span>
            <Link to="/company-intelligence" className="hover:text-[var(--accent-interactive)] transition-colors">Company Intelligence</Link>
            <span>/</span>
            <span style={{ color: 'var(--text-primary)' }}>B2B Business Network</span>
          </nav>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase"
            style={{ background: 'var(--accent-subtle, #eff6ff)', color: 'var(--accent-interactive, #2563eb)' }}>
            <Network size={13} />
            <span>{networkContent.badge}</span>
          </div>

          <h1
            className="text-[34px] sm:text-[46px] lg:text-[52px] font-extrabold tracking-tight leading-[1.12]"
            style={{ color: 'var(--text-primary)', ...geist }}
          >
            {networkContent.h1}
          </h1>

          <p
            className="text-[17px] sm:text-[19px] leading-relaxed max-w-[880px]"
            style={{ color: 'var(--text-secondary)' }}
          >
            {networkContent.subtitle}
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <button
              onClick={() => navigate('/signup')}
              className="premium-btn px-6 py-3 rounded-xl font-semibold text-[14px] flex items-center gap-2 cursor-pointer"
            >
              <span>Explore EBEXTA Platform</span>
              <ArrowRight size={16} />
            </button>
            <Link
              to="/company-intelligence"
              className="px-5 py-3 rounded-xl font-semibold text-[14px] border transition-colors inline-flex items-center gap-2"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)'
              }}
            >
              <span>Company Intelligence</span>
              <ArrowUpRight size={15} />
            </Link>
            <Link
              to="/b2b-intent-intelligence"
              className="px-5 py-3 rounded-xl font-semibold text-[14px] border transition-colors inline-flex items-center gap-2"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)'
              }}
            >
              <span>Intent Intelligence</span>
              <ArrowUpRight size={15} />
            </Link>
          </div>

          {/* Canonical Positioning Box */}
          <div
            className="p-5 sm:p-6 rounded-2xl border space-y-2 mt-4"
            style={{
              background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
              borderColor: 'rgba(37, 99, 235, 0.25)'
            }}
          >
            <div className="flex items-center gap-2 text-blue-600 font-bold text-[12px] uppercase tracking-wider">
              <ShieldCheck size={16} />
              <span>Ethical &amp; Transparent B2B Networking</span>
            </div>
            <p className="text-[14px] sm:text-[15px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
              {networkContent.positioning}
            </p>
          </div>
        </header>

        {/* ── SECTION 1: What Is a B2B Business Network? ── */}
        <section id={networkContent.section1.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section1.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section1.h2}
            </h2>
            {networkContent.section1.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-4">
            {networkContent.section1.pillars.map(pill => (
              <div
                key={pill.num}
                className="p-6 rounded-2xl border space-y-3"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="text-[13px] font-mono font-bold text-blue-500">{pill.num}</div>
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  {pill.title}
                </h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {pill.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 2: How Is a B2B Business Network Different from a General Social Network? ── */}
        <section id={networkContent.section2.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section2.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section2.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
              {networkContent.section2.intro}
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border" style={{ borderColor: 'var(--border-subtle)' }}>
            <table className="w-full text-left text-[14px]">
              <thead className="border-b" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
                <tr>
                  <th className="py-4 px-5 font-bold" style={{ color: 'var(--text-primary)' }}>Dimension</th>
                  <th className="py-4 px-5 font-bold text-red-600">General Social Network</th>
                  <th className="py-4 px-5 font-bold text-emerald-600">EBEXTA B2B Business Network</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {networkContent.section2.comparisonTable.map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-500/[0.02] transition-colors">
                    <td className="py-4 px-5 font-semibold" style={{ color: 'var(--text-primary)' }}>{row.dimension}</td>
                    <td className="py-4 px-5" style={{ color: 'var(--text-secondary)' }}>{row.social}</td>
                    <td className="py-4 px-5 font-medium" style={{ color: 'var(--text-primary)' }}>{row.b2b}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div
            className="p-5 rounded-xl border"
            style={{ background: 'var(--accent-subtle, #eff6ff)', borderColor: 'rgba(37, 99, 235, 0.25)' }}
          >
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              <strong>Key Distinction: </strong>{networkContent.section2.takeaway}
            </p>
          </div>
        </section>

        {/* ── SECTION 3: What Can Businesses Discover Through a B2B Network? ── */}
        <section id={networkContent.section3.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section3.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section3.h2}
            </h2>
            {networkContent.section3.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {networkContent.section3.categories.map((cat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500">
                  <Building2 size={18} />
                  <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {cat.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {cat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 4: Why Business Context Matters Before Making a Connection ── */}
        <section id={networkContent.section4.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section4.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section4.h2}
            </h2>
            {networkContent.section4.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 pt-2">
            {networkContent.section4.contextCards.map((card, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Compass size={17} />
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {card.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 5: From Business Signals to Relevant Connections ── */}
        <section id={networkContent.section5.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section5.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section5.h2}
            </h2>
            {networkContent.section5.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="space-y-4 pt-2">
            {networkContent.section5.signalWorkflows.map((item, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-3"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500">
                  <Activity size={18} />
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {item.signal}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  <strong>Operational Context: </strong>{item.meaning}
                </p>
                <div className="p-3 rounded-xl bg-blue-500/[0.04] border border-blue-500/20 text-[13.5px]" style={{ color: 'var(--text-primary)' }}>
                  <strong>Connection Action: </strong>{item.action}
                </div>
              </div>
            ))}
          </div>

          <div
            className="p-5 rounded-xl border"
            style={{ background: 'var(--accent-subtle, #eff6ff)', borderColor: 'rgba(37, 99, 235, 0.25)' }}
          >
            <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {networkContent.section5.caution}
            </p>
          </div>
        </section>

        {/* ── SECTION 6: How EBEXTA Connects Intelligence With Business Networking ── */}
        <section id={networkContent.section6.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section6.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section6.h2}
            </h2>
            {networkContent.section6.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
            {networkContent.section6.stages.map((st, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <span className="text-[11px] font-mono font-bold uppercase text-blue-500">{st.step}</span>
                <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  {st.title}
                </h3>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {st.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 7: Building Better B2B Business Relationships ── */}
        <section id={networkContent.section7.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section7.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section7.h2}
            </h2>
            {networkContent.section7.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {networkContent.section7.principles.map((pr, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-emerald-600">
                  <ShieldCheck size={18} />
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {pr.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {pr.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 8: Who Uses a B2B Business Network? ── */}
        <section id={networkContent.section8.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section8.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section8.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
              {networkContent.section8.intro}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
            {networkContent.section8.audiences.map((aud, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500 mb-1">
                  <Briefcase size={17} />
                  <h3 className="text-[17px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {aud.role}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {aud.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 9: How EBEXTA's Business Network Works ── */}
        <section id={networkContent.section9.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section9.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section9.h2}
            </h2>
            {networkContent.section9.paragraphs.map((p, idx) => (
              <p key={idx} className="text-[15px] sm:text-[16px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
                {p}
              </p>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 pt-2">
            {networkContent.section9.features.map((feat, idx) => (
              <div
                key={idx}
                className="p-6 rounded-2xl border space-y-2"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <div className="flex items-center gap-2 text-blue-500">
                  <Share2 size={17} />
                  <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                    {feat.title}
                  </h3>
                </div>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {feat.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* ── SECTION 10: Frequently Asked Questions ── */}
        <section id={networkContent.section10.id} className="space-y-6">
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-blue-500">
              {networkContent.section10.badge}
            </span>
            <h2 className="text-[26px] sm:text-[34px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              {networkContent.section10.h2}
            </h2>
            <p className="text-[15px] sm:text-[16px] leading-relaxed max-w-[820px]" style={{ color: 'var(--text-secondary)' }}>
              {networkContent.section10.intro}
            </p>
          </div>

          <div className="pt-2">
            {faqItems.map(faq => (
              <FaqItem key={faq.q} question={faq.q} answer={faq.a} />
            ))}
          </div>
        </section>

        {/* ── COMPLETE 5-PAGE TOPICAL AUTHORITY CLUSTER ── */}
        <section
          className="p-8 sm:p-10 rounded-3xl border space-y-6"
          style={{
            background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.05) 0%, rgba(16, 185, 129, 0.04) 100%)',
            borderColor: 'rgba(37, 99, 235, 0.25)'
          }}
        >
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider bg-blue-500/10 text-blue-600">
              <Layers size={13} />
              <span>Complete 5-Part Topical Authority Cluster</span>
            </div>
            <h3 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight" style={{ color: 'var(--text-primary)', ...geist }}>
              Explore EBEXTA's Complete B2B Intelligence &amp; Network Ecosystem
            </h3>
            <p className="text-[14.5px] leading-relaxed max-w-[840px]" style={{ color: 'var(--text-secondary)' }}>
              Gain complete commercial clarity across the five foundational layers of enterprise opportunity discovery, intelligence, verification, and bilateral networking:
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/b2b-business-intelligence"
              className="p-5 rounded-2xl border transition-all hover:border-blue-500 group flex flex-col justify-between"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase text-blue-500">Part 1 · Foundation</span>
                <h4 className="text-[15px] font-bold group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  B2B Business Intelligence
                </h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Comprehensive architecture for discovering and evaluating opportunities.
                </p>
              </div>
              <div className="pt-3 text-[12.5px] font-bold text-blue-500 flex items-center gap-1">
                <span>Read Guide</span>
                <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/business-signals"
              className="p-5 rounded-2xl border transition-all hover:border-blue-500 group flex flex-col justify-between"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase text-blue-500">Part 2 · Activity</span>
                <h4 className="text-[15px] font-bold group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Business Signals
                </h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Observable public corporate events, leadership moves, and hiring trends.
                </p>
              </div>
              <div className="pt-3 text-[12.5px] font-bold text-blue-500 flex items-center gap-1">
                <span>Read Guide</span>
                <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/b2b-intent-intelligence"
              className="p-5 rounded-2xl border transition-all hover:border-blue-500 group flex flex-col justify-between"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase text-blue-500">Part 3 · Interpretation</span>
                <h4 className="text-[15px] font-bold group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  B2B Intent Intelligence
                </h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Ethical, signal-driven interpretation of potential enterprise buyer interest.
                </p>
              </div>
              <div className="pt-3 text-[12.5px] font-bold text-blue-500 flex items-center gap-1">
                <span>Read Guide</span>
                <ArrowRight size={13} />
              </div>
            </Link>

            <Link
              to="/company-intelligence"
              className="p-5 rounded-2xl border transition-all hover:border-blue-500 group flex flex-col justify-between"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="space-y-1.5">
                <span className="text-[11px] font-mono font-bold uppercase text-blue-500">Part 4 · Research</span>
                <h4 className="text-[15px] font-bold group-hover:text-blue-500 transition-colors" style={{ color: 'var(--text-primary)' }}>
                  Company Intelligence
                </h4>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  In-depth organizational research, operational models, and decision-maker context.
                </p>
              </div>
              <div className="pt-3 text-[12.5px] font-bold text-blue-500 flex items-center gap-1">
                <span>Read Guide</span>
                <ArrowRight size={13} />
              </div>
            </Link>
          </div>
        </section>

        {/* ── SECTION 11: Call to Action (Connect Through the EBEXTA Business Network) ── */}
        <section
          id={networkContent.section11.id}
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
              <span>{networkContent.section11.badge}</span>
            </div>

            <h2 className="text-[28px] sm:text-[36px] font-extrabold text-white tracking-tight leading-tight" style={geist}>
              {networkContent.section11.h2}
            </h2>

            <p className="text-[15px] sm:text-[16.5px] leading-relaxed text-slate-300">
              {networkContent.section11.intro}
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button
                onClick={() => navigate(networkContent.section11.ctaUrl)}
                className="px-7 py-3.5 rounded-xl font-bold text-[14px] bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2 transition-all shadow-lg cursor-pointer"
              >
                <span>{networkContent.section11.ctaText}</span>
                <ArrowRight size={16} />
              </button>
              <Link
                to={networkContent.section11.secondaryCtaUrl}
                className="px-7 py-3.5 rounded-xl font-semibold text-[14px] bg-white/10 hover:bg-white/15 text-white border border-white/20 transition-all inline-flex items-center gap-2"
              >
                <span>{networkContent.section11.secondaryCtaText}</span>
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
            <Link to="/b2b-intent-intelligence" className="hover:text-[var(--text-primary)] transition-colors">Intent Intelligence</Link>
            <Link to="/company-intelligence" className="hover:text-[var(--text-primary)] transition-colors">Company Intelligence</Link>
            <Link to="/b2b-business-network" className="hover:text-[var(--text-primary)] transition-colors font-semibold" style={{ color: 'var(--accent-interactive, #2563eb)' }}>Business Network</Link>
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
