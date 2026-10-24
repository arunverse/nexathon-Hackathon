import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import {
  JOB_ROLES,
  CULTURE_PILLARS,
  WHY_EBEXTA_POINTS,
  type JobRole,
  type JobDepartment,
  type EmploymentType
} from '../lib/careersData'
import { RoleDrawer } from '../components/careers/RoleDrawer'
import { ApplyModal } from '../components/careers/ApplyModal'
import { EbextaLogo } from '../components/common/EbextaLogo'

const EASE = [0.16, 1, 0.3, 1] as const
const geist = { fontFamily: 'Geist, Inter, sans-serif' }

const DEPARTMENTS: JobDepartment[] = [
  'All',
  'Engineering',
  'Sales',
  'Marketing',
  'Business Development',
  'Internships'
]

export default function CareersPage() {
  const { roleSlug } = useParams<{ roleSlug?: string }>()
  const navigate = useNavigate()
  const reduce = useReducedMotion()

  const [selectedDept, setSelectedDept] = useState<JobDepartment>('All')
  const [selectedType, setSelectedType] = useState<'All' | EmploymentType>('All')
  const [activeRole, setActiveRole] = useState<JobRole | null>(null)
  const [applyRole, setApplyRole] = useState<JobRole | null>(null)
  const [applyModalOpen, setApplyModalOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // Scroll listener for sticky nav
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Deep-link matching for /careers/:roleSlug
  useEffect(() => {
    if (roleSlug) {
      const match = JOB_ROLES.find(r => r.slug === roleSlug)
      if (match) {
        setActiveRole(match)
      } else {
        setActiveRole(null)
      }
    } else {
      setActiveRole(null)
    }
  }, [roleSlug])

  const reveal = {
    initial: { opacity: 0, y: reduce ? 0 : 20 },
    whileInView: { opacity: 1, y: 0 },
    viewport: { once: true, margin: '-60px' },
    transition: { duration: 0.5, ease: EASE },
  }

  // Filter logic: accounts for departments and internship category
  const filteredRoles = JOB_ROLES.filter(r => {
    if (selectedDept === 'Internships') {
      return r.openForInterns || r.employmentType.includes('Internship')
    }
    if (selectedDept !== 'All' && r.department !== selectedDept) {
      return false
    }
    if (selectedType === 'Full-time') {
      return r.employmentType.includes('Full-time')
    }
    if (selectedType === 'Internship') {
      return r.openForInterns || r.employmentType.includes('Internship')
    }
    return true
  })

  function handleOpenRole(role: JobRole) {
    setActiveRole(role)
    if (roleSlug !== role.slug) {
      navigate(`/careers/${role.slug}`)
    }
  }

  function handleCloseRole() {
    setActiveRole(null)
    if (roleSlug) {
      navigate('/careers', { replace: true })
    }
  }

  function handleOpenApply(role?: JobRole) {
    setApplyRole(role ?? null)
    setActiveRole(null)
    setApplyModalOpen(true)
  }

  function handleCloseApply() {
    setApplyModalOpen(false)
    if (roleSlug) {
      navigate('/careers', { replace: true })
    }
  }

  function scrollToSection(id: string) {
    const el = document.getElementById(id)
    if (el) el.scrollIntoView({ behavior: 'smooth' })
  }

  // Structured Data (JSON-LD) authoritative management in head
  useEffect(() => {
    let script = document.getElementById('careers-jsonld') as HTMLScriptElement | null
    if (!script) {
      script = document.createElement('script')
      script.id = 'careers-jsonld'
      script.type = 'application/ld+json'
      document.head.appendChild(script)
    }

    if (activeRole) {
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'JobPosting',
        title: activeRole.title,
        description: `<h3>Role Overview</h3><p>${activeRole.overview}</p><h3>Key Responsibilities</h3><ul>${activeRole.responsibilities.map(r => `<li>${r}</li>`).join('')}</ul><h3>Requirements & Qualifications</h3><ul>${activeRole.requirements.map(r => `<li>${r}</li>`).join('')}</ul><h3>Nice to Have</h3><ul>${activeRole.niceToHave.map(r => `<li>${r}</li>`).join('')}</ul><h3>What You Will Learn & Gain</h3><ul>${activeRole.learnings.map(r => `<li>${r}</li>`).join('')}</ul>`,
        datePosted: '2026-10-10',
        employmentType: ['FULL_TIME', 'INTERN'],
        hiringOrganization: {
          '@type': 'Organization',
          name: 'EBEXTA',
          sameAs: 'https://www.ebexta.com',
          logo: 'https://www.ebexta.com/logo-mark.svg'
        },
        jobLocation: {
          '@type': 'Place',
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Bengaluru',
            addressRegion: 'Karnataka',
            addressCountry: 'IN'
          }
        },
        directApply: true,
        url: `https://www.ebexta.com/careers/${activeRole.slug}`
      }, null, 2)
    } else {
      script.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@graph': [
          {
            '@type': 'WebPage',
            '@id': 'https://www.ebexta.com/careers#webpage',
            url: 'https://www.ebexta.com/careers',
            name: 'Careers at EBEXTA | Build the Future of B2B Intelligence',
            description:
              'Join EBEXTA and help build the B2B Business Intelligence and Business Network platform connecting companies, sector leaders, and professionals across high-growth markets.',
            isPartOf: {
              '@id': 'https://www.ebexta.com/#website'
            },
            about: {
              '@id': 'https://www.ebexta.com/#organization'
            },
            publisher: {
              '@id': 'https://www.ebexta.com/#organization'
            }
          }
        ]
      }, null, 2)
    }

    return () => {
      if (!window.location.pathname.startsWith('/careers')) {
        script?.remove()
      }
    }
  }, [activeRole])

  return (
    <div
      className="min-h-screen overflow-x-hidden"
      style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}
    >
      {/* ══════════ STICKY NAV ══════════ */}
      <nav
        className="fixed top-0 left-0 w-full z-50 h-16 flex items-center transition-all"
        style={{
          background: scrolled ? 'color-mix(in srgb, var(--bg-base) 80%, transparent)' : 'transparent',
          backdropFilter: scrolled ? 'blur(12px)' : 'none',
          WebkitBackdropFilter: scrolled ? 'blur(12px)' : 'none',
          borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        }}
      >
        <div className="max-w-[1200px] mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate('/')}
              className="inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[12px] font-medium transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                color: 'var(--text-secondary)',
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
              }}
              title="Return to EBEXTA Home"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              Back to Home
            </button>

            <button onClick={() => navigate('/')} className="flex items-center gap-2.5 group text-left">
              <EbextaLogo variant="horizontal" size={28} priority />
              <span
                className="text-[11px] font-semibold px-2 py-0.5 rounded-full"
                style={{
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent-interactive)',
                  border: '1px solid var(--border-subtle)'
                }}
              >
                Careers
              </span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-7">
            <button
              onClick={() => scrollToSection('roles')}
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Open Roles
            </button>
            <button
              onClick={() => scrollToSection('why-ebexta')}
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
              style={{ color: 'var(--text-secondary)' }}
            >
              Why EBEXTA
            </button>
            <button
              onClick={() => scrollToSection('culture')}
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)] cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              Culture
            </button>
            <button
              onClick={() => navigate('/about')}
              className="text-[13px] font-medium transition-colors hover:text-[var(--text-primary)] cursor-pointer"
              style={{ color: 'var(--text-secondary)' }}
            >
              About
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => scrollToSection('roles')}
              className="px-4 h-9 rounded-lg text-[13px] font-bold inline-flex items-center gap-1.5 transition-all hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                color: 'var(--bg-elevated)',
              }}
            >
              View Roles
              <span className="material-symbols-outlined text-[15px]">arrow_downward</span>
            </button>
          </div>
        </div>
      </nav>

      {/* ══════════ HERO SECTION ══════════ */}
      <header className="relative pt-32 md:pt-40 pb-20 overflow-hidden">
        {/* Ambient atmospheric glows */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[350px] bg-[radial-gradient(ellipse_at_center,var(--accent-subtle)_0%,transparent_70%)] pointer-events-none opacity-80" />
        <div className="absolute top-10 left-10 w-[300px] h-[300px] bg-[radial-gradient(circle,rgba(56,189,248,0.04)_0%,transparent_70%)] pointer-events-none" />
        
        <div className="max-w-[1100px] mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold uppercase tracking-[0.08em] mb-6"
            style={{
              background: 'var(--accent-subtle)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--accent-interactive)'
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-interactive)] animate-pulse" />
            We Are Hiring Across Engineering, Growth & Business
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1, ease: EASE }}
            className="text-[38px] sm:text-[48px] md:text-[58px] font-bold tracking-tight leading-[1.08] max-w-[850px] mx-auto"
            style={geist}
          >
            Build What's Next at{' '}
            <span className="bg-gradient-to-r from-[var(--text-primary)] via-[var(--text-secondary)] to-[var(--accent-interactive)] bg-clip-text text-transparent">
              EBEXTA
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2, ease: EASE }}
            className="text-[16px] sm:text-[18px] md:text-[19px] leading-relaxed max-w-[680px] mx-auto mt-6"
            style={{ color: 'var(--text-secondary)' }}
          >
            Join EBEXTA and work on technology, growth, and business opportunities that turn ideas into products and real-world impact.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: EASE }}
            className="flex flex-wrap items-center justify-center gap-4 mt-8"
          >
            <button
              onClick={() => scrollToSection('roles')}
              className="px-6 h-12 rounded-xl text-[14px] font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                color: 'var(--bg-elevated)',
              }}
            >
              View Open Roles
              <span className="material-symbols-outlined text-[17px]">arrow_forward</span>
            </button>

            <button
              onClick={() => scrollToSection('why-ebexta')}
              className="px-6 h-12 rounded-xl text-[14px] font-semibold transition-all border hover:border-[var(--border-strong)]"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)',
                color: 'var(--text-primary)'
              }}
            >
              Why EBEXTA?
            </button>
          </motion.div>

          {/* Quick Metrics Strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4, ease: EASE }}
            className="grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[820px] mx-auto mt-16 pt-8 border-t"
            style={{ borderColor: 'var(--border-subtle)' }}
          >
            {[
              { label: 'Open Positions', val: '5 Roles (All Open for Interns)' },
              { label: 'Work Mode', val: 'Bengaluru / Hybrid' },
              { label: 'Domain', val: 'Verified B2B Intel' },
              { label: 'Team Culture', val: 'High Ownership' }
            ].map(m => (
              <div key={m.label} className="p-3">
                <div className="text-[18px] font-bold tracking-tight" style={{ ...geist, color: 'var(--text-primary)' }}>
                  {m.val}
                </div>
                <div className="text-[11px] font-medium uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>
                  {m.label}
                </div>
              </div>
            ))}
          </motion.div>
        </div>
      </header>

      {/* ══════════ WHY EBEXTA SECTION ══════════ */}
      <section id="why-ebexta" className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-16">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
            >
              Why Join Us
            </span>
            <h2 className="text-[30px] md:text-[38px] font-bold mt-3 tracking-tight" style={geist}>
              Work on Problems That Matter
            </h2>
            <p className="text-[15px] max-w-[580px] mx-auto mt-3" style={{ color: 'var(--text-secondary)' }}>
              We are building serious bilateral intelligence technology that replaces cold, noisy outreach with high-confidence, verified business discovery.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {WHY_EBEXTA_POINTS.map((pt, i) => (
              <motion.div
                key={pt.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                className="p-6 rounded-2xl border transition-all duration-200 hover:-translate-y-1 hover:shadow-lg flex flex-col justify-between"
                style={{
                  background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div>
                  <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mb-4"
                    style={{
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--accent-interactive)'
                    }}
                  >
                    <span className="material-symbols-outlined text-[20px]">{pt.icon}</span>
                  </div>
                  <h3 className="text-[16px] font-bold tracking-tight mb-2" style={geist}>
                    {pt.title}
                  </h3>
                  <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    {pt.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════ CULTURE & PHILOSOPHY SECTION ══════════ */}
      <section id="culture" className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-16">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
            >
              Working Philosophy
            </span>
            <h2 className="text-[30px] md:text-[38px] font-bold mt-3 tracking-tight" style={geist}>
              How We Build & Collaborate
            </h2>
            <p className="text-[15px] max-w-[560px] mx-auto mt-3" style={{ color: 'var(--text-secondary)' }}>
              Our values are not poster slogans: they guide everyday decisions, architecture reviews, and customer conversations.
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {CULTURE_PILLARS.map((pillar, i) => (
              <motion.div
                key={pillar.title}
                {...reveal}
                transition={{ ...reveal.transition, delay: i * 0.08 }}
                className="p-6 rounded-2xl border transition-all duration-200 hover:border-[var(--border-strong)]"
                style={{
                  background: 'var(--bg-elevated)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                  >
                    {pillar.title}
                  </span>
                </div>
                <h3 className="text-[15px] font-bold tracking-tight mt-2 mb-2" style={{ color: 'var(--text-primary)' }}>
                  {pillar.tagline}
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {pillar.description}
                </p>
              </motion.div>
            ))}

            {/* University & Internship Welcome Card */}
            <motion.div
              {...reveal}
              transition={{ ...reveal.transition, delay: 0.4 }}
              className="p-6 rounded-2xl border flex flex-col justify-between"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.06))',
                borderColor: 'rgba(37,99,235,0.25)'
              }}
            >
              <div>
                <span
                  className="text-[11px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                  style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}
                >
                  STUDENTS & FRESHERS
                </span>
                <h3 className="text-[15px] font-bold tracking-tight mt-3 mb-2" style={{ color: 'var(--text-primary)' }}>
                  Grounded In Real-World Industry Exposure
                </h3>
                <p className="text-[12.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  We work closely with university graduates, researchers, and internship candidates. We evaluate based on problem-solving speed, curiosity, and code/execution ability rather than pedigree.
                </p>
              </div>
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex items-center gap-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined text-[14px]">school</span>
                Institutional & VTU internship evaluation compliant
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ══════════ OPEN POSITIONS SECTION ══════════ */}
      <section id="roles" className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6">
          <motion.div {...reveal} className="text-center mb-12">
            <span
              className="text-[10px] font-bold uppercase tracking-[0.1em] px-2.5 py-1 rounded-full"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
            >
              Current Opportunities
            </span>
            <h2 className="text-[30px] md:text-[38px] font-bold mt-3 tracking-tight" style={geist}>
              Open Positions
            </h2>
            <p className="text-[15px] max-w-[540px] mx-auto mt-3" style={{ color: 'var(--text-secondary)' }}>
              Explore active roles at EBEXTA. Every role works directly on core technology, market development, and product growth.
            </p>
          </motion.div>

          {/* Department & Type Filters */}
          <div className="flex flex-col items-center gap-3 mb-10">
            {/* Departments */}
            <div className="flex flex-wrap items-center justify-center gap-2">
              {DEPARTMENTS.map(dept => {
                const active = selectedDept === dept
                return (
                  <button
                    key={dept}
                    onClick={() => setSelectedDept(dept)}
                    className="px-4 py-2 rounded-xl text-[12px] font-semibold transition-all"
                    style={
                      active
                        ? { background: 'var(--accent)', color: 'var(--bg-elevated)', boxShadow: 'var(--shadow-sm)' }
                        : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }
                    }
                  >
                    {dept}
                    {dept === 'All' && ` (${JOB_ROLES.length})`}
                    {dept === 'Internships' && ` (${JOB_ROLES.filter(r => r.openForInterns).length})`}
                  </button>
                )
              })}
            </div>

            {/* Employment Type Toggle */}
            <div
              className="inline-flex items-center p-1 rounded-xl border text-[11px] font-semibold uppercase tracking-wider"
              style={{
                background: 'var(--bg-elevated)',
                borderColor: 'var(--border-subtle)'
              }}
            >
              {(['All', 'Full-time', 'Internship'] as const).map(type => {
                const active = selectedType === type
                return (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className="px-3 py-1 rounded-lg transition-all"
                    style={
                      active
                        ? { background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--border-subtle)' }
                        : { color: 'var(--text-muted)' }
                    }
                  >
                    {type}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Job Cards Grid */}
          <div className="space-y-4">
            {filteredRoles.length > 0 ? (
              filteredRoles.map((job, i) => (
                <motion.div
                  key={job.id}
                  {...reveal}
                  transition={{ ...reveal.transition, delay: i * 0.05 }}
                  onClick={() => handleOpenRole(job)}
                  className="p-6 md:p-7 rounded-2xl border transition-all duration-200 cursor-pointer hover:border-[var(--border-strong)] hover:shadow-md group flex flex-col md:flex-row md:items-center justify-between gap-6"
                  style={{
                    background: 'linear-gradient(145deg, var(--bg-surface), var(--bg-elevated))',
                    borderColor: 'var(--border-subtle)'
                  }}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span
                        className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider"
                        style={{
                          background: 'var(--accent-subtle)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--accent-interactive)'
                        }}
                      >
                        {job.department}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        Full-time
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-semibold inline-flex items-center gap-1"
                        style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', color: 'var(--success)' }}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                        Internship Available
                      </span>
                      <span
                        className="px-2 py-0.5 rounded-md text-[10px] font-medium"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                      >
                        {job.location}
                      </span>
                    </div>

                    <h3
                      className="text-[18px] md:text-[20px] font-bold tracking-tight group-hover:text-[var(--accent-interactive)] transition-colors"
                      style={geist}
                    >
                      <Link
                        to={`/careers/${job.slug}`}
                        onClick={e => {
                          e.stopPropagation()
                          handleOpenRole(job)
                        }}
                        className="hover:underline focus:outline-none"
                        style={{ color: 'inherit', textDecoration: 'none' }}
                      >
                        {job.title}
                      </Link>
                    </h3>
                    <p className="text-[13px] leading-relaxed mt-1 max-w-[720px]" style={{ color: 'var(--text-secondary)' }}>
                      {job.summary}
                    </p>

                    {/* Skill tags */}
                    <div className="flex flex-wrap items-center gap-1.5 mt-3">
                      {job.skills.slice(0, 5).map(s => (
                        <span
                          key={s}
                          className="px-2 py-0.5 rounded text-[10px] font-medium"
                          style={{
                            background: 'var(--bg-elevated)',
                            border: '1px solid var(--border-subtle)',
                            color: 'var(--text-muted)'
                          }}
                        >
                          {s}
                        </span>
                      ))}
                      {job.skills.length > 5 && (
                        <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                          +{job.skills.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Button */}
                  <div className="flex items-center gap-3 shrink-0">
                    <Link
                      to={`/careers/${job.slug}`}
                      onClick={e => {
                        e.stopPropagation()
                        handleOpenRole(job)
                      }}
                      className="px-5 h-10 rounded-xl text-[13px] font-semibold border transition-all inline-flex items-center gap-2 group-hover:border-[var(--accent-interactive)] group-hover:text-[var(--accent-interactive)] cursor-pointer"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)',
                        textDecoration: 'none'
                      }}
                    >
                      View Role
                      <span className="material-symbols-outlined text-[15px] transition-transform group-hover:translate-x-0.5">
                        arrow_forward
                      </span>
                    </Link>
                  </div>
                </motion.div>
              ))
            ) : (
              <div
                className="p-12 text-center rounded-2xl border space-y-3"
                style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}
              >
                <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--text-muted)' }}>
                  work_outline
                </span>
                <h4 className="text-[16px] font-bold" style={geist}>
                  No active listings in this category right now
                </h4>
                <p className="text-[13px] max-w-[400px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  We open internship and full-time cycles regularly. Submit a general application and our team will keep your profile on priority file.
                </p>
                <div className="pt-2">
                  <button
                    onClick={() => handleOpenApply()}
                    className="px-5 h-9 rounded-xl text-[12px] font-bold"
                    style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
                  >
                    Send General Application
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ══════════ FINAL CTA (GENERAL APPLICATION) ══════════ */}
      <section className="py-24 border-t" style={{ borderColor: 'var(--border-subtle)', background: 'var(--navy)' }}>
        <div className="max-w-[800px] mx-auto px-6 text-center text-[#F5F3EF]">
          <motion.h2 {...reveal} className="text-[30px] md:text-[38px] font-bold tracking-tight mb-4" style={geist}>
            Don't see your role?
          </motion.h2>
          <motion.p
            {...reveal}
            transition={{ ...reveal.transition, delay: 0.1 }}
            className="text-[15px] md:text-[16px] leading-relaxed opacity-85 max-w-[580px] mx-auto mb-8"
          >
            We're always interested in meeting people who can contribute to what we're building. Whether in data systems, research, consultative sales, or creative growth, reach out to us.
          </motion.p>
          <motion.div {...reveal} transition={{ ...reveal.transition, delay: 0.2 }}>
            <button
              onClick={() => handleOpenApply()}
              className="px-8 h-12 rounded-xl text-[14px] font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl"
              style={{ background: '#F5F3EF', color: 'var(--navy)' }}
            >
              Send Your Profile
              <span className="material-symbols-outlined text-[17px]">mail</span>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ══════════ FOOTER ══════════ */}
      <footer className="py-12 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[1100px] mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/')}>
            <EbextaLogo variant="horizontal" size={26} />
            <span className="text-[11px] font-mono text-[var(--text-muted)]">Verified Bilateral Intelligence</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
            <button onClick={() => navigate('/')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Home</button>
            <button onClick={() => navigate('/#how')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>How it works</button>
            <button onClick={() => navigate('/#pricing')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Pricing</button>
            <button onClick={() => navigate('/about')} className="text-[13px] font-medium cursor-pointer" style={{ color: 'var(--text-secondary)' }}>About</button>
            <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="text-[13px] font-bold cursor-pointer" style={{ color: 'var(--text-primary)' }}>Careers</button>
            <button onClick={() => navigate('/terms')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Terms</button>
            <button onClick={() => navigate('/privacy')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>Privacy</button>
            <button onClick={() => navigate('/dpdp')} className="text-[13px] cursor-pointer" style={{ color: 'var(--text-secondary)' }}>DPDP</button>
          </div>

          <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
            © 2026 EBEXTA. All rights reserved.
          </p>
        </div>
      </footer>

      {/* Role details slide-in drawer */}
      <RoleDrawer
        role={activeRole}
        onClose={handleCloseRole}
        onApply={role => handleOpenApply(role)}
      />

      {/* Application submission modal */}
      <ApplyModal
        role={applyRole}
        isOpen={applyModalOpen}
        onClose={handleCloseApply}
      />
    </div>
  )
}

