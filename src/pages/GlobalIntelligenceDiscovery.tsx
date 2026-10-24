import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../components/layout/Sidebar'
import { cn } from '../lib/utils'
import type { ScannedLead } from '../lib/scanEngine'
import { getCachedLeads } from '../lib/loadLeads'

// ─── Types ────────────────────────────────────────────────────────────────────

interface NodeCard {
  id: string
  name: string
  category: string
  matchStrength: number
  activeSignals: number
  signalIcon: string
  status: 'Verified' | 'Pending'
  logoUrl?: string
  avatarCount: number
  // Filter-relevant fields derived from ScannedLead
  fundingStage: string
  intentFlags: string[]
  recentSignals: string[]
  trustScore: number
}

const filterChips = ['High Intent', 'Verified Only', 'Bilateral > 90%', 'New Signals']

// ─── Sub-components ───────────────────────────────────────────────────────────

function CompanyLogo({ url, name }: { url?: string; name: string }) {
  const [error, setError] = useState(false)
  if (!url || error) {
    return (
      <div className="w-full h-full flex items-center justify-center font-bold text-[16px] text-on-surface-variant">
        {name.charAt(0)}
      </div>
    )
  }
  return (
    <img src={url} alt={name} className="w-full h-full object-contain p-1" onError={() => setError(true)} />
  )
}

function AvatarStack({ count }: { count: number }) {
  const colors = ['bg-primary/30', 'bg-secondary/30', 'bg-tertiary-container/50']
  const show = Math.min(count, 3)
  return (
    <div className="flex -space-x-2">
      {Array.from({ length: show }).map((_, i) => (
        <div key={i} className={cn('w-6 h-6 rounded-full border border-background flex items-center justify-center text-[10px] text-on-surface-variant', colors[i] ?? 'bg-surface-variant')}>
          <span className="material-symbols-outlined text-[12px]">person</span>
        </div>
      ))}
      {count > 3 && (
        <div className="w-6 h-6 rounded-full bg-surface-variant border border-background flex items-center justify-center text-[10px] text-on-surface-variant">
          +{count - 3}
        </div>
      )}
    </div>
  )
}

function NodeCardComponent({ node, onView }: { node: NodeCard; onView: () => void }) {
  return (
    <div className="glass-card p-6 rounded-xl flex flex-col group hover:intent-glow transition-all duration-300">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-surface-container-highest rounded-lg border border-outline-variant overflow-hidden shrink-0">
            <CompanyLogo url={node.logoUrl} name={node.name} />
          </div>
          <div>
            <h3 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface group-hover:text-primary transition-colors" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
              {node.name}
            </h3>
            <p className="text-[14px] text-on-surface-variant">{node.category}</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <div className="text-primary text-[18px] font-bold" style={{ fontFamily: 'JetBrains Mono, monospace' }}>
            {node.matchStrength}%
          </div>
          <div className="text-[11px] font-bold leading-[1.2] tracking-[0.06em] text-on-surface-variant opacity-60 uppercase">
            Match Strength
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/30">
          <div className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase mb-1">Active Signals</div>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>{node.signalIcon}</span>
            <span className="text-on-surface text-[16px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{node.activeSignals} Active</span>
          </div>
        </div>
        <div className="p-4 bg-surface-container rounded-lg border border-outline-variant/30">
          <div className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase mb-1">Status</div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
            <span className="text-on-surface text-[16px]" style={{ fontFamily: 'JetBrains Mono, monospace' }}>{node.status}</span>
          </div>
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between">
        <AvatarStack count={node.avatarCount} />
        <button onClick={onView} className="flex items-center gap-2 text-primary font-semibold hover:gap-3 transition-all duration-200">
          View Deep Scan
          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
        </button>
      </div>
    </div>
  )
}

// ─── Accordion section header ─────────────────────────────────────────────────

