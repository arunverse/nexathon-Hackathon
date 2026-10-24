/**
 * EBEXTA Signal Watch
 * Providers save keyword watches. On refresh, a Gemini scan
 * checks for public intent signals (job posts, funding news,
 * RFPs) matching those keywords and surfaces new matches.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { callGeminiProxy } from '../../lib/geminiProxy'
import { sanitizeText } from '../../lib/sanitize'
import { googleSearch } from '../../lib/urlUtils'
import { NetworkProfile } from '../../components/NetworkProfile'

interface MatchedIntent {
  intent_id: string; poster_id: string; company_name: string | null; mode: string | null
  requirement: string | null; industry_tags: string[] | null; budget_range: string | null; matched_keyword: string | null; created_at: string
}

interface SignalWatch {
  id: string
  user_id: string
  keyword: string
  industry: string
  notes: string
  active: boolean
  created_at: string
}

interface SignalMatch {
  id: string
  watch_id: string
  user_id: string
  company_name: string
  signal_text: string
  source_url: string
  detected_at: string
  watch?: { keyword: string; industry: string }
}

const INDUSTRY_OPTIONS = [
  'Technology', 'E-commerce', 'Healthcare', 'Fintech', 'EdTech',
  'SaaS', 'Manufacturing', 'Logistics', 'Real Estate', 'Media',
  'Retail', 'FMCG', 'Consulting', 'Legal', 'Other',
]

const sectionAnim = (i: number) => ({
  initial: { opacity: 0, y: 16 } as const,
  animate: { opacity: 1, y: 0 } as const,
  transition: { delay: i * 0.07, duration: 0.4, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
})

export default function SignalWatch() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const [matchedIntents, setMatchedIntents] = useState<MatchedIntent[]>([])
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [watches, setWatches] = useState<SignalWatch[]>([])
  const [matches, setMatches] = useState<SignalMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [newIndustry, setNewIndustry] = useState('Technology')
  const [newNotes, setNewNotes] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)

  function showToast(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 3000)
  }

  // ─── Load watches + matches ───────────────────────────────────────────────

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [{ data: w }, { data: m }] = await Promise.all([
        supabase
          .from('signal_watches')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('signal_matches')
          .select('*, signal_watches(keyword, industry)')
          .eq('user_id', user.id)
          .order('detected_at', { ascending: false })
          .limit(50),
      ])
      setWatches((w as SignalWatch[]) ?? [])
      setMatches(
        ((m ?? []) as Array<SignalMatch & { signal_watches?: { keyword: string; industry: string } | null }>).map(r => ({
          ...r,
          watch: r.signal_watches ?? undefined,
        }))
      )
    } catch (err) {
      console.error('[SignalWatch] load error:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => { loadData() }, [loadData])

  // ─── Add a new watch ─────────────────────────────────────────────────────

  async function handleAddWatch() {
    if (!user || !newKeyword.trim()) return
    setAdding(true)
    try {
      // Sanitize before DB write + Gemini prompt use (S4). Normal text is unchanged.
      const cleanKeyword = sanitizeText(newKeyword, 120)
      if (!cleanKeyword) { setAdding(false); return }
      const { error } = await supabase.from('signal_watches').insert({
        user_id: user.id,
        keyword: cleanKeyword,
        industry: sanitizeText(newIndustry, 80),
        notes: sanitizeText(newNotes, 500),
        active: true,
      })
      if (error) throw error
      setNewKeyword('')
      setNewNotes('')
      setShowForm(false)
      showToast('Watch saved scan to find matches')
      await loadData()
    } catch (err) {
      console.error('[SignalWatch] add error:', err)
      showToast('Failed to save watch', 'error')
    } finally {
      setAdding(false)
    }
  }

  // ─── Toggle watch active/paused ──────────────────────────────────────────

  async function toggleWatch(watchId: string, currentActive: boolean) {
    try {
      await supabase
        .from('signal_watches')
        .update({ active: !currentActive })
        .eq('id', watchId)
      setWatches(prev => prev.map(w => w.id === watchId ? { ...w, active: !currentActive } : w))
    } catch { /* non-fatal */ }
  }

  // ─── Delete watch ────────────────────────────────────────────────────────

  async function deleteWatch(watchId: string) {
    try {
      await supabase.from('signal_watches').delete().eq('id', watchId)
      await supabase.from('signal_matches').delete().eq('watch_id', watchId)
      setWatches(prev => prev.filter(w => w.id !== watchId))
      setMatches(prev => prev.filter(m => m.watch_id !== watchId))
      showToast('Watch removed')
    } catch {
      showToast('Failed to delete watch', 'error')
    }
  }

  // ─── Run Gemini signal scan ───────────────────────────────────────────────

  async function runSignalScan() {
    if (!user || watches.filter(w => w.active).length === 0) {
      showToast('Add at least one active watch first', 'error')
      return
    }
    setScanning(true)
    const activeWatches = watches.filter(w => w.active)
    const newMatchesFound: SignalMatch[] = []

    try {
      for (let i = 0; i < activeWatches.length; i++) {
        const watch = activeWatches[i]
        setScanProgress(`Scanning for "${watch.keyword}" (${i + 1}/${activeWatches.length})…`)

        const prompt = `You are a B2B intelligence analyst. Find 3-5 REAL companies that are currently showing PUBLIC intent signals matching this search:

Keyword: "${watch.keyword}"
Industry: ${watch.industry}
${watch.notes ? `Additional context: ${watch.notes}` : ''}

A "public intent signal" means the company has publicly shown they NEED this service/product through:
- Job postings (e.g. hiring someone to do X = they need X done)
- Recent funding that implies upcoming vendor needs
- Product announcements that require supporting services
- Public RFPs or tenders
- News about expansion plans
- Tech adoption signals from blog posts / press releases

For each company return a JSON array with this exact structure:
[
  {
    "company_name": "Real Company Name",
    "signal_text": "Specific signal found what public evidence shows their intent (1-2 sentences)",
    "source_url": "Real URL where this signal was found (must be a real working URL, not example.com)"
  }
]

STRICT RULES:
- Only include REAL companies with verifiable public signals
- source_url must be a real URL (LinkedIn company page, news article, job posting, etc.)
- Do NOT invent companies, signals, or URLs
- Return only the JSON array, no markdown`

        try {
          // GROUNDED. The model was writing source_url from memory, which
          // produced real domains with invented paths thesaasnews.com/news/
          // <made-up-slug>/ → 404. Grounding returns the pages it ACTUALLY
          // visited, and we use those instead of anything it typed.
          const { text: rawText, sources } = await callGeminiProxy(prompt, {
            action: 'discovery',
            grounded: true,
          })
          const raw = rawText.replace(/^```json\s*/, '').replace(/```\s*$/, '')

          let companies: Array<{ company_name: string; signal_text: string; source_url: string }> = []
          try { companies = JSON.parse(raw) } catch { continue }

          for (const c of companies) {
            if (!c.company_name || !c.signal_text) continue

            // Only a URL Gemini genuinely opened is allowed through. If none
            // of them match this company, fall back to a Google search that
            // WILL work never a dead deep link.
            const modelUrl = String(c.source_url ?? '')
            const nameTokens = c.company_name.toLowerCase().split(/\s+/).filter(w => w.length > 3)
            const grounded = sources.find(s => {
              const u = s.uri.toLowerCase()
              const t = (s.title ?? '').toLowerCase()
              return nameTokens.some(w => u.includes(w) || t.includes(w))
            })
            // A model URL is trusted ONLY if grounding visited the same page.
            const exactHit = modelUrl && sources.some(s => s.uri === modelUrl)

            c.source_url = exactHit
              ? modelUrl
              : grounded?.uri
                ?? googleSearch(`${c.company_name} ${watch.keyword}`)

            // Check if we already have this match
            const alreadyExists = matches.some(
              m => m.watch_id === watch.id && m.company_name === c.company_name
            )
            if (alreadyExists) continue

            const { data: inserted, error } = await supabase
              .from('signal_matches')
              .insert({
                watch_id: watch.id,
                user_id: user.id,
                company_name: c.company_name,
                signal_text: c.signal_text,
                source_url: c.source_url,
                detected_at: new Date().toISOString(),
              })
              .select()
              .single()

            if (!error && inserted) {
              newMatchesFound.push({ ...(inserted as SignalMatch), watch: { keyword: watch.keyword, industry: watch.industry } })
            }
          }
        } catch (err) {
          console.error(`[SignalWatch] scan error for watch "${watch.keyword}":`, err)
        }
      }

      if (newMatchesFound.length > 0) {
        setMatches(prev => [...newMatchesFound, ...prev])
        showToast(`${newMatchesFound.length} new signal${newMatchesFound.length > 1 ? 's' : ''} detected`)
      } else {
        showToast('Scan complete no new signals found')
      }
    } finally {
      setScanning(false)
      setScanProgress('')
    }
  }

  // Load declared intents (from other users) that match your watched keywords.
  const loadMatchedIntents = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.rpc('ebexta_matched_intents')
    setMatchedIntents((data as MatchedIntent[]) ?? [])
  }, [user])
  useEffect(() => { void loadMatchedIntents() }, [loadMatchedIntents, watches.length])

  const connect = (posterId: string) => navigate(`/dashboard/inbox?to=${posterId}`)

  // ─── Render ──────────────────────────────────────────────────────────────

  const newMatchCount = matches.filter(m => {
    const detectedAt = new Date(m.detected_at)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    return detectedAt > oneDayAgo
  }).length

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="ml-0 md:ml-[240px] flex-1 min-h-screen">
        {/* Header */}
        <header className="sticky top-0 z-30 border-b pl-16 pr-4 md:px-8 py-4 flex items-center justify-between gap-2"
          style={{ background: 'rgba(255,255,255,0.92)', borderColor: 'var(--border-subtle)', backdropFilter: 'blur(20px)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>notifications_active</span>
            </div>
            <div>
              <h1 className="text-[18px] font-bold tracking-tight" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                Signal Watch
              </h1>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Monitor public intent signals for your keywords</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {newMatchCount > 0 && (
              <span className="px-2.5 py-1 rounded-full text-[11px] font-bold"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                {newMatchCount} new today
              </span>
            )}
            <button
              onClick={runSignalScan}
              disabled={scanning || watches.filter(w => w.active).length === 0}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
              style={{
                background: 'linear-gradient(135deg, var(--accent), var(--accent-interactive))',
                color: '#fff',
                boxShadow: '0 0 20px var(--accent-subtle)',
              }}
            >
              <span className={`material-symbols-outlined text-[16px] ${scanning ? 'animate-spin' : ''}`}>
                {scanning ? 'sync' : 'radar'}
              </span>
              {scanning ? scanProgress || 'Scanning…' : 'Run Scan'}
            </button>
            <button
              onClick={() => setShowForm(f => !f)}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-bold transition-all"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}
            >
              <span className="material-symbols-outlined text-[16px]">{showForm ? 'close' : 'add'}</span>
              {showForm ? 'Cancel' : 'Add Watch'}
            </button>
          </div>
        </header>

        <div className="p-8 space-y-8 max-w-5xl mx-auto">

          {/* Add Watch Form */}
          <AnimatePresence>
            {showForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="overflow-hidden"
              >
                <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <h3 className="text-[15px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>New Signal Watch</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div className="col-span-2 space-y-1.5">
                      <label className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>
                        Watch Keyword *
                      </label>
                      <input
                        type="text"
                        value={newKeyword}
                        onChange={e => setNewKeyword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleAddWatch()}
                        placeholder="e.g. AI development, mobile app agency, SaaS tools…"
                        className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                        }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>Industry</label>
                      <select
                        value={newIndustry}
                        onChange={e => setNewIndustry(e.target.value)}
                        className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all appearance-none"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      >
                        {INDUSTRY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>Notes (optional)</label>
                      <input
                        type="text"
                        value={newNotes}
                        onChange={e => setNewNotes(e.target.value)}
                        placeholder="e.g. India only, ₹2L+ budget…"
                        className="w-full rounded-xl px-4 py-3 text-[14px] outline-none transition-all"
                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        onFocus={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
                        onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      />
                    </div>
                  </div>
                  <button
                    onClick={handleAddWatch}
                    disabled={adding || !newKeyword.trim()}
                    className="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
                    style={{ background: 'var(--accent)', color: '#fff' }}
                  >
                    {adding ? 'Saving…' : 'Save Watch'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Loading */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
                <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading watches…</p>
              </div>
            </div>
          ) : (
            <>
              {/* Active Watches */}
              <motion.section {...sectionAnim(0)}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>manage_search</span>
                    <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                      Active Watches
                    </h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                      {watches.length}
                    </span>
                  </div>
                </div>

                {watches.length === 0 ? (
                  <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
                    style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                      <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--accent)' }}>radar</span>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No watches yet</p>
                      <p className="text-[13px] max-w-sm" style={{ color: 'var(--text-muted)' }}>
                        Add keywords to watch. EBEXTA will scan for companies showing public intent signals matching them.
                      </p>
                    </div>
                    <button onClick={() => setShowForm(true)}
                      className="px-5 py-2.5 rounded-xl text-[13px] font-bold"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                      Add your first watch
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {watches.map((watch, i) => (
                      <motion.div key={watch.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="rounded-2xl p-5"
                        style={{
                          background: 'var(--bg-surface)',
                          border: `1px solid ${watch.active ? 'var(--accent-subtle)' : 'var(--border-subtle)'}`,
                        }}
                      >
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-[15px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                              {watch.keyword}
                            </p>
                            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                              {watch.industry}{watch.notes ? ` · ${watch.notes}` : ''}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 ml-3 shrink-0">
                            {/* Toggle */}
                            <button
                              onClick={() => toggleWatch(watch.id, watch.active)}
                              className="relative w-9 h-5 rounded-full transition-all"
                              style={{ background: watch.active ? 'var(--accent)' : 'var(--border-subtle)' }}
                              title={watch.active ? 'Pause watch' : 'Resume watch'}
                            >
                              <div className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform"
                                style={{ transform: watch.active ? 'translateX(17px)' : 'translateX(2px)' }} />
                            </button>
                            {/* Delete */}
                            <button onClick={() => deleteWatch(watch.id)}
                              className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                              style={{ color: 'var(--text-muted)' }}
                              onMouseEnter={e => (e.currentTarget.style.color = 'var(--critical)')}
                              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text-muted)')}
                            >
                              <span className="material-symbols-outlined text-[16px]">delete</span>
                            </button>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className={`flex h-1.5 w-1.5 relative`}>
                            {watch.active && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />}
                            <span className="relative inline-flex rounded-full h-1.5 w-1.5"
                              style={{ background: watch.active ? 'var(--accent)' : 'var(--text-muted)' }} />
                          </span>
                          <span className="text-[11px] font-bold tracking-[0.06em]"
                            style={{ color: watch.active ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>
                            {watch.active ? 'ACTIVE' : 'PAUSED'}
                          </span>
                          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)' }}>
                            {matches.filter(m => m.watch_id === watch.id).length} signals found
                          </span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.section>

              {/* Matching intents from the network (posted on the Intent Board) */}
              {matchedIntents.length > 0 && (
                <motion.section {...sectionAnim(1)} className="mb-8">
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>ads_click</span>
                    <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Live intent matches</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono" style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>{matchedIntents.length}</span>
                  </div>
                  <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>EBEXTA members who posted an intent matching your keywords. Connect to start a conversation.</p>
                  <div className="grid md:grid-cols-2 gap-3">
                    {matchedIntents.map(mi => (
                      <div key={mi.intent_id} className="rounded-2xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>{mi.company_name || 'EBEXTA member'}</span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>{mi.mode}</span>
                        </div>
                        <p className="text-[13px] mb-2" style={{ color: 'var(--text-secondary)' }}>{mi.requirement}</p>
                        <div className="flex items-center gap-2 mb-3 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>matched: {mi.matched_keyword}</span>
                          {mi.budget_range && <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>{mi.budget_range}</span>}
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => connect(mi.poster_id)} className="flex-1 h-9 rounded-lg text-[12px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>Connect</button>
                          <button onClick={() => setProfileUserId(mi.poster_id)} className="flex-1 h-9 rounded-lg text-[12px] font-bold" style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>View profile</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>
              )}

              {/* Signal Matches */}
              {matches.length > 0 && (
                <motion.section {...sectionAnim(1)}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>bolt</span>
                    <h2 className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Detected Signals</h2>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono"
                      style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>
                      {matches.length}
                    </span>
                  </div>

                  <div className="space-y-3">
                    {matches.map((match, i) => {
                      const isNew = new Date(match.detected_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
                      return (
                        <motion.div key={match.id}
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="rounded-2xl p-5"
                          style={{
                            background: isNew ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                            border: `1px solid ${isNew ? 'var(--accent-subtle)' : 'var(--border-subtle)'}`,
                          }}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1.5">
                                {isNew && (
                                  <span className="px-2 py-0.5 rounded text-[9px] font-bold tracking-wider"
                                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent)' }}>NEW</span>
                                )}
                                <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                                  {match.company_name}
                                </p>
                              </div>
                              <p className="text-[13px] mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                                {match.signal_text}
                              </p>
                              <div className="flex items-center gap-3 flex-wrap">
                                {match.watch && (
                                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold"
                                    style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                                    {match.watch.keyword}
                                  </span>
                                )}
                                {match.source_url && !match.source_url.includes('example.com') && (() => {
                                  // A Google-search fallback is honest but it is
                                  // NOT a source. Label it for what it is.
                                  const isSearch = match.source_url.includes('google.com/search')
                                  return (
                                    <a
                                      href={match.source_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      title={isSearch
                                        ? 'We could not confirm a direct source page this searches for it'
                                        : match.source_url}
                                      className="flex items-center gap-1.5 text-[12px] transition-colors"
                                      style={{ color: isSearch ? 'var(--text-muted)' : 'var(--accent)' }}
                                      onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent-interactive)')}
                                      onMouseLeave={e => (e.currentTarget.style.color = isSearch ? 'var(--text-muted)' : 'var(--accent)')}
                                    >
                                      <span className="material-symbols-outlined text-[14px]">
                                        {isSearch ? 'search' : 'open_in_new'}
                                      </span>
                                      {isSearch ? 'Find source' : 'View source'}
                                    </a>
                                  )
                                })()}
                                <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                  {new Date(match.detected_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.section>
              )}

              {/* Empty matches state */}
              {matches.length === 0 && watches.length > 0 && (
                <motion.section {...sectionAnim(1)}>
                  <div className="rounded-2xl p-10 flex flex-col items-center gap-4 text-center"
                    style={{ background: 'var(--bg-surface)', border: '1px dashed var(--border-subtle)' }}>
                    <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                      <span className="material-symbols-outlined text-[24px]" style={{ color: 'var(--accent)' }}>sensors</span>
                    </div>
                    <div>
                      <p className="text-[15px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No signals yet</p>
                      <p className="text-[13px] max-w-sm" style={{ color: 'var(--text-muted)' }}>
                        Hit "Run Scan" to search for companies showing public intent signals matching your watches.
                      </p>
                    </div>
                    <button
                      onClick={runSignalScan}
                      disabled={scanning}
                      className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-bold transition-all disabled:opacity-50"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                    >
                      <span className="material-symbols-outlined text-[16px]">radar</span>
                      Scan Now
                    </button>
                  </div>
                </motion.section>
              )}

              {/* How it works */}
              <motion.section {...sectionAnim(2)}>
                <div className="rounded-2xl p-5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>info</span>
                    <h3 className="text-[13px] font-bold tracking-[0.04em]" style={{ color: 'var(--text-muted)' }}>How Signal Watch works</h3>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {[
                      { icon: 'add_circle', title: 'Save a keyword', desc: 'e.g. "mobile app development", "AI automation", "logistics SaaS"' },
                      { icon: 'radar', title: 'Scan on demand', desc: 'EBEXTA searches public job posts, news, and funding signals matching your keyword' },
                      { icon: 'notifications_active', title: 'See new signals', desc: 'New companies showing intent appear here click to investigate and reach out' },
                    ].map(item => (
                      <div key={item.title} className="flex flex-col gap-2">
                        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent-interactive)' }}>{item.icon}</span>
                        <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                        <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>
            </>
          )}
        </div>
      </main>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            className="fixed bottom-8 left-1/2 -translate-x-1/2 px-5 py-3 rounded-2xl flex items-center gap-2.5 text-[13px] font-bold z-50"
            style={{
              background: 'var(--border-subtle)',
              border: `1px solid ${toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--accent-subtle)'}`,
              color: toast.type === 'error' ? 'var(--critical)' : 'var(--text-primary)',
              boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
            }}
          >
            <span className="material-symbols-outlined text-[16px]"
              style={{ color: toast.type === 'error' ? 'var(--critical)' : 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>
              {toast.type === 'error' ? 'error' : 'check_circle'}
            </span>
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      {profileUserId && <NetworkProfile userId={profileUserId} onClose={() => setProfileUserId(null)} />}
    </div>
  )
}
