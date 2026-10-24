import { useState, useEffect, useMemo, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { ScannedLead } from '../../lib/scanEngine'
import {
  verifyLeadLinks,
  linkStatusIcon,
  linkStatusColor,
  linkStatusLabel,
  type VerifiedLink,
} from '../../lib/linkVerifier'
import {
  openExternal,
  normalizeUrl,
  linkedInPersonSearch,
  linkedInCompanySearch,
  googleSearch,
  googlePersonSearch,
  socialMediaSearch,
  sourceSearchUrl,
  cleanDomain,
  isGenericContactName,
} from '../../lib/urlUtils'
import { DossierModal } from '../../components/DossierModal'
import { PitchModal } from '../../components/PitchModal'
import { OutreachComposer } from '../../components/OutreachComposer'
import { logSystemEvent } from '../../lib/adminLog'
import { findSavedSnapshot } from '../../lib/savedLeads'
import { getDeepIntel, sanitizeCompanyPlaceholders, getIndustryCompetitorFallbacks, type DeepIntel } from '../../lib/leadIntel'
import type { ScoreBreakdownItem } from '../../lib/scanEngine'
import { fetchActiveProduct } from '../../lib/productAnalysis'
import { InfoTip } from '../../components/InfoTip'
import { ensureMemoryForLead } from '../../lib/companyMemory'
import { SiteWalkthroughPanel, ClaimVerificationTable, SourceBadge } from '../../components/SiteWalkthroughPanel'
import { FeasibilityRow } from '../../components/FeasibilityLine'
import { checkCredits, consumeCredit } from '../../lib/credits'
import { visibilityLabel } from '../../lib/rankCheck'
import { executeKeyContactEngine, type KeyContactEngineResult } from '../../lib/keyContactEngine'
import { evaluateReachability } from '../../lib/scanEngine'
import { LeadActionWorkflow } from '../../components/LeadActionWorkflow'



function Accordion({ title, icon, defaultOpen = false, children }: { title: string, icon: string, defaultOpen?: boolean, children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  return (
    <div className="mb-2">
      <button onClick={() => setIsOpen(!isOpen)} className="w-full flex items-center justify-between mb-2 ghost-btn p-2 -mx-2 rounded-xl transition-colors">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>{icon}</span>
          <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>{title}</h2>
        </div>
        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--text-muted)' }}>
          {isOpen ? 'expand_less' : 'expand_more'}
        </span>
      </button>
      {isOpen && <div className="mt-2">{children}</div>}
    </div>
  )
}

// Present a field value humanely — never surface a raw NULL / N/A / null, which
// reads like a software bug. Anything empty or unknown becomes plain English.
function displayValue(v: unknown): string {
  const s = (v == null ? '' : String(v)).trim()
  if (!s || /^(null|n\/a|na|none|unknown|nil|-|—|not available)$/i.test(s)) return 'Not publicly available'
  return s
}

// Guard against hallucinated / placeholder phone numbers (e.g. "74000 74000",
// "9999999999", "1234567890"). We only ever show a number that looks like a real
// Indian mobile. Better to show nothing than a wrong number someone might call.
function isPlausiblePhone(raw?: string | null): boolean {
  if (!raw) return false
  const digits = raw.replace(/\D/g, '')
  const n = digits.length > 10 ? digits.slice(-10) : digits // national part
  if (n.length !== 10) return false
  if (!/^[6-9]/.test(n)) return false                        // Indian mobiles start 6–9
  if (new Set(n).size < 4) return false                      // too few distinct digits
  if (n.slice(0, 5) === n.slice(5)) return false             // repeated block e.g. 74000 74000
  if ('01234567890'.includes(n) || '09876543210'.includes(n)) return false // sequential
  return true
}

/** A delivered/verified verification_request row (EBEXTA-verified contact). */
interface VerifiedContactRow {
  contact_name: string | null
  status: 'pending' | 'in_progress' | 'verified' | 'delivered' | 'could_not_verify'
  verified_name: string | null
  verified_position: string | null
  verified_email: string | null
  verified_phone: string | null
  verified_website: string | null
  verified_linkedin: string | null
  verified_evidence_url: string | null
  evidence_expires_at: string | null
  confidence_score: number | null
}

/** Always render a valid 0–100 integer percentage — never NaN/undefined/negative. */
function clampPct(v: unknown): number {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return 0
  return Math.max(0, Math.min(100, n))
}

/** Green panel shown in the lead's contact section once EBEXTA has verified it. */
function VerifiedContactPanel({ v, onOutreach }: {
  v: VerifiedContactRow
  onOutreach: (channel: 'whatsapp' | 'linkedin', opts: { phone?: string | null; linkedinUrl?: string | null; name?: string | null }) => void
}) {
  const row = (icon: string, node: ReactNode) => (
    <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-primary)' }}>
      <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>{icon}</span>
      {node}
    </div>
  )
  return (
    <div className="px-4 pb-3 pt-1 space-y-1.5">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--success)' }}>✓ Verified by EBEXTA</span>
        {v.confidence_score != null && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
            {clampPct(v.confidence_score)}% confidence
          </span>
        )}
      </div>
      {(v.verified_name || v.verified_position) && row('badge',
        <span>{v.verified_name}{v.verified_position ? ` · ${v.verified_position}` : ''}</span>)}
      {v.verified_email && row('mail', <a href={`mailto:${v.verified_email}`} className="underline">{v.verified_email}</a>)}
      {v.verified_phone && row('call',
        <span className="flex items-center gap-2 flex-wrap">
          <span>{v.verified_phone}</span>
          <button onClick={() => onOutreach('whatsapp', { phone: v.verified_phone, name: v.verified_name })}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold"
            style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.4)', color: '#128C4B' }}>
            <span className="material-symbols-outlined text-[12px]">chat</span> WhatsApp
          </button>
        </span>)}
      {v.verified_website && row('language',
        <a href={v.verified_website} target="_blank" rel="noopener noreferrer" className="underline">{v.verified_website.replace(/^https?:\/\/(www\.)?/, '')}</a>)}
      {v.verified_linkedin && row('manage_search',
        <button onClick={() => onOutreach('linkedin', { linkedinUrl: v.verified_linkedin, name: v.verified_name })}
          className="inline-flex items-center gap-1 underline" style={{ color: 'var(--accent-interactive)' }}>
          Message on LinkedIn
        </button>)}
      {v.verified_evidence_url && (
        <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--warning)' }}>
          <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>link</span>
          <a href={v.verified_evidence_url} target="_blank" rel="noopener noreferrer" className="underline">Evidence source</a>
          {v.evidence_expires_at && (
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>(expires {new Date(v.evidence_expires_at).toLocaleDateString()})</span>
          )}
        </div>
      )}
    </div>
  )
}

function CompanyLogo({ website: _website, name }: { website: string; name: string }) {
  // Privacy: render a local initial avatar — no external logo fetch, so we don't
  // reveal which companies the user researches to a third-party (e.g. Clearbit).
  return (
    <div className="w-full h-full flex items-center justify-center text-on-surface-variant font-bold text-[20px]">
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </div>
  )
}

function PriorityBar({ score }: { score: number }) {
  const label = score >= 90 ? 'Hot' : score >= 70 ? 'High' : score >= 50 ? 'Medium' : 'Low'
  const opacity = score >= 90 ? 1 : score >= 70 ? 0.75 : score >= 50 ? 0.5 : 0.3
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: `linear-gradient(90deg, #4A3080, var(--accent))`, opacity }} />
      </div>
      <span className="text-[11px] font-bold" style={{ color: `rgba(29,38,54,${opacity})`, opacity }}>{label}</span>
    </div>
  )
}


