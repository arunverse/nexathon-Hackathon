import { Users, Zap, CheckCircle2, Target, Package, Building2, Search, Store, Download, RefreshCw, Info, X, PiggyBank, ArrowRightLeft, ChevronDown, PlusCircle, Star, Compass, Filter } from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/layout/Sidebar'
import { LeadCard, calculateRealisticMatchScore } from '../components/LeadCard'
import { CompareModal } from '../components/CompareModal'
import { ReviewModal } from '../components/ReviewModal'
import { fetchActiveProduct } from '../lib/productAnalysis'
import { InfoTip } from '../components/InfoTip'
import { ProductTour, TOUR_STEPS } from '../components/ProductTour'
import { HelpButton } from '../components/HelpButton'
import { useToast } from '../contexts/ToastContext'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { runScan, type ScannedLead } from '../lib/scanEngine'
import { exportLeadsToCSV } from '../lib/csvExport'
import { ProfileMenu } from '../components/layout/ProfileMenu'
import { UsageBanner } from '../components/UsageBanner'
import { DismissUndoToast } from '../components/DismissButton'
import { NotificationCenter } from '../components/NotificationCenter'
import { CompanyProfilePrompt } from '../components/CompanyProfilePrompt'

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO_LEADS: ScannedLead[] = [
  {
    id: 'd1', company_name: 'Zoho Payments', industry: 'Fintech & SaaS', location: 'Chennai, India',
    employee_count: 3200, funding_stage: 'Bootstrapped', annual_revenue: '$1.1B ARR',
    website: 'zoho.com', linkedin_url: 'linkedin.com/company/zoho',
    email: '', evidence_source_url: 'crunchbase.com/organization/zoho',
    recent_signals: ['Launched Zoho Payments enterprise suite', 'Expanded to 25 new markets, Q1 2025', 'Hiring 300+ engineers globally'],
    stakeholders: [{ name: 'Sridhar Vembu', title: 'CEO & Co-Founder', priority_score: 100 }],
    intent_score: 94, match_score: 96, confidence_score: 88,
    verification_status: 'VERIFIED', intent_flags: ['EXPANSION_SIGNAL', 'HIRING_SURGE'],
    validation_errors: [], strongly_recommended: true, trust_score: 100, created_at: new Date().toISOString(),
  },
  {
    id: 'd2', company_name: 'BrowserStack', industry: 'Developer Tools & QA', location: 'Mumbai, India',
    employee_count: 1100, funding_stage: 'Series B', annual_revenue: '$80M ARR',
    website: 'browserstack.com', linkedin_url: 'linkedin.com/company/browserstack',
    email: '', evidence_source_url: 'crunchbase.com/organization/browserstack',
    recent_signals: ['Expanding to APAC markets, Q1 2025', 'Partnership with Microsoft Azure'],
    stakeholders: [{ name: 'Ritesh Arora', title: 'CEO & Co-Founder', priority_score: 100 }],
    intent_score: 89, match_score: 91, confidence_score: 82,
    verification_status: 'VERIFIED', intent_flags: ['EXPANSION_SIGNAL', 'HIRING_SURGE'],
    validation_errors: [], strongly_recommended: false, trust_score: 85, created_at: new Date().toISOString(),
  },
  {
    id: 'd3', company_name: 'Chargebee', industry: 'B2B SaaS & Subscriptions', location: 'Chennai, India',
    employee_count: 620, funding_stage: 'Series H', annual_revenue: '$100M ARR',
    website: 'chargebee.com', linkedin_url: 'linkedin.com/company/chargebee',
    email: '', evidence_source_url: 'crunchbase.com/organization/chargebee',
    recent_signals: ['Crossed $100M ARR milestone', 'Hired VP Sales from Salesforce, Jan 2025'],
    stakeholders: [{ name: 'Krish Subramanian', title: 'CEO & Co-Founder', priority_score: 100 }],
    intent_score: 84, match_score: 86, confidence_score: 79,
    verification_status: 'PARTIALLY_VERIFIED', intent_flags: ['HIRING_SURGE'],
    validation_errors: ['EMAIL_UNVERIFIED'], strongly_recommended: false, trust_score: 81, created_at: new Date().toISOString(),
  },
  {
    id: 'd4', company_name: 'Freshworks', industry: 'CRM & Enterprise SaaS', location: 'Chennai, India',
    employee_count: 4900, funding_stage: 'Public', annual_revenue: '$600M ARR',
    website: 'freshworks.com', linkedin_url: 'linkedin.com/company/freshworks',
    email: '', evidence_source_url: 'crunchbase.com/organization/freshworks',
    recent_signals: ['Q3 2024 revenue up 22% YoY', 'Expanding AI product line'],
    stakeholders: [{ name: 'Dennis Woodside', title: 'CEO', priority_score: 100 }],
    intent_score: 81, match_score: 84, confidence_score: 91,
    verification_status: 'VERIFIED', intent_flags: ['EXPANSION_SIGNAL'],
    validation_errors: [], strongly_recommended: false, trust_score: 86, created_at: new Date().toISOString(),
  },
]

