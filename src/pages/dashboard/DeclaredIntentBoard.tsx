import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { TipBanner } from '../../components/TipBanner'
import { ProfileMenu } from '../../components/layout/ProfileMenu'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { rankIntents } from '../../lib/intentMatch'
import { sanitizeText, sanitizeTags, sanitizeUrl } from '../../lib/sanitize'
import { NetworkProfile } from '../../components/NetworkProfile'

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
  // Denormalized poster info (network sharing) — who posted this intent
  company_name?: string | null
  company_website?: string | null
  poster_mission?: string | null
  // Computed client-side: relevance of this intent to the viewer (0–100)
  intent_score?: number
}

const statusConfig = {
  mutual: { icon: 'verified', label: 'MUTUAL INTEREST', color: 'text-[var(--accent-interactive)]' },
  pending: { icon: 'pending', label: 'VERIFICATION PENDING', color: 'text-on-surface-variant' },
  ready: { icon: 'check_circle', label: 'READY FOR OUTREACH', color: 'text-[var(--accent-interactive)]' },
  processing: { icon: 'sync', label: 'PROCESSING MATCH', color: 'text-on-surface-variant' },
}

function daysLeft(expiresAt: string): number {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
}

export default function DeclaredIntentBoard() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [myIntents, setMyIntents] = useState<DeclaredIntent[]>([])
  const [incomingIntents, setIncomingIntents] = useState<DeclaredIntent[]>([])
  const [postOpen, setPostOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [successToast, setSuccessToast] = useState(false)

  // Form state
  const [requirement, setRequirement] = useState('')
  const [mode, setMode] = useState<'seeker' | 'provider'>('seeker')
  const [industryTagsInput, setIndustryTagsInput] = useState('')
  const [budgetRange, setBudgetRange] = useState('')
  const [duration, setDuration] = useState<30 | 60 | 90>(30)
  const [showCompanyDetails, setShowCompanyDetails] = useState(false)

  const loadIntents = useCallback(async () => {
    if (!user) return

    // Load my intents
    const { data: mine } = await supabase
      .from('declared_intents')
      .select('*')
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setMyIntents((mine ?? []) as DeclaredIntent[])

    // Load my profile (mode + mission) to get incoming (opposite mode) and to
    // rank them by relevance to what I offer/need.
    const { data: profile } = await supabase
      .from('profiles')
      .select('mode, mission')
      .eq('id', user.id)
      .maybeSingle()
    const s = resolveSenderProfile(profile ? { mission: profile.mission } : null)
    const myMode = profile?.mode ?? (JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}').mode ?? 'seeker')
    const viewerMission = s.mission
    const oppositeMode = myMode === 'seeker' ? 'provider' : 'seeker'

    const { data: incoming } = await supabase
      .from('declared_intents')
      .select('*')
      .eq('mode', oppositeMode)
      .neq('user_id', user.id)                    // never show my own back to me
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(40)
    // Rank by relevance to the viewer — most-relevant provider/seeker first.
    const ranked = rankIntents(viewerMission, (incoming ?? []) as DeclaredIntent[])
    setIncomingIntents(ranked as DeclaredIntent[])
  }, [user])

  useEffect(() => { loadIntents() }, [loadIntents])

  async function handlePostIntent() {
    if (!user || !requirement.trim()) return
    setPosting(true)
    setPostError(null)
    try {
      // Sanitize all user-supplied fields before they hit the DB / prompts / DOM.
      const cleanRequirement = sanitizeText(requirement)
      if (!cleanRequirement) { setPostError('Please enter a valid requirement.'); setPosting(false); return }
      const tags = sanitizeTags(industryTagsInput)
      const cleanBudget = sanitizeText(budgetRange, 60)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + duration)

      // Attach poster info so other users see WHO posted this + can evaluate.
      const { data: prof } = await supabase
        .from('profiles')
        .select('company_name, website, mission')
        .eq('id', user.id)
        .maybeSingle()
      const s = resolveSenderProfile(prof)
      const displayCompanyName = showCompanyDetails ? (sanitizeText(s.companyName, 120) || 'Verified Business') : 'Verified Enterprise'
      const displayWebsite = showCompanyDetails ? (sanitizeUrl(s.website) || null) : null
      const displayMission = showCompanyDetails ? (sanitizeText(s.mission, 500) || null) : 'Confidential business requirement on the EBEXTA Network.'

      const { error } = await supabase.from('declared_intents').insert({
        user_id: user.id,
        requirement: cleanRequirement,
        mode,
        industry_tags: tags,
        budget_range: cleanBudget || null,
        duration,
        expires_at: expiresAt.toISOString(),
        company_name: displayCompanyName,
        company_website: displayWebsite,
        poster_mission: displayMission,
      })
      if (error) throw error

      // Reset form
      setRequirement('')
      setIndustryTagsInput('')
      setBudgetRange('')
      setDuration(30)
      setPostOpen(false)
      setSuccessToast(true)
      setTimeout(() => setSuccessToast(false), 3000)
      await loadIntents()
    } catch (err: unknown) {
      setPostError(err instanceof Error ? err.message : 'Failed to post intent')
    } finally {
      setPosting(false)
    }
  }

  async function handleDeleteIntent(id: string) {
    if (!confirm('Remove this intent? It will no longer be visible to matches.')) return
    await supabase.from('declared_intents').delete().eq('id', id)
    await loadIntents()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      <main className="ml-0 md:ml-[240px] flex-1 flex flex-col min-w-0">
        {/* TopBar */}
        <header className="h-16 pl-16 pr-4 md:px-6 flex justify-between items-center gap-2 bg-surface-dim/80 backdrop-blur-md border-b border-outline-variant z-40 shrink-0">
          <div className="flex items-center gap-6 flex-1">
            <h2 className="text-[20px] font-black tracking-widest text-primary" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>EBEXTA INTELLIGENCE</h2>
            <div className="relative max-w-md w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input
                className="w-full bg-surface-container-lowest border-none pl-10 pr-4 py-1.5 rounded-lg text-[14px] focus:ring-1 focus:ring-primary/50 outline-none text-on-surface placeholder:text-on-surface-variant/50"
                placeholder="Search bilateral matching..."
                type="text"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPostOpen(true)}
              className="px-4 py-2 bg-primary text-on-primary font-bold rounded-lg text-[13px] flex items-center gap-2 hover:brightness-110 transition-all"
            >
              <span className="material-symbols-outlined text-[16px]">add</span>
              Post Intent Privately
            </button>
            <ProfileMenu />
          </div>
        </header>

        {/* Success toast */}
        <AnimatePresence>
          {successToast && (
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 400, damping: 28 }}
              className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 px-6 py-3.5 rounded-2xl shadow-2xl"
              style={{
                background: 'var(--bg-elevated)',
                border: '1px solid rgba(16,185,129,0.3)',
                boxShadow: '0 8px 40px rgba(29,38,54,0.15), 0 0 20px rgba(16,185,129,0.08)',
              }}>
              <div className="live-dot" />
              <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>Posted privately. EBEXTA is now matching you.</span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex overflow-hidden">
          {/* Main area */}
          <section className="flex-1 overflow-y-auto p-6 no-scrollbar">

            <TipBanner id="intent_intro" userId={user?.id} icon="ads_click">
              Post what you need and we'll match you privately: the other side sees your requirement, never your identity, until you both opt in. Use <strong>Post Intent Privately</strong> to start.
            </TipBanner>

            {/* Post Intent Modal */}
            <AnimatePresence>
            {postOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center p-6"
                style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}>
                <motion.div
                  initial={{ opacity: 0, scale: 0.94, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 10 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                  className="w-full max-w-lg p-8 flex flex-col gap-6 rounded-2xl"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--accent-subtle)',
                    boxShadow: '0 0 0 1px var(--border-subtle) inset, 0 8px 60px rgba(29,38,54,0.18)',
                  }}>
                  <div className="flex justify-between items-center">
                    <h3 className="text-[22px] font-bold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Post a Declared Intent</h3>
                    <button onClick={() => setPostOpen(false)} className="text-on-surface-variant hover:text-on-surface">
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block mb-1.5">What are you looking for? *</label>
                      <div className="mb-2 flex items-center gap-2 text-[11px] text-on-surface-variant/60">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Only EBEXTA's matching engine reads this. Never visible publicly.
                      </div>
                      <textarea
                        value={requirement}
                        onChange={e => setRequirement(e.target.value)}
                        rows={4}
                        placeholder="e.g. We need a React development team for a 3-month project starting July 2025. Budget ₹15–20L. Looking for agencies with fintech experience."
                        className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block mb-1.5">Mode</label>
                        <div className="flex gap-2">
                          {(['seeker', 'provider'] as const).map(m => (
                            <button key={m} onClick={() => setMode(m)}
                              className={`flex-1 py-2 rounded-lg border text-[13px] font-bold transition-all capitalize ${mode === m ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'}`}>
                              {m === 'seeker' ? '🔍 Seeker' : '🏢 Provider'}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block mb-1.5">Duration</label>
                        <div className="flex gap-2">
                          {([30, 60, 90] as const).map(d => (
                            <button key={d} onClick={() => setDuration(d)}
                              className={`flex-1 py-2 rounded-lg border text-[13px] font-bold transition-all ${duration === d ? 'bg-primary text-on-primary border-primary' : 'border-outline-variant text-on-surface-variant hover:border-primary'}`}>
                              {d}d
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block mb-1.5">Industry Tags (comma separated)</label>
                      <input
                        value={industryTagsInput}
                        onChange={e => setIndustryTagsInput(e.target.value)}
                        placeholder="e.g. fintech, saas, ai"
                        className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block mb-1.5">Budget Range (optional)</label>
                      <input
                        value={budgetRange}
                        onChange={e => setBudgetRange(e.target.value)}
                        placeholder="e.g. $5K-$20K/month"
                        className="w-full bg-surface-container border border-outline-variant rounded-lg px-4 py-3 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none"
                      />
                    </div>

                    <div className="p-3 rounded-xl bg-surface-container border border-outline-variant">
                      <label className="flex items-center gap-2.5 text-[13px] font-medium text-on-surface cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={showCompanyDetails}
                          onChange={e => setShowCompanyDetails(e.target.checked)}
                          className="w-4 h-4 rounded accent-primary cursor-pointer"
                        />
                        <span>Disclose Company Profile &amp; Name publicly (unchecked = Confidential "Verified Enterprise")</span>
                      </label>
                    </div>
                  </div>

                  {postError && (
                    <p className="text-[13px]" style={{ color: 'var(--critical)' }}>{postError}</p>
                  )}

                  <div className="flex gap-3">
                    <button onClick={() => setPostOpen(false)}
                      className="ghost-btn flex-1 py-3 rounded-xl font-semibold text-[14px]">
                      Cancel
                    </button>
                    <button onClick={handlePostIntent} disabled={posting || !requirement.trim()}
                      className="premium-btn flex-1 py-3 rounded-xl font-bold text-[14px] disabled:opacity-50 flex items-center justify-center gap-2">
                      {posting ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> : null}
                      {posting ? 'Posting…' : showCompanyDetails ? 'Post Publicly' : 'Post Privately'}
                    </button>
                  </div>
                </motion.div>
              </motion.div>
            )}
            </AnimatePresence>

            {/* My Active Intents */}
            {myIntents.length > 0 && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                  <span className="material-symbols-outlined text-primary text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>person</span>
                  <h3 className="text-[18px] font-bold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>My Active Intents</h3>
                  <span className="text-[11px] font-bold text-on-surface-variant/60 ml-2">{myIntents.length} active</span>
                </div>
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                  {myIntents.map((intent, idx) => (
                    <motion.div key={intent.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                      className="rounded-xl p-4 flex flex-col gap-3"
                      style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-subtle)' }}>
                      <div className="flex justify-between items-start">
                        <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                          style={intent.mode === 'seeker'
                            ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }
                            : { background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                          {intent.mode === 'seeker' ? '🔍 SEEKER' : '🏢 PROVIDER'}
                        </span>
                        <button onClick={() => handleDeleteIntent(intent.id)}
                          className="transition-colors" style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'var(--critical)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}>
                          <span className="material-symbols-outlined text-[16px]">delete</span>
                        </button>
                      </div>
                      <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{intent.requirement}</p>
                      <div className="flex flex-wrap gap-1">
                        {(intent.industry_tags ?? []).map(tag => (
                          <span key={tag} className="px-2 py-0.5 rounded-md text-[11px]"
                            style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>{tag}</span>
                        ))}
                      </div>
                      <div className="flex justify-between items-center text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>
                        <span>{intent.budget_range || 'No budget specified'}</span>
                        <span style={{ color: daysLeft(intent.expires_at) <= 7 ? 'var(--warning)' : 'var(--text-muted)' }}>
                          {daysLeft(intent.expires_at)}d left
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Incoming Matches */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>handshake</span>
                  <h3 className="text-[18px] font-bold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Incoming Matches</h3>
                  <span className="text-[11px] font-bold text-on-surface-variant/60 ml-2">{incomingIntents.length} found</span>
                </div>
                <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">OPPOSITE MODE DECLARED INTENTS</span>
              </div>

              {incomingIntents.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center py-20 gap-4 rounded-2xl"
                  style={{ border: '1px dashed var(--border-subtle)' }}>
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                    <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--accent-subtle)' }}>handshake</span>
                  </div>
                  <p className="text-[15px] font-medium" style={{ color: 'var(--text-secondary)' }}>No incoming intents yet</p>
                  <p className="text-[13px] max-w-sm text-center" style={{ color: 'var(--text-muted)' }}>When companies post intents in the opposite mode to yours, they'll appear here as potential matches.</p>
                </motion.div>
              ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {incomingIntents.map((intent, idx) => {
                    const st = statusConfig.pending
                    return (
                      <motion.div key={intent.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.06, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                        className="rounded-xl p-4 flex flex-col gap-4 transition-all cursor-default"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--accent-subtle)', boxShadow: '0 4px 20px rgba(29,38,54,0.10)' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent-subtle)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(29,38,54,0.10), 0 0 20px var(--accent-subtle)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--accent-subtle)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(29,38,54,0.10)' }}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                              style={{ background: 'var(--border-subtle)', border: '1px solid var(--border-subtle)' }}>
                              <span className="material-symbols-outlined" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                                {intent.mode === 'provider' ? 'store' : 'search'}
                              </span>
                            </div>
                            <div>
                              {intent.company_name && intent.company_name !== 'Verified Enterprise' ? (
                                <p className="text-[14px] font-bold leading-tight flex items-center gap-1.5" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                                  <span className="material-symbols-outlined text-[16px] text-primary">domain</span>
                                  {intent.company_name}
                                </p>
                              ) : (
                                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 font-bold text-[11px]">
                                  <span className="material-symbols-outlined text-[13px] leading-none">verified_user</span>
                                  <span>Verified Enterprise (Confidential)</span>
                                </div>
                              )}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={intent.mode === 'provider'
                                    ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }
                                    : { background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent)' }}>
                                  {intent.mode.toUpperCase()}
                                </span>
                                {intent.company_name && intent.company_name !== 'Verified Enterprise' && intent.company_website && (
                                  <a href={intent.company_website} target="_blank" rel="noopener noreferrer"
                                    className="text-[10px] underline" style={{ color: 'var(--accent-interactive)' }}>
                                    {intent.company_website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                                  </a>
                                )}
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {typeof intent.intent_score === 'number' && intent.intent_score > 0 && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                                PRIORITY {intent.intent_score}%
                              </span>
                            )}
                            <span className="text-[11px] font-mono" style={{ color: 'var(--text-muted)' }}>{daysLeft(intent.expires_at)}d</span>
                          </div>
                        </div>
                        {(intent.industry_tags ?? []).length > 0 && (
                          <p className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>
                            {(intent.industry_tags ?? []).join(', ').toUpperCase()}
                          </p>
                        )}
                        {intent.poster_mission && (
                          <p className="text-[11px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{intent.poster_mission}</p>
                        )}

                        <p className="text-[14px] leading-relaxed line-clamp-3" style={{ color: 'var(--text-primary)' }}>{intent.requirement}</p>

                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider"
                              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>TRUST 100%</span>
                            <div className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                              <span className="material-symbols-outlined text-[13px]">{st.icon}</span>
                              <span className="text-[10px] font-bold tracking-[0.06em]">{st.label}</span>
                            </div>
                          </div>
                          {intent.budget_range && (
                            <span className="text-[11px] font-mono" style={{ color: 'var(--accent-interactive)' }}>{intent.budget_range}</span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                          <button onClick={() => navigate(`/dashboard/inbox?to=${intent.user_id}`)} className="premium-btn py-2 rounded-lg text-[11px] tracking-[0.06em] flex items-center justify-center gap-1 uppercase font-bold">
                            <span className="material-symbols-outlined text-[13px]">rocket_launch</span> Connect
                          </button>
                          <button onClick={() => setProfileUserId(intent.user_id)} className="ghost-btn py-2 rounded-lg text-[11px] tracking-[0.06em] font-bold flex items-center justify-center gap-1 uppercase">
                            <span className="material-symbols-outlined text-[13px]">visibility</span> Details
                          </button>
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Global Intent Stream */}
          <aside className="w-80 border-l border-outline-variant glass-panel flex flex-col h-full overflow-hidden shrink-0">
            <div className="p-4 border-b border-outline-variant bg-surface-container-high/50 flex items-center justify-between">
              <h3 className="text-[11px] font-bold tracking-[0.15em] text-on-surface uppercase">Global Intent Stream</h3>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)' }} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
              {[...myIntents, ...incomingIntents].slice(0, 8).map((intent) => (
                <div key={intent.id} className="space-y-1 border-l-2 pl-4 py-1" style={{ borderColor: 'var(--accent-interactive)' }}>
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--accent)' }}>
                      {intent.mode === 'seeker' ? 'Seeker Intent' : 'Provider Intent'}
                    </span>
                    <span className="text-[10px] font-mono text-on-surface-variant">{daysLeft(intent.expires_at)}D LEFT</span>
                  </div>
                  <p className="text-[13px] text-on-surface leading-tight line-clamp-2">{intent.requirement}</p>
                  {(intent.industry_tags ?? []).length > 0 && (
                    <div className="text-[10px] font-mono text-on-surface-variant/70 italic">
                      {(intent.industry_tags ?? []).join(' · ')}
                    </div>
                  )}
                </div>
              ))}
              {myIntents.length === 0 && incomingIntents.length === 0 && (
                <p className="text-[13px] text-on-surface-variant text-center py-8">No intents posted yet. Be the first!</p>
              )}
            </div>
          </aside>
        </div>
      </main>

      {profileUserId && <NetworkProfile userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </div>
  )
}
