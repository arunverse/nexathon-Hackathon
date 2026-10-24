import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { InfoTip } from '../../components/InfoTip'
import { EbextaLogo } from '../../components/common/EbextaLogo'

// ── Default option lists ───────────────────────────────────────────────────────
const DEFAULT_INDUSTRIES    = ['SaaS', 'Healthcare', 'FinTech', 'E-commerce', 'Manufacturing', 'Education', 'Logistics', 'Hospitality', 'Real Estate', 'Media']
const DEFAULT_SIZES         = ['Startup (1–10)', 'Small (11–50)', 'Medium (51–200)', 'Large (201–500)', 'Enterprise (500+)']
const DEFAULT_REVENUE       = ['< ₹1 Cr', '₹1–10 Cr', '₹10–50 Cr', '₹50+ Cr']
const DEFAULT_STAGES        = ['Bootstrapped', 'Seed', 'Pre-Series A', 'Series A', 'Series B+', 'Mid-market', 'Enterprise']
const DEFAULT_SERVICE_CATS  = ['Digital Marketing', 'SEO', 'AI Development', 'Web Development', 'Mobile Apps', 'UI/UX', 'Branding', 'Recruitment', 'Cloud Services', 'Data Analytics', 'Cybersecurity', 'HR Tech']
const DEFAULT_BUDGET        = ['₹10K–50K', '₹50K–2L', '₹2L–10L', '₹10L+']
const DEFAULT_DURATIONS     = ['One Time', '1 Month', '3 Months', '6 Months', 'Long-Term', 'Retainer']
const DEFAULT_DM_ROLES      = ['Founder', 'CEO', 'CTO', 'CMO', 'CFO', 'COO', 'Head of Growth', 'Product Manager', 'VP Sales', 'Director']
const DEFAULT_DM_SENIORITY  = ['C-Level', 'VP', 'Director', 'Manager', 'Team Lead']

// ── EditablePillGroup ──────────────────────────────────────────────────────────
// Multi-select pills + inline "Add other…" tag input.
// Custom values are added to the options list AND auto-selected.
function EditablePillGroup({
  options,
  selected,
  onToggle,
  onAddCustom,
  placeholder = 'Add other…',
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  onAddCustom: (v: string) => void
  placeholder?: string
}) {
  const [input, setInput] = useState('')

  function commit() {
    const val = input.trim()
    if (!val) return
    onAddCustom(val)
    setInput('')
  }

  return (
    <div className="flex flex-wrap gap-2 items-center">
      {options.map(o => {
        const active = selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => onToggle(o)}
            className="px-3 py-1.5 rounded-full border text-[11px] font-bold tracking-[0.05em] transition-all active:scale-95 flex items-center gap-1.5"
            style={active ? {
              background: 'var(--accent-subtle)',
              borderColor: 'var(--accent)',
              color: '#5B3FA3',
              boxShadow: '0 0 8px var(--accent-subtle)',
            } : {
              background: 'var(--bg-surface)',
              borderColor: 'var(--border-subtle)',
              color: 'var(--text-muted)',
            }}
          >
            {active && (
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1 4l2 2 4-4" stroke="#5B3FA3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {o}
            {active && (
              <span
                className="ml-0.5 opacity-60 hover:opacity-100 text-[10px] leading-none"
                onClick={e => { e.stopPropagation(); onToggle(o) }}
              >✕</span>
            )}
          </button>
        )
      })}

      {/* Inline add input */}
      <div
        className="flex items-center gap-1 rounded-full border px-2 py-1 transition-all"
        style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}
      >
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
          placeholder={placeholder}
          className="bg-transparent outline-none text-[11px] font-semibold w-[100px] placeholder:text-[var(--text-muted)]"
          style={{ color: 'var(--text-secondary)' }}
        />
        {input.trim() && (
          <button
            type="button"
            onClick={commit}
            className="w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 transition-all"
            style={{ background: 'var(--accent)', color: '#fff' }}
          >+</button>
        )}
      </div>
    </div>
  )
}