function sortLeads(leads: ScannedLead[], by: string) {
  return [...leads].sort((a, b) => {
    if (by === 'match') {
      const aScore = calculateRealisticMatchScore(a)
      const bScore = calculateRealisticMatchScore(b)
      return bScore - aScore
    }
    if (by === 'confidence') return b.confidence_score - a.confidence_score
    return b.intent_score - a.intent_score
  })
}

// Drop duplicate companies so the headline count never inflates (e.g. a
// EBEXTA-verified pool entry that overlaps a discovered lead). Keeps first seen.
function dedupeByCompany(list: ScannedLead[]): ScannedLead[] {
  const seen = new Set<string>()
  return list.filter(l => {
    const k = (l.company_name ?? '').trim().toLowerCase()
    if (!k) return true
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

// ─── Micro sparkline (decorative inline SVG) ─────────────────────────────────

function Sparkline({ color, value, id }: { color: string; value: number; id: string }) {
  // Derive 8 decorative data points from the value (visual only, not historical data)
  const seed = value || 10
  const points = [
    seed * 0.55, seed * 0.62, seed * 0.58, seed * 0.70,
    seed * 0.75, seed * 0.68, seed * 0.85, seed,
  ]
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1

  const W = 64, H = 24
  const coords = points.map((p, i) => ({
    x: (i / (points.length - 1)) * W,
    y: H - ((p - min) / range) * (H - 4) - 2,
  }))
  const path = coords.map((c, i) => `${i === 0 ? 'M' : 'L'}${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')
  const fillPath = `${path} L${W},${H} L0,${H} Z`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={`sg-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.16} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <motion.path
        d={fillPath}
        fill={`url(#sg-${id})`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, delay: 0.4 }}
      />
      <motion.path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
      />
      {/* Last point dot */}
      <motion.circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2.5}
        fill={color}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.4, type: 'spring' }}
      />
    </svg>
  )
}

// ─── Animated counter ─────────────────────────────────────────────────────────

function AnimCounter({ to, suffix = '', delay = 0 }: { to: number; suffix?: string; delay?: number }) {
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    let start: number | null = null
    const duration = 900
    const delayMs = delay * 1000

    const timer = setTimeout(() => {
      function step(ts: number) {
        if (!start) start = ts
        const progress = Math.min((ts - start) / duration, 1)
        const ease = 1 - Math.pow(1 - progress, 3)
        setDisplayed(Math.round(ease * to))
        if (progress < 1) requestAnimationFrame(step)
      }
      requestAnimationFrame(step)
    }, delayMs)

    return () => clearTimeout(timer)
  }, [to, delay])

  return <>{displayed}{suffix}</>
}

// ─── KPI stat card ────────────────────────────────────────────────────────────

interface StatConfig {
  label: string
  value: number
  suffix: string
  icon: React.ReactNode
  color: string
  bg: string
  border: string
  glow: string
  description: string
  trend: 'up' | 'stable'
}