function SectionAccordion({
  icon, label, sectionKey, expanded, onToggle, active, children,
}: {
  icon: string
  label: string
  sectionKey: string
  expanded: boolean
  onToggle: () => void
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-lg transition-colors', active && !expanded ? 'bg-secondary-container/10 border-r-2 border-primary' : '')}>
      <button
        onClick={onToggle}
        className="flex items-center justify-between w-full px-4 py-2.5 hover:bg-surface-variant/20 rounded-lg transition-colors"
      >
        <div className="flex items-center gap-2 text-primary">
          <span className="material-symbols-outlined text-[18px]">{icon}</span>
          <span className="text-[11px] font-bold tracking-[0.06em] uppercase">{label}</span>
        </div>
        <span
          className="material-symbols-outlined text-[16px] text-on-surface-variant transition-transform duration-200"
          style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }}
        >
          expand_more
        </span>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key={sectionKey}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            style={{ overflow: 'hidden' }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function GlobalIntelligenceDiscovery() {
  const navigate = useNavigate()
  const searchRef = useRef<HTMLInputElement>(null)

  // ── Core data ──
  const [nodes, setNodes] = useState<NodeCard[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [activeChips, setActiveChips] = useState<Set<string>>(new Set(['High Intent']))

  // ── Accordion state ──
  const [expandedSections, setExpandedSections] = useState<string[]>(['firmographics', 'intent'])
  function toggleSection(s: string) {
    setExpandedSections(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  // ── Firmographics filter state ──
  const [employeeRange, setEmployeeRange] = useState('500 - 1,000')

  // ── Intent Signals filter state ──
  const [intentChecks, setIntentChecks] = useState({ financial: true, tech: false })

  // ── Bilateral Strength filter state ──
  const [minMatchStrength, setMinMatchStrength] = useState(0)
  const [bilateralFilters, setBilateralFilters] = useState({ declared: false, strong: false, mutual: false })

  // ── Technographics filter state ──
  const [techFilters, setTechFilters] = useState<string[]>([])

  // ── Financials filter state ──
  const [fundingFilters, setFundingFilters] = useState<string[]>([])
  const [recentlyFundedOnly, setRecentlyFundedOnly] = useState(false)

  // ── Load real scan results (per-mode cache — same source as the dashboard) ──
  useEffect(() => {
    try {
        const leads = getCachedLeads<ScannedLead>().leads
        setNodes(leads.map((l, i) => ({
          id: l.id ?? String(i),
          name: l.company_name,
          category: l.industry,
          matchStrength: l.match_score ?? l.intent_score ?? 80,
          activeSignals: (l.intent_flags ?? []).length + (l.recent_signals ?? []).length,
          signalIcon: 'analytics',
          status: l.verification_status === 'VERIFIED' ? 'Verified' : 'Pending',
          logoUrl: undefined,
          avatarCount: (l.stakeholders ?? []).length,
          fundingStage: l.funding_stage ?? '',
          intentFlags: l.intent_flags ?? [],
          recentSignals: l.recent_signals ?? [],
          trustScore: l.trust_score ?? 0,
        })))
    } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  function toggleChip(label: string) {
    setActiveChips(prev => { const n = new Set(prev); n.has(label) ? n.delete(label) : n.add(label); return n })
  }

  // ── Filter logic ──────────────────────────────────────────────────────────
  const hasActiveFilters =
    minMatchStrength > 0 ||
    bilateralFilters.declared || bilateralFilters.strong || bilateralFilters.mutual ||
    techFilters.length > 0 ||
    fundingFilters.length > 0 ||
    recentlyFundedOnly ||
    searchQuery.trim().length > 0 ||
    activeChips.size > 0

  function clearFilters() {
    setMinMatchStrength(0)
    setBilateralFilters({ declared: false, strong: false, mutual: false })
    setTechFilters([])
    setFundingFilters([])
    setRecentlyFundedOnly(false)
    setSearchQuery('')
    setActiveChips(new Set())
    setIntentChecks({ financial: false, tech: false })
  }

  const filteredNodes = nodes.filter(c => {
    // Search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      if (!c.name.toLowerCase().includes(q) && !c.category.toLowerCase().includes(q)) return false
    }

    // Filter chips
    if (activeChips.has('High Intent') && c.activeSignals < 3) return false
    if (activeChips.has('Verified Only') && c.status !== 'Verified') return false
    if (activeChips.has('Bilateral > 90%') && c.matchStrength < 90) return false
    if (activeChips.has('New Signals') && c.intentFlags.length === 0) return false

    // Intent signals
    if (intentChecks.financial && !c.intentFlags.some(f => f.includes('FUNDING') || f.includes('FINANCIAL'))) return false
    if (intentChecks.tech && !c.intentFlags.some(f => f.includes('TECH') || f.includes('MIGRATION') || f.includes('EXPANSION'))) return false

    // Bilateral strength
    if (c.matchStrength < minMatchStrength) return false
    if (bilateralFilters.declared && c.trustScore !== 100) return false
    if (bilateralFilters.strong && c.matchStrength < 90) return false
    if (bilateralFilters.mutual && c.status !== 'Verified') return false

    // Technographics — check if recent signals mention any selected tech
    if (techFilters.length > 0) {
      const signalText = c.recentSignals.join(' ').toLowerCase() + ' ' + c.category.toLowerCase()
      const hasMatch = techFilters.some(t => signalText.includes(t.toLowerCase()))
      if (!hasMatch) return false
    }

    // Financials
    if (fundingFilters.length > 0) {
      const stage = c.fundingStage.toLowerCase()
      const stageMatch = fundingFilters.some(f => {
        const fl = f.toLowerCase()
        if (fl === 'seed') return stage.includes('seed') || stage.includes('pre-seed') || stage.includes('angel')
        if (fl === 'series a') return stage.includes('series a')
        if (fl === 'series b+') return stage.includes('series b') || stage.includes('series c') || stage.includes('series d') || stage.includes('series e') || stage.includes('series f') || stage.includes('series h')
        if (fl === 'bootstrapped') return stage.includes('bootstrap') || stage.includes('profitable')
        if (fl === 'public') return stage.includes('public') || stage.includes('ipo') || stage.includes('nyse') || stage.includes('nasdaq')
        return stage.includes(fl)
      })
      if (!stageMatch) return false
    }
    if (recentlyFundedOnly && !c.intentFlags.includes('RECENT_FUNDING')) return false

    return true
  })

  const TECH_OPTIONS = ['AWS', 'Azure', 'GCP', 'React', 'Salesforce', 'HubSpot', 'Kubernetes', 'Python']
  const FUNDING_STAGES = ['Seed', 'Series A', 'Series B+', 'Bootstrapped', 'Public']

  // ── Sidebar filter section style helpers ──────────────────────────────────
  const checkboxClass = 'accent-[#5B5BD6] cursor-pointer'
  const labelClass = 'flex items-center gap-2 cursor-pointer'
  const labelTextClass = 'text-xs text-[#A0A0C0]'
  const sectionHeadingClass = 'text-xs text-[var(--text-muted)] mb-2'

  return (
    <div className="min-h-screen bg-background text-on-background flex">
      <Sidebar />

      <div className="flex flex-col lg:flex-row ml-0 md:ml-[240px] min-h-screen min-w-0 overflow-x-hidden">

        {/* ── Deep Filters Sidebar — stacks on top below lg, sticky rail on lg+ ── */}
        <aside className="w-full lg:w-64 lg:h-screen lg:sticky lg:top-0 border-b lg:border-b-0 lg:border-r border-outline-variant bg-surface-container-low flex flex-col py-4 px-2 overflow-y-auto custom-scrollbar lg:shrink-0">

          {/* Header */}
          <div className="mb-4 px-4 flex items-center justify-between">
            <div>
              <h2 className="text-[18px] font-semibold tracking-[-0.01em] text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
                Deep Filters
              </h2>
              <p className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant mt-0.5 opacity-70 uppercase">
                Precision Matching
              </p>
            </div>
            {hasActiveFilters && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                onClick={clearFilters}
                className="text-[10px] font-bold px-2 py-1 rounded-md transition-colors"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent)', border: '1px solid var(--accent-subtle)' }}
              >
                Clear all
              </motion.button>
            )}
          </div>

          <nav className="flex-grow space-y-1">

            {/* ── 1. Firmographics ── */}
            <SectionAccordion icon="business" label="Firmographics" sectionKey="firmographics"
              expanded={expandedSections.includes('firmographics')} onToggle={() => toggleSection('firmographics')}
            >
              <div className="pl-8 pt-2 pb-3 space-y-3">
                <div>
                  <div className={sectionHeadingClass}>Employee Count</div>
                  <select
                    value={employeeRange}
                    onChange={e => setEmployeeRange(e.target.value)}
                    className="w-full bg-surface-container border border-outline-variant rounded-lg text-[12px] px-2 py-1.5 text-on-surface focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option>Any</option>
                    <option>1 - 50</option>
                    <option>50 - 200</option>
                    <option>200 - 500</option>
                    <option>500 - 1,000</option>
                    <option>1,000 - 5,000</option>
                    <option>5,000+</option>
                  </select>
                </div>
                <div>
                  <div className={sectionHeadingClass}>Revenue Range</div>
                  <div className="h-1.5 bg-surface-variant rounded-full overflow-hidden">
                    <div className="h-full bg-primary w-2/3 rounded-full" />
                  </div>
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                    <span>$0</span><span>$100M+</span>
                  </div>
                </div>
              </div>
            </SectionAccordion>

            {/* ── 2. Intent Signals ── */}
            <SectionAccordion icon="sensors" label="Intent Signals" sectionKey="intent"
              expanded={expandedSections.includes('intent')} onToggle={() => toggleSection('intent')}
              active={intentChecks.financial || intentChecks.tech}
            >
              <div className="pl-8 pt-2 pb-3 space-y-1.5">
                <label className={labelClass}>
                  <input type="checkbox" checked={intentChecks.financial} onChange={e => setIntentChecks(p => ({ ...p, financial: e.target.checked }))} className={checkboxClass} />
                  <span className={labelTextClass}>Financial Pulse</span>
                </label>
                <label className={labelClass}>
                  <input type="checkbox" checked={intentChecks.tech} onChange={e => setIntentChecks(p => ({ ...p, tech: e.target.checked }))} className={checkboxClass} />
                  <span className={labelTextClass}>Tech Expansion</span>
                </label>
              </div>
            </SectionAccordion>

            {/* ── 3. Bilateral Strength ── */}
            <SectionAccordion icon="handshake" label="Bilateral Strength" sectionKey="bilateral"
              expanded={expandedSections.includes('bilateral')} onToggle={() => toggleSection('bilateral')}
              active={minMatchStrength > 0 || bilateralFilters.declared || bilateralFilters.strong || bilateralFilters.mutual}
            >
              <div className="pl-8 pt-2 pb-3 space-y-3">
                <div>
                  <div className={sectionHeadingClass}>Minimum Match Strength</div>
                  <input
                    type="range"
                    min="0" max="100" step="10"
                    value={minMatchStrength}
                    onChange={e => setMinMatchStrength(Number(e.target.value))}
                    className="w-full accent-[#5B5BD6]"
                  />
                  <div className="flex justify-between text-[10px] text-[var(--text-muted)] mt-1">
                    <span>Any</span>
                    <span className="text-[var(--accent-interactive)] font-mono">{minMatchStrength}%+</span>
                  </div>
                </div>
                <div className="space-y-1.5">
                  {([
                    { key: 'declared', label: 'Declared Intent (100%)' },
                    { key: 'strong',   label: 'Strong Match (>90%)' },
                    { key: 'mutual',   label: 'Mutual Fit Confirmed' },
                  ] as const).map(opt => (
                    <label key={opt.key} className={labelClass}>
                      <input
                        type="checkbox"
                        checked={bilateralFilters[opt.key]}
                        onChange={e => setBilateralFilters(prev => ({ ...prev, [opt.key]: e.target.checked }))}
                        className={checkboxClass}
                      />
                      <span className={labelTextClass}>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </SectionAccordion>

            {/* ── 4. Technographics ── */}
            <SectionAccordion icon="terminal" label="Technographics" sectionKey="techno"
              expanded={expandedSections.includes('techno')} onToggle={() => toggleSection('techno')}
              active={techFilters.length > 0}
            >
              <div className="pl-8 pt-2 pb-3 space-y-1.5">
                <div className={sectionHeadingClass}>Filter by tech they use</div>
                {TECH_OPTIONS.map(tech => (
                  <label key={tech} className={labelClass}>
                    <input
                      type="checkbox"
                      checked={techFilters.includes(tech)}
                      onChange={e => setTechFilters(prev => e.target.checked ? [...prev, tech] : prev.filter(t => t !== tech))}
                      className={checkboxClass}
                    />
                    <span className={labelTextClass}>{tech}</span>
                  </label>
                ))}
              </div>
            </SectionAccordion>

            {/* ── 5. Financials ── */}
            <SectionAccordion icon="payments" label="Financials" sectionKey="financials"
              expanded={expandedSections.includes('financials')} onToggle={() => toggleSection('financials')}
              active={fundingFilters.length > 0 || recentlyFundedOnly}
            >
              <div className="pl-8 pt-2 pb-3 space-y-3">
                <div>
                  <div className={sectionHeadingClass}>Funding Stage</div>
                  <div className="space-y-1.5">
                    {FUNDING_STAGES.map(stage => (
                      <label key={stage} className={labelClass}>
                        <input
                          type="checkbox"
                          checked={fundingFilters.includes(stage)}
                          onChange={e => setFundingFilters(prev => e.target.checked ? [...prev, stage] : prev.filter(s => s !== stage))}
                          className={checkboxClass}
                        />
                        <span className={labelTextClass}>{stage}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <div className={sectionHeadingClass}>Recently Funded Only</div>
                  <label className={labelClass}>
                    <input
                      type="checkbox"
                      checked={recentlyFundedOnly}
                      onChange={e => setRecentlyFundedOnly(e.target.checked)}
                      className={checkboxClass}
                    />
                    <span className={labelTextClass}>Funded in last 12 months</span>
                  </label>
                </div>
              </div>
            </SectionAccordion>

          </nav>

          {/* Footer */}
          <div className="mt-auto border-t border-outline-variant pt-4 px-4">
            <button className="w-full bg-primary text-on-primary py-2 rounded-lg font-semibold text-[13px] hover:brightness-110 transition-all active:scale-[0.98]">
              Save Search
            </button>
            <div className="flex justify-between mt-4 text-on-surface-variant">
              <button className="flex items-center gap-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">help</span>
                <span className="text-[12px]">Help</span>
              </button>
              <button className="flex items-center gap-1 hover:text-primary transition-colors">
                <span className="material-symbols-outlined text-[18px]">history</span>
                <span className="text-[12px]">Logs</span>
              </button>
            </div>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main className="flex-grow p-6 overflow-y-auto custom-scrollbar">

          {/* Search Bar */}
          <div className="mb-6 relative">
            <div className="absolute inset-y-0 left-6 flex items-center pointer-events-none">
              <span className="material-symbols-outlined text-outline">search</span>
            </div>
            <input
              ref={searchRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Global Intelligence Search"
              className="w-full h-16 pl-16 pr-24 bg-surface-container-high border border-outline-variant rounded-xl text-[20px] focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-outline/50"
              style={{ fontFamily: 'Geist, Inter, sans-serif' }}
            />
            <div className="absolute inset-y-0 right-6 flex items-center gap-2 pointer-events-none">
              <kbd className="px-2 py-1 bg-surface-variant rounded border border-outline-variant text-[11px] text-on-surface-variant" style={{ fontFamily: 'JetBrains Mono, monospace' }}>Cmd</kbd>
              <span className="text-on-surface-variant">+</span>
              <kbd className="px-2 py-1 bg-surface-variant rounded border border-outline-variant text-[11px] text-on-surface-variant" style={{ fontFamily: 'JetBrains Mono, monospace' }}>K</kbd>
            </div>
          </div>

          {/* Filter Chips + Result Count */}
          <div className="flex flex-wrap gap-2 mb-6 items-center">
            {filterChips.map(chip => {
              const active = activeChips.has(chip)
              return (
                <button key={chip} onClick={() => toggleChip(chip)}
                  className={cn('px-4 py-2 rounded-full text-[11px] font-bold tracking-[0.06em] uppercase flex items-center gap-2 transition-all',
                    active ? 'bg-primary-container text-on-primary-container hover:brightness-110' : 'border border-outline-variant text-on-surface hover:bg-surface-variant/30'
                  )}
                >
                  {chip}
                  {chip === 'High Intent' && <span className="material-symbols-outlined text-[14px]">bolt</span>}
                </button>
              )
            })}
            <div className="flex-grow" />

            {/* Result count + clear */}
            <div className="flex items-center gap-3">
              <AnimatePresence>
                {hasActiveFilters && (
                  <motion.button
                    initial={{ opacity: 0, x: 8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 8 }}
                    onClick={clearFilters}
                    className="text-[11px] font-bold px-3 py-1.5 rounded-lg transition-colors"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}
                  >
                    Clear Filters
                  </motion.button>
                )}
              </AnimatePresence>
              <div className="text-on-surface-variant text-[13px] flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined text-[18px]">sort</span>
                <span className="font-mono font-bold" style={{ color: nodes.length > 0 ? 'var(--accent)' : undefined }}>
                  {filteredNodes.length}
                </span>
                <span>of {nodes.length} matches</span>
              </div>
            </div>
          </div>

          {/* Node Cards Grid */}
          {nodes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed border-outline-variant rounded-2xl">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant">scatter_plot</span>
              <p className="text-on-surface-variant text-[15px]">No leads yet: run a scan first</p>
              <button onClick={() => navigate('/scan')}
                className="px-6 py-3 bg-primary text-on-primary rounded-xl font-bold text-[14px] hover:brightness-110 transition-all">
                Run Scan
              </button>
            </div>
          ) : filteredNodes.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-24 gap-4 border-2 border-dashed border-outline-variant rounded-2xl"
            >
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant">filter_alt_off</span>
              <div className="text-center">
                <p className="text-on-surface font-semibold text-[15px] mb-1">No companies match these filters</p>
                <p className="text-on-surface-variant text-[13px]">Try loosening your criteria or clearing some filters</p>
              </div>
              <button
                onClick={clearFilters}
                className="px-5 py-2.5 rounded-xl font-bold text-[13px] hover:brightness-110 transition-all"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}
              >
                Clear All Filters
              </button>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <AnimatePresence>
                {filteredNodes.map(node => (
                  <motion.div
                    key={node.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.96 }}
                    transition={{ duration: 0.2 }}
                  >
                    <NodeCardComponent node={node} onView={() => navigate(`/dashboard/lead/${node.id}`)} />
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
