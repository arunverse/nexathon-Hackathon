import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sanitizeText, sanitizeTags } from '../../lib/sanitize'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { checkCredits, consumeCredit } from '../../lib/credits'

interface MatchedIntent {
  intent_id: string
  poster_id: string
  company_name: string | null
  mode: string | null
  requirement: string | null
  industry_tags: string[] | null
  budget_range: string | null
  matched_keyword: string | null
  created_at: string
}

interface DeclaredIntent {
  id: string
  user_id: string
  requirement: string
  mode: 'seeker' | 'provider'
  industry_tags: string[]
  budget_range: string
  duration: 30 | 60 | 90
  expires_at: string
  created_at: string
  company_name?: string | null
  company_website?: string | null
  poster_mission?: string | null
}

interface SignalWatch {
  id: string
  user_id: string
  keyword: string
  industry: string
  notes?: string
  active: boolean
  created_at: string
}

const DEMO_INTENTS: DeclaredIntent[] = [
  {
    id: 'demo-int-1',
    user_id: 'user-demo-1',
    requirement: 'Seeking Enterprise AI Security Auditor for SOC2 Type II certification & compliance',
    mode: 'seeker',
    industry_tags: ['Cybersecurity', 'AI / ML', 'Compliance'],
    budget_range: '$25,000 - $50,000',
    duration: 30,
    expires_at: new Date(Date.now() + 2592000000).toISOString(),
    created_at: '2 hours ago',
    company_name: 'Apex CyberSec Solutions',
    company_website: 'https://apexcybersec.example.com',
    poster_mission: 'Protecting next-generation SaaS architectures with autonomous threat detection.',
  },
  {
    id: 'demo-int-2',
    user_id: 'user-demo-2',
    requirement: 'Offering High-Throughput Dedicated GPU Cluster Hosting (NVIDIA H100 LLM Training)',
    mode: 'provider',
    industry_tags: ['Cloud Infrastructure', 'AI / ML', 'DevOps'],
    budget_range: '$50,000 - $150,000 / mo',
    duration: 60,
    expires_at: new Date(Date.now() + 5184000000).toISOString(),
    created_at: '5 hours ago',
    company_name: 'Vortex Cloud Infrastructure',
    company_website: 'https://vortexcloud.example.com',
    poster_mission: 'Ultra-low latency cloud compute for enterprise artificial intelligence models.',
  },
  {
    id: 'di-3',
    user_id: 'u-103',
    requirement: 'Need SOC2 Type II compliance audit consultant & automated evidence collection platform for HIPAA SaaS product.',
    mode: 'seeker',
    industry_tags: ['Healthcare', 'Security'],
    budget_range: '$15,000 - $30,000',
    duration: 30,
    expires_at: new Date(Date.now() + 18 * 86400000).toISOString(),
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
    company_name: 'Infinita Health Tech',
    company_website: 'infinita-health.com',
    poster_mission: 'HIPAA-compliant telemedicine and EHR platform.',
  },
]

const DEMO_SIGNAL_MATCHES = [
  {
    id: 'sig-1',
    company_name: 'Kuber Freight Solutions',
    signal_text: 'Posted job for Head of Air & Ocean Logistics in Port Operations (Expansion Signal)',
    matched_keyword: 'Logistics',
    detected_at: '2 hours ago',
  },
  {
    id: 'sig-2',
    company_name: 'Hyperion Logistics Group',
    signal_text: 'Hired VP of Supply Chain Transformation & Automated Warehousing',
    matched_keyword: 'Warehouse Automation',
    detected_at: '45 mins ago',
  },
]

const INDUSTRY_OPTIONS = [
  'Technology', 'E-commerce', 'Healthcare', 'Fintech', 'EdTech',
  'SaaS', 'Manufacturing', 'Logistics', 'Real Estate', 'Media',
  'Retail', 'FMCG', 'Consulting', 'Legal', 'Other',
]

interface SignalIntentSplitPaneProps {
  onOpenCompanyProfile?: (userId: string, companyName?: string) => void
}

