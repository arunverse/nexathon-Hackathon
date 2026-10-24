import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  Compass,
  FileSearch,
  CheckCircle2,
  Users2,
  TrendingUp,
  ShieldCheck,
  Building2,
  Briefcase,
  Layers,
  ArrowRight,
  Sparkles,
  ChevronDown
} from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'

const EASE = [0.16, 1, 0.3, 1] as const
const geist = { fontFamily: 'Geist, Inter, sans-serif' }

// ── FAQ Item Component ─────────────────────────────────────────────────────────
function AboutFaqItem({ question, answer, details }: { question: string; answer: string; details?: string[] }) {
  const [open, setOpen] = useState(false)

  return (
    <div className="border-b transition-colors" style={{ borderColor: 'var(--border-subtle)' }}>
      <button
        onClick={() => setOpen(prev => !prev)}
        className="w-full py-6 flex items-start justify-between gap-4 text-left group cursor-pointer"
        aria-expanded={open}
      >
        <h3
          className="text-[17px] md:text-[18px] font-semibold transition-colors group-hover:text-[var(--accent-interactive)]"
          style={{ color: 'var(--text-primary)', ...geist }}
        >
          {question}
        </h3>
        <span
          className="p-1.5 rounded-lg border transition-transform duration-200 shrink-0 mt-0.5"
          style={{
            background: 'var(--bg-elevated)',
            borderColor: 'var(--border-subtle)',
            color: 'var(--text-muted)',
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
          className="pb-6"
        >
          <p className="text-[15px] leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
            {answer}
          </p>
          {details && details.length > 0 && (
            <ul className="space-y-2 mt-3 pl-4 border-l-2" style={{ borderColor: 'var(--accent-interactive)' }}>
              {details.map((item, idx) => (
                <li key={idx} className="text-[14px] leading-normal" style={{ color: 'var(--text-muted)' }}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </motion.div>
      )}
    </div>
  )
}

export default function AboutPage() {
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const reveal = {
    initial: { opacity: 0, y: reduce ? 0 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.5, ease: EASE },
  }

  // JSON-LD Structured Data for AboutPage + Organization + WebSite + BreadcrumbList
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
        '@type': 'AboutPage',
        '@id': 'https://www.ebexta.com/about#webpage',
        url: 'https://www.ebexta.com/about',
        name: 'About EBEXTA | Business Intelligence Built for Better Business Opportunities',
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
        },
        breadcrumb: {
          '@id': 'https://www.ebexta.com/about#breadcrumb'
        }
      },
      {
        '@type': 'BreadcrumbList',
        '@id': 'https://www.ebexta.com/about#breadcrumb',
        itemListElement: [
          {
            '@type': 'ListItem',
            position: 1,
            name: 'Home',
            item: 'https://www.ebexta.com/'
          },
          {
            '@type': 'ListItem',
            position: 2,
            name: 'About',
            item: 'https://www.ebexta.com/about'
          }
        ]
      },
      {
        '@type': 'FAQPage',
        '@id': 'https://www.ebexta.com/about#faq',
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
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* ── JSON-LD Structured Data ── */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />

      {/* ══════════ STICKY NAVIGATION ══════════ */}
      <nav
        className="fixed top-0 left-0 w-full z-50 h-16 flex items-center transition-all"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg-base) 85%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        }}
      >
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate('/')} className="flex items-center gap-2 cursor-pointer">
              <EbextaLogo variant="horizontal" size={28} priority />
            </button>
          </div>

          <div className="hidden md:flex items-center gap-8">
            <button
              onClick={() => navigate('/#how')}
              className="text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              How it works
            </button>
            <button
              onClick={() => navigate('/#pricing')}
              className="text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Pricing
            </button>
            <button
              onClick={() => {
                const el = document.getElementById('faq')
                if (el) el.scrollIntoView({ behavior: 'smooth' })
                else navigate('/#faq')
              }}
              className="text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              FAQ
            </button>
            <button
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="text-[13px] font-bold cursor-pointer"
              style={{ color: 'var(--text-primary)' }}
            >
              About
            </button>
            <button
              onClick={() => navigate('/careers')}
              className="text-[13px] font-medium transition-colors cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-primary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
            >
              Careers
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/login')}
              className="ghost-btn text-[13px] font-semibold px-4 h-9 rounded-lg cursor-pointer"
            >
              Sign in
            </button>
            <button
              onClick={() => navigate('/signup')}
              className="premium-btn text-[13px] px-5 h-9 rounded-lg cursor-pointer"
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ SECTION 1 — HERO ══════════ */}
      <header className="relative pt-32 md:pt-40 pb-20 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        {/* Subtle background grid pattern */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage:
              'linear-gradient(var(--border-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            opacity: 0.35,
            maskImage: 'radial-gradient(circle at 50% 25%, black, transparent 75%)',
            WebkitMaskImage: 'radial-gradient(circle at 50% 25%, black, transparent 75%)',
          }}
        />

        <div className="max-w-[1100px] mx-auto px-6 relative text-center">
          {/* Visible Breadcrumb Navigation */}
          <motion.nav
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            aria-label="Breadcrumb"
            className="inline-flex items-center gap-2 text-[12px] font-medium mb-4"
            style={{ color: 'var(--text-muted)' }}
          >
            <button onClick={() => navigate('/')} className="hover:underline cursor-pointer transition-colors" style={{ color: 'var(--text-secondary)' }}>Home</button>
            <span className="opacity-40">/</span>
            <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>About</span>
          </motion.nav>

          <br />

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-[0.14em] uppercase mb-6"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-interactive)',
            }}
          >
            <Sparkles size={13} />
            <span>About EBEXTA</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.08, ease: EASE }}
            className="font-bold leading-[1.1] tracking-[-0.03em] max-w-[900px] mx-auto"
            style={{ ...geist, fontSize: 'clamp(34px, 5vw, 56px)' }}
          >
            Business Intelligence Built for Better Business Opportunities
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.16, ease: EASE }}
            className="text-[17px] md:text-[19px] leading-relaxed max-w-[820px] mx-auto mt-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.24, ease: EASE }}
            className="flex flex-wrap items-center justify-center gap-4 mt-8"
          >
            <button
              onClick={() => navigate('/signup')}
              className="premium-btn text-[15px] px-7 h-12 rounded-xl flex items-center gap-2 cursor-pointer"
            >
              Explore Platform
              <ArrowRight size={17} />
            </button>
            <a
              href="/#how"
              className="ghost-btn text-[15px] font-semibold px-7 h-12 rounded-xl flex items-center gap-2"
            >
              How It Works
            </a>
          </motion.div>
        </div>
      </header>

      {/* ══════════ SECTION 2 — WHAT IS EBEXTA? ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <div className="grid lg:grid-cols-12 gap-10 items-start">
            <div className="lg:col-span-5">
              <motion.div {...reveal}>
                <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
                  Direct Definition
                </p>
                <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight mb-5" style={geist}>
                  What is EBEXTA?
                </h2>
                <div className="p-6 rounded-2xl border" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                  <p className="text-[15px] md:text-[16px] leading-relaxed font-medium" style={{ color: 'var(--text-primary)' }}>
                    EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network.
                  </p>
                </div>
              </motion.div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.1 }}>
                <p className="text-[15px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Rather than serving as an undifferentiated contact directory, EBEXTA brings together continuous market intelligence and direct business networking into a unified operational workflow. It analyzes market signals and business requirements to clarify what companies need before outreach begins.
                </p>
              </motion.div>

              <div className="grid sm:grid-cols-2 gap-3 pt-3">
                {[
                  { title: 'Business Intelligence', desc: 'Synthesizes market signals, corporate events, and requirement indicators.' },
                  { title: 'Opportunity Discovery', desc: 'Identifies active buying and selling requirements across industry sectors.' },
                  { title: 'Decision-Maker Identification', desc: 'Maps relevant leadership and functional stakeholders accountable for the requirement.' },
                  { title: 'Evidence Verification', desc: 'Validates claims and public evidence to confirm requirement legitimacy.' },
                  { title: 'Business Networking', desc: 'Facilitates structured bilateral communication between verified counterparts.' },
                  { title: 'Contextual Engagement', desc: 'Enables purposeful, evidence-backed conversations that yield high response rates.' },
                ].map((item, idx) => (
                  <motion.div
                    key={item.title}
                    {...reveal}
                    transition={{ ...reveal.transition, delay: 0.1 + idx * 0.04 }}
                    className="p-4 rounded-xl border"
                    style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
                  >
                    <div className="text-[13px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      {item.title}
                    </div>
                    <div className="text-[12px] leading-normal" style={{ color: 'var(--text-muted)' }}>
                      {item.desc}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 3 — THE PROBLEM ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="max-w-[760px] mx-auto text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              The Underlying Friction
            </p>
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight" style={geist}>
              The Problem with Raw B2B Data
            </h2>
            <p className="text-[15px] md:text-[16px] leading-relaxed mt-4" style={{ color: 'var(--text-secondary)' }}>
              Modern businesses have access to millions of company records, yet data volume alone does not answer the fundamental questions necessary to initiate a viable commercial conversation.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                q: 'Which companies have genuine opportunities?',
                expl: 'Traditional lists present static firmographic data without revealing whether a company has an immediate commercial need or initiative.',
              },
              {
                q: 'Why does the opportunity exist?',
                expl: 'Without understanding the business catalyst—such as expansion, technology modernization, or scaling bottlenecks—outreach lacks relevance.',
              },
              {
                q: 'What business signal indicates the need?',
                expl: 'Opportunities stem from tangible events like hiring surges, funding rounds, regulatory shifts, or procurement announcements.',
              },
              {
                q: 'Is the requirement authentic and verified?',
                expl: 'Incomplete or unverified claims lead teams to waste valuable bandwidth pursuing non-existent or outdated requirements.',
              },
              {
                q: 'Who is the relevant decision-maker?',
                expl: 'Reaching a generic email or the wrong executive stalls deals. Conversations require the specific stakeholder who owns the outcome.',
              },
              {
                q: 'How to transition from data to engagement?',
                expl: 'Cold, untargeted pitches get ignored. Meaningful business conversations require context, verified facts, and bilateral relevance.',
              },
            ].map((item, idx) => (
              <motion.div
                key={item.q}
                {...reveal}
                transition={{ ...reveal.transition, delay: idx * 0.05 }}
                className="p-6 rounded-2xl border flex flex-col justify-between"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-4 text-[12px] font-mono font-bold"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                    0{idx + 1}
                  </div>
                  <h3 className="text-[15px] font-bold mb-2 leading-snug" style={{ color: 'var(--text-primary)', ...geist }}>
                    {item.q}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {item.expl}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 4 — HOW EBEXTA WORKS ══════════ */}
      <section className="py-24 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center max-w-[760px] mx-auto mb-16">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Core Operating Framework
            </p>
            <h2 className="text-[28px] md:text-[38px] font-bold tracking-tight" style={geist}>
              How EBEXTA Works
            </h2>
            <p className="text-[16px] font-mono font-bold mt-2" style={{ color: 'var(--accent-interactive)' }}>
              Discover → Understand → Verify → Engage
            </p>
            <p className="text-[15px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
              EBEXTA organizes B2B opportunity discovery into four interconnected stages, ensuring that every outreach effort is grounded in validated business context.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* STAGE 1: DISCOVER */}
            <motion.div
              {...reveal}
              className="p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  <Compass size={20} />
                </div>
                <div className="text-[10px] font-bold font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--accent-interactive)' }}>
                  Stage 01
                </div>
                <h3 className="text-[20px] font-bold mb-3" style={{ color: 'var(--text-primary)', ...geist }}>
                  Discover
                </h3>
                <p className="text-[14px] leading-relaxed mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Find companies with relevant business opportunities.
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Scan market sectors to identify businesses with active operational, technological, or strategic requirements matching your value proposition.
                </p>
              </div>
            </motion.div>

            {/* STAGE 2: UNDERSTAND */}
            <motion.div
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.08 }}
              className="p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  <FileSearch size={20} />
                </div>
                <div className="text-[10px] font-bold font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--accent-interactive)' }}>
                  Stage 02
                </div>
                <h3 className="text-[20px] font-bold mb-3" style={{ color: 'var(--text-primary)', ...geist }}>
                  Understand
                </h3>
                <p className="text-[14px] leading-relaxed mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Identify business signals, intent, needs and business context.
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Examine the underlying indicators, recent company developments, and specific operational hurdles that give rise to the opportunity.
                </p>
              </div>
            </motion.div>

            {/* STAGE 3: VERIFY */}
            <motion.div
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.16 }}
              className="p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[#10B981]" />
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10B981' }}>
                  <CheckCircle2 size={20} />
                </div>
                <div className="text-[10px] font-bold font-mono uppercase tracking-wider mb-1" style={{ color: '#10B981' }}>
                  Stage 03
                </div>
                <h3 className="text-[20px] font-bold mb-3" style={{ color: 'var(--text-primary)', ...geist }}>
                  Verify
                </h3>
                <p className="text-[14px] leading-relaxed mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Validate companies, evidence, requirements and relevant decision-makers.
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Cross-examine public evidence and confirm that stakeholder contact details and business requirements are genuine and reachable.
                </p>
              </div>
            </motion.div>

            {/* STAGE 4: ENGAGE */}
            <motion.div
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.24 }}
              className="p-6 rounded-2xl border flex flex-col justify-between relative overflow-hidden"
              style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="absolute top-0 left-0 right-0 h-1 bg-[var(--accent)]" />
              <div>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-5"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  <Users2 size={20} />
                </div>
                <div className="text-[10px] font-bold font-mono uppercase tracking-wider mb-1" style={{ color: 'var(--accent-interactive)' }}>
                  Stage 04
                </div>
                <h3 className="text-[20px] font-bold mb-3" style={{ color: 'var(--text-primary)', ...geist }}>
                  Engage
                </h3>
                <p className="text-[14px] leading-relaxed mb-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Engage with prospects and directly connect with relevant businesses, sector leaders and professionals in the EBEXTA network.
                </p>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Initiate context-aware discussions with the relevant functional leaders, converting intelligence into productive commercial partnerships.
                </p>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 5 — FROM BUSINESS SIGNAL TO OPPORTUNITY ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="max-w-[760px] mx-auto text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Intelligence Architecture
            </p>
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight" style={geist}>
              From Business Signal to Opportunity
            </h2>
            <p className="text-[15px] md:text-[16px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
              EBEXTA’s objective is not simply to provide more company records, but to help companies understand the context behind potential opportunities.
            </p>
          </motion.div>

          {/* Sequential Step Diagram */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { step: '01', title: 'Business Signal', desc: 'Market indicators, hiring changes, or expansions.' },
              { step: '02', title: 'Business Context', desc: 'Why the event creates a specific need.' },
              { step: '03', title: 'Potential Opportunity', desc: 'Matching requirement with capable providers.' },
              { step: '04', title: 'Verification', desc: 'Auditing claims, public links, and legitimacy.' },
              { step: '05', title: 'Decision-Maker', desc: 'Identifying the exact leader responsible.' },
              { step: '06', title: 'Business Engagement', desc: 'Constructive outreach with mutual context.' },
            ].map((node, i) => (
              <motion.div
                key={node.step}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.05 }}
                className="p-4 rounded-xl border flex flex-col justify-between"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div>
                  <span className="text-[10px] font-mono font-bold block mb-2" style={{ color: 'var(--accent-interactive)' }}>
                    {node.step}
                  </span>
                  <div className="text-[13px] font-bold leading-snug mb-2" style={{ color: 'var(--text-primary)' }}>
                    {node.title}
                  </div>
                  <div className="text-[11.5px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                    {node.desc}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 text-center">
            <Link
              to="/b2b-business-intelligence"
              className="inline-flex items-center gap-2 text-[13px] font-semibold text-blue-400 hover:text-blue-300 transition-colors cursor-pointer"
            >
              <span>Explore our comprehensive guide to B2B Business Intelligence &amp; Opportunity Discovery</span>
              <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 6 — WHAT EBEXTA HELPS COMPANIES DO ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="max-w-[760px] mx-auto text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Platform Capabilities
            </p>
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight" style={geist}>
              What EBEXTA Helps Companies Do
            </h2>
            <p className="text-[15px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
              Practical capabilities designed to accelerate B2B business development and partnership discovery.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: <Building2 size={20} />,
                title: 'Discover Relevant Companies',
                desc: 'Locate counterpart organizations aligned with your industry domain, service scope, and strategic parameters.',
              },
              {
                icon: <TrendingUp size={20} />,
                title: 'Detect Relevant Business Signals',
                desc: 'Identify timely growth events, team expansions, technical transitions, and stated business needs.',
              },
              {
                icon: <Layers size={20} />,
                title: 'Understand Company Context',
                desc: 'Gain insight into why a company is positioned to buy or partner before drafting an introductory message.',
              },
              {
                icon: <ShieldCheck size={20} />,
                title: 'Verify Information & Evidence',
                desc: 'Examine verifiable public evidence and corroborated contact data to avoid misdirected communication.',
              },
              {
                icon: <Briefcase size={20} />,
                title: 'Find Relevant Decision-Makers',
                desc: 'Connect with the specific founders, directors, or functional leads responsible for approving the initiative.',
              },
              {
                icon: <Users2 size={20} />,
                title: 'Build Relevant Business Relationships',
                desc: 'Foster durable, mutual commercial relationships through transparent bilateral networking.',
              },
            ].map((cap, idx) => (
              <motion.div
                key={cap.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: idx * 0.05 }}
                className="p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                >
                  {cap.icon}
                </div>
                <h3 className="text-[16px] font-bold mb-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  {cap.title}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {cap.desc}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 7 — WHO IS EBEXTA FOR? ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="max-w-[760px] mx-auto text-center mb-14">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Target Users
            </p>
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight" style={geist}>
              Who is EBEXTA Built For?
            </h2>
            <p className="text-[15px] leading-relaxed mt-3" style={{ color: 'var(--text-secondary)' }}>
              Built for commercial teams that prioritize verified precision and context-backed outreach over mass-blast communications.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              {
                role: 'B2B Sales Teams',
                benefit: 'Focus outreach on companies with clear commercial context and verified decision-maker details, reducing wasted sales cycles.',
              },
              {
                role: 'Business Development Teams',
                benefit: 'Identify high-alignment strategic partners, distribution allies, and ecosystem collaborators across target sectors.',
              },
              {
                role: 'Founders & Executives',
                benefit: 'Accelerate zero-to-one customer acquisition and partnership origination with verified counterpart discovery.',
              },
              {
                role: 'Growth & Revenue Leaders',
                benefit: 'Equip sales pipelines with verified intent signals and defensible market intelligence to improve conversion metrics.',
              },
              {
                role: 'Agencies & Consultancies',
                benefit: 'Discover businesses currently scaling operational demands that require specialized external expertise.',
              },
              {
                role: 'Solution Providers',
                benefit: 'Locate genuine buyers actively seeking technology, services, and industrial capabilities without competitive noise.',
              },
            ].map((u, i) => (
              <motion.div
                key={u.role}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.05 }}
                className="p-6 rounded-2xl border"
                style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}
              >
                <h3 className="text-[16px] font-bold mb-2.5 flex items-center gap-2" style={{ color: 'var(--text-primary)', ...geist }}>
                  <span className="w-2 h-2 rounded-full bg-[var(--accent-interactive)]" />
                  {u.role}
                </h3>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {u.benefit}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 8 — WHY "BUSINESS INTELLIGENCE & NETWORK"? ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1000px] mx-auto px-6">
          <motion.div {...reveal} className="text-center max-w-[760px] mx-auto mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Strategic Synthesis
            </p>
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight" style={geist}>
              Why "Business Intelligence &amp; Network"?
            </h2>
            <p className="text-[17px] font-medium mt-4 max-w-[680px] mx-auto" style={{ color: 'var(--accent-interactive)' }}>
              "Intelligence helps you understand where an opportunity exists. A network helps you act on it."
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-6">
            <motion.div
              {...reveal}
              className="p-8 rounded-2xl border"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  <FileSearch size={18} />
                </div>
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  Business Intelligence
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Provides the analytical foundation: understanding market requirements, detecting relevant business signals, deciphering corporate context, and identifying verified decision-makers.
              </p>
            </motion.div>

            <motion.div
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.1 }}
              className="p-8 rounded-2xl border"
              style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  <Users2 size={18} />
                </div>
                <h3 className="text-[18px] font-bold" style={{ color: 'var(--text-primary)', ...geist }}>
                  Business Network
                </h3>
              </div>
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Provides the operational bridge: enabling companies to transition from passive data observation to active, bilateral communication and trustworthy commercial engagement.
              </p>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ SECTION 9 — EBEXTA'S VISION ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[860px] mx-auto px-6 text-center">
          <motion.div {...reveal}>
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Looking Forward
            </p>
            <h2 className="text-[28px] md:text-[34px] font-bold tracking-tight mb-6" style={geist}>
              EBEXTA’s Vision
            </h2>
            <div className="p-8 rounded-2xl border text-left" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
              <p className="text-[16px] md:text-[17px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                We envision a business environment where companies can discover relevant opportunities based on real business context, understand why those opportunities exist, verify the information behind them, and connect directly with the right people.
              </p>
              <div className="h-px w-full my-5" style={{ background: 'var(--border-subtle)' }} />
              <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                By replacing unverified spam and speculative lead scraping with evidence-backed intelligence and verified bilateral discovery, EBEXTA aims to make commercial interactions higher signal, more productive, and respectful of every stakeholder’s time.
              </p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ══════════ SECTION 10 — FAQ (AEO & ENTITY STRUCTURED) ══════════ */}
      <section id="faq" className="py-24 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[800px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-12">
            <p className="text-[11px] font-bold tracking-[0.14em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
              Direct Answers
            </p>
            <h2 className="text-[28px] md:text-[36px] font-bold tracking-tight" style={geist}>
              Frequently Asked Questions
            </h2>
            <p className="text-[15px] mt-3" style={{ color: 'var(--text-secondary)' }}>
              Clear, factual information about EBEXTA’s platform, approach, and capabilities.
            </p>
          </motion.div>

          <motion.div {...reveal} style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <AboutFaqItem
              question="What is EBEXTA?"
              answer="EBEXTA is a B2B Business Intelligence and Business Network platform that helps companies discover opportunities, understand business signals and intent, verify companies and decision-makers, engage with prospects, and directly connect with businesses, sector leaders, and professionals who are part of the EBEXTA network."
            />

            <AboutFaqItem
              question="What does EBEXTA do?"
              answer="EBEXTA connects business opportunity discovery with real-time business signals, commercial intent, deep company context, multi-source verification, decision-maker identification, proactive engagement, and high-trust business networking."
            />

            <AboutFaqItem
              question="Who is EBEXTA for?"
              answer="EBEXTA is built for B2B companies, founders, enterprise sales teams, agency leaders, service providers, and business seekers looking to discover high-intent counterparties, verify decision-makers, and initiate genuine commercial conversations."
            />

            <AboutFaqItem
              question="What is B2B Business Intelligence?"
              answer="B2B Business Intelligence is the process of collecting, analyzing, and transforming public and commercial data—such as hiring surges, funding events, technology adoption, and organizational expansion—into actionable business insights that explain why and when a company is ready to buy or partner."
            />

            <AboutFaqItem
              question="What are business signals and intent?"
              answer="Business signals are real-time market indicators (e.g., leadership hiring, capital raises, regulatory filings, product expansions) that reveal a company's strategic priorities. Business intent measures how actively an organization is seeking solutions or allocating budget within a specific domain."
            />

            <AboutFaqItem
              question="How does EBEXTA help discover business opportunities?"
              answer="Instead of static contact directories, EBEXTA continuously scans market activity to surface companies experiencing specific commercial triggers. Every opportunity is presented with contextual evidence, timing relevance, and verified stakeholders."
            />

            <AboutFaqItem
              question="How does EBEXTA verify companies and decision-makers?"
              answer="EBEXTA validates companies through multi-source cross-referencing against official registries (MCA, GSTIN, corporate filings) and active digital presence. Decision-makers are verified to ensure current roles and valid, reachable communication channels."
            />

            <AboutFaqItem
              question="What does Discover → Understand → Verify → Engage mean?"
              answer="It is EBEXTA's 4-step intelligence pipeline: Discover identifies companies with relevant opportunities; Understand analyzes signals, intent, and needs; Verify validates company evidence and decision-makers; and Engage enables direct connection with verified businesses and professionals in the EBEXTA network."
            />

            <AboutFaqItem
              question="How does EBEXTA connect businesses?"
              answer="EBEXTA operates a bilateral business network where verified seekers and providers connect directly. Counterparties are matched based on mutual commercial alignment, verified identity, and active business needs rather than cold unsolicited outreach."
            />

            <AboutFaqItem
              question="How is EBEXTA different from a traditional lead database?"
              answer="Traditional lead databases sell static lists of contacts without context or timing, leading to cold outreach based on assumptions. EBEXTA begins with live opportunity discovery, unpacks verifiable business signals and intent, confirms key decision-makers, and facilitates direct high-trust bilateral connections."
            />
          </motion.div>
        </div>
      </section>

      {/* ══════════ FINAL CTA ══════════ */}
      <section className="py-20 border-b" style={{ borderColor: 'var(--border-subtle)', background: 'var(--navy)' }}>
        <div className="max-w-[800px] mx-auto px-6 text-center text-[#F5F3EF]">
          <motion.h2 {...reveal} className="text-[28px] md:text-[36px] font-bold tracking-tight mb-4" style={geist}>
            Discover Verified Business Opportunities with EBEXTA
          </motion.h2>
          <motion.p
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.1 }}
            className="text-[15px] md:text-[16px] leading-relaxed opacity-85 max-w-[600px] mx-auto mb-8"
          >
            Experience how verified bilateral intelligence transforms opportunity discovery into productive commercial relationships.
          </motion.p>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.2 }} className="flex flex-wrap items-center justify-center gap-4">
            <button
              onClick={() => navigate('/signup')}
              className="px-8 h-12 rounded-xl text-[14px] font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl cursor-pointer"
              style={{ background: '#F5F3EF', color: 'var(--navy)' }}
            >
              Get Started
              <ArrowRight size={16} />
            </button>
            <button
              onClick={() => navigate('/careers')}
              className="px-6 h-12 rounded-xl text-[14px] font-semibold inline-flex items-center gap-2 border border-white/20 hover:bg-white/10 transition-colors cursor-pointer"
              style={{ color: '#F5F3EF' }}
            >
              View Careers
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="py-12" style={{ borderTop: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <EbextaLogo variant="horizontal" size={26} />
            <span className="text-[11px] font-mono text-[var(--text-muted)]">B2B Business Intelligence &amp; Network</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button onClick={() => navigate('/')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Home</button>
            <button onClick={() => navigate('/')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>How it works</button>
            <button onClick={() => navigate('/')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Pricing</button>
            <button onClick={() => { const el = document.getElementById('faq'); if (el) el.scrollIntoView({ behavior: 'smooth' }); }} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>FAQ</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-[13px] font-bold cursor-pointer" style={{ color: 'var(--text-primary)' }}>About</button>
            <Link to="/careers" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Careers</Link>
            <Link to="/terms" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Terms</Link>
            <Link to="/privacy" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Privacy</Link>
            <Link to="/dpdp" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>DPDP</Link>
            <Link to="/b2b-business-intelligence" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Intelligence Guide</Link>
            <Link to="/business-signals" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Business Signals</Link>
            <Link to="/b2b-intent-intelligence" className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Intent Intelligence</Link>
          </div>

          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            © 2026 EBEXTA. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  )
}