// ── SingleOrMultiSelect — for Revenue / Budget / Duration ─────────────────────
// Was single-select radio. Now multi-select with Add Other.
function TagSelect({
  options,
  selected,
  onToggle,
  onAddCustom,
  placeholder = 'Add other…',
}: {
  options: string[]
  selected: string[]
  onToggle: (v: string) => void
  onAddCustom: (v: string) => void
  placeholder?: string
}) {
  return (
    <EditablePillGroup
      options={options}
      selected={selected}
      onToggle={onToggle}
      onAddCustom={onAddCustom}
      placeholder={placeholder}
    />
  )
}

function SectionLabel({ label, sub }: { label: string; sub?: string }) {
  return (
    <div className="mb-3">
      <p className="text-[10px] font-bold tracking-[0.1em] uppercase mb-0.5" style={{ color: 'var(--accent-interactive)' }}>{label}</p>
      {sub && <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  )
}

function Divider() {
  return <div className="h-px w-full my-1" style={{ background: 'var(--border-subtle)' }} />
}

// ── Main component ────────────────────────────────────────────────────────────
export default function OnboardingFilters() {
  const navigate = useNavigate()

  // Restore anything already entered (so going back from step 3 doesn't wipe it)
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { return {} }
  })()

  // Employee range — restore saved or default to 10–500
  const [empMin, setEmpMin] = useState<number>(() => {
    const val = Number(saved.employeeMin)
    return Number.isFinite(val) && val >= 1 ? val : 10
  })
  const [empMax, setEmpMax] = useState<number>(() => {
    const val = Number(saved.employeeMax)
    return Number.isFinite(val) && val >= 1 ? val : 500
  })

  // Company profile — all multi-select + custom
  const [industryOptions,  setIndustryOptions]  = useState<string[]>(() => {
    const custom = Array.isArray(saved.industries) ? (saved.industries as string[]) : []
    return Array.from(new Set([...DEFAULT_INDUSTRIES, ...custom]))
  })
  const [selectedIndustries, setSelectedIndustries] = useState<string[]>(() =>
    Array.isArray(saved.industries) ? (saved.industries as string[]) : []
  )

  const [sizeOptions, setSizeOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.companySizes) ? (saved.companySizes as string[]) : []
    return Array.from(new Set([...DEFAULT_SIZES, ...custom]))
  })
  const [selectedSizes, setSelectedSizes] = useState<string[]>(() =>
    Array.isArray(saved.companySizes) ? (saved.companySizes as string[]) : []
  )

  const [revenueOptions, setRevenueOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.revenueRanges) ? (saved.revenueRanges as string[]) : []
    return Array.from(new Set([...DEFAULT_REVENUE, ...custom]))
  })
  const [selectedRevenue, setSelectedRevenue] = useState<string[]>(() => {
    if (Array.isArray(saved.revenueRanges) && saved.revenueRanges.length > 0) return saved.revenueRanges as string[]
    if (saved.revenueRange) return [String(saved.revenueRange)]
    return []
  })

  const [stageOptions, setStageOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.companyStages) ? (saved.companyStages as string[]) : []
    return Array.from(new Set([...DEFAULT_STAGES, ...custom]))
  })
  const [selectedStages, setSelectedStages] = useState<string[]>(() =>
    Array.isArray(saved.companyStages) && saved.companyStages.length > 0
      ? (saved.companyStages as string[])
      : ['Series A', 'Series B+']
  )

  // Service filters
  const [serviceCatOptions, setServiceCatOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.serviceCategories) ? (saved.serviceCategories as string[]) : []
    return Array.from(new Set([...DEFAULT_SERVICE_CATS, ...custom]))
  })
  const [serviceCategories, setServiceCategories] = useState<string[]>(() =>
    Array.isArray(saved.serviceCategories) ? (saved.serviceCategories as string[]) : []
  )

  const [budgetOptions, setBudgetOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.budgetRanges) ? (saved.budgetRanges as string[]) : []
    return Array.from(new Set([...DEFAULT_BUDGET, ...custom]))
  })
  const [selectedBudgets, setSelectedBudgets] = useState<string[]>(() => {
    if (Array.isArray(saved.budgetRanges) && saved.budgetRanges.length > 0) return saved.budgetRanges as string[]
    if (saved.budgetRange) return [String(saved.budgetRange)]
    return []
  })

  const [durationOptions, setDurationOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.projectDurations) ? (saved.projectDurations as string[]) : []
    return Array.from(new Set([...DEFAULT_DURATIONS, ...custom]))
  })
  const [selectedDurations, setSelectedDurations] = useState<string[]>(() => {
    if (Array.isArray(saved.projectDurations) && saved.projectDurations.length > 0) return saved.projectDurations as string[]
    if (saved.projectDuration) return [String(saved.projectDuration)]
    return []
  })

  // Intent signals (toggles)
  const [intentSignals, setIntentSignals] = useState({
    recentlyFunded: Boolean(saved.intentSignals?.recentlyFunded),
    hiringAggressively: Boolean(saved.intentSignals?.hiringAggressively),
    websiteRedesigned: Boolean(saved.intentSignals?.websiteRedesigned),
    newProductLaunch: Boolean(saved.intentSignals?.newProductLaunch),
    geographicExpansion: Boolean(saved.intentSignals?.geographicExpansion),
    techMigration: Boolean(saved.intentSignals?.techMigration),
  })

  // Decision maker
  const [dmRoleOptions, setDmRoleOptions] = useState<string[]>(() => {
    const custom = Array.isArray(saved.decisionMakerRoles) ? (saved.decisionMakerRoles as string[]) : []
    return Array.from(new Set([...DEFAULT_DM_ROLES, ...custom]))
  })
  const [dmRoles, setDmRoles] = useState<string[]>(() =>
    Array.isArray(saved.decisionMakerRoles) ? (saved.decisionMakerRoles as string[]) : []
  )

  const [dmSeniorityOpts, setDmSeniorityOpts] = useState<string[]>(() => {
    const custom = Array.isArray(saved.decisionMakerSeniority) ? (saved.decisionMakerSeniority as string[]) : []
    return Array.from(new Set([...DEFAULT_DM_SENIORITY, ...custom]))
  })
  const [dmSeniority, setDmSeniority] = useState<string[]>(() =>
    Array.isArray(saved.decisionMakerSeniority) ? (saved.decisionMakerSeniority as string[]) : []
  )

  // Trust filters (checkboxes)
  const [trustFilters, setTrustFilters] = useState({
    websiteActive: Boolean(saved.trustFilters?.websiteActive),
    linkedinActive: Boolean(saved.trustFilters?.linkedinActive),
    emailVerified: Boolean(saved.trustFilters?.emailVerified),
    fundingVerified: Boolean(saved.trustFilters?.fundingVerified),
  })

  // ── Generic helpers ─────────────────────────────────────────────────────────

  function toggle(arr: string[], setArr: (v: string[]) => void, val: string) {
    setArr(arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val])
  }

  // Add a custom value to options + auto-select it
  function addCustom(
    opts: string[], setOpts: (v: string[]) => void,
    sel: string[], setSel: (v: string[]) => void,
    val: string
  ) {
    const trimmed = val.trim()
    if (!trimmed) return
    if (!opts.includes(trimmed)) setOpts([...opts, trimmed])
    if (!sel.includes(trimmed)) setSel([...sel, trimmed])
  }

  // ── Save & navigate ─────────────────────────────────────────────────────────

  function handleNext() {
    const existing = localStorage.getItem('ebexta_scan_filters')
    const parsed = existing ? JSON.parse(existing) : {}
    localStorage.setItem('ebexta_scan_filters', JSON.stringify({
      ...parsed,
      employeeMin: empMin,
      employeeMax: empMax,
      companyStages: selectedStages,
      industries: selectedIndustries,
      companySizes: selectedSizes,
      // Pass first selected value for backward-compat with single-value fields,
      // also pass full arrays so Gemini prompt can use them
      revenueRange: selectedRevenue[0] ?? '',
      revenueRanges: selectedRevenue,
      serviceCategories,
      budgetRange: selectedBudgets[0] ?? '',
      budgetRanges: selectedBudgets,
      projectDuration: selectedDurations[0] ?? '',
      projectDurations: selectedDurations,
      intentSignals,
      decisionMakerRoles: dmRoles,
      decisionMakerSeniority: dmSeniority,
      trustFilters,
    }))
    navigate('/onboarding/geography')
  }

  // Light-theme section card — matches the EBEXTA design system.
  // (Was a leftover dark rgba(16,19,26) panel that clashed with the light UI.)
  const cardStyle = {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    padding: '20px 22px',
    boxShadow: 'var(--shadow-md)',
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: 'var(--bg-base)', color: 'var(--text-secondary)' }}>
      {/* Ambient glows */}
      <div className="fixed top-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, var(--accent-subtle), transparent 70%)' }} />
      <div className="fixed bottom-[-10%] left-[-5%] w-[40vw] h-[40vw] rounded-full pointer-events-none -z-10"
        style={{ background: 'radial-gradient(circle, var(--accent-subtle), transparent 70%)' }} />

      {/* Header */}
      <header className="fixed top-0 w-full z-50 border-b"
        style={{ background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(20px)', borderColor: 'var(--border-subtle)' }}>
        <div className="flex justify-between items-center px-6 py-4 w-full max-w-[720px] mx-auto">
          <div className="flex items-center gap-2">
            <EbextaLogo variant="horizontal" size={28} priority />
            <span className="mx-2" style={{ color: 'var(--border-subtle)' }}>|</span>
            <span className="text-[11px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--text-muted)' }}>Onboarding</span>
          </div>
          <span className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>Step 2 of 3</span>
        </div>
      </header>

      <main className="flex-grow flex justify-center px-4 pt-32 pb-16">
        <div className="w-full max-w-[720px] flex flex-col gap-5">

          {/* Progress */}
          <div className="flex items-center gap-2">
            <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--accent)' }} />
            <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--accent)' }} />
            <div className="h-1 flex-1 rounded-full" style={{ background: 'var(--border-subtle)' }} />
          </div>

          <div>
            <h1 className="text-[24px] font-semibold mb-1" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              What kind of leads are you looking for?
            </h1>
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
              Select from the options below, or type your own and press <kbd className="px-1.5 py-0.5 rounded text-[11px] font-mono" style={{ background: 'var(--border-subtle)', color: 'var(--accent-interactive)' }}>↵</kbd> to add it. Every filter sharpens your EBEXTA results.
            </p>
          </div>

          {/* ── TARGET LEAD PROFILE ── */}
          <div style={cardStyle}>
            <SectionLabel label="Target Lead Profile" sub="Define the types of companies you want to match with." />
            <div className="flex flex-col gap-5">

              {/* Employee Count */}
              <div>
                <div className="flex justify-between items-center mb-3">
                  <label className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>Employee Count</label>
                  <span className="text-[12px] font-mono px-2 py-0.5 rounded" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}>
                    {empMin} — {empMax >= 1000 ? '1,000+' : empMax}
                  </span>
                </div>
                <div className="relative w-full h-8 flex items-center">
                  <div className="absolute w-full h-1 rounded-full" style={{ background: 'var(--border-subtle)' }} />
                  <div className="absolute h-1 rounded-full"
                    style={{ left: `${(empMin / 1000) * 100}%`, right: `${100 - (empMax / 1000) * 100}%`, background: 'var(--accent)' }} />
                  <input type="range" min={1} max={1000} value={empMin}
                    onChange={e => setEmpMin(Math.min(Number(e.target.value), empMax - 1))}
                    className="range-thumb absolute w-full z-20 focus:outline-none" />
                  <input type="range" min={1} max={1000} value={empMax}
                    onChange={e => setEmpMax(Math.max(Number(e.target.value), empMin + 1))}
                    className="range-thumb absolute w-full z-10 focus:outline-none" />
                </div>
                <div className="flex justify-between text-[10px] font-bold tracking-[0.06em] mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span>1</span><span>250</span><span>500</span><span>750</span><span>1,000+</span>
                </div>
              </div>

              <Divider />

              {/* Company Size */}
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Company Size</label>
                <EditablePillGroup
                  options={sizeOptions}
                  selected={selectedSizes}
                  onToggle={v => toggle(selectedSizes, setSelectedSizes, v)}
                  onAddCustom={v => addCustom(sizeOptions, setSizeOptions, selectedSizes, setSelectedSizes, v)}
                  placeholder="Add size…"
                />
              </div>

              <Divider />

              {/* Industry */}
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Industry</label>
                <EditablePillGroup
                  options={industryOptions}
                  selected={selectedIndustries}
                  onToggle={v => toggle(selectedIndustries, setSelectedIndustries, v)}
                  onAddCustom={v => addCustom(industryOptions, setIndustryOptions, selectedIndustries, setSelectedIndustries, v)}
                  placeholder="Add industry…"
                />
              </div>

              <Divider />

              {/* Revenue Range */}
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Revenue Range</label>
                <TagSelect
                  options={revenueOptions}
                  selected={selectedRevenue}
                  onToggle={v => toggle(selectedRevenue, setSelectedRevenue, v)}
                  onAddCustom={v => addCustom(revenueOptions, setRevenueOptions, selectedRevenue, setSelectedRevenue, v)}
                  placeholder="e.g. ₹100–200 Cr…"
                />
              </div>

              <Divider />

              {/* Funding Stage */}
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Funding Stage</label>
                <EditablePillGroup
                  options={stageOptions}
                  selected={selectedStages}
                  onToggle={v => toggle(selectedStages, setSelectedStages, v)}
                  onAddCustom={v => addCustom(stageOptions, setStageOptions, selectedStages, setSelectedStages, v)}
                  placeholder="Add stage…"
                />
              </div>
            </div>
          </div>

          {/* ── SERVICE FILTERS ── */}
          <div style={cardStyle}>
            <SectionLabel label="What Service Are You Offering or Seeking?" />
            <div className="flex flex-col gap-5">

              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Service Category</label>
                <EditablePillGroup
                  options={serviceCatOptions}
                  selected={serviceCategories}
                  onToggle={v => toggle(serviceCategories, setServiceCategories, v)}
                  onAddCustom={v => addCustom(serviceCatOptions, setServiceCatOptions, serviceCategories, setServiceCategories, v)}
                  placeholder="Add service…"
                />
              </div>

              <Divider />

              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Budget Range</label>
                <TagSelect
                  options={budgetOptions}
                  selected={selectedBudgets}
                  onToggle={v => toggle(selectedBudgets, setSelectedBudgets, v)}
                  onAddCustom={v => addCustom(budgetOptions, setBudgetOptions, selectedBudgets, setSelectedBudgets, v)}
                  placeholder="e.g. ₹20L–50L…"
                />
              </div>

              <Divider />

              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Project Duration</label>
                <TagSelect
                  options={durationOptions}
                  selected={selectedDurations}
                  onToggle={v => toggle(selectedDurations, setSelectedDurations, v)}
                  onAddCustom={v => addCustom(durationOptions, setDurationOptions, selectedDurations, setSelectedDurations, v)}
                  placeholder="e.g. 9 Months…"
                />
              </div>
            </div>
          </div>

          {/* ── INTENT SIGNALS ── */}
          <div style={cardStyle}>
            <div className="flex items-start justify-between">
              <SectionLabel
                label="Prioritize Companies With These Signals"
                sub="Enabled signals boost intent score. Toggle what matters to you."
              />
              <div className="mt-1"><InfoTip term="intent" /></div>
            </div>
            <div className="space-y-3">
              {([
                { key: 'recentlyFunded',      label: 'Recently Funded',             desc: 'Company raised funding in the last 12 months' },
                { key: 'hiringAggressively',  label: 'Hiring Aggressively',         desc: '20+ open roles, signaling rapid growth' },
                { key: 'websiteRedesigned',   label: 'Website Recently Redesigned', desc: 'New site or rebrand detected' },
                { key: 'newProductLaunch',    label: 'New Product Launch',          desc: 'Product launch announced' },
                { key: 'geographicExpansion', label: 'Geographic Expansion',        desc: 'Entering new cities or countries' },
                { key: 'techMigration',       label: 'Technology Migration',        desc: 'Cloud or stack upgrade signals' },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIntentSignals(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors shrink-0 ml-4"
                    style={{ background: intentSignals[key] ? 'var(--accent)' : 'var(--border-subtle)' }}
                  >
                    <span className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                      style={{ transform: intentSignals[key] ? 'translateX(22px)' : 'translateX(4px)', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }} />
                  </button>
                </label>
              ))}
            </div>
          </div>

          {/* ── DECISION MAKER FILTERS ── */}
          <div style={cardStyle}>
            <SectionLabel label="Target Decision Makers" />
            <div className="flex flex-col gap-4">
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Role</label>
                <EditablePillGroup
                  options={dmRoleOptions}
                  selected={dmRoles}
                  onToggle={v => toggle(dmRoles, setDmRoles, v)}
                  onAddCustom={v => addCustom(dmRoleOptions, setDmRoleOptions, dmRoles, setDmRoles, v)}
                  placeholder="Add role…"
                />
              </div>
              <Divider />
              <div>
                <label className="text-[13px] font-semibold block mb-2" style={{ color: 'var(--text-primary)' }}>Seniority</label>
                <EditablePillGroup
                  options={dmSeniorityOpts}
                  selected={dmSeniority}
                  onToggle={v => toggle(dmSeniority, setDmSeniority, v)}
                  onAddCustom={v => addCustom(dmSeniorityOpts, setDmSeniorityOpts, dmSeniority, setDmSeniority, v)}
                  placeholder="Add seniority…"
                />
              </div>
            </div>
          </div>

          {/* ── TRUST FILTERS ── */}
          <div style={cardStyle}>
            <SectionLabel label="Only Show Leads With" />
            <div className="space-y-3">
              {([
                { key: 'websiteActive',   label: 'Website Active',     desc: 'Verified live website' },
                { key: 'linkedinActive',  label: 'LinkedIn Active',    desc: 'Verified LinkedIn company page' },
                { key: 'emailVerified',   label: 'Email Verified',     desc: 'Valid email address found' },
                { key: 'fundingVerified', label: 'Funding Verified',   desc: 'Funding data confirmed via source' },
              ] as const).map(({ key, label, desc }) => (
                <label key={key} className="flex items-center gap-3 cursor-pointer">
                  <button
                    type="button"
                    onClick={() => setTrustFilters(prev => ({ ...prev, [key]: !prev[key] }))}
                    className="w-5 h-5 rounded flex items-center justify-center shrink-0 transition-all"
                    style={{
                      background: trustFilters[key] ? 'var(--accent)' : 'transparent',
                      border: `1.5px solid ${trustFilters[key] ? 'var(--accent)' : 'var(--border-subtle)'}`,
                    }}
                  >
                    {trustFilters[key] && (
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M1.5 5l2.5 2.5 4.5-5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </button>
                  <div>
                    <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</p>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{desc}</p>
                  </div>
                </label>
              ))}
              <p className="text-[11px] mt-1 pl-0" style={{ color: 'var(--text-muted)' }}>
                GST Registered and Customer Reviews coming in Phase 2.
              </p>
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2 pb-4">
            <button onClick={() => navigate('/onboarding')}
              className="flex items-center gap-1 text-[14px] font-semibold transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text-secondary)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
              <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
            </button>
            <button onClick={handleNext}
              className="flex items-center gap-2 px-8 py-3 rounded-xl text-[14px] font-bold transition-all active:scale-95"
              style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-interactive))', color: '#fff', boxShadow: '0 0 24px var(--accent-subtle)' }}>
              Next Step <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </div>

        </div>
      </main>
    </div>
  )
}