export function SignalIntentSplitPane({ onOpenCompanyProfile }: SignalIntentSplitPaneProps) {
  const { user } = useAuth()

  // Intents State
  const [myIntents, setMyIntents] = useState<DeclaredIntent[]>([])
  const [incomingIntents, setIncomingIntents] = useState<DeclaredIntent[]>([])
  const [matchedIntents, setMatchedIntents] = useState<MatchedIntent[]>([])
  const [intentFilterMode, setIntentFilterMode] = useState<'all' | 'seeker' | 'provider'>('all')

  // New Intent Form
  const [requirement, setRequirement] = useState('')
  const [mode, setMode] = useState<'seeker' | 'provider'>('seeker')
  const [industryTagsInput, setIndustryTagsInput] = useState('')
  const [budgetRange, setBudgetRange] = useState('$10,000 - $50,000')
  const [duration, setDuration] = useState<30 | 60 | 90>(30)
  const [showCompanyDetails, setShowCompanyDetails] = useState(false)
  const [postingIntent, setPostingIntent] = useState(false)

  // Signal Watch State
  const [watches, setWatches] = useState<SignalWatch[]>([])
  const [signalKeyword, setSignalKeyword] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('Technology & Software')
  const [signalNotes, setSignalNotes] = useState('')
  const [addingWatch, setAddingWatch] = useState(false)

  // Realtime Signal Stream Demo Matches
  const [scanningSignals, setScanningSignals] = useState(false)
  const [signalMatches, setSignalMatches] = useState(DEMO_SIGNAL_MATCHES)

  // Load Intents & Signals from Supabase
  const loadAllData = useCallback(async () => {
    if (!user) {
      setIncomingIntents(DEMO_INTENTS)
      return
    }

    try {
      // 1. Load Intents
      const { data: myData } = await supabase
        .from('declared_intents')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })

      setMyIntents(myData || [])

      const { data: netData } = await supabase
        .from('declared_intents')
        .select('*')
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(30)

      if (netData && netData.length > 0) {
        setIncomingIntents(netData)
      } else {
        setIncomingIntents(DEMO_INTENTS)
      }

      // 2. Load Signal Watches
      const { data: swData } = await supabase
        .from('signal_watches')
        .select('*')
        .eq('user_id', user.id)

      if (swData && swData.length > 0) {
        setWatches(swData)
      }

      // 3. Load Matched Intents via RPC
      const { data: matchedData } = await supabase.rpc('ebexta_matched_intents')
      if (matchedData && matchedData.length > 0) {
        setMatchedIntents(matchedData)
      }
    } catch (err) {
      console.warn('Error loading DB intent/signal rows, falling back to live demo stream:', err)
      setIncomingIntents(DEMO_INTENTS)
    }
  }, [user])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // Post Intent Handler
  async function handlePostIntent(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !requirement.trim()) return

    const gate = await checkCredits('ai_generation')
    if (!gate) return

    try {
      setPostingIntent(true)
      const sanitizedReq = sanitizeText(requirement.trim())
      const tags = sanitizeTags(industryTagsInput)
      const expiresAt = new Date(Date.now() + duration * 86400000).toISOString()

      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, logo_url, full_name, website, mission')
        .eq('id', user.id)
        .maybeSingle()

      const sender = resolveSenderProfile(profile)
      const resolvedCompanyName =
        profile?.company_name?.trim() ||
        profile?.full_name?.trim() ||
        (user.user_metadata?.company_name as string | undefined)?.trim() ||
        (sender.companyName && sender.companyName !== 'Your Company' ? sender.companyName : '') ||
        (user.email ? user.email.split('@')[0] : 'Verified Enterprise')

      // Save company_name to profiles table if missing
      if (profile && !profile.company_name && resolvedCompanyName && resolvedCompanyName !== 'Verified Enterprise') {
        await supabase.from('profiles').update({ company_name: resolvedCompanyName }).eq('id', user.id)
      }

      const displayCompanyName = showCompanyDetails ? resolvedCompanyName : 'Verified Enterprise'
      const displayWebsite = showCompanyDetails ? (profile?.website || sender.website || null) : null
      const displayMission = showCompanyDetails ? (profile?.mission || sender.mission || null) : 'Confidential business requirement on the EBEXTA Network.'

      const newIntent: DeclaredIntent = {
        id: `di-${Date.now()}`,
        user_id: user.id,
        requirement: sanitizedReq,
        mode,
        industry_tags: tags,
        budget_range: budgetRange,
        duration,
        expires_at: expiresAt,
        created_at: new Date().toISOString(),
        company_name: displayCompanyName,
        company_website: displayWebsite,
        poster_mission: displayMission,
      }

      const { data, error } = await supabase
        .from('declared_intents')
        .insert({
          user_id: newIntent.user_id,
          requirement: newIntent.requirement,
          mode: newIntent.mode,
          industry_tags: newIntent.industry_tags,
          budget_range: newIntent.budget_range,
          duration: newIntent.duration,
          expires_at: newIntent.expires_at,
          company_name: newIntent.company_name,
          company_website: newIntent.company_website,
          poster_mission: newIntent.poster_mission,
        })
        .select()
        .single()

      if (!error && data) {
        setMyIntents((prev) => [data, ...prev])
        setIncomingIntents((prev) => [data, ...prev])
      } else {
        setMyIntents((prev) => [newIntent, ...prev])
        setIncomingIntents((prev) => [newIntent, ...prev])
      }

      await consumeCredit('ai_generation', { requirement: sanitizedReq })
      setRequirement('')
      alert('Declared Intent published live to the EBEXTA Network!')
    } catch (err) {
      console.error('Post intent error:', err)
    } finally {
      setPostingIntent(false)
    }
  }

  // Add Watch Handler
  async function handleAddWatch(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !signalKeyword.trim()) return

    try {
      setAddingWatch(true)
      const kw = sanitizeText(signalKeyword.trim())

      const newWatch = {
        user_id: user.id,
        keyword: kw,
        industry: selectedIndustry,
        notes: signalNotes ? sanitizeText(signalNotes) : '',
        active: true,
      }

      const { data, error } = await supabase
        .from('signal_watches')
        .insert(newWatch)
        .select()
        .single()

      if (!error && data) {
        setWatches((prev) => [...prev, data])
      } else {
        setWatches((prev) => [
          ...prev,
          { id: `sw-${Date.now()}`, ...newWatch, created_at: new Date().toISOString() },
        ])
      }

      setSignalKeyword('')
      setSignalNotes('')
    } catch (err) {
      console.error('Add watch error:', err)
    } finally {
      setAddingWatch(false)
    }
  }

  // Trigger Gemini Signal Scan
  async function handleTriggerSignalScan() {
    const gate = await checkCredits('ai_generation')
    if (!gate) return

    setScanningSignals(true)
    setTimeout(async () => {
      setSignalMatches((prev) => [
        {
          id: `sig-${Date.now()}`,
          company_name: 'Apex Robotics & Logistics',
          signal_text: 'Posted RFP for Automated Warehousing & Packaging Systems',
          matched_keyword: watches[0]?.keyword || 'Logistics',
          detected_at: 'Just now',
        },
        ...prev,
      ])
      await consumeCredit('ai_generation', { action: 'signal_scan' })
      setScanningSignals(false)
    }, 1500)
  }

  // Dynamic Real-time Signal Engine based on active keyword watches
  const computedSignalMatches = useMemo(() => {
    if (watches.length === 0) return signalMatches

    const watchKeywords = watches.map((w) => w.keyword.toLowerCase().trim()).filter(Boolean)
    const matchesFromIntents: typeof signalMatches = []

    incomingIntents.forEach((intent) => {
      const textToScan = `${intent.requirement} ${(intent.industry_tags || []).join(' ')} ${intent.company_name || ''}`.toLowerCase()

      for (const kw of watchKeywords) {
        if (textToScan.includes(kw)) {
          matchesFromIntents.push({
            id: `sig-match-${intent.id}-${kw}`,
            company_name: intent.company_name || 'Verified Enterprise',
            signal_text: intent.requirement,
            matched_keyword: kw.toUpperCase(),
            detected_at: new Date(intent.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          })
          break
        }
      }
    })

    return matchesFromIntents.length > 0 ? [...matchesFromIntents, ...signalMatches] : signalMatches
  }, [watches, incomingIntents, signalMatches])

  const filteredIncoming = incomingIntents.filter(
    (i) => intentFilterMode === 'all' || i.mode === intentFilterMode
  )

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      {/* ──────────────── LEFT SIDE (50%): DECLARED INTENT MARKETPLACE ──────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[var(--accent-interactive)] shrink-0">
              <span className="material-symbols-outlined text-[20px]">ads_click</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[16px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Geist, sans-serif' }}>
                  Declared Intent Marketplace
                </h2>
                {myIntents.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] text-[10px] font-bold">
                    {myIntents.length} Mine
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <button
              type="button"
              onClick={() => setIntentFilterMode('all')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                intentFilterMode === 'all'
                  ? 'bg-[var(--accent-interactive)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setIntentFilterMode('seeker')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                intentFilterMode === 'seeker'
                  ? 'bg-[var(--accent-interactive)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Seekers
            </button>
            <button
              type="button"
              onClick={() => setIntentFilterMode('provider')}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer ${
                intentFilterMode === 'provider'
                  ? 'bg-[var(--accent-interactive)] text-white shadow-xs'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Providers
            </button>
          </div>
        </div>

        {/* Intent Submission Form */}
        <form onSubmit={handlePostIntent} className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[12.5px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)]">target</span>
              Declare Active Deal Intent
            </label>

            <div className="flex items-center gap-3">
              <label className="flex items-center gap-1 text-[12px] font-semibold text-[var(--text-primary)] cursor-pointer select-none">
                <input
                  type="radio"
                  name="intentMode"
                  checked={mode === 'seeker'}
                  onChange={() => setMode('seeker')}
                  className="accent-[var(--accent-interactive)]"
                />
                Seeker
              </label>
              <label className="flex items-center gap-1 text-[12px] font-semibold text-[var(--text-primary)] cursor-pointer select-none">
                <input
                  type="radio"
                  name="intentMode"
                  checked={mode === 'provider'}
                  onChange={() => setMode('provider')}
                  className="accent-[var(--accent-interactive)]"
                />
                Provider
              </label>
            </div>
          </div>

          <div>
            <textarea
              value={requirement}
              onChange={(e) => setRequirement(e.target.value)}
              rows={2}
              placeholder="State your exact deal requirement (e.g. 'Seeking SOC2 Type II auditor for SaaS platform...')"
              className="w-full p-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Industry Tags</label>
              <input
                type="text"
                value={industryTagsInput}
                onChange={(e) => setIndustryTagsInput(e.target.value)}
                placeholder="e.g. Logistics, AI"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Budget Range</label>
              <input
                type="text"
                value={budgetRange}
                onChange={(e) => setBudgetRange(e.target.value)}
                placeholder="e.g. $5k - $25k"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-[10px] font-semibold text-[var(--text-muted)] mb-1 uppercase tracking-wider">Duration</label>
              <select
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value) as any)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              >
                <option value={30}>30 Days</option>
                <option value={60}>60 Days</option>
                <option value={90}>90 Days</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--border-subtle)]">
            <label className="flex items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-primary)] cursor-pointer select-none">
              <input
                type="checkbox"
                checked={showCompanyDetails}
                onChange={(e) => setShowCompanyDetails(e.target.checked)}
                className="rounded accent-[var(--accent-interactive)] cursor-pointer"
              />
              <span>Disclose Company Details</span>
            </label>

            <button
              type="submit"
              disabled={postingIntent || !requirement.trim()}
              className="px-4 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer flex items-center gap-1.5 shadow-xs transition-all"
            >
              {postingIntent && <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />}
              {showCompanyDetails ? 'Publish Intent' : 'Publish Confidential'}
            </button>
          </div>
        </form>

        {/* Live Intent Feed */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-[13px] font-bold text-[var(--text-primary)]">
            <span>Live Declared Intents Feed ({filteredIncoming.length})</span>
            <span className="text-[11px] text-[var(--accent-interactive)] font-semibold flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Marketplace
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
            {filteredIncoming.map((intent) => {
              const isAnon = !intent.company_name || intent.company_name === 'Verified Enterprise'
              return (
                <motion.div
                  key={intent.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  onClick={() => !isAnon && intent.user_id && onOpenCompanyProfile?.(intent.user_id)}
                  className={`p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all flex flex-col justify-between ${!isAnon ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      {isAnon ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 font-bold text-[10.5px]">
                          <span className="material-symbols-outlined text-[13px] leading-none">verified_user</span>
                          <span>Verified Enterprise (Confidential)</span>
                        </span>
                      ) : (
                        <span className="font-bold text-[var(--text-primary)] truncate flex items-center gap-1">
                          <span className="material-symbols-outlined text-[14px] text-[var(--accent-interactive)]">domain</span>
                          {intent.company_name}
                        </span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded text-[9.5px] font-bold uppercase tracking-wider shrink-0"
                        style={
                          intent.mode === 'seeker'
                            ? { background: 'var(--warning-bg)', color: 'var(--warning)', border: '1px solid var(--warning)' }
                            : { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
                        }
                      >
                        {intent.mode}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{intent.requirement}</p>
                  </div>

                <div className="flex items-center justify-between text-[10.5px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
                  <span>Budget: {intent.budget_range}</span>
                  <span className="text-[var(--accent-interactive)] font-semibold flex items-center gap-0.5">
                    View Details
                    <span className="material-symbols-outlined text-[13px]">arrow_forward</span>
                  </span>
                </div>
              </motion.div>
            )})}
          </div>
        </div>
      </div>

      {/* ──────────────── RIGHT SIDE (50%): SIGNAL WATCH & AUTOMATED INTELLIGENCE ──────────────── */}
      <div className="p-4 sm:p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[var(--accent-interactive)] shrink-0">
              <span className="material-symbols-outlined text-[20px]">radar</span>
            </div>
            <div>
              <h2 className="text-[16px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Geist, sans-serif' }}>
                Signal Watch & Automated Intelligence
              </h2>
            </div>
          </div>

          <button
            type="button"
            onClick={handleTriggerSignalScan}
            disabled={scanningSignals}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] hover:bg-[var(--accent-interactive)] hover:text-white transition-all cursor-pointer shrink-0"
          >
            <span className={`material-symbols-outlined text-[15px] ${scanningSignals ? 'animate-spin' : ''}`}>sync</span>
            {scanningSignals ? 'Scanning Signals...' : 'Run Signal Scan'}
          </button>
        </div>

        {/* Add Keyword Watch Form */}
        <form onSubmit={handleAddWatch} className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2.5">
          <div className="text-[12.5px] font-bold text-[var(--text-primary)] flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)]">add_alert</span>
            Create Keyword Signal Monitor
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <div>
              <input
                type="text"
                value={signalKeyword}
                onChange={(e) => setSignalKeyword(e.target.value)}
                placeholder="Keyword (e.g. 'Logistics')"
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
            </div>
            <div>
              <select
                value={selectedIndustry}
                onChange={(e) => setSelectedIndustry(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              >
                {INDUSTRY_OPTIONS.map((ind) => (
                  <option key={ind} value={ind}>
                    {ind}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <input
                type="text"
                value={signalNotes}
                onChange={(e) => setSignalNotes(e.target.value)}
                placeholder="Notes..."
                className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={addingWatch || !signalKeyword.trim()}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-xs transition-all"
            >
              Add Watch Keyword
            </button>
          </div>
        </form>

        {/* Active Watches Badges */}
        <div>
          <span className="block text-[10.5px] font-semibold text-[var(--text-muted)] uppercase tracking-wider mb-1.5">
            Active Monitored Keywords ({watches.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {watches.length === 0 ? (
              <span className="text-[11px] text-[var(--text-muted)] italic">No signal watches configured. Add keywords above.</span>
            ) : (
              watches.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11.5px] font-bold"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--border-strong)' }}
                >
                  <span>#{w.keyword}</span>
                  <span className="text-[10px] text-[var(--text-muted)]">({w.industry})</span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Live Detected Signals List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-[13px] font-bold text-[var(--text-primary)]">
            <span>Detected Growth &amp; Market Signals ({computedSignalMatches.length + matchedIntents.length})</span>
            <span className="text-[11px] font-semibold text-[var(--accent-interactive)] flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Live Intelligence
            </span>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
            {matchedIntents.map((m) => (
              <div
                key={m.intent_id}
                onClick={() => m.poster_id && onOpenCompanyProfile?.(m.poster_id)}
                className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[var(--text-primary)] truncate">{m.company_name || 'Network Partner'}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[9.5px] font-bold shrink-0"
                    style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}
                  >
                    Matched: #{m.matched_keyword || 'Intent'}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{m.requirement}</p>
              </div>
            ))}

            {computedSignalMatches.map((sig) => (
              <div
                key={sig.id}
                className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all space-y-1"
              >
                <div className="flex items-center justify-between gap-2 text-[11px]">
                  <span className="font-bold text-[var(--text-primary)] truncate">{sig.company_name}</span>
                  <span
                    className="px-2 py-0.5 rounded text-[9.5px] font-bold shrink-0"
                    style={{ background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }}
                  >
                    Matched: #{sig.matched_keyword}
                  </span>
                </div>
                <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">{sig.signal_text}</p>
                <div className="text-[10px] text-[var(--text-muted)] text-right pt-0.5">{sig.detected_at}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