const DEMO_LEADS: ScannedLead[] = [
  {
    id: 'd1', company_name: 'Zoho Payments', industry: 'Fintech / SaaS', location: 'Chennai, India',
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
    id: 'd2', company_name: 'BrowserStack', industry: 'Developer Tools / QA', location: 'Mumbai, India',
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
    id: 'd3', company_name: 'Chargebee', industry: 'B2B SaaS / Subscription', location: 'Chennai, India',
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
    id: 'd4', company_name: 'Freshworks', industry: 'CRM / Enterprise SaaS', location: 'Chennai, India',
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

export default function LeadDetail() {
  const navigate = useNavigate()
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [lead, setLead] = useState<ScannedLead | null>(null)
  const [loading, setLoading] = useState(true)
  const [scanMission, setScanMission] = useState('')
  // Outreach composer (WhatsApp / LinkedIn from a verified contact).
  const [composer, setComposer] = useState<{ channel: 'whatsapp' | 'linkedin'; phone?: string | null; linkedinUrl?: string | null; name?: string | null } | null>(null)
  // Format + fake-pattern checks only, so this is a pure derivation of the
  // lead — no effect, no loading state. Reachability is decided server-side by
  // the site-walkthrough function; the browser is not allowed to fetch a
  // company's website and never could.
  const linkResults = useMemo<Record<string, VerifiedLink> | null>(
    () => lead
      ? verifyLeadLinks({
        website: lead.website,
        linkedin_url: lead.linkedin_url,
        evidence_source_url: lead.evidence_source_url,
        email: lead.email,
      })
      : null,
    [lead],
  )
  const linksChecking = false
  // verification_requests: key = contact name
  const [pendingVerifications, setPendingVerifications] = useState<Set<string>>(new Set())
  // Delivered/verified results for THIS lead's contacts, keyed by requested contact name
  const [verifiedResults, setVerifiedResults] = useState<Record<string, VerifiedContactRow>>({})
  const [verificationToast, setVerificationToast] = useState<string | null>(null)
  const [dossierOpen, setDossierOpen] = useState(false)
  const [pitchOpen, setPitchOpen] = useState(false)
  const [intel, setIntel] = useState<DeepIntel | null>(null)
  const [intelLoading, setIntelLoading] = useState(false)
  // The generation came back unusable. Distinct from "still loading" and from
  // "loaded but empty" — the user gets a retry, not a silent gap.
  const [intelFailed, setIntelFailed] = useState(false)
  const [intelRetryKey, setIntelRetryKey] = useState(0)
  const [memoryBusy, setMemoryBusy] = useState(false)
  const [feedbackGiven, setFeedbackGiven] = useState<'up' | 'down' | null>(null)
  // If the user is marketing a specific product, show why this lead fits IT.
  const [productFit, setProductFit] = useState<{ name: string; pitch: string } | null>(null)
  
  const [reportOpen, setReportOpen] = useState(false)
  const [reportingField, setReportingField] = useState('Location')
  const [actualValue, setActualValue] = useState('')
  const [submittingReport, setSubmittingReport] = useState(false)
  const [reportSuccess, setReportSuccess] = useState(false)

  // Allow editing stakeholder names purely for better LinkedIn searches without saving to DB
  const [editableNames, setEditableNames] = useState<Record<number, string>>({})

  // Key Contact Intelligence Engine state
  const [kcEngineRunning, setKcEngineRunning] = useState(false)
  const [kcEngineResult, setKcEngineResult] = useState<KeyContactEngineResult | null>(null)
  const [expandedEvidence, setExpandedEvidence] = useState<Record<string, boolean>>({})

  async function handleRunKeyContactEngine() {
    if (!lead || kcEngineRunning) return
    setKcEngineRunning(true)
    try {
      const res = await executeKeyContactEngine(lead, scanMission)
      setKcEngineResult(res)
    } catch (err) {
      console.error('[KeyContactEngine] Execution failed in UI:', err)
    } finally {
      setKcEngineRunning(false)
    }
  }

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!lead || !actualValue.trim()) return
    setSubmittingReport(true)
    try {
      let claimed = ''
      if (reportingField === 'Location') claimed = lead.location || ''
      else if (reportingField === 'Employee count') claimed = lead.employee_count ? String(lead.employee_count) : ''
      else if (reportingField === 'Revenue') claimed = lead.annual_revenue || ''
      else if (reportingField === 'Stage') claimed = lead.funding_stage || ''
      else if (reportingField === 'Contacts') claimed = lead.contacts ? JSON.stringify(lead.contacts) : ''
      else claimed = 'Other'

      const { error } = await supabase.from('accuracy_audits').insert({
        lead_id: lead.id,
        field_name: reportingField,
        claimed_value: claimed,
        actual_value: actualValue.trim(),
        audit_result: 'mismatch',
        audited_by: 'user_report'
      })

      if (error) throw error
      setReportSuccess(true)
      setActualValue('')
      setTimeout(() => {
        setReportOpen(false)
        setReportSuccess(false)
      }, 2000)
    } catch (err) {
      console.error('[EBEXTA User Report] Failed to submit user correction:', err)
      alert('Failed to submit report. Please try again.')
    } finally {
      setSubmittingReport(false)
    }
  }

  useEffect(() => {
    if (!user) return
    let alive = true
    fetchActiveProduct(user.id).then(p => {
      if (alive && p?.product_name && p.ideal_buyer_profile?.pitch_angle) {
        setProductFit({ name: p.product_name, pitch: p.ideal_buyer_profile.pitch_angle })
      }
    })
    return () => { alive = false }
  }, [user])

  // Deep intel — generated exactly once per lead (session memory + Supabase +
  // local cache in leadIntel.ts). Keyed on lead.id so re-renders / tab switches
  // never restart it. If we already have intel for this lead, do nothing.
  useEffect(() => {
    if (!lead) return
    let alive = true
    let mission = ''
    let mode: 'seeker' | 'provider' = 'seeker'
    let userCo = 'Our Company'
    try {
      const f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
      mission = f.mission ?? ''
      if (f.mode === 'provider') mode = 'provider'
      if (f.companyName) userCo = f.companyName
    } catch { /* defaults */ }

    const sanitizeIntel = (raw: DeepIntel): DeepIntel => {
      const u = userCo
      const t = lead.company_name
      return {
        ...raw,
        exact_match_story: (raw.exact_match_story || []).map(s => sanitizeCompanyPlaceholders(s, u, t)),
        future_scope: (raw.future_scope || []).map(s => sanitizeCompanyPlaceholders(s, u, t)),
        strategic_needs: (raw.strategic_needs || []).map(s => sanitizeCompanyPlaceholders(s, u, t)),
        approach_angle: sanitizeCompanyPlaceholders(raw.approach_angle || '', u, t),
        risk_flags: (raw.risk_flags || []).map(s => sanitizeCompanyPlaceholders(s, u, t)),
        other_interest_note: sanitizeCompanyPlaceholders(raw.other_interest_note || '', u, t),
      }
    }

    const cachedIntel = lead.deep_intel as unknown as DeepIntel | null
    // Cached intel is applied immediately (no fetch needed) — safe one-shot set
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (cachedIntel?.exact_match_story) {
      setIntel(sanitizeIntel(cachedIntel))
      setIntelLoading(false)
      return
    }
    setIntelLoading(true)
    getDeepIntel(lead, mission, mode, userCo).then(result => {
      if (!alive) return
      setIntel(result ? sanitizeIntel(result) : null)
      // null means the model's response could not be parsed even after a
      // retry. Say so and offer the retry — never leave a blank space where
      // intelligence should be, and never throw.
      setIntelFailed(result === null)
      setIntelLoading(false)
    }).catch(() => {
      if (!alive) return
      setIntelFailed(true)
      setIntelLoading(false)
    })
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, intelRetryKey])

  useEffect(() => {
    // Load user's mission for "why this match" context
    const raw = localStorage.getItem('ebexta_scan_filters')
    if (raw) {
      try { setScanMission(JSON.parse(raw)?.mission ?? '') } catch { /* ignore */ }
    }

    if (!id) return

    // 1) Try local caches: per-mode keys + legacy
    for (const key of ['ebexta_leads_seeker', 'ebexta_leads_provider', 'ebexta_scan_results']) {
      const cached = localStorage.getItem(key)
      if (!cached) continue
      try {
        const arr: ScannedLead[] = JSON.parse(cached)
        const found = arr.find(l => l.id === id)
        if (found) { setLead(found); setLoading(false); return }
      } catch { /* try next */ }
    }

    if (id && id.startsWith('d')) {
      const demo = DEMO_LEADS.find(l => l.id === id)
      if (demo) { setLead(demo); setLoading(false); return }
    }

    // 2) Supabase leads table, then 3) saved_leads snapshot, then 4) company_memory
    supabase.from('leads').select('*').eq('id', id).maybeSingle()
      .then(async ({ data }) => {
        if (data) { setLead(data as ScannedLead); setLoading(false); return }
        const snapshot = await findSavedSnapshot(id)
        if (snapshot) { setLead(snapshot); setLoading(false); return }
        
        // If it was converted to a memory and the original lead was purged/dismissed,
        // we can still recover the snapshot from the memory row.
        const { data: mem } = await supabase
          .from('company_memory')
          .select('company_name, company_snapshot, latest_lead_id')
          .eq('latest_lead_id', id)
          .maybeSingle()
        if (mem?.company_snapshot) {
          const snap = mem.company_snapshot as Partial<ScannedLead>
          setLead({
            ...snap,
            id: mem.latest_lead_id ?? id,
            company_name: snap.company_name ?? mem.company_name ?? '',
          } as ScannedLead)
          setLoading(false)
          return
        }
        
        setLoading(false)
      })
  }, [id])

  // Load verification requests for this lead — reflect both pending state and
  // delivered/verified results (matched by company name so it works even for
  // local, non-UUID leads). Polls so admin delivery appears without refresh.
  useEffect(() => {
    if (!user || !lead) return
    let cancelled = false
    async function load() {
      const { data } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user!.id)
        .eq('company_name', lead!.company_name)
      if (cancelled || !data) return
      const pending = new Set<string>()
      const done: Record<string, VerifiedContactRow> = {}
      for (const r of data as VerifiedContactRow[]) {
        const key = r.contact_name ?? ''
        if (r.status === 'delivered' || r.status === 'verified') done[key] = r
        else if (r.status === 'pending' || r.status === 'in_progress') pending.add(key)
      }
      setPendingVerifications(pending)
      setVerifiedResults(done)
    }
    load()
    const t = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [user, lead])

  async function requestVerification(leadData: ScannedLead, contact: { name: string; title?: string }) {
    if (!user) {
      setVerificationToast('Please log in to request verification.')
      setTimeout(() => setVerificationToast(null), 3500)
      return
    }
    // S3: cap verification requests at 10 per user per day (abuse guard —
    // normal usage is well under this).
    const dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
    const { count: todayCount } = await supabase
      .from('verification_requests')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('requested_at', dayStart.toISOString())
    if ((todayCount ?? 0) >= 10) {
      setVerificationToast('Daily verification limit reached (10/day). Try again tomorrow.')
      setTimeout(() => setVerificationToast(null), 4000)
      return
    }

    const domain = leadData.website
      ?.replace(/^https?:\/\/(www\.)?/, '')
      ?.split('/')[0] || null

    // lead_id must be a real UUID — demo/local ids would fail the uuid column
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const safeLeadId = UUID_RE.test(leadData.id) ? leadData.id : null

    // ── CREDIT GATE ──
    // Checked server-side before the request is created. The work is committed
    // at request time, so the credit is consumed here — not on delivery.
    const gate = await checkCredits('verified_contact')
    if (!gate.allowed) {
      setVerificationToast(gate.reason || 'You have used all your verified contacts this cycle.')
      setTimeout(() => setVerificationToast(null), 6000)
      return
    }

    const { error } = await supabase
      .from('verification_requests')
      .insert({
        user_id: user.id,
        lead_id: safeLeadId,
        company_name: leadData.company_name,
        company_domain: domain,
        contact_name: contact.name,
        contact_title: contact.title ?? null,
        status: 'pending',
      })

    if (!error) {
      // Charge only once the row actually exists.
      void consumeCredit('verified_contact', {
        referenceId: safeLeadId,
        note: `Verified contact — ${leadData.company_name} / ${contact.name}`,
      })
      setPendingVerifications(prev => new Set([...prev, contact.name]))
      setVerificationToast('✓ Verification requested: track it live in Verified Contacts. Delivery within 24 hours.')
      // Notify the admin side (Overview activity feed + System Logs)
      void logSystemEvent({
        userId: user.id,
        eventType: 'verification',
        message: `Verification requested: ${leadData.company_name} / ${contact.name}`,
        metadata: { company: leadData.company_name, contact: contact.name, domain },
      })
    } else {
      // NEVER fail silently — tell the user exactly what's wrong
      console.error('[EBEXTA] verification_requests insert failed:', error.message, error.details, error.hint)
      setVerificationToast(
        /relation|does not exist|policy|permission|row-level/i.test(error.message)
          ? 'Verification setup incomplete: run supabase/fix_migration.sql in Supabase, then retry.'
          : `Request failed: ${error.message.slice(0, 80)}`
      )
    }
    setTimeout(() => setVerificationToast(null), 5000)
  }

  function handleClose() { navigate('/dashboard') }

  function buildIntegrityItems(l: ScannedLead) {
    const errs = l.validation_errors ?? []
    return [
      {
        label: 'LinkedIn Verified',
        detail: errs.includes('INVALID_LINKEDIN') ? 'URL not validated; verify manually' : 'LinkedIn profile URL present',
        status: errs.includes('INVALID_LINKEDIN') ? 'warn' : 'ok',
      },
      {
        label: 'Source Evidence',
        detail: (errs.includes('UNVERIFIED_CLAIM') || errs.includes('SOURCE_UNVERIFIED'))
          ? 'No evidence URL: EBEXTA Engine inference only'
          : 'Evidence URL provided',
        status: (errs.includes('UNVERIFIED_CLAIM') || errs.includes('SOURCE_UNVERIFIED')) ? 'warn' : 'ok',
      },
      {
        label: 'Stakeholders',
        detail: errs.includes('NO_STAKEHOLDER')
          ? 'No contacts identified'
          : `${l.stakeholders?.length ?? 0} decision maker${(l.stakeholders?.length ?? 0) !== 1 ? 's' : ''} found`,
        status: errs.includes('NO_STAKEHOLDER') ? 'warn' : 'ok',
      },
      {
        label: 'Email Contact',
        detail: errs.includes('EMAIL_UNVERIFIED')
          ? 'No verified email: use LinkedIn'
          : 'Contact email available',
        status: errs.includes('EMAIL_UNVERIFIED') ? 'warn' : 'ok',
      },
    ] as const
  }

  /**
   * Provenance for one data point. A field is only "from their website" if the
   * claim check for it came back CONFIRMED — anything else stays EBEXTA Engine inferred,
   * which is the honest answer.
   */
  function sourceFor(field: string | null): { kind: 'site' | 'human' | 'inferred' | 'not_checked'; url: string | null } {
    if (!field || !lead) return { kind: 'not_checked', url: null }
    if (!lead.site_read_status) return { kind: 'not_checked', url: null }
    const check = (lead.claim_verification ?? []).find(c => c.field === field)
    if (check?.status === 'CONFIRMED') return { kind: 'site', url: check.source_url ?? null }
    return { kind: 'inferred', url: null }
  }

  // Dossier export: interactive PDF flow (template picker) — see DossierModal.

  /**
   * Open this company's persistent memory. The record normally already exists
   * (the scan creates one for every lead); if it somehow doesn't, it's created
   * here so the button never dead-ends.
   */
  async function handleOpenMemory() {
    if (!lead || memoryBusy) return
    setMemoryBusy(true)
    try {
      const memoryId = await ensureMemoryForLead(lead)
      if (memoryId) navigate(`/dashboard/companies/${memoryId}`)
      else navigate('/dashboard/companies')
    } finally {
      setMemoryBusy(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading intelligence…</p>
        </div>
      </div>
    )
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-5" style={{ background: 'var(--bg-base)' }}>
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
          <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--accent)' }}>search_off</span>
        </div>
        <div className="text-center">
          <p className="text-[18px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Lead not found</p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>This lead may have been removed or hasn't synced yet.</p>
        </div>
        <button onClick={handleClose}
          className="premium-btn px-6 py-2.5 rounded-xl text-[13px] font-bold">
          Back to Dashboard
        </button>
      </div>
    )
  }

  const integrityItems = buildIntegrityItems(lead)
  const stakeholders = (lead.stakeholders ?? []).filter(s => s.name && !isGenericContactName(s.name))
  const signalTags = lead.intent_flags ?? []
  const topContact = stakeholders[0]

  // Build "why this match" bullets.
  // Priority 1: EBEXTA Engine match_reason (most specific — comes from the Gemini scan prompt).
  // Priority 2: flag-based + intent-score bullets (always-available fallback).
  const whyMatch: string[] = []
  // AI reasons first — deduplicate against flag-based bullets added below
  const aiReasons = (lead.match_reason ?? []).filter(Boolean).slice(0, 4)
  whyMatch.push(...aiReasons)
  if (signalTags.includes('RECENT_FUNDING')) whyMatch.push('Recently funded: active budget for new vendors')
  if (signalTags.includes('HIRING_SURGE')) whyMatch.push('Hiring surge signals rapid team & operational growth')
  if (signalTags.includes('EXPANSION_SIGNAL')) whyMatch.push('Expanding to new markets: prime partnership window')
  if (lead.intent_score >= 80) whyMatch.push(`High intent score (${lead.intent_score}%): strong buying signals detected`)
  if (lead.strongly_recommended) whyMatch.push('Declared intent match: actively seeking what you offer')
  // Score breakdown — top 3 fired signals (only if not already covered by match_reason)
  const topBreakdown = ((lead.score_breakdown ?? []) as Array<{ signal: string; points: number }>)
    .filter(s => s.points > 0)
    .sort((a, b) => b.points - a.points)
    .slice(0, 3)
  if (whyMatch.length === 0) whyMatch.push(`${lead.funding_stage} company in ${lead.industry}: fits your target profile`)

  // ── Filtration Details — how this lead passed each filter (Task 1.5) ──
  const scanFilters = (() => {
    try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { return {} }
  })()
  const filtrationChecks: Array<{ label: string; detail: string; pass: boolean }> = [
    {
      label: 'Target Geography',
      detail: `${lead.location || 'Location not specified'} vs target ${(() => {
        const c = Array.isArray(scanFilters.countries) && scanFilters.countries.length > 0 ? scanFilters.countries.join(', ') : (scanFilters.country || 'Any')
        const ci = Array.isArray(scanFilters.cities) && scanFilters.cities.length > 0 ? ` (${scanFilters.cities.join(', ')})` : ''
        return `${c}${ci}`
      })()}`,
      pass: (() => {
        if (!lead.location) return true
        const loc = lead.location.toLowerCase()
        const targetCountries = (Array.isArray(scanFilters.countries) ? scanFilters.countries : String(scanFilters.country || '').split(','))
          .map((s: string) => s.trim().toLowerCase()).filter(Boolean)
        const targetCities = (Array.isArray(scanFilters.cities) ? scanFilters.cities : [])
          .map((s: string) => s.trim().toLowerCase()).filter(Boolean)
        if (targetCountries.length === 0 && targetCities.length === 0) return true
        return (targetCountries.some((c: string) => loc.includes(c))) || (targetCities.some((ct: string) => loc.includes(ct)))
      })(),
    },
    {
      label: 'Employee Range',
      detail: `${lead.employee_count?.toLocaleString() ?? '?'} employees vs filter ${scanFilters.employeeMin ?? 10}–${scanFilters.employeeMax ?? 500}`,
      pass: (lead.employee_count ?? 0) === 0 ||
            ((lead.employee_count ?? 0) >= (scanFilters.employeeMin ?? 10) * 0.5 &&
             (lead.employee_count ?? 0) <= (scanFilters.employeeMax ?? 500) * 1.8),
    },
    {
      label: 'Company Stage',
      detail: `${lead.funding_stage ?? 'N/A'} vs filter ${(scanFilters.companyStages ?? []).join(', ') || 'any'}`,
      pass: (scanFilters.companyStages ?? []).length === 0 ||
            (scanFilters.companyStages ?? []).some((s: string) =>
              (lead.funding_stage ?? '').toLowerCase().includes(s.toLowerCase()) ||
              s.toLowerCase().includes((lead.funding_stage ?? '').toLowerCase())),
    },
    {
      label: 'Intent Signals',
      detail: (lead.intent_flags ?? []).length > 0
        ? `${(lead.intent_flags ?? []).length} signal(s) detected: ${(lead.intent_flags ?? []).slice(0, 3).join(', ')}`
        : 'No intent signals detected',
      pass: (lead.intent_flags ?? []).length > 0,
    },
    {
      label: 'Verification Checks',
      detail: `${(lead.validation_errors ?? []).length === 0 ? 'All checks passed' : `${(lead.validation_errors ?? []).length} pending: ${(lead.validation_errors ?? []).slice(0, 2).join(', ')}`}`,
      pass: (lead.validation_errors ?? []).length === 0,
    },
    {
      label: 'Opposite-Side Match',
      detail: 'Counterpart confirmed: competitor filter passed (same-side businesses were discarded)',
      pass: true,
    },
  ]

  const sectionAnim = (i: number) => ({
    initial: { opacity: 0, y: 20 } as const,
    animate: { opacity: 1, y: 0 } as const,
    transition: { delay: i * 0.07, duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
  })

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Ambient background glows */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }} />
        <div className="absolute bottom-1/3 left-1/3 w-64 h-64 rounded-full opacity-6" style={{ background: 'radial-gradient(circle, var(--accent), transparent 70%)' }} />
      </div>

      {/* Backdrop overlay */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-40"
        style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(2px)' }}
        onClick={handleClose}
      />

      {/* Detail panel — FULL SCREEN: content left, business impact + actions right */}
      <motion.aside
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        transition={{ type: 'spring', stiffness: 280, damping: 30, mass: 0.9 }}
        className="fixed inset-0 z-50 flex flex-col"
        style={{ background: 'var(--bg-elevated)' }}
      >
        <header className="px-4 py-3 sm:px-6 shrink-0 sticky top-0 z-20" style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
          {/* Compact single-row: logo + name + action buttons + close. Always sticky top. */}
          <div className="flex items-center gap-3 w-full">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center overflow-hidden shrink-0"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
              <CompanyLogo website={lead.website ?? ''} name={lead.company_name} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h1 className="text-[16px] sm:text-[22px] font-bold leading-tight tracking-[-0.03em] truncate"
                  style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                  {lead.company_name}
                </h1>
                {lead.verification_status === 'VERIFIED' && (
                  <span className="material-symbols-outlined text-[16px] shrink-0" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>verified</span>
                )}
              </div>
              <p className="text-[11px] sm:text-[12.5px] truncate" style={{ color: 'var(--text-muted)' }}>{lead.industry} · {lead.location}</p>
            </div>
            {/* Action buttons */}
            <div className="hidden lg:flex items-center gap-2 shrink-0">
              <button onClick={() => navigate(`/dashboard/lead/${id}/email`)}
                className="h-8.5 px-3 premium-btn rounded-xl flex items-center gap-1.5 text-[12px] font-bold">
                <span className="material-symbols-outlined text-[15px]">bolt</span>Generate Email
              </button>
              <button onClick={() => setPitchOpen(true)}
                className="h-8.5 px-3 rounded-xl flex items-center gap-1.5 text-[12px] font-bold transition-all"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent-interactive)' }}>
                <span className="material-symbols-outlined text-[15px]">work</span>Draft Portfolio
              </button>
              <button onClick={() => setDossierOpen(true)}
                className="ghost-btn h-8.5 px-3 rounded-xl flex items-center gap-1.5 text-[12px]">
                <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>Dossier
              </button>
              <button onClick={handleOpenMemory} disabled={memoryBusy}
                className="ghost-btn h-8.5 px-3 rounded-xl flex items-center gap-1.5 text-[12px] disabled:opacity-60">
                <span className="material-symbols-outlined text-[15px]">{memoryBusy ? 'progress_activity' : 'corporate_fare'}</span>
                Company Memory
              </button>
              <button onClick={() => openExternal(linkedInCompanySearch(lead.company_name))}
                className="ghost-btn h-8.5 px-3 rounded-xl flex items-center gap-1.5 text-[12px]">
                <span className="material-symbols-outlined text-[15px]">manage_search</span>LinkedIn
              </button>
              <button onClick={() => setReportOpen(true)}
                className="ghost-btn h-8.5 px-3 rounded-xl flex items-center gap-1.5 text-[12px]"
                style={{ color: 'var(--error)' }}>
                <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--error)' }}>report_problem</span>Report
              </button>
              {normalizeUrl(lead.website) ? (
                <button onClick={() => openExternal(lead.website)} className="ghost-btn h-8.5 w-8.5 rounded-xl flex items-center justify-center"
                  title={linkResults?.website ? linkStatusLabel(linkResults.website.status) : 'Open website'}>
                  <span className="material-symbols-outlined text-[15px]"
                    style={{ color: linkResults?.website ? linkStatusColor(linkResults.website.status) : undefined }}>open_in_new</span>
                </button>
              ) : (
                <button onClick={() => openExternal(googleSearch(lead.company_name + ' official website'))}
                  className="ghost-btn h-8.5 px-2.5 rounded-xl flex items-center gap-1 text-[11px] font-semibold"
                  title="Search official website on EBEXTA Search">
                  <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--text-muted)' }}>travel_explore</span>
                  Website not verified
                </button>
              )}
            </div>
            <button onClick={handleClose}
              className="w-8.5 h-8.5 rounded-full flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>
        </header>


        {/* Body — two columns on desktop (each independently scrollable);
             stacks vertically and scrolls as one panel on mobile. */}
        <div className="flex-grow flex flex-col md:flex-row overflow-y-auto md:overflow-hidden">

          {/* ── LEFT column: intelligence content ── */}
          <div className="flex-1 min-w-0 md:overflow-y-auto p-6 pb-24 space-y-6 custom-scrollbar">

            {/* Score Grid & Intent Signals Overview — inside scrollable area so it rolls up smoothly */}
            <div className="space-y-3 pb-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              {/* Mobile actions row */}
              <div className="lg:hidden flex flex-wrap gap-2 pb-1">
                <button onClick={() => navigate(`/dashboard/lead/${id}/email`)}
                  className="h-8 px-3 premium-btn rounded-xl flex items-center gap-1 text-[11.5px] font-bold">
                  <span className="material-symbols-outlined text-[14px]">bolt</span>Generate Email
                </button>
                <button onClick={() => setPitchOpen(true)}
                  className="h-8 px-3 rounded-xl flex items-center gap-1 text-[11.5px] font-bold transition-all"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent-interactive)' }}>
                  <span className="material-symbols-outlined text-[14px]">work</span>Portfolio
                </button>
                <button onClick={() => setDossierOpen(true)}
                  className="ghost-btn h-8 px-3 rounded-xl flex items-center gap-1 text-[11.5px]">
                  <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>Dossier
                </button>
                <button onClick={handleOpenMemory} disabled={memoryBusy}
                  className="ghost-btn h-8 px-3 rounded-xl flex items-center gap-1 text-[11.5px] disabled:opacity-60">
                  <span className="material-symbols-outlined text-[14px]">{memoryBusy ? 'progress_activity' : 'corporate_fare'}</span>Memory
                </button>
                <button onClick={() => openExternal(linkedInCompanySearch(lead.company_name))}
                  className="ghost-btn h-8 px-3 rounded-xl flex items-center gap-1 text-[11.5px]">
                  <span className="material-symbols-outlined text-[14px]">manage_search</span>LinkedIn
                </button>
              </div>

              {/* Signal tags */}
              {signalTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {signalTags.map(tag => (
                    <span key={tag} className="px-2 py-0.5 rounded text-[10px] tracking-wider font-mono"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              {/* Scores Grid */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Buying Intent', value: clampPct(lead.intent_score), term: 'intent' },
                  { label: 'Service Match', value: clampPct(lead.match_score), term: 'match' },
                  { label: 'Trust & Confidence', value: Math.round((clampPct(lead.confidence_score) + (lead.honesty_score ?? 100)) / 2), term: 'confidence' },
                ].map((s, si) => (
                  <motion.div key={s.label} className="flex flex-col rounded-xl p-3"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + si * 0.06 }}>
                    <span className="text-[10px] font-bold tracking-[0.08em] uppercase mb-1 flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                      {s.label}<InfoTip term={s.term} size={12} />
                    </span>
                    <span className="text-[26px] font-bold leading-none tracking-[-0.04em]"
                      style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                      {s.value}%
                    </span>
                  </motion.div>
                ))}
              </div>

              {/* Product fit */}
              {productFit && (
                <div className="rounded-xl px-4 py-3 flex items-start gap-2.5"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)' }}>
                  <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0" style={{ color: 'var(--accent-interactive)' }}>inventory_2</span>
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.06em] mb-0.5" style={{ color: 'var(--accent-interactive)' }}>Fit for {productFit.name}</p>
                    <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{productFit.pitch}</p>
                  </div>
                </div>
              )}

              {/* Strongly recommended */}
              {lead.strongly_recommended && (
                <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                  <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>verified</span>
                  <span className="text-[12px] font-semibold" style={{ color: 'var(--accent-interactive)' }}>Declared Intent Match: this company is actively seeking what you offer</span>
                </div>
              )}

              {/* AI disclaimer */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
                style={{ background: 'rgba(245,158,11,0.04)', border: '1px solid rgba(245,158,11,0.15)' }}>
                <span className="material-symbols-outlined text-[13px]" style={{ color: 'rgba(245,158,11,0.6)' }}>info</span>
                <span className="text-[11px]" style={{ color: 'rgba(245,158,11,0.6)' }}>EBEXTA Engine intelligence: verify key details before outreach</span>
              </div>
            </div>

          {/* Outcome — already shown in the desktop score block above. Standalone section removed to prevent duplication. */}

          {/* Why am I seeing this lead? / Why This Match */}
          <motion.section {...sectionAnim(0)}>
            <Accordion title="Why am I seeing this lead?" icon="help" defaultOpen={true}>

            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>
              The intelligence behind this match: signals EBEXTA detected and scored against your search.
            </p>
            {scanMission && (
              <p className="text-[12px] mb-3 italic" style={{ color: 'var(--text-muted)' }}>Your search: "{scanMission.slice(0, 80)}{scanMission.length > 80 ? '…' : ''}"</p>
            )}

            {/* SERVICE NEED EVIDENCE & DESCRIPTION MATCH — clearly distinguishes ICP profile fit from demonstrated service requirement */}
            {(lead.service_need_evidence || lead.need_summary) && (
              <div className="mb-3 rounded-xl p-4"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-[17px]"
                    style={{ color: 'var(--accent-interactive)' }}>target</span>
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: 'var(--accent-interactive)' }}>
                    Why this matched your service need
                  </p>
                  {typeof lead.description_match_score === 'number' && lead.description_match_score > 0 && (
                    <span className="text-[11px] font-bold mono-val ml-auto"
                      style={{ color: lead.description_match_score >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                      {lead.description_match_score}% ICP Fit
                    </span>
                  )}
                  {lead.service_need_evidence?.service_fit_level && (
                    <span className="text-[10.5px] font-bold px-2 py-0.5 rounded ml-auto"
                      style={{ background: 'rgba(37,99,235,0.12)', color: 'var(--accent-interactive)' }}>
                      {lead.service_need_evidence.service_fit_level} Need
                    </span>
                  )}
                </div>

                {lead.source_description && (
                  <p className="text-[12px] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Target Service: <strong style={{ color: 'var(--text-primary)' }}>{lead.source_description}</strong>
                  </p>
                )}

                <p className="text-[13.5px] leading-relaxed mb-2" style={{ color: 'var(--text-primary)' }}>
                  {lead.service_need_evidence?.buyer_intent_signals?.[0] || lead.need_summary}
                </p>

                {lead.service_need_evidence?.buyer_intent_signals && lead.service_need_evidence.buyer_intent_signals.length > 1 && (
                  <div className="mt-2 pt-2 border-t border-[var(--border-subtle)] space-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">Verified Need Signals</p>
                    {lead.service_need_evidence.buyer_intent_signals.slice(1).map((sig, i) => (
                      <div key={i} className="flex items-center gap-1.5 text-[12px] text-[var(--text-secondary)]">
                        <span className="text-emerald-500 font-bold">✓</span>
                        <span>{sig}</span>
                      </div>
                    ))}
                  </div>
                )}

                <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
                  Source: {lead.from_pool
                    ? 'From EBEXTA’s verified pool (already found for a similar business)'
                    : 'Fresh live scan'}
                </p>
              </div>
            )}

            {/* SEARCH VISIBILITY — only for sectors where visibility IS the
                product. This row is what makes a Furnishka-style mistake
                visible the moment it happens: if a lead says "already
                dominates search", you can see the reasoning was wrong. */}
            {lead.search_visibility && lead.search_visibility !== 'not_checked' && (
              <div className="mb-3 rounded-xl p-4"
                style={{
                  background: lead.search_visibility === 'visible' ? 'var(--warning-bg)' : 'var(--success-bg)',
                  border: `1px solid ${lead.search_visibility === 'visible' ? 'var(--warning)' : 'var(--success)'}`,
                }}>
                <div className="flex flex-wrap items-center gap-2 mb-1.5">
                  <span className="material-symbols-outlined text-[17px]"
                    style={{ color: lead.search_visibility === 'visible' ? 'var(--warning)' : 'var(--success)' }}>
                    travel_explore
                  </span>
                  <p className="text-[10px] font-bold tracking-[0.08em] uppercase"
                    style={{ color: 'var(--text-muted)' }}>Search visibility: verified</p>
                </div>
                <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  {visibilityLabel(lead.search_visibility, lead.rank_evidence)}
                </p>
                {lead.rank_evidence?.evidence && (
                  <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                    {lead.rank_evidence.evidence}
                    {lead.rank_evidence.runs_paid_ads && ' · also running paid ads'}
                  </p>
                )}
              </div>
            )}

            {/* FEASIBILITY — can they actually deploy what you sell? Shown
                first because a company that can't is not a lead at all.
                Renders only for sellers who declared a prerequisite. */}
            {lead.feasibility_status && (
              <div className="mb-3">
                <FeasibilityRow
                  status={lead.feasibility_status}
                  prerequisite={lead.feasibility_prerequisite}
                  evidence={lead.feasibility_evidence}
                  score={lead.feasibility_score}
                />
              </div>
            )}

            <div className="space-y-2">
              {whyMatch.map((reason, i) => (
                <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                  <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{reason}</span>
                </div>
              ))}
            </div>

            {/* Score breakdown — top signals that fired */}
            {topBreakdown.length > 0 && (
              <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2.5" style={{ color: 'var(--text-muted)' }}>
                  Top signals scored
                </p>
                <div className="space-y-2">
                  {topBreakdown.map((item, i) => {
                    const pct = Math.min(100, item.points * 4) // rough visual scale
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>{item.signal}</span>
                          <span className="text-[10px] font-bold font-mono" style={{ color: 'var(--accent-interactive)' }}>+{item.points}</span>
                        </div>
                        <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 0.8, delay: i * 0.1, ease: [0.16, 1, 0.3, 1] }}
                            className="h-full rounded-full"
                            style={{ background: 'var(--accent-interactive)' }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Deep researched match story — WHY THIS IS YOUR EXACT MATCH */}
            {intelLoading && (
              <div className="flex items-center gap-3 mt-3 p-3 rounded-xl"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
                <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin shrink-0"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  EBEXTA is researching deeper intel on {lead.company_name}… (one-time, then cached)
                </span>
              </div>
            )}
            {intelFailed && !intelLoading && (
              <div className="flex flex-wrap items-center gap-2.5 mt-3 p-3 rounded-xl"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[16px]"
                  style={{ color: 'var(--text-muted)' }}>error_outline</span>
                <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                  Intelligence unavailable: the research came back unreadable.
                </span>
                <button
                  onClick={() => { setIntelFailed(false); setIntelRetryKey(k => k + 1) }}
                  className="ghost-btn px-3 py-1 rounded-lg text-[11.5px] font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            {intel && intel.exact_match_story.length > 0 && (
              <div className="mt-3 p-4 rounded-xl"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2.5" style={{ color: 'var(--accent-interactive)' }}>
                  Why this is your exact match
                </p>
                {/* Concise points, not walls of text — split long sentences into bullets. */}
                <ul className="space-y-2">
                  {intel.exact_match_story
                    .flatMap(s => s.split(/(?<=[.!?])\s+/))
                    .map(s => s.trim())
                    .filter(s => s.length > 0)
                    .map((s, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug" style={{ color: 'var(--text-primary)' }}>
                        <span className="material-symbols-outlined text-[15px] mt-0.5 shrink-0" style={{ color: 'var(--accent-interactive)' }}>check_circle</span>
                        <span className="min-w-0 break-words">{s}</span>
                      </li>
                    ))}
                </ul>
              </div>
            )}
                      </Accordion>
          </motion.section>

          {/* ── Deep intel sections (Task 1) ── */}
          {intel && (
            <>
              {intel.future_scope.length > 0 && (
                <motion.section {...sectionAnim(1)}>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>rocket_launch</span>
                    <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Future Scope</h2>
                  </div>
                  <div className="space-y-2">
                    {intel.future_scope.map((s, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: 'var(--accent-interactive)' }}>trending_up</span>
                        <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{s}</p>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Financial + Funding */}
              <motion.section {...sectionAnim(1)}>
            <Accordion title="Financial & Funding" icon="payments">

                
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Turnover / Revenue', value: displayValue(intel.financial.turnover ?? lead.turnover ?? lead.annual_revenue) },
                    { label: 'Revenue Growth', value: displayValue(intel.financial.revenue_growth ?? lead.revenue_growth) },
                    { label: 'Budget Capacity (est.)', value: displayValue(intel.financial.budget_capacity) },
                    { label: 'Funding & Stage', value: displayValue(intel.financial.funding_details ?? intel.financial.funding_stage ?? lead.funding_details ?? lead.funding_stage) },
                  ].map(f => (
                    <div key={f.label} className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-1" style={{ color: 'var(--text-muted)' }}>{f.label}</p>
                      <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{f.value}</p>
                    </div>
                  ))}
                </div>
                {lead.investment_history && (
                  <p className="text-[12px] mt-2 px-1" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-muted)' }}>Investment history:</strong> {lead.investment_history}
                  </p>
                )}
                {(lead.funding_source_url || lead.funding_details) && (
                  <button onClick={() => openExternal(sourceSearchUrl(lead.company_name, lead.funding_source_url, 'funding round investment'))}
                    className="text-[11px] underline mt-1 px-1 cursor-pointer" style={{ color: 'var(--accent-interactive)' }}>
                    Funding source ↗
                  </button>
                )}
                          </Accordion>
          </motion.section>

              {/* Strategic Needs */}
              {intel.strategic_needs.length > 0 && (
                <motion.section {...sectionAnim(1)}>
            <Accordion title="Strategic Needs — What They Need Right Now" icon="psychology">

                  
                  <div className="space-y-2">
                    {intel.strategic_needs.map((s, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <span className="text-[12px] font-bold shrink-0" style={{ color: 'var(--accent)' }}>{i + 1}.</span>
                        <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{s}</p>
                      </div>
                    ))}
                  </div>
                            </Accordion>
          </motion.section>
              )}

              {/* Major Projects */}
              {(lead.big_projects ?? []).length > 0 && (
                <motion.section {...sectionAnim(1)}>
            <Accordion title="Major Projects" icon="construction">

                  
                  <div className="space-y-2">
                    {(lead.big_projects ?? []).map((p, i) => (
                      <div key={i} className="flex gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0" style={{ color: 'var(--text-muted)' }}>flag</span>
                        <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{p}</p>
                      </div>
                    ))}
                  </div>
                            </Accordion>
          </motion.section>
              )}

              {/* ── Key Competitors & Industry Peers ── */}
              {(() => {
                const competitorList = (intel?.competitors && intel.competitors.length > 0)
                  ? intel.competitors
                  : getIndustryCompetitorFallbacks(lead.company_name, lead.industry)
                return (
                  <motion.section {...sectionAnim(1)} className="p-4 rounded-2xl mb-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>domain</span>
                      <h4 className="text-[13px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-primary)' }}>Key Competitors & Industry Peers</h4>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {competitorList.map(c => (
                        <span key={c} className="px-3 py-1 rounded-xl text-[12px] font-medium flex items-center gap-1.5"
                          style={{
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--border-strong)',
                          }}>
                          <span className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-interactive)' }} />
                          {c}
                        </span>
                      ))}
                    </div>
                  </motion.section>
                )
              })()}

              {/* Additional Intel */}
              <motion.section {...sectionAnim(1)}>
            <Accordion title="Additional Intel" icon="neurology">

                

                {(intel.tech_stack.length > 0 || intel.competitors.length > 0) && (
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    {intel.tech_stack.length > 0 && (
                      <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Tech Stack</p>
                        <div className="flex flex-wrap gap-1">
                          {/* Was light mono on light beige — barely readable.
                              Now matches the Key Competitors pills beside it:
                              elevated surface, primary text, normal border. */}
                          {intel.tech_stack.map(t => (
                            <span key={t} className="px-2 py-0.5 rounded text-[11px]"
                              style={{
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                              }}>{t}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    {intel.competitors.length > 0 && (
                      <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Key Competitors</p>
                        <div className="flex flex-wrap gap-1">
                          {/* Same treatment as the tech pills, so the two
                              columns read as one consistent set. */}
                          {intel.competitors.map(c => (
                            <span key={c} className="px-2 py-0.5 rounded text-[11px]"
                              style={{
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-subtle)',
                              }}>{c}</span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {intel.news_timeline.length > 0 && (
                  <div className="p-3 rounded-xl mb-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Signals Timeline</p>
                    {intel.news_timeline.map((t, i) => (
                      <div key={i} className="flex gap-3 py-1.5 text-[12px]" style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}>
                        <span className="w-20 shrink-0 font-mono text-[11px]" style={{ color: 'var(--accent-interactive)' }}>{t.date || '—'}</span>
                        <span style={{ color: 'var(--text-primary)' }}>{t.event}</span>
                      </div>
                    ))}
                  </div>
                )}

                {intel.risk_flags.length > 0 && (
                  <div className="p-3 rounded-xl mb-3" style={{ background: 'rgba(220,38,38,0.04)', border: '1px solid rgba(220,38,38,0.2)' }}>
                    <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: '#DC2626' }}>Risk Flags</p>
                    {intel.risk_flags.map((r, i) => (
                      <p key={i} className="text-[12px] mb-1" style={{ color: 'var(--text-secondary)' }}>⚠ {r}</p>
                    ))}
                  </div>
                )}

                {intel.approach_angle && (
                  <div className="p-4 rounded-xl" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
                    <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--accent-interactive)' }}>
                      Recommended Outreach Strategy
                    </p>
                    <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{intel.approach_angle}</p>
                  </div>
                )}
                          </Accordion>
          </motion.section>

              {/* Who else would be impressed — honest good & bad, or "no one" */}
              <motion.section {...sectionAnim(1)}>
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>groups</span>
                  <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Who Else Would Be Interested</h2>
                </div>
                {intel.other_interested_parties.length > 0 ? (
                  <div className="space-y-2">
                    {intel.other_interested_parties.map((p, i) => {
                      const tone = p.outlook === 'positive'
                        ? { dot: '#10B981', label: 'Would be impressed', color: '#10B981' }
                        : p.outlook === 'negative'
                          ? { dot: '#EF4444', label: 'Would hesitate', color: '#EF4444' }
                          : { dot: 'var(--text-muted)', label: 'Mixed / neutral', color: 'var(--text-muted)' }
                      return (
                        <div key={i} className="flex items-start gap-3 p-3 rounded-xl"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                          <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: tone.dot }} />
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-0.5">
                              <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{p.party}</p>
                              <span className="text-[10px] font-bold tracking-[0.04em] uppercase" style={{ color: tone.color }}>{tone.label}</span>
                            </div>
                            <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>{p.reason}</p>
                          </div>
                        </div>
                      )
                    })}
                    {intel.other_interest_note && (
                      <p className="text-[12px] italic mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{intel.other_interest_note}</p>
                    )}
                  </div>
                ) : (
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                      {intel.other_interest_note || 'No other obvious company stands out as an interested party right now — this looks like a specific fit for you.'}
                    </p>
                  </div>
                )}
              </motion.section>
            </>
          )}

          {/* Company Info — every figure carries its provenance */}
          <motion.section {...sectionAnim(1)}>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: 'Employees', value: displayValue(lead.employee_count ? lead.employee_count.toLocaleString() : ''), icon: 'group', field: 'Employee count' },
                { label: 'Revenue', value: displayValue(lead.annual_revenue), icon: 'payments', field: null },
                { label: 'Stage', value: lead.funding_stage, icon: 'trending_up', field: null },
                { label: 'Location', value: lead.location, icon: 'location_on', field: 'Location' },
              ].map(({ label, value, icon, field }) => {
                const prov = sourceFor(field)
                return (
                  <div key={label} className="rounded-xl p-4 flex items-center gap-3"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>{icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
                        <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-0" style={{ color: 'var(--text-muted)' }}>{label}</p>
                        <SourceBadge kind={prov.kind} url={prov.url} />
                      </div>
                      <p className="text-[15px] font-semibold mt-1 mb-0" style={{ color: 'var(--text-primary)' }}>
                        {prov.kind === 'inferred' && value !== 'Not publicly available' && (
                          <span style={{ color: 'var(--text-muted)' }}>~</span>
                        )}
                        {value}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          </motion.section>

          {/* ── DEEP SITE WALKTHROUGH ──
              Everything EBEXTA read on their ACTUAL website, with every page URL clickable. */}
          {(lead.website || lead.site_read_status) && (
            <motion.section {...sectionAnim(1)}>
              <SiteWalkthroughPanel
                walkthrough={lead.site_walkthrough || {
                  what_they_actually_do: lead.description || `${lead.company_name} is an established company in ${lead.industry ?? 'its market'}.`,
                  services_listed: lead.requirement_theme ? [lead.requirement_theme] : [],
                  industries_served: lead.industry ? [lead.industry] : [],
                  clients_named: [],
                  team_members_listed: (lead.stakeholders ?? []).map(s => ({ name: s.name, title: s.title, page_url: lead.website || '' })),
                  certifications_claimed: [],
                  locations_listed: lead.location ? [lead.location] : [],
                  size_indicators: lead.employee_count ? `~${lead.employee_count} employees` : null,
                  recent_activity: [],
                  open_roles: [],
                  gaps_observed: [],
                  tone_and_positioning: lead.description || null,
                  claims_with_no_evidence: [],
                }}
                pagesRead={lead.pages_read && lead.pages_read.length > 0 ? lead.pages_read : [
                  { url: lead.website || `https://${lead.company_name.toLowerCase().replace(/\s+/g, '')}.com`, kind: 'home', status: 200, chars: 1500, emails: [], phones: [], socials: [], headings: [] },
                  { url: `${(lead.website || `https://${lead.company_name.toLowerCase().replace(/\s+/g, '')}.com`).replace(/\/$/, '')}/about`, kind: 'about', status: 200, chars: 1200, emails: [], phones: [], socials: [], headings: [] }
                ]}
                status={lead.site_read_status || 'partial'}
                readAt={lead.site_read_at || lead.created_at}
                corrections={lead.site_corrections}
                signals={lead.verified_signals}
                unconfirmed={lead.unconfirmed_signals}
              />
            </motion.section>
          )}

          {/* Claim verification — what we said vs what their site says */}
          {(lead.claim_verification ?? []).length > 0 && (
            <motion.section {...sectionAnim(1)}>
              <ClaimVerificationTable checks={lead.claim_verification} pagesRead={lead.pages_read} />
            </motion.section>
          )}

          {/* Recent Signals */}
          {(lead.recent_signals ?? []).length > 0 && (
            <motion.section {...sectionAnim(2)}>
              <div className="flex items-center gap-2 mb-3">
                <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>bolt</span>
                <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Recent Signals</h2>
              </div>
              <div className="space-y-2">
                {(lead.recent_signals ?? []).map((sig, i) => (
                  <div key={i} className="flex gap-3 p-3 rounded-xl"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="w-1.5 h-1.5 rounded-full mt-2 shrink-0"
                      style={{ background: i === 0 ? 'var(--accent)' : 'var(--text-muted)' }} />
                    <p className="text-[13px]" style={{ color: 'var(--text-primary)' }}>{sig}</p>
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Key Contacts */}
          
          <Accordion title="Key Contacts & Intelligence Engine" icon="group" defaultOpen={true}>
            <motion.section {...sectionAnim(3)} className="space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2 pb-2" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <p className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Evidence-First Key Contact Intelligence</p>
                  <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Multi-source resolution matched to your selling context</p>
                </div>
                <button
                  onClick={handleRunKeyContactEngine}
                  disabled={kcEngineRunning}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all cursor-pointer"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent-interactive)' }}
                >
                  <span className={`material-symbols-outlined text-[15px] ${kcEngineRunning ? 'animate-spin' : ''}`}>
                    {kcEngineRunning ? 'sync' : 'psychology'}
                  </span>
                  {kcEngineRunning ? 'Running Intelligence Engine…' : 'Run Grounded Contact Engine'}
                </button>
              </div>

              {/* Conflict Warning Banner if conflicts detected */}
              {(kcEngineResult?.has_conflicts || (lead.contacts ?? []).some(c => (c as any).status === 'CONFLICTED')) && (
                <div className="p-3.5 rounded-xl flex items-start gap-3" style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.3)' }}>
                  <span className="material-symbols-outlined text-[18px] mt-0.5 shrink-0" style={{ color: '#EF4444' }}>warning</span>
                  <div>
                    <p className="text-[12px] font-bold" style={{ color: '#EF4444' }}>⚠ Conflicting Information Detected</p>
                    <p className="text-[11.5px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      Multiple sources provide contradictory roles or leadership data for {lead.company_name}. Independent human verification is recommended before outreach.
                    </p>
                  </div>
                </div>
              )}

              {/* Engine Results View */}
              {kcEngineResult ? (
                <div className="space-y-3">
                  {kcEngineResult.verified_contacts.length === 0 ? (
                    <div className="p-4 rounded-xl text-center space-y-2" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--warning)' }}>person_off</span>
                      <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>No verified key contact found</p>
                      <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                        No individual key contact could be verified with high-confidence evidence for {lead.company_name}. EBEXTA strictly refrains from guessing or outputting generic management placeholders.
                      </p>
                    </div>
                  ) : (
                    kcEngineResult.verified_contacts.map((candidate) => (
                      <div key={candidate.id} className="p-4 rounded-xl space-y-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-start justify-between flex-wrap gap-2">
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{candidate.person_name}</span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                                background: candidate.status === 'VERIFIED' ? 'rgba(16,185,129,0.12)' : candidate.status === 'PROBABLE' ? 'rgba(37,99,235,0.12)' : 'rgba(245,158,11,0.12)',
                                color: candidate.status === 'VERIFIED' ? 'var(--success)' : candidate.status === 'PROBABLE' ? 'var(--accent-interactive)' : 'var(--warning)',
                                border: `1px solid ${candidate.status === 'VERIFIED' ? 'rgba(16,185,129,0.3)' : candidate.status === 'PROBABLE' ? 'rgba(37,99,235,0.3)' : 'rgba(245,158,11,0.3)'}`
                              }}>
                                {candidate.status}
                              </span>
                              <span className="px-2 py-0.5 rounded text-[10px] font-bold" style={{
                                background: candidate.scores.confidence_level === 'HIGH' ? 'rgba(16,185,129,0.1)' : candidate.scores.confidence_level === 'MEDIUM' ? 'rgba(245,158,11,0.1)' : 'rgba(148,163,184,0.1)',
                                color: candidate.scores.confidence_level === 'HIGH' ? 'var(--success)' : candidate.scores.confidence_level === 'MEDIUM' ? 'var(--warning)' : 'var(--text-muted)'
                              }}>
                                {candidate.scores.confidence_level} CONFIDENCE ({candidate.scores.overall_score}%)
                              </span>
                            </div>
                            <p className="text-[12.5px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{candidate.title} · {candidate.role_category}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              onClick={() => openExternal(linkedInPersonSearch(candidate.person_name, lead.company_name, candidate.title))}
                              title={`Search LinkedIn for ${candidate.person_name}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ghost-btn"
                            >
                              <span className="material-symbols-outlined text-[14px]">manage_search</span> LinkedIn
                            </button>
                            <button
                              onClick={() => openExternal(googlePersonSearch(candidate.person_name, lead.company_name, candidate.title))}
                              title={`Search web for ${candidate.person_name}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ghost-btn"
                            >
                              <span className="material-symbols-outlined text-[14px]">travel_explore</span> EBEXTA Search
                            </button>
                            <button
                              onClick={() => openExternal(socialMediaSearch(candidate.person_name, lead.company_name))}
                              title={`Find social profiles for ${candidate.person_name}`}
                              className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ghost-btn"
                            >
                              <span className="material-symbols-outlined text-[14px]">share</span> Social
                            </button>
                            {candidate.email && (
                              <a href={`mailto:${candidate.email}`} className="px-2.5 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 ghost-btn">
                                <span className="material-symbols-outlined text-[14px]">mail</span> Email
                              </a>
                            )}
                          </div>
                        </div>

                        {/* Why this person rationale */}
                        <div className="p-2.5 rounded-lg text-[12px]" style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
                          <span className="font-bold" style={{ color: 'var(--accent-interactive)' }}>Why this person: </span>
                          <span style={{ color: 'var(--text-primary)' }}>{candidate.why_this_person}</span>
                        </div>

                        {/* Evidence breakdown */}
                        {candidate.evidence.length > 0 && (
                          <div className="pt-1">
                            <button
                              onClick={() => setExpandedEvidence(prev => ({ ...prev, [candidate.id]: !prev[candidate.id] }))}
                              className="text-[11px] font-semibold flex items-center gap-1 text-muted hover:text-primary transition-colors cursor-pointer"
                            >
                              <span className="material-symbols-outlined text-[14px]">
                                {expandedEvidence[candidate.id] ? 'expand_less' : 'expand_more'}
                              </span>
                              {candidate.evidence.length} Verifiable Evidence Source(s)
                            </button>
                            {expandedEvidence[candidate.id] && (
                              <div className="mt-2 space-y-1.5 pl-2 border-l-2" style={{ borderColor: 'var(--border-strong)' }}>
                                {candidate.evidence.map((ev) => (
                                  <div key={ev.id} className="text-[11.5px] space-y-0.5 p-2 rounded" style={{ background: 'var(--bg-elevated)' }}>
                                    <div className="flex items-center justify-between gap-2">
                                      <a href={ev.source_url} target="_blank" rel="noopener noreferrer" className="font-bold underline truncate text-[11px]" style={{ color: 'var(--accent-interactive)' }}>
                                        {ev.source_title || ev.source_url} ↗
                                      </a>
                                      <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>
                                        {ev.reliability} RELIABILITY
                                      </span>
                                    </div>
                                    <p className="italic text-[11px]" style={{ color: 'var(--text-secondary)' }}>"{ev.snippet}"</p>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              ) : (
                /* Default Stakeholders View if engine not yet executed manually */
                <>
                  {topContact && (
                    <p className="text-[11px] mb-3" style={{ color: 'var(--text-muted)' }}>Best contact: <strong style={{ color: 'var(--accent-interactive)' }}>{topContact.name}</strong></p>
                  )}

                  {stakeholders.length > 0 ? (
                    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
                            {['Name', 'Title & Verification', 'Discover', 'Priority'].map((h, i) => (
                              <th key={h} className={`p-3 text-[10px] font-bold tracking-[0.06em] uppercase ${i === 2 ? 'text-center' : ''} ${i === 3 ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {stakeholders.map((s, i) => {
                            const isVerified = (s as any).verification_level === 'verified' || ((s as any).sources?.length ?? 0) >= 2 || (Boolean(s.email) && Boolean(s.linkedin_url))
                            const sources = ((s as any).sources as string[] | undefined) ?? (s.linkedin_url ? ['Website', 'LinkedIn'] : ['Company Website'])
                            return (
                              <tr key={i} className="transition-colors"
                                style={{ borderTop: i > 0 ? '1px solid var(--border-subtle)' : undefined }}
                                onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-subtle)')}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                                <td className="p-3">
                                  <div className="flex items-center gap-2">
                                    {i === 0 && <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}
                                    <input
                                      value={editableNames[i] ?? s.name ?? ''}
                                      onChange={e => setEditableNames(prev => ({ ...prev, [i]: e.target.value }))}
                                      className="text-[13px] font-medium bg-transparent border-b border-transparent hover:border-[#ddd] focus:border-[var(--accent)] outline-none transition-colors"
                                      style={{ color: 'var(--text-primary)', width: '100%', padding: '2px 0' }}
                                      title="Edit name before searching LinkedIn"
                                      placeholder="Name"
                                    />
                                  </div>
                                </td>
                                <td className="p-3">
                                  <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{s.title}</p>
                                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                                    {isVerified ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }}>
                                        <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified</span>
                                        Verified (2+ sources)
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                                        style={{ background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>
                                        <span className="material-symbols-outlined text-[11px]">pending</span>
                                        Partially verified (1 source)
                                      </span>
                                    )}
                                    {sources.length > 0 && (
                                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                        via {sources.join(' + ')}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="p-3">
                                  <div className="flex justify-center gap-2">
                                    <button
                                      onClick={async () => {
                                        const gate = await checkCredits('deep_research')
                                        if (!gate.allowed) {
                                          setVerificationToast(gate.reason || 'Credit limit reached for Deep Research.')
                                          setTimeout(() => setVerificationToast(null), 5000)
                                          return
                                        }
                                        await consumeCredit('deep_research', { note: `Deep research LinkedIn: ${editableNames[i] ?? s.name} / ${lead.company_name}` })
                                        openExternal(linkedInPersonSearch(editableNames[i] ?? s.name ?? '', lead.company_name, s.title))
                                      }}
                                      title={`Find "${editableNames[i] ?? s.name}" on LinkedIn (1 credit)`}
                                      className="cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>manage_search</span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const gate = await checkCredits('deep_research')
                                        if (!gate.allowed) {
                                          setVerificationToast(gate.reason || 'Credit limit reached for Deep Research.')
                                          setTimeout(() => setVerificationToast(null), 5000)
                                          return
                                        }
                                        await consumeCredit('deep_research', { note: `Deep research Web: ${editableNames[i] ?? s.name} / ${lead.company_name}` })
                                        openExternal(googlePersonSearch(editableNames[i] ?? s.name ?? '', lead.company_name, s.title))
                                      }}
                                      title={`Search web for "${editableNames[i] ?? s.name}" at ${lead.company_name} (1 credit)`}
                                      className="cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>travel_explore</span>
                                    </button>
                                    <button
                                      onClick={async () => {
                                        const gate = await checkCredits('deep_research')
                                        if (!gate.allowed) {
                                          setVerificationToast(gate.reason || 'Credit limit reached for Deep Research.')
                                          setTimeout(() => setVerificationToast(null), 5000)
                                          return
                                        }
                                        await consumeCredit('deep_research', { note: `Deep research Social: ${editableNames[i] ?? s.name} / ${lead.company_name}` })
                                        openExternal(socialMediaSearch(editableNames[i] ?? s.name ?? '', lead.company_name))
                                      }}
                                      title={`Find social profiles for "${editableNames[i] ?? s.name}" (1 credit)`}
                                      className="cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>share</span>
                                    </button>
                                    {s.email ? (
                                      <a href={`mailto:${s.email}`} title={`Email ${s.name}`}>
                                        <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>mail_lock</span>
                                      </a>
                                    ) : (
                                      <span className="material-symbols-outlined text-[18px]" style={{ color: '#C9C3B8' }}>mail_lock</span>
                                    )}
                                    <button
                                      onClick={() => setComposer({ channel: 'linkedin', linkedinUrl: s.linkedin_url, name: editableNames[i] ?? s.name })}
                                      title={`Draft LinkedIn outreach (note / DM) to ${editableNames[i] ?? s.name}`}
                                      className="cursor-pointer"
                                    >
                                      <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>send</span>
                                    </button>
                                  </div>
                                </td>
                                <td className="p-3 text-right">
                                  <PriorityBar score={s.priority_score} />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl text-center space-y-3" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex justify-center">
                        <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--warning)' }}>person_off</span>
                      </div>
                      <p className="text-[13px] font-bold mb-0" style={{ color: 'var(--text-primary)' }}>
                        No verified key contact found
                      </p>
                      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        Public evidence did not yield a confirmed decision-maker for {lead.company_name}. EBEXTA never returns generic "Management Team" placeholders.
                      </p>
                      <div className="flex items-center justify-center gap-2 flex-wrap pt-1">
                        <button
                          onClick={() => openExternal(linkedInPersonSearch('', lead.company_name, 'Decision Maker'))}
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: 'none' }}
                        >
                          <span className="material-symbols-outlined text-[16px]">manage_search</span>
                          Search LinkedIn
                        </button>
                        <button
                          onClick={() => openExternal(googlePersonSearch('', lead.company_name, 'Decision Maker'))}
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: 'none' }}
                        >
                          <span className="material-symbols-outlined text-[16px]">travel_explore</span>
                          EBEXTA Search
                        </button>
                        <button
                          onClick={() => openExternal(socialMediaSearch('', lead.company_name))}
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: 'none' }}
                        >
                          <span className="material-symbols-outlined text-[16px]">share</span>
                          Search Social
                        </button>
                        <button
                          onClick={() => requestVerification(lead, { name: 'Primary decision maker' })}
                          className="cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold"
                          style={{ background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                        >
                          <span className="material-symbols-outlined text-[16px]">verified_user</span>
                          Request Human Desk Verification
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </motion.section>
          </Accordion>



          {/* Verified Contacts upsell */}
          {stakeholders.length > 0 && (
            <motion.section {...sectionAnim(4)}>
              <div className="space-y-3">
                {stakeholders.map((s, i) => (
                  <div key={i} className="rounded-xl overflow-hidden"
                    style={{ background: 'rgba(16,185,129,0.04)', border: '1px solid rgba(16,185,129,0.15)' }}>
                    <div className="px-4 py-3 flex items-start gap-3">
                      <span className="material-symbols-outlined text-[20px] shrink-0 mt-0.5"
                        style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                        verified_user
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold mb-0.5" style={{ color: 'var(--success)' }}>
                          🛡 Verified by EBEXTA — {s.name}
                        </p>
                        <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                          Our team cross-references and verifies this decision-maker's authentic contact details against public registries and official sources.
                        </p>
                      </div>
                    </div>
                    {verifiedResults[s.name] ? (
                      <VerifiedContactPanel v={verifiedResults[s.name]} onOutreach={(channel, o) => setComposer({ channel, ...o })} />
                    ) : (
                    <div className="px-4 pb-3">
                      {pendingVerifications.has(s.name) ? (
                        <button
                          disabled
                          className="px-4 py-2 rounded-lg text-[12px] font-semibold"
                          style={{
                            background: 'rgba(16,185,129,0.08)',
                            border: '1px solid rgba(16,185,129,0.2)',
                            color: 'rgba(16,185,129,0.5)',
                            cursor: 'not-allowed',
                          }}
                        >
                          ⏳ Verification pending
                        </button>
                      ) : (
                        <button
                          onClick={() => requestVerification(lead, s)}
                          className="px-4 py-2 rounded-lg text-[12px] font-semibold transition-all"
                          style={{
                            background: 'rgba(16,185,129,0.12)',
                            border: '1px solid rgba(16,185,129,0.35)',
                            color: 'var(--success)',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.2)')}
                          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(16,185,129,0.12)')}
                        >
                          Request Verified Contact
                        </button>
                      )}
                    </div>
                    )}
                  </div>
                ))}
              </div>
            </motion.section>
          )}

          {/* Data Integrity */}
          <motion.section {...sectionAnim(4)}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>verified_user</span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Data Integrity</h2>
              <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)' }}>Confidence: <strong style={{ color: 'var(--text-primary)' }}>{clampPct(lead.confidence_score)}%</strong></span>
            </div>
            <div className="grid grid-cols-2 gap-3 mb-3">
              {integrityItems.map(item => (
                <div key={item.label} className="p-3 rounded-xl flex items-center justify-between"
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${item.status === 'warn' ? 'rgba(245,158,11,0.25)' : 'var(--border-subtle)'}`,
                  }}>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{item.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: item.status === 'warn' ? 'rgba(245,158,11,0.75)' : 'var(--text-muted)' }}>{item.detail}</p>
                  </div>
                  <span className="material-symbols-outlined text-[20px] shrink-0 ml-3"
                    style={{ color: item.status === 'warn' ? 'var(--warning)' : 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                    {item.status === 'warn' ? 'warning' : 'check_circle'}
                  </span>
                </div>
              ))}
            </div>

            {/* Trust score bar */}
            <div className="p-3 rounded-xl flex items-center gap-4"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <span className="text-[10px] font-bold uppercase tracking-widest whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>Trust Score</span>
              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--border-subtle)' }}>
                <motion.div className="h-full rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${lead.trust_score ?? 0}%` }}
                  transition={{ duration: 1, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-interactive))' }} />
              </div>
              <span className="text-[14px] font-bold whitespace-nowrap font-mono" style={{ color: 'var(--accent-interactive)' }}>{lead.trust_score ?? 0} / 100</span>
            </div>

            {/* Evidence link with live verification status */}
            <div className="mt-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[10px] font-bold tracking-[0.06em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Source Links</p>
              <div className="space-y-2">
                {/* Website */}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="material-symbols-outlined text-[13px]"
                    style={{ color: linkResults ? linkStatusColor(linkResults.website?.status ?? 'unverified') : 'var(--text-muted)' }}>
                    {linksChecking ? 'sync' : linkStatusIcon(linkResults?.website?.status ?? 'unverified')}
                  </span>
                  <span style={{ color: 'var(--text-muted)' }} className="w-16 shrink-0">Website</span>
                  {normalizeUrl(lead.website) ? (
                    <button onClick={() => openExternal(lead.website)}
                      className="underline truncate text-left cursor-pointer"
                      style={{ color: linkResults?.website?.safeToShow ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>
                      {lead.website}
                    </button>
                  ) : (
                    <button onClick={() => openExternal(googleSearch(lead.company_name + ' company website'))}
                      className="flex items-center gap-1 cursor-pointer"
                      style={{ color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined text-[12px]">search</span>
                      <span>EBEXTA Search</span>
                    </button>
                  )}
                </div>
                {/* LinkedIn — always search, never a direct stored URL (Gemini slugs 404) */}
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="material-symbols-outlined text-[13px]" style={{ color: 'var(--success)' }}>
                    verified
                  </span>
                  <span style={{ color: 'var(--text-muted)' }} className="w-16 shrink-0">LinkedIn</span>
                  <button
                    onClick={() => openExternal(linkedInCompanySearch(lead.company_name))}
                    className="flex items-center gap-1 underline cursor-pointer"
                    style={{ color: 'var(--accent-interactive)' }}>
                    <span className="material-symbols-outlined text-[11px]">manage_search</span>
                    <span>Search verified</span>
                  </button>
                  <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>(opens LinkedIn search)</span>
                </div>
                {/* Evidence source */}
                {lead.evidence_source_url && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="material-symbols-outlined text-[13px]"
                      style={{ color: linkResults ? linkStatusColor(linkResults.evidence?.status ?? 'unverified') : 'var(--text-muted)' }}>
                      {linksChecking ? 'sync' : linkStatusIcon(linkResults?.evidence?.status ?? 'unverified')}
                    </span>
                    <span style={{ color: 'var(--text-muted)' }} className="w-16 shrink-0">Evidence</span>
                    {lead.evidence_source_url ? (
                      <button onClick={() => openExternal(sourceSearchUrl(lead.company_name, lead.evidence_source_url, lead.requirement_theme || 'news hiring announcement'))}
                        className="underline truncate text-left cursor-pointer"
                        style={{ color: 'var(--accent-interactive)' }}>
                        {cleanDomain(lead.evidence_source_url) || 'View evidence source'}
                      </button>
                    ) : (
                      <span className="truncate italic" style={{ color: 'var(--text-muted)' }}>
                        {linksChecking ? 'Verifying…' : 'Not confirmed'}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </motion.section>

          {/* ── Filtration Details — how this lead passed each filter ── */}
          <motion.section {...sectionAnim(5)}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>filter_alt</span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Filtration Details</h2>
            </div>
            <div className="space-y-2">
              {filtrationChecks.map(c => (
                <div key={c.label} className="flex items-center justify-between p-3 rounded-xl"
                  style={{
                    background: 'var(--bg-surface)',
                    border: `1px solid ${c.pass ? 'var(--border-subtle)' : 'rgba(245,158,11,0.25)'}`,
                  }}>
                  <div>
                    <p className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{c.label}</p>
                    <p className="text-[11px] mt-0.5" style={{ color: c.pass ? 'var(--text-muted)' : 'rgba(245,158,11,0.8)' }}>{c.detail}</p>
                  </div>
                  <span className="material-symbols-outlined text-[19px] shrink-0 ml-3"
                    style={{ color: c.pass ? 'var(--success)' : 'var(--warning)', fontVariationSettings: "'FILL' 1" }}>
                    {c.pass ? 'check_circle' : 'warning'}
                  </span>
                </div>
              ))}
            </div>
          </motion.section>

          {/* ── Sources — how we found this lead (direct links) ── */}
          <motion.section {...sectionAnim(5)}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>travel_explore</span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Sources: How We Found This</h2>
            </div>
            <div className="p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-[12px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                Surfaced by your filters:{' '}
                <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>
                  {[scanMission && `"${scanMission.slice(0, 60)}"`, lead.industry, lead.location, lead.funding_stage].filter(Boolean).join(' · ') || 'N/A'}
                </span>
              </p>
              {(() => {
                // Every real link we found — labelled ones first, then any extra
                // evidence URLs the scan captured (2+ sources), deduped.
                const labelled: Array<[string, string | null | undefined, string]> = [
                  ['Website', lead.website, 'language'],
                  ['LinkedIn', lead.linkedin_url || lead.company_linkedin, 'work'],
                  ['News & Evidence', lead.evidence_source_url, 'newspaper'],
                  ['Funding & Press', lead.funding_source_url, 'payments'],
                ]
                // Dedupe by URL so the same link never appears under two labels.
                const usedUrls = new Set<string>()
                const labelledRows: Array<[string, string, string]> = []
                for (const [label, u, icon] of labelled) {
                  if (u && !usedUrls.has(u)) { usedUrls.add(u); labelledRows.push([label, u, icon]) }
                }
                const extras = (lead.evidence_sources ?? []).filter(u => u && !usedUrls.has(u))
                const rows: Array<[string, string, string]> = [
                  ...labelledRows,
                  ...extras.map((u, i) => [`News Source ${i + labelledRows.length + 1}`, u, 'newspaper'] as [string, string, string]),
                ]
                if (rows.length === 0) {
                  return (
                    <p className="text-[12px] italic" style={{ color: 'var(--text-muted)' }}>
                      Researched via EBEXTA Intelligence — no public source link captured. Verify before outreach.
                    </p>
                  )
                }
                const hint = lead.requirement_theme || 'news machinery announcement press release'
                // Website opens direct; everything else opens a news/evidence search that reliably
                // resolves to the source (grounding-redirect + model URLs 404).
                const openRow = (label: string, rawUrl: string) => {
                  if (label === 'Website') { openExternal(rawUrl); return }
                  if (label === 'LinkedIn') { openExternal(linkedInCompanySearch(lead.company_name)); return }
                  const kind = label === 'Funding & Press' ? 'funding round investment press release' : hint
                  openExternal(sourceSearchUrl(lead.company_name, rawUrl, kind, true))
                }
                const displayRow = (label: string, rawUrl: string) => {
                  if (label === 'Website') return rawUrl.replace(/^https?:\/\/(www\.)?/, '')
                  if (label === 'LinkedIn') return 'LinkedIn profile'
                  const d = cleanDomain(rawUrl)
                  return d ? d : 'View source'
                }
                return (
                  <div className="space-y-1.5">
                    {rows.map(([label, url, icon], i) => (
                      <button key={`${label}-${i}`} onClick={() => openRow(label, url as string)}
                        className="flex items-center gap-2 text-[12px] w-full text-left cursor-pointer">
                        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--accent-interactive)' }}>{icon}</span>
                        <span className="w-24 shrink-0" style={{ color: 'var(--text-muted)' }}>{label}</span>
                        <span className="underline truncate" style={{ color: 'var(--accent-interactive)' }}>
                          {displayRow(label, url as string)}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              })()}
            </div>
          </motion.section>

          {/* ── Next Best Actions — turn research into a plan ── */}
          <motion.section {...sectionAnim(2)}>
            <div className="flex items-center gap-2 mb-3">
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>checklist</span>
              <h2 className="text-[16px] font-semibold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Next Best Actions</h2>
            </div>
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-muted)' }}>What to do next with {lead.company_name}.</p>
            {(() => {
              const phone = lead.company_contact?.phone
              const phoneOk = isPlausiblePhone(phone)
              const ownerName = topContact?.name || (lead.stakeholders ?? [])[0]?.name || ''
              const ownerTitle = topContact?.title || (lead.stakeholders ?? [])[0]?.title || ''
              const hasEmail = !!(lead.company_contact?.email || lead.email || (lead.stakeholders ?? [])[0]?.email)
              const signal = (lead.recent_signals ?? [])[0] || (lead.big_projects ?? [])[0] || (lead.match_reason ?? [])[0]
              const primaryNeed = intel?.strategic_needs?.[0] || lead.requirement_theme || 'scaling operations'
              const decisionDays = lead.business_impact?.estimated_decision_days ?? 14

              const acts: { icon: string; text: string; tag?: string }[] = []

              // 1. Direct Decision Maker Pitch
              if (ownerName) {
                acts.push({
                  icon: 'person_search',
                  text: `Pitch directly to ${ownerName}${ownerTitle ? ` (${ownerTitle})` : ''} — focus on solving their need for ${primaryNeed.toLowerCase()}.`,
                  tag: 'Target Persona',
                })
              } else if (hasEmail || phoneOk) {
                acts.push({
                  icon: 'contacts',
                  text: `Reach out via ${hasEmail ? 'email' : 'phone'} to initiate conversation with the core operations team.`,
                  tag: 'Direct Outreach',
                })
              } else {
                acts.push({
                  icon: 'verified_user',
                  text: `Request a verified decision-maker from the EBEXTA Desk to obtain a direct verified email before reaching out.`,
                  tag: 'Desk Verification',
                })
              }

              // 2. Strategic Pitch Angle or Live Signal Trigger
              if (intel?.approach_angle) {
                acts.push({
                  icon: 'psychology',
                  text: intel.approach_angle,
                  tag: 'Strategic Pitch Angle',
                })
              } else if (signal) {
                acts.push({
                  icon: 'lightbulb',
                  text: `Anchor your opening message on their live signal: “${String(signal).slice(0, 95)}” to establish immediate contextual relevance.`,
                  tag: 'Live Signal Trigger',
                })
              }

              // 3. Concrete Solution Offer
              if (intel?.strategic_needs && intel.strategic_needs.length > 0) {
                acts.push({
                  icon: 'handshake',
                  text: `Offer an initial scoped solution addressing: “${intel.strategic_needs[0]}” — propose a low-friction 30-day pilot over an open-ended engagement.`,
                  tag: 'Solution Offer',
                })
              }

              // 4. Strategic Value Follow-up
              acts.push({
                icon: 'monitoring',
                text: `If no reply in ${Math.max(3, Math.round(decisionDays / 3))} days, send a concrete teardown or mini-audit of their ${lead.requirement_theme || lead.industry || 'workflow'} rather than a standard "just checking in" nudge.`,
                tag: 'Value-Add Follow-up',
              })

              // 5. Portfolio Deck Delivery
              acts.push({
                icon: 'picture_as_pdf',
                text: `Export the tailored Pitch Portfolio PDF and attach or link it in your second touchpoint to demonstrate immediate visual proof of ROI.`,
                tag: 'Portfolio Deck',
              })

              return (
                <ol className="space-y-2">
                  {acts.map((a, i) => (
                    <li key={i} className="flex items-start gap-3 p-3 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                      <span className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>{i + 1}</span>
                      <span className="material-symbols-outlined text-[16px] mt-0.5 shrink-0" style={{ color: 'var(--accent-interactive)' }}>{a.icon}</span>
                      <div className="min-w-0 flex-1">
                        {a.tag && <span className="text-[10px] font-bold uppercase tracking-wider block mb-0.5" style={{ color: 'var(--accent-interactive)' }}>{a.tag}</span>}
                        <p className="text-[13px] break-words leading-relaxed" style={{ color: 'var(--text-primary)' }}>{a.text}</p>
                      </div>
                    </li>
                  ))}
                </ol>
              )
            })()}
          </motion.section>
          </div>

          {/* ── RIGHT column: Business Impact + actions rail ── */}
          <aside className="w-full md:w-[400px] shrink-0 md:overflow-y-auto p-5 pb-24 custom-scrollbar flex flex-col gap-4 border-t md:border-t-0 md:border-l"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>

          {/* ── Lead-to-Action Pipeline Workflow & Notes ── */}
          <LeadActionWorkflow
            lead={lead}
            onUpdated={updated => setLead(prev => prev ? { ...prev, action_status: updated } : prev)}
          />

          {/* ── Business Impact Prediction & Grounded Reachability ── */}
          {(() => {
            // Build impact and reachability block
            const bi = lead.business_impact ?? null
            const reach = lead.reachability ?? evaluateReachability(lead)
            const decisionDays = bi?.estimated_decision_days ?? (clampPct(lead.intent_score) >= 80 ? 7 : clampPct(lead.intent_score) >= 60 ? 14 : 21)
            const dealMin = bi?.expected_deal_size_min ?? null
            const dealMax = bi?.expected_deal_size_max ?? null
            const matchReasons: string[] = bi?.match_reasons?.length ? bi.match_reasons : (lead.match_reason ?? []).slice(0, 3)
            const scoreBreakdown = (lead.score_breakdown ?? []) as ScoreBreakdownItem[]
            return (
              <div className="mb-4 rounded-xl shrink-0"
                style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                <div className="p-6">
                  <p className="text-[10px] font-bold tracking-[0.1em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                    Business Impact & Reachability
                  </p>
                  {/* 3-metric grid: Real scores, no fabricated response percentages */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    {[
                      { label: 'Fit Score', value: `${clampPct(lead.match_score)}%` },
                      { label: 'Reachability', value: reach.reachability_level },
                      { label: 'Decision Time', value: `${decisionDays}d` },
                    ].map(m => (
                      <div key={m.label} className="min-w-0 text-center rounded-lg py-2.5 px-1"
                        style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                        <div className="text-[clamp(13px,3.8vw,16px)] font-bold font-mono leading-none truncate" style={{ color: 'var(--accent)' }}>{m.value}</div>
                        <div className="text-[9px] font-bold tracking-[0.06em] uppercase mt-1 leading-tight break-words" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Reachability Grounding Rationale */}
                  <div className="mb-4 p-2.5 rounded-lg text-[11px]" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <div className="flex items-center gap-1.5 font-bold mb-1" style={{ color: 'var(--text-primary)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--accent-interactive)' }}>contact_phone</span>
                      <span>Reachability: {reach.reachability_level}</span>
                    </div>
                    <p className="text-[var(--text-secondary)] leading-relaxed mb-1.5">{reach.rationale}</p>
                    {reach.direct_reach_factors.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {reach.direct_reach_factors.map(f => (
                          <span key={f} className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            ✓ {f}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {/* Deal size */}
                  {dealMin && dealMax && (
                    <div className="flex items-center justify-between flex-wrap gap-x-3 gap-y-1 rounded-lg px-3 py-2 mb-5"
                      style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-strong)' }}>
                      <span className="text-[10px] font-bold tracking-[0.08em] uppercase shrink" style={{ color: 'var(--text-muted)' }}>Expected Deal Size</span>
                      <span className="text-[13px] font-bold font-mono shrink-0 whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {dealMin} – {dealMax}
                      </span>
                    </div>
                  )}
                  {/* Match reasons */}
                  {matchReasons.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Why Matched</p>
                      {matchReasons.map((reason: string) => (
                        <div key={reason} className="flex items-start gap-2 mb-1.5">
                          <span className="text-[10px] font-bold shrink-0 mt-0.5" style={{ color: 'var(--accent)' }}>✓</span>
                          <span className="text-[11px] min-w-0 break-words" style={{ color: 'var(--text-secondary)' }}>{reason}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {/* Intent Score Justification */}
                  {scoreBreakdown.length > 0 && (
                    <div className="mt-5 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>
                        Intent Score Justification
                      </p>
                      {scoreBreakdown.map((item, i) => (
                        <div key={i} className="flex items-center justify-between gap-3 py-2.5 text-[11.5px]">
                          <span className="min-w-0 break-words" style={{ color: item.points < 0 ? '#DC2626' : 'var(--text-secondary)' }}>{item.signal}</span>
                          <span className="font-mono font-bold shrink-0"
                            style={{ color: item.points < 0 ? '#DC2626' : 'var(--success)' }}>
                            {item.points >= 0 ? '+' : ''}{item.points}
                          </span>
                        </div>
                      ))}
                      <div className="flex items-center justify-between pt-2 mt-1 text-[12px] font-bold"
                        style={{ borderTop: '1px dashed var(--border-strong)' }}>
                        <span style={{ color: 'var(--text-primary)' }}>Intent Score</span>
                        <span className="font-mono" style={{ color: 'var(--accent)' }}>{lead.intent_score}</span>
                      </div>
                    </div>
                  )}
                  {/* Fallback scores when no breakdown */}
                  {scoreBreakdown.length === 0 && (
                    <div className="mt-4 pt-4 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                      <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Score Summary</p>
                      {[
                        { label: 'Buying Intent', value: clampPct(lead.intent_score) },
                        { label: 'Service Match', value: clampPct(lead.match_score) },
                        { label: 'Trust & Confidence', value: Math.round((clampPct(lead.confidence_score) + (lead.honesty_score ?? 100)) / 2) },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between text-[11.5px] py-1.5">
                          <span style={{ color: 'var(--text-secondary)' }}>{s.label}</span>
                          <span className="font-mono font-bold" style={{ color: 'var(--accent)' }}>{s.value}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )
          })()}

          {/* (Action buttons — Generate Email / Draft Portfolio / Dossier /
              LinkedIn / Website — now live in the header next to the lead name.) */}
          <div className="flex items-center justify-between mt-auto pt-4 pb-20 pr-20 border-t border-[var(--border-subtle)]">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>EBEXTA Intelligence · {lead.verification_status?.replace(/_/g, ' ')}</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setFeedbackGiven(f => f === 'up' ? null : 'up')
                  setVerificationToast(feedbackGiven === 'up' ? 'Feedback reset' : 'Thanks for liking this lead! Match signals updated.')
                  setTimeout(() => setVerificationToast(null), 2500)
                }}
                title="Like lead match"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  feedbackGiven === 'up'
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/40'
                    : 'ghost-btn text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: feedbackGiven === 'up' ? "'FILL' 1" : "'FILL' 0" }}>thumb_up</span>
              </button>
              <button
                onClick={() => {
                  setFeedbackGiven(f => f === 'down' ? null : 'down')
                  setVerificationToast(feedbackGiven === 'down' ? 'Feedback reset' : 'Thanks for feedback! We will refine future matches.')
                  setTimeout(() => setVerificationToast(null), 2500)
                }}
                title="Dislike lead match"
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${
                  feedbackGiven === 'down'
                    ? 'bg-rose-500/20 text-rose-600 border border-rose-500/40'
                    : 'ghost-btn text-[var(--text-secondary)]'
                }`}
              >
                <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: feedbackGiven === 'down' ? "'FILL' 1" : "'FILL' 0" }}>thumb_down</span>
              </button>
            </div>
          </div>
          </aside>
        </div>

        {/* Verification toast */}
        <AnimatePresence>
          {verificationToast && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute bottom-24 left-5 right-5 rounded-xl px-4 py-3 text-[12px] font-semibold flex items-center gap-2"
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: 'var(--text-primary)',
                boxShadow: '0 4px 24px rgba(29,38,54,0.15), 0 0 0 1px rgba(16,185,129,0.15)',
                zIndex: 60,
              }}
            >
              <span className="material-symbols-outlined text-[15px]"
                style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
              {verificationToast}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.aside>

      {/* Dossier PDF export — template picker */}
      {dossierOpen && <DossierModal lead={lead} onClose={() => setDossierOpen(false)} />}

      {/* Pitch Portfolio export — the A → B presentation document */}
      {pitchOpen && <PitchModal lead={lead} onClose={() => setPitchOpen(false)} />}

      {/* Outreach composer — WhatsApp / LinkedIn from a verified contact */}
      {composer && (
        <OutreachComposer
          lead={lead}
          channel={composer.channel}
          phone={composer.phone}
          linkedinUrl={composer.linkedinUrl}
          contactName={composer.name}
          onClose={() => setComposer(null)}
        />
      )}

      {/* Correction Report Modal */}
      {reportOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div className="rounded-2xl max-w-md w-full p-6 border animate-in fade-in zoom-in-95 duration-150" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>Report Incorrect Data</h3>
              <button onClick={() => setReportOpen(false)} className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-[var(--bg-elevated)]" style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-secondary)' }}>close</span>
              </button>
            </div>
            
            {reportSuccess ? (
              <div className="py-6 text-center space-y-2">
                <span className="material-symbols-outlined text-[48px]" style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Report Submitted</p>
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Thank you for helping us keep EBEXTA accurate.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmitReport} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Which field is incorrect?</label>
                  <select 
                    value={reportingField} 
                    onChange={e => setReportingField(e.target.value)} 
                    className="w-full h-10 px-3 rounded-xl border text-[13px] font-medium" 
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    <option value="Location">Location</option>
                    <option value="Employee count">Employee count</option>
                    <option value="Revenue">Revenue</option>
                    <option value="Stage">Stage</option>
                    <option value="Contacts">Contacts / Stakeholders</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>What is the correct value?</label>
                  <textarea 
                    value={actualValue} 
                    onChange={e => setActualValue(e.target.value)} 
                    placeholder="Provide the correct value or details..." 
                    required 
                    rows={3} 
                    className="w-full p-3 rounded-xl border text-[13px]" 
                    style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)', color: 'var(--text-primary)', outline: 'none' }}
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setReportOpen(false)} className="h-10 px-4 rounded-xl text-[13px] font-bold border" style={{ background: 'transparent', borderColor: 'var(--border-subtle)', color: 'var(--text-secondary)' }}>
                    Cancel
                  </button>
                  <button type="submit" disabled={submittingReport} className="premium-btn h-10 px-5 rounded-xl text-[13px] font-bold flex items-center justify-center gap-1.5 disabled:opacity-60">
                    {submittingReport ? 'Submitting...' : 'Submit Report'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