function StatCard({ config, delay }: { config: StatConfig; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.16, 1, 0.3, 1] }}
      className="relative p-5 md:p-6 rounded-2xl overflow-hidden group transition-all duration-200"
      style={{
        background: 'var(--bg-elevated)',
        border: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div className="relative z-10">
        {/* Top row */}
        <div className="flex items-start justify-between mb-4">
          <span className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--text-muted)' }}>
            {config.label}
          </span>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center transition-colors"
            style={{
              background: config.bg,
              border: `1px solid ${config.border}`,
              color: config.color,
            }}
          >
            {config.icon}
          </div>
        </div>

        {/* Value + sparkline row */}
        <div className="flex items-end justify-between">
          <div>
            <div
              className="text-[28px] md:text-[32px] font-bold font-mono leading-none tracking-tight"
              style={{ color: 'var(--text-primary)' }}
            >
              <AnimCounter to={config.value} suffix={config.suffix} delay={delay} />
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                {config.description}
              </span>
            </div>
          </div>
          {/* Micro sparkline */}
          <div className="opacity-75 group-hover:opacity-100 transition-opacity">
            <Sparkline color={config.color} id={config.label.replace(/\s+/g, '')} value={config.value} />
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon, iconColor, title, subtitle, badge,
}: {
  icon: React.ReactNode; iconColor?: string; title: string; subtitle?: string; badge?: string
}) {
  const isStar = title.includes('Recommended')
  return (
    <div className="flex items-center gap-2.5 mb-5">
      <div
        className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
        style={{
          background: isStar ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-elevated)',
          border: isStar ? '1px solid rgba(217, 119, 6, 0.20)' : '1px solid var(--border-subtle)',
          color: isStar ? '#D97706' : (iconColor || 'var(--text-secondary)'),
          boxShadow: 'var(--shadow-sm)',
        }}
      >
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h2 className="text-[15px] font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
            {title}
          </h2>
          {badge && (
            <span
              className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full font-mono"
              style={{
                background: isStar ? 'rgba(217, 119, 6, 0.08)' : 'var(--bg-surface)',
                border: isStar ? '1px solid rgba(217, 119, 6, 0.20)' : '1px solid var(--border-subtle)',
                color: isStar ? '#B45309' : 'var(--text-muted)'
              }}
            >
              {badge}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{subtitle}</p>
        )}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function IntelligenceHub() {
  const navigate   = useNavigate()
  const { user }   = useAuth()

  // The fixed header's height changes with content (the targeting line wraps).
  // Measured so <main> never sits underneath it.
  const headerRef = useRef<HTMLElement | null>(null)
  const [headerHeight, setHeaderHeight] = useState(80)

  useEffect(() => {
    const el = headerRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      const h = entries[0]?.contentRect.height
      if (h) setHeaderHeight(Math.ceil(h))
    })
    ro.observe(el)
    setHeaderHeight(Math.ceil(el.getBoundingClientRect().height))
    return () => ro.disconnect()
  }, [])

  // Dismissed companies vanish from the grid immediately; the toast is the only
  // way back, so it has to be there.
  const [dismissedToast, setDismissedToast] = useState<ScannedLead | null>(null)

  const [leads, setLeads]               = useState<ScannedLead[]>([])
  const [loading, setLoading]           = useState(true)
  const [usingDemo, setUsingDemo]       = useState(false)
  const [generating, setGenerating]     = useState(false)
  const [generateStatus, setGenerateStatus] = useState('')
  const [sortBy, setSortBy]             = useState('intent')
  const [showAllLeads, setShowAllLeads] = useState(true)
  const [showBanner, setShowBanner]     = useState(true)
  const [mode, setMode]                 = useState<'seeker' | 'provider'>('seeker')
  const [needsScan, setNeedsScan]       = useState(false)
  const [compareOpen, setCompareOpen]   = useState(false)
  const [reviewOpen, setReviewOpen]     = useState(false)
  const [freshFundedOnly, setFreshFundedOnly] = useState(false)
  const [targeting, setTargeting]       = useState<{ type: 'company' | 'product'; label: string } | null>(null)
  const [tourOpen, setTourOpen]         = useState(false)
  const toast = useToast()

  // First-run product tour — shows once, then never again (replayable from Help/Settings).
  useEffect(() => {
    if (!user) return
    let alive = true
    async function checkTour() {
      try {
        if (localStorage.getItem('ebexta_replay_tour') === '1') {
          localStorage.removeItem('ebexta_replay_tour')
          if (alive) setTourOpen(true)
          return
        }
        if (localStorage.getItem('ebexta_tour_done') === '1') return
      } catch { /* ignore */ }
      // FAIL-SAFE: only open the tour when we POSITIVELY confirm it hasn't been
      // done — a real row, no query error, flag explicitly false. If the
      // migration hasn't run (column missing → error) or anything is off, we do
      // NOT open the tour, so a missing column can never block the dashboard.
      const { data, error } = await supabase.from('profiles').select('onboarding_tour_done').eq('id', user!.id).maybeSingle()
      if (alive && !error && data && data.onboarding_tour_done === false) setTourOpen(true)
    }
    checkTour()
    return () => { alive = false }
  }, [user])

  async function finishTour() {
    setTourOpen(false)
    try { localStorage.setItem('ebexta_tour_done', '1') } catch { /* ignore */ }
    if (user) await supabase.from('profiles').update({ onboarding_tour_done: true }).eq('id', user.id)
  }

  // What the user is taking to market — an active product, else their company.
  useEffect(() => {
    let alive = true
    async function loadTargeting() {
      let companyName = ''
      try { companyName = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}').companyName || '' } catch { /* ignore */ }
      if (user) {
        const p = await fetchActiveProduct(user.id)
        if (!alive) return
        if (p?.product_name) { setTargeting({ type: 'product', label: p.product_name }); return }
      }
      if (alive) setTargeting(companyName ? { type: 'company', label: companyName } : null)
    }
    loadTargeting()
    window.addEventListener('ebexta_profile_updated', loadTargeting)
    window.addEventListener('ebexta_mode_changed', loadTargeting)
    return () => {
      alive = false
      window.removeEventListener('ebexta_profile_updated', loadTargeting)
      window.removeEventListener('ebexta_mode_changed', loadTargeting)
    }
  }, [user])

  // ── Load leads — STRICTLY per-mode (Task 6: seekers never see seeker-side
  //    results, providers never see provider-side results) ──
  useEffect(() => {
    async function loadLeads() {
      // 1. Resolve mode from the SCAN FILTERS first — that is the exact mode the
      //    scan ran in and wrote its cache under (ebexta_leads_<mode>). Reading
      //    profiles.mode here can lag behind the scan and point the dashboard at
      //    the WRONG cache, so the user sees an empty "switch mode" screen even
      //    though their leads are cached. Fall back to the profile, then seeker.
      let currentMode: 'seeker' | 'provider' = 'seeker'
      let haveMode = false
      if (user) {
        try {
          const { data } = await supabase.from('profiles').select('mode').eq('id', user.id).maybeSingle()
          if (data?.mode === 'provider' || data?.mode === 'seeker') {
            currentMode = data.mode
            haveMode = true
          }
        } catch { /* default seeker */ }
      }
      if (!haveMode) {
        try {
          const f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
          if (f?.mode === 'provider' || f?.mode === 'seeker') currentMode = f.mode
        } catch { /* ignore */ }
      }
      setMode(currentMode)

      // 2. Per-mode local cache (ebexta_leads_seeker / ebexta_leads_provider)
      const modeKey = `ebexta_leads_${currentMode}`
      const cached = localStorage.getItem(modeKey)
      if (cached) {
        try {
          const parsed = dedupeByCompany(JSON.parse(cached) as ScannedLead[])
          if (parsed.length > 0) { setLeads(parsed); setLoading(false); return }
        } catch { /* fall through */ }
      }

      // 2b. Migrate the legacy single-key cache once — assume it belongs to the
      //     current mode, then remove it so the OTHER mode never sees it.
      const legacy = localStorage.getItem('ebexta_scan_results')
      if (legacy) {
        try {
          const parsed = dedupeByCompany(JSON.parse(legacy) as ScannedLead[])
          localStorage.removeItem('ebexta_scan_results')
          if (parsed.length > 0) {
            localStorage.setItem(modeKey, JSON.stringify(parsed))
            setLeads(parsed); setLoading(false); return
          }
        } catch { /* fall through */ }
      }

      // 3. Supabase reload — the account is the source of truth. The device
      //    cache above is just a fast path; if it's empty (fresh device, after
      //    a logout, cleared storage) we ALWAYS restore the user's generated
      //    leads from their account so nothing is ever lost on refresh/login.
      //    We look across the last few scans of this mode, not only the very
      //    latest — a latest scan that saved 0 rows must not hide earlier leads.
      if (user) {
        try {
          const { data: scans } = await supabase
            .from('scans').select('id').eq('user_id', user.id).eq('mode', currentMode)
            .order('created_at', { ascending: false }).limit(5)
          const scanIds = (scans ?? []).map(s => s.id).filter(Boolean)
          if (scanIds.length > 0) {
            const { data, error } = await supabase
              .from('leads').select('*').eq('user_id', user.id).in('scan_id', scanIds)
              .order('created_at', { ascending: false }).limit(40)
            if (!error && data && data.length > 0) {
              const deduped = dedupeByCompany(data as ScannedLead[]).slice(0, 20)
              localStorage.setItem(modeKey, JSON.stringify(deduped))
              setLeads(deduped); setLoading(false); return
            }
          }
        } catch { /* fall through */ }
      }

      // 4. No results for THIS mode → prompt to scan (never show the other
      //    mode's leads, never fake it with demo data for a switched mode)
      const otherKey = `ebexta_leads_${currentMode === 'seeker' ? 'provider' : 'seeker'}`
      if (localStorage.getItem(otherKey)) {
        setLeads([])
        setNeedsScan(true)
        setLoading(false)
        return
      }

      // 5. Brand-new account with no scans at all → demo preview
      setLeads(DEMO_LEADS)
      setUsingDemo(true)
      setLoading(false)
    }
    loadLeads()

    const handleModeOrProfileChange = () => {
      loadLeads()
    }

    window.addEventListener('ebexta_mode_changed', handleModeOrProfileChange)
    window.addEventListener('ebexta_profile_updated', handleModeOrProfileChange)
    window.addEventListener('storage', handleModeOrProfileChange)

    return () => {
      window.removeEventListener('ebexta_mode_changed', handleModeOrProfileChange)
      window.removeEventListener('ebexta_profile_updated', handleModeOrProfileChange)
      window.removeEventListener('storage', handleModeOrProfileChange)
    }
  }, [user])

  // Ensure a scan runs in the SAME mode the dashboard is showing. Previously the
  // empty-state / "New Scan" buttons jumped to /scan without syncing the display
  // mode into the scan filters, so a PROVIDER viewing an empty board could kick
  // off a SEEKER scan → board stayed empty → user had to switch mode and rescan
  // (the 2–3 clicks reported). Pinning the mode into filters + profile first
  // makes it a single click.
  function goScan(scanMode: 'seeker' | 'provider') {
    try {
      const f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
      f.mode = scanMode
      localStorage.setItem('ebexta_scan_filters', JSON.stringify(f))
    } catch {
      localStorage.setItem('ebexta_scan_filters', JSON.stringify({ mode: scanMode }))
    }
    if (user) void supabase.from('profiles').update({ mode: scanMode }).eq('id', user.id)
    localStorage.removeItem('ebexta_scan_results')
    navigate('/scan')
  }

  // ── Generate more ──
  async function handleGenerateMore() {
    if (!user || generating || usingDemo) return
    setGenerating(true)
    setGenerateStatus('Scanning for more leads…')
    try {
      const rawFilters = localStorage.getItem('ebexta_scan_filters')
      const filters    = rawFilters ? JSON.parse(rawFilters) : {}
      const excludeCompanies = leads.map(l => l.company_name)
      const newLeads = await runScan(
        { ...filters, excludeCompanies },
        user.id,
        (_step, msg) => setGenerateStatus(msg),
      )
      const existingNames = new Set(leads.map(l => l.company_name.toLowerCase()))
      const fresh = newLeads.filter(l => !existingNames.has(l.company_name.toLowerCase()))
      if (fresh.length > 0) {
        const modeKey = `ebexta_leads_${mode}`
        const existing: ScannedLead[] = JSON.parse(localStorage.getItem(modeKey) ?? '[]')
        localStorage.setItem(modeKey, JSON.stringify([...existing, ...fresh]))
        setLeads(prev => [...prev, ...fresh])
        setGenerateStatus(`${fresh.length} new leads added!`)
      } else {
        setGenerateStatus('No new leads found. Try broadening your filters.')
      }
    } catch (err) {
      // Surface the REAL reason (quota, rate limit, no results) instead of a
      // generic message — otherwise a quota failure looks like "nothing found".
      const raw = err instanceof Error ? err.message : String(err)
      setGenerateStatus(
        /quota|billing|check your plan/i.test(raw)
          ? "Daily EBEXTA Engine limit reached. Try again after the reset."
          : `Could not generate more: ${raw.slice(0, 120)}`
      )
      console.error(err)
    } finally {
      setGenerating(false)
      setTimeout(() => setGenerateStatus(''), 4000)
    }
  }

  // ── Derived ──
  // Freshly Funded = recently-funded companies (fresh budget, high intent).
  const isFreshlyFunded = (l: ScannedLead) =>
    (l.intent_flags ?? []).includes('RECENT_FUNDING') ||
    /rais(?:ed|e|ing)|series\s+[a-e]|\bseed\b|pre-seed|funding round|fresh(?:ly)?\s+fund/i.test(
      `${l.funding_details ?? ''} ${(l.recent_signals ?? []).join(' ')}`)
  const fundedCount = leads.filter(isFreshlyFunded).length
  const base = freshFundedOnly ? leads.filter(isFreshlyFunded) : leads
  /** Remove the card immediately — the promise is that it's gone for good. */
  function handleDismiss(lead: ScannedLead) {
    setLeads(prev => prev.filter(l => l.company_name !== lead.company_name))
    setDismissedToast(lead)
    setTimeout(() => setDismissedToast(null), 7000)
  }

  const recommended = base.filter(l => l.strongly_recommended)
  const others      = sortLeads(base.filter(l => !l.strongly_recommended), sortBy)
  // Show only 5 leads up front; the rest reveal on "Show all".
  const INITIAL_LEADS = 5
  const othersCap     = Math.max(0, INITIAL_LEADS - recommended.length)
  const visibleOthers = showAllLeads ? others : others.slice(0, othersCap)
  const hiddenCount   = others.length - visibleOthers.length

  const stats = {
    total:     leads.length,
    highIntent: leads.filter(l => l.intent_score > 88).length,
    verified:  leads.filter(l => l.verification_status === 'VERIFIED').length,
    avgConf:   leads.length > 0
      ? Math.round(leads.reduce((s, l) => s + (l.confidence_score || 0), 0) / leads.length)
      : 0,
  }

  const statCards: StatConfig[] = [
    {
      label: 'Total Leads',    value: stats.total,       suffix: '',  icon: <Users size={18} />,
      color: '#2563EB', bg: 'rgba(37,99,235,0.08)', border: 'rgba(37,99,235,0.18)',
      glow: 'transparent', description: 'in active pipeline', trend: 'up',
    },
    {
      label: 'High Intent',    value: stats.highIntent,  suffix: '',  icon: <Zap size={18} />,
      color: '#D97706', bg: 'rgba(217,119,6,0.08)',  border: 'rgba(217,119,6,0.20)',
      glow: 'transparent', description: 'intent score > 88', trend: 'up',
    },
    {
      label: 'Verified',       value: stats.verified,    suffix: '',  icon: <CheckCircle2 size={18} />,
      color: '#059669', bg: 'rgba(5,150,105,0.08)', border: 'rgba(5,150,105,0.20)',
      glow: 'transparent', description: 'confirmed leads', trend: 'up',
    },
    {
      label: 'Avg Confidence', value: stats.avgConf,     suffix: '%', icon: <Target size={18} />,
      color: '#4F46E5', bg: 'rgba(79,70,229,0.08)',  border: 'rgba(79,70,229,0.18)',
      glow: 'transparent', description: 'match confidence', trend: 'stable',
    },
  ]

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      {/* ── Ambient background ── (GPU-isolated; radial gradients are already
           soft so no costly blur() filters — keeps scrolling smooth) */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0" style={{ transform: 'translateZ(0)' }}>
        <div className="absolute -top-48 -left-24 w-[500px] h-[500px] rounded-full"
          style={{ background: 'radial-gradient(circle, var(--accent-subtle) 0%, transparent 70%)' }} />
        <div className="absolute -top-24 right-[15%] w-[380px] h-[380px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(147,165,180,0.05) 0%, transparent 70%)' }} />
        <div className="absolute bottom-0 left-[40%] w-[360px] h-[360px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(45,106,79,0.04) 0%, transparent 70%)' }} />
      </div>

      {/* ── Top bar ── */}
      <motion.header
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        ref={headerRef}
        className="fixed top-0 right-0 z-30 flex items-center justify-between gap-3 pl-16 pr-4 md:px-8 py-4 left-0 md:left-[240px]"
        style={{
          background: 'color-mix(in srgb, var(--bg-surface) 88%, transparent)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          transform: 'translateZ(0)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <div className="flex items-center gap-4">
          <div>
            <h1
              className="text-[20px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}
            >
              Intelligence Hub
            </h1>
            <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              {loading ? 'Loading…' : `${leads.length} opportunities discovered`}
            </p>
            {targeting && (
              <p className="text-[12px] mt-1 flex items-center gap-1.5 max-w-[380px]" style={{ color: 'var(--accent-interactive)' }}>
                <span className="flex items-center text-[14px]">{targeting.type === 'product' ? <Package size={14} /> : <Building2 size={14} />}</span>
                <span className="truncate">
                  {targeting.type === 'product'
                    ? `${mode === 'provider' ? 'Finding buyers for' : 'Finding providers of'}: `
                    : `${mode === 'provider' ? 'Finding clients for' : 'Finding providers for'}: `}
                  <strong style={{ color: 'var(--text-primary)' }}>{targeting.label}</strong>
                </span>
              </p>
            )}
          </div>

          {/* Current mode — always visible so users never lose track of which side they're seeing */}
          <div data-tour="mode" className="flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold shrink-0"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
            <span className="flex items-center text-[13px] text-[var(--text-muted)]">{mode === 'seeker' ? <Search size={13} /> : <Store size={13} />}</span>
            {mode === 'seeker' ? 'Seeker' : 'Provider'}
            <InfoTip term="seeker_provider" size={12} />
          </div>

          {!loading && leads.length > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.35 }}
              className="flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-semibold"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid var(--border-subtle)',
                color: 'var(--text-secondary)',
              }}
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: usingDemo ? '#D97706' : '#059669' }}
              />
              <span>{usingDemo ? 'DEMO MODE' : 'LIVE DATA'}</span>
              <span className="opacity-30">·</span>
              <span className="font-mono font-bold text-[var(--text-primary)]">{leads.length} matched</span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => { exportLeadsToCSV(leads); toast('CSV exported') }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-medium transition-all"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-secondary)',
            }}
          >
            <Download size={15}  />
            Export CSV
          </motion.button>

          <motion.button
            whileHover={{ scale: 1.02, boxShadow: '0 0 24px var(--accent-subtle)' }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              const ok = window.confirm(
                'Start a new scan?\n\nThis replaces your current leads with fresh ones. Any lead you have NOT saved (bookmark icon) cannot be retrieved afterward.\n\nSave the leads you want to keep first, then continue.'
              )
              if (!ok) return
              goScan(mode)
            }}
            data-tour="scan"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold"
            style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: 'var(--bg-elevated)' }}
          >
            <RefreshCw size={15}  />
            New Scan
          </motion.button>

          {/* Interactive Real Notification Center */}
          <NotificationCenter />

          {/* Profile button — dropdown with Settings + Admin Login */}
          <ProfileMenu />
        </div>
      </motion.header>

      {/* ── Main content ── */}
      {/* The header is fixed and its height VARIES — the targeting line wraps
          to two lines, and the subtitle changes. A static pt-[80px] meant
          content slid under it. Measure the real height instead. */}
      <main
        className="relative z-10 pb-20 px-4 md:px-10 ml-0 md:ml-[240px]"
        style={{ paddingTop: headerHeight + 32 }}
      >

        {/* ── Loading skeleton ── */}
        {loading && (
          <div className="grid grid-cols-2 gap-4 mt-8">
            {[1, 2, 3, 4].map(i => (
              <div
                key={i}
                className="h-52 rounded-2xl animate-pulse"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
              />
            ))}
          </div>
        )}

        {!loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* ── Status banner ── */}
            <AnimatePresence>
              {showBanner && leads.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -12, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: 'auto' }}
                  exit={{ opacity: 0, y: -8, height: 0 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="overflow-hidden"
                >
                  <div
                    className="mb-6 mt-4 px-4 py-3 rounded-xl flex items-center gap-3 text-[13px] bg-[var(--bg-elevated)] border border-[var(--border-subtle)] shadow-[var(--shadow-sm)]"
                  >
                    <span
                      className="flex items-center shrink-0"
                      style={{
                        color: usingDemo ? '#D97706' : '#059669'
                      }}
                    >
                      {usingDemo ? <Info size={16} /> : <CheckCircle2 size={16} />}
                    </span>
                    <span className="font-semibold text-[var(--text-primary)]">
                      {usingDemo ? 'Sample data active:' : 'Live scan results:'}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {usingDemo
                        ? 'Run your first scan to discover real matches.'
                        : `${leads.length} verified opportunities found for your profile`}
                    </span>
                    <button
                      onClick={() => setShowBanner(false)}
                      className="ml-auto p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors cursor-pointer"
                      title="Dismiss notification"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Usage / credit-limit notification ── */}
            <UsageBanner />

            {/* ── KPI stat cards ── */}
            <div className={`grid grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 ${showBanner ? 'mb-12' : 'mt-8 mb-12'}`}>
              {statCards.map((cfg, i) => (
                <StatCard key={cfg.label} config={cfg} delay={0.08 + i * 0.07} />
              ))}
            </div>

            {/* ── Empty state ── */}
            {leads.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center py-28 gap-5"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}
                >
                  <span className="flex items-center" style={{ color: 'var(--accent)' }}>
                    <Search size={32} />
                  </span>
                </div>
                <div className="text-center">
                  {needsScan ? (
                    <>
                      <p className="text-[17px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                        You switched to {mode.toUpperCase()} mode
                      </p>
                      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
                        Run a scan to find your {mode === 'seeker' ? 'providers' : 'clients'}. The other mode's leads stay saved under its own tab.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-[17px] font-bold mb-1" style={{ color: 'var(--text-primary)' }}>No leads yet</p>
                      <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Run a scan to find high-intent opportunities</p>
                    </>
                  )}
                </div>
                <motion.button
                  whileHover={{ scale: 1.03, boxShadow: '0 0 28px var(--accent-subtle)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => needsScan ? goScan(mode) : navigate('/onboarding')}
                  className="px-8 py-3 rounded-xl text-[14px] font-bold"
                  style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))', color: 'var(--bg-elevated)' }}
                >
                  {needsScan ? `Run ${mode === 'seeker' ? 'Provider' : 'Client'} Scan` : 'Start My First Scan'}
                </motion.button>
              </motion.div>
            )}

            {/* ── Strongly Recommended ── */}
            {recommended.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
                className="mb-10"
              >
                <SectionHeader
                  icon={<Star size={17} />}
                  iconColor="var(--warning)"
                  title="Strongly Recommended"
                  subtitle="Highest trust score · EBEXTA Engine verified opportunities"
                  badge={`${recommended.length} leads`}
                />
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {recommended.map((lead, i) => (
                    <div key={lead.id} data-tour={i === 0 ? 'lead-card' : undefined}>
                      <LeadCard lead={lead} index={i} onDismiss={handleDismiss} />
                    </div>
                  ))}
                </div>
              </motion.section>
            )}

            {/* ── All Matches ── */}
            {others.length > 0 && (
              <motion.section
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
              >
                <div className="flex items-center justify-between mb-5">
                  <SectionHeader
                    icon={recommended.length > 0 ? <Filter size={17} /> : <Compass size={17} />}
                    iconColor="var(--accent)"
                    title={recommended.length > 0 ? 'Matching Pipeline' : 'All Matches'}
                    badge={`${others.length}`}
                  />
                  <div className="flex items-center gap-2 shrink-0 -mt-5 flex-wrap justify-end pr-16">
                    {fundedCount > 0 && (
                      <button
                        onClick={() => setFreshFundedOnly(v => !v)}
                        title="Show only recently-funded companies (fresh budget)"
                        className="flex items-center gap-1.5 text-[12px] font-semibold rounded-xl px-3 py-2 transition-all"
                        style={freshFundedOnly
                          ? { background: 'var(--text-primary)', border: '1px solid var(--text-primary)', color: 'var(--bg-elevated)' }
                          : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        <PiggyBank size={15}  />
                        Freshly Funded
                        <span className="font-mono opacity-80">{fundedCount}</span>
                      </button>
                    )}
                    {leads.length >= 2 && (
                      <button
                        onClick={() => setCompareOpen(true)}
                        className="flex items-center gap-1.5 text-[12px] font-semibold rounded-xl px-3 py-2 transition-all cursor-pointer hover:bg-[var(--bg-surface)]"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                      >
                        <ArrowRightLeft size={15}  />
                        Compare
                      </button>
                    )}
                    <select
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                      className="text-[12px] rounded-xl px-3 py-2 outline-none cursor-pointer transition-all"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      <option value="intent">Sort: Intent Score</option>
                      <option value="match">Sort: Match Score</option>
                      <option value="confidence">Sort: Confidence</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {visibleOthers.map((lead, i) => (
                    <div key={lead.id} data-tour={recommended.length === 0 && i === 0 ? 'lead-card' : undefined}>
                      <LeadCard lead={lead} index={i + recommended.length} onDismiss={handleDismiss} />
                    </div>
                  ))}
                </div>
                {hiddenCount > 0 && (
                  <div className="flex justify-center mt-6">
                    <button
                      onClick={() => setShowAllLeads(true)}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
                    >
                      <ChevronDown size={16}  />
                      Show all {leads.length} leads ({hiddenCount} more)
                    </button>
                  </div>
                )}
              </motion.section>
            )}

            {/* ── Generate More ── */}
            {!usingDemo && leads.length > 0 && (
              <div className="mt-10 flex flex-col items-center gap-3">
                <AnimatePresence>
                  {generateStatus && (
                    <motion.p
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      className="text-[13px] font-medium"
                      style={{ color: 'var(--accent)' }}
                    >
                      {generateStatus}
                    </motion.p>
                  )}
                </AnimatePresence>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.9 }}
                  whileHover={{ scale: 1.01, borderColor: 'var(--accent-subtle)' }}
                  whileTap={{ scale: 0.99 }}
                  onClick={handleGenerateMore}
                  disabled={generating}
                  className="w-full py-4 rounded-2xl text-[13px] font-medium flex items-center justify-center gap-2 transition-all"
                  style={{
                    background: 'transparent',
                    border: `1px dashed ${generating ? 'var(--border-subtle)' : 'var(--accent-subtle)'}`,
                    color: generating ? 'var(--text-muted)' : 'var(--accent)',
                  }}
                >
                  {generating ? (
                    <>
                      <div
                        className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                        style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
                      />
                      {generateStatus || 'Scanning…'}
                    </>
                  ) : (
                    <>
                      <PlusCircle size={17}  />
                      Generate More Leads
                    </>
                  )}
                </motion.button>
              </div>
            )}

            {/* ── Footer ── */}
            <footer
              className="mt-14 pt-5 flex justify-between items-center px-1"
              style={{ borderTop: '1px solid var(--border-subtle)' }}
            >
              <span
                className="text-[10px] font-bold tracking-[0.15em] uppercase"
                style={{ color: 'var(--text-muted)' }}
              >
                EBEXTA
              </span>
              <div className="flex items-center gap-4">
                <button
                  onClick={() => setReviewOpen(true)}
                  className="flex items-center gap-1.5 text-[11px] font-semibold transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'var(--warning)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                >
                  <Star size={15}  />
                  Leave a review
                </button>
                {[{ l: 'Privacy', to: '/privacy' }, { l: 'Terms', to: '/terms' }, { l: 'Refund', to: '/refund' }].map(link => (
                  <button
                    key={link.l}
                    onClick={() => navigate(link.to)}
                    className="text-[10px] uppercase tracking-wider transition-colors"
                    style={{ color: 'var(--text-muted)' }}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    {link.l}
                  </button>
                ))}
              </div>
            </footer>
          </motion.div>
        )}
      </main>

      {compareOpen && leads.length >= 2 && (
        <CompareModal leads={leads} onClose={() => setCompareOpen(false)} />
      )}

      {tourOpen && !loading && <ProductTour steps={TOUR_STEPS} onFinish={finishTour} />}
      <HelpButton onStartTour={() => setTourOpen(true)} />

      {/* Undo — dismissal is permanent, so a mis-click needs a way back that
          doesn't involve hunting through Settings. */}
      {dismissedToast && (
        <DismissUndoToast
          companyName={dismissedToast.company_name}
          onUndone={() => setLeads(prev => [dismissedToast, ...prev])}
          onClose={() => setDismissedToast(null)}
        />
      )}

      {reviewOpen && user && (
        <ReviewModal
          userId={user.id}
          defaultName={user.user_metadata?.full_name || user.email?.split('@')[0]}
          defaultCompany={(() => { try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}').companyName || '' } catch { return '' } })()}
          onClose={() => setReviewOpen(false)}
        />
      )}

      {/* Gentle Company Profile Completion prompt after 5+ mins usage */}
      <CompanyProfilePrompt />
    </div>
  )
}
