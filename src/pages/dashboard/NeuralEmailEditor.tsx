import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { generateEmail, type GeneratedEmail, type StrategyHint } from '../../lib/emailGenerator'
import { useAuth } from '../../contexts/AuthContext'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { checkCredits, consumeCredit } from '../../lib/credits'
import type { ScannedLead } from '../../lib/scanEngine'

const SECTION_META = [
  { key: 'p1', label: 'OPENING_HOOK', borderColor: 'border-primary/40', hoverBorder: 'hover:border-primary', labelColor: 'text-primary/60' },
  { key: 'p2', label: 'PAIN_POINT', borderColor: 'border-error/40', hoverBorder: 'hover:border-error', labelColor: 'text-error/60' },
  { key: 'p3', label: 'VALUE_PROP', borderColor: 'border-secondary/40', hoverBorder: 'hover:border-secondary', labelColor: 'text-secondary/60' },
  { key: 'p4', label: 'CALL_TO_ACTION', borderColor: 'border-on-surface-variant/40', hoverBorder: 'hover:border-on-surface', labelColor: 'text-on-surface-variant/60' },
] as const

export default function NeuralEmailEditor() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [lead, setLead] = useState<ScannedLead | null>(null)
  const [profile, setProfile] = useState<{ company_name?: string; mission?: string; sender_email?: string } | null>(null)

  // FUNCTION 1 state — generation only
  const [emailData, setEmailData] = useState<GeneratedEmail | null>(null)
  const [generating, setGenerating] = useState(false)
  const [emailGenerated, setEmailGenerated] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // UI state
  const [copied, setCopied] = useState(false)
  const [strategyOpen, setStrategyOpen] = useState(true)

  // Deal-strategy angle handed over from Company Memory → "Use in outreach".
  // Read once on mount and cleared immediately, so it steers this visit's
  // generation without silently colouring every future email for this lead.
  const [strategy] = useState<StrategyHint | null>(() => {
    if (!id) return null
    try {
      const raw = localStorage.getItem(`ebexta_strategy_${id}`)
      if (!raw) return null
      localStorage.removeItem(`ebexta_strategy_${id}`)
      const parsed = JSON.parse(raw) as StrategyHint
      return (parsed?.opening_line || parsed?.pitch_first) ? parsed : null
    } catch {
      return null
    }
  })

  // ── Load lead (from localStorage or Supabase) ──────────────────────────────
  // NO email generation here — just data loading
  useEffect(() => {
    if (!id) return
    for (const key of ['ebexta_leads_seeker', 'ebexta_leads_provider', 'ebexta_scan_results']) {
      const cached = localStorage.getItem(key)
      if (!cached) continue
      try {
        const arr: ScannedLead[] = JSON.parse(cached)
        const found = arr.find(l => l.id === id)
        if (found) { setLead(found); return }
      } catch { /* fall through */ }
    }
    supabase.from('leads').select('*').eq('id', id).maybeSingle()
      .then(({ data }) => { if (data) setLead(data as ScannedLead) })
  }, [id])

  // ── Load cached email (generated once, then reused) ─────────────────────────
  // Restores a previously generated email so switching pages / tabs never
  // triggers a regeneration or loses the draft.
  useEffect(() => {
    if (!id) return
    try {
      const raw = localStorage.getItem(`ebexta_email_${id}`)
      if (raw) {
        const parsed = JSON.parse(raw) as GeneratedEmail
        if (parsed?.subject) { setEmailData(parsed); setEmailGenerated(true) }
      }
    } catch { /* no cache */ }
  }, [id])

  // ── Persist the email (and any edits) to cache ──────────────────────────────
  useEffect(() => {
    if (!id || !emailGenerated || !emailData) return
    try { localStorage.setItem(`ebexta_email_${id}`, JSON.stringify(emailData)) } catch { /* quota */ }
  }, [id, emailGenerated, emailData])

  // ── Load user profile ──────────────────────────────────────────────────────
  // NO email generation here — just data loading. Merges Supabase profile with
  // the onboarding company name so outreach always shows the real company.
  useEffect(() => {
    // Seed immediately from onboarding data
    const s0 = resolveSenderProfile(null)
    setProfile({ company_name: s0.companyName, mission: s0.mission, sender_email: s0.email })
    if (!user) return
    supabase.from('profiles').select('company_name, mission, sender_email').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        const s = resolveSenderProfile(data)
        setProfile({ company_name: s.companyName, mission: s.mission, sender_email: s.email })
      })
  }, [user])

  // ── FUNCTION 1: Generate email content (calls Gemini) ─────────────────────
  // Fires ONLY when user clicks "Generate Email" or "Regenerate"
  // NEVER calls window.open, NEVER calls mailto, ONLY updates state
  async function handleGenerateEmail() {
    if (generating || !lead) return  // prevent double-click

    const gate = await checkCredits('ai_generation')
    if (!gate) return

    setGenerating(true)
    setError(null)
    try {
      const result = await generateEmail(lead, {
        id: user?.id,
        company_name: profile?.company_name,
        mission: profile?.mission,
        sender_email: profile?.sender_email,
      }, strategy)
      setEmailData(result)
      setEmailGenerated(true)
      await consumeCredit('ai_generation', { lead_id: lead.id, company_name: lead.company_name })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Email generation failed')
    } finally {
      setGenerating(false)
    }
  }

  // ── FUNCTION 2: Open Gmail (NO Gemini, NO API call) ───────────────────────
  // Fires ONLY when user clicks "Send via Gmail"
  // Pure side effect — opens Gmail once and stops
  function handleOpenGmail() {
    if (!emailData) return

    const to = lead?.email ?? lead?.stakeholders?.[0]?.email ?? ''
    const subject = encodeURIComponent(emailData.subject)
    const body = encodeURIComponent(
      [emailData.p1, emailData.p2, emailData.p3, emailData.p4].join('\n\n')
    )

    // Open ONCE using window.open
    // NOT window.location.href (can loop in some browsers)
    // NOT inside useEffect
    // NOT in a loop
    window.open(
      `mailto:${to}?subject=${subject}&body=${body}`,
      '_blank'
    )
    // DO NOT update any state after this
    // DO NOT call any other function after this
    // STOP here
  }

  function handleCopy() {
    if (!emailData) return
    const text = `Subject: ${emailData.subject}\n\n${emailData.p1}\n\n${emailData.p2}\n\n${emailData.p3}\n\n${emailData.p4}`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function updateSection(key: string, value: string) {
    if (!emailData) return
    setEmailData(prev => prev ? { ...prev, [key]: value } : null)
  }

  const geo = (f: string) => ({ fontFamily: f })

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="flex-1 min-w-0 ml-0 md:ml-[240px] h-screen flex flex-col overflow-hidden">
        {/* TopAppBar */}
        <header className="h-16 px-6 flex justify-between items-center bg-surface border-b border-outline-variant z-40 shrink-0">
          <div className="flex items-center gap-6">
            <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>
              Outreach Intelligence
            </h2>
            <div className="h-4 w-px bg-outline-variant" />
            <nav className="flex items-center gap-4">
              <span className="text-primary font-bold text-[14px]">Neural Email</span>
              <span className="material-symbols-outlined text-on-surface-variant text-[16px]">chevron_right</span>
              <span className="text-on-surface-variant text-[14px] opacity-60">{lead?.company_name ?? '…'}</span>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={handleGenerateEmail}
              disabled={generating || !lead}
              className="px-4 py-1 bg-primary text-on-primary hover:opacity-90 transition-opacity rounded-lg text-[14px] font-bold flex items-center gap-1 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">sync</span>
              {generating ? 'Generating…' : emailGenerated ? 'Regenerate' : 'Generate Email'}
            </button>
            <button className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-container-high text-on-surface-variant">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container-high flex items-center justify-center">
              <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
            </div>
          </div>
        </header>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Lead Context */}
          <section className="w-[300px] border-r border-outline-variant bg-surface-container-lowest p-6 overflow-y-auto custom-scrollbar shrink-0">
            {lead ? (
              <>
                <div className="mb-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="w-12 h-12 bg-surface-container-high rounded-lg flex items-center justify-center border border-outline-variant shrink-0">
                      <span className="text-[18px] font-bold text-on-surface-variant">{lead.company_name.charAt(0)}</span>
                    </div>
                    <div>
                      <h3 className="text-[20px] font-semibold text-on-surface" style={geo('Geist, Inter, sans-serif')}>{lead.company_name}</h3>
                      <p className="text-[14px] text-on-surface-variant opacity-70">{lead.industry}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-4">
                    {(lead.intent_flags ?? []).map(flag => (
                      <span key={flag} className="px-2 py-1 bg-primary-container/10 border border-primary-container/30 text-primary text-[11px] font-bold tracking-[0.06em] uppercase rounded-full">
                        {flag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="p-4 glass-box">
                    <p className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant mb-3 opacity-60 uppercase">Neural Personalization Base</p>
                    <p className="text-[14px] text-on-surface leading-relaxed">
                      Personalized using:{' '}
                      {(lead.intent_flags ?? []).map((f, i) => (
                        <span key={f}><span className="text-secondary" style={geo('JetBrains Mono, monospace')}>{f}</span>{i < (lead.intent_flags?.length ?? 0) - 1 ? ' · ' : ''}</span>
                      ))}
                    </p>
                  </div>

                  {(lead.recent_signals ?? []).length > 0 && (
                    <div>
                      <h4 className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant mb-4 uppercase">Key Signals Map</h4>
                      <div className="space-y-4 relative">
                        <div className="absolute left-3 top-4 bottom-4 w-px bg-outline-variant" />
                        {(lead.recent_signals ?? []).map((sig, i) => (
                          <div key={i} className="flex gap-4 relative">
                            <div className="w-6 h-6 rounded-full bg-surface-container-high border border-outline-variant flex items-center justify-center z-10 shrink-0">
                              <div className={`w-2 h-2 rounded-full ${i === 0 ? 'bg-primary' : i === 1 ? 'bg-tertiary' : 'bg-secondary'}`} />
                            </div>
                            <p className="text-[14px] text-on-surface">{sig}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {emailData?.winningAngle && (
                    <div className="p-4 glass-box border-primary/20">
                      <div className="flex items-center gap-2 mb-2 text-primary">
                        <span className="material-symbols-outlined text-[18px]">lightbulb</span>
                        <span className="text-[11px] font-bold tracking-[0.06em] uppercase">Winning Angle</span>
                      </div>
                      <p className="text-[14px] text-on-surface italic">"{emailData.winningAngle}"</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-32">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </section>

          {/* Right: Email Editor */}
          <section className="flex-1 bg-surface flex flex-col overflow-hidden">
            <div className="flex-1 overflow-y-auto px-8 py-8 custom-scrollbar">

              {/* Strategy angle carried over from Company Memory. Shown so the
                  user knows exactly what is steering this email. */}
              {strategy && (
                <div className="max-w-[1080px] mx-auto mb-5 p-4 rounded-xl"
                  style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-strong)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--accent-interactive)' }}>strategy</span>
                    <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--accent-interactive)' }}>
                      Using the deal strategy from Company Memory
                    </p>
                  </div>
                  {strategy.opening_line && (
                    <p className="text-[13px] italic leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                      “{strategy.opening_line}”
                    </p>
                  )}
                  {strategy.pitch_first && (
                    <p className="text-[12.5px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                      Leading with: {strategy.pitch_first}
                    </p>
                  )}
                </div>
              )}

              {/* Not yet generated — prompt user to click */}
              {!emailGenerated && !generating && !error && (
                <div className="max-w-[1080px] mx-auto mb-6 p-6 rounded-xl bg-primary/5 border border-primary/20 flex flex-col items-center gap-4 text-center">
                  <span className="material-symbols-outlined text-primary text-[40px]">mail</span>
                  <div>
                    <p className="text-on-surface font-semibold text-[16px]">Ready to generate your personalized email</p>
                    <p className="text-on-surface-variant text-[13px] mt-1">
                      {lead ? 'Click "Generate Email" to write a personalized cold outreach with EBEXTA.' : 'Loading lead data…'}
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateEmail}
                    disabled={generating || !lead}
                    className="px-8 py-3 bg-primary text-on-primary font-bold rounded-xl text-[14px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[18px]">auto_awesome</span>
                    Generate Email
                  </button>
                </div>
              )}

              {error && (
                <div className="max-w-[1080px] mx-auto mb-6 p-4 rounded-xl bg-[var(--critical-bg)] border border-[var(--critical)]/30 text-[var(--critical)] text-[14px] flex items-center gap-3">
                  <span className="material-symbols-outlined">error</span>
                  <span>{error}</span>
                  <button onClick={handleGenerateEmail} className="ml-auto px-4 py-1 bg-[var(--critical)]/20 rounded-lg text-[13px] font-bold">Retry</button>
                </div>
              )}

              {generating && (
                <div className="max-w-[1080px] mx-auto glass-card rounded-xl p-8">
                  <div className="flex items-center gap-3 text-primary text-[14px] mb-6">
                    <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin shrink-0" />
                    <span>EBEXTA is writing your personalized email…</span>
                  </div>
                  {/* Skeleton so the editor space stays filled while generating */}
                  <div className="h-6 w-2/3 rounded bg-surface-container-high animate-pulse mb-6" />
                  <div className="space-y-6">
                    {[0, 1, 2, 3].map(i => (
                      <div key={i} className="pl-4 border-l-2 border-outline-variant/40 space-y-2">
                        <div className="h-3 w-24 rounded bg-surface-container-high animate-pulse" />
                        <div className="h-3 w-full rounded bg-surface-container-high animate-pulse" />
                        <div className="h-3 w-11/12 rounded bg-surface-container-high animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {emailGenerated && emailData && (
                <div className="max-w-[1080px] mx-auto glass-card rounded-xl p-8">
                  {/* Subject */}
                  <div className="mb-6 pb-4 border-b border-outline-variant">
                    <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant block mb-1 opacity-50 uppercase">Subject</label>
                    <input
                      type="text"
                      value={emailData.subject}
                      onChange={e => setEmailData(prev => prev ? { ...prev, subject: e.target.value } : null)}
                      className="w-full bg-transparent border-none text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface focus:outline-none p-0"
                      style={geo('Geist, Inter, sans-serif')}
                    />
                  </div>

                  {/* Body Sections */}
                  <div className="space-y-6 text-[16px] text-on-surface leading-relaxed" style={geo('JetBrains Mono, monospace')}>
                    {SECTION_META.map(sec => (
                      <div key={sec.key} className={`pl-4 border-l-2 ${sec.borderColor} ${sec.hoverBorder} py-2 group transition-colors`}>
                        <span className={`text-[11px] font-bold tracking-[0.06em] ${sec.labelColor} block mb-2 select-none uppercase`}>
                          # {sec.label}
                        </span>
                        <textarea
                          value={emailData[sec.key as keyof GeneratedEmail] as string}
                          onChange={e => updateSection(sec.key, e.target.value)}
                          rows={4}
                          className="w-full bg-transparent border-none resize-none text-on-surface focus:outline-none p-0 text-[15px] leading-relaxed"
                          style={geo('JetBrains Mono, monospace')}
                        />
                      </div>
                    ))}

                    <div className="mt-10 pt-6">
                      <p className="text-on-surface-variant">Best,</p>
                      <p className="text-on-surface font-bold mt-1">{profile?.company_name ?? 'Your Company'}</p>
                      {profile?.sender_email && <p className="text-on-surface-variant text-[14px]">{profile.sender_email}</p>}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Deliverability tip — shown once an email is ready, before sending */}
            {emailGenerated && emailData && (
              <div className="max-w-[1080px] mx-auto mb-3 flex items-start gap-2 px-3.5 py-2 rounded-lg"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                <span className="material-symbols-outlined text-[16px] mt-0.5" style={{ color: 'var(--accent-interactive)' }}>lightbulb</span>
                <p className="text-[12px] leading-snug" style={{ color: 'var(--text-secondary)' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>Deliverability tip:</strong> send from your own inbox, ~10–15 personalised emails a day, not 200 at once. Slow and human protects your domain and gets more replies.
                </p>
              </div>
            )}

            {/* Action bar */}
            <div className="email-action-bar shrink-0">
              {/* Button 1: Generate / Regenerate — calls Gemini, NEVER opens Gmail */}
              <button
                onClick={handleGenerateEmail}
                disabled={generating || !lead}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container text-on-surface-variant transition-all text-[14px] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                {generating ? 'Generating…' : emailGenerated ? 'Regenerate' : 'Generate Email'}
              </button>

              <button
                onClick={handleCopy}
                disabled={!emailGenerated || !emailData}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-outline-variant bg-surface hover:bg-surface-container text-on-surface-variant transition-all text-[14px] disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{copied ? 'check' : 'content_copy'}</span>
                {copied ? 'Copied!' : 'Copy'}
              </button>

              {/* Button 2: Send via Gmail — only visible after generation, NEVER calls Gemini */}
              {emailGenerated && emailData && (
                <button
                  onClick={handleOpenGmail}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg bg-primary text-on-primary font-bold hover:brightness-110 active:scale-[0.98] transition-all text-[14px]"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                  Send via Gmail
                </button>
              )}
            </div>

            {/* Strategy Builder */}
            {emailGenerated && emailData && (
              <div className="border-t border-outline-variant bg-surface-container-low shrink-0">
                <button
                  onClick={() => setStrategyOpen(o => !o)}
                  className="w-full flex items-center justify-between px-6 py-4 hover:bg-surface-container transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-primary">psychology</span>
                    <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface uppercase">Strategy Builder & Messaging Notes</span>
                  </div>
                  <span className="material-symbols-outlined transition-transform duration-300" style={{ transform: strategyOpen ? 'rotate(0deg)' : 'rotate(180deg)' }}>
                    expand_less
                  </span>
                </button>
                {strategyOpen && (
                  <div className="px-6 pb-6 grid grid-cols-2 gap-6">
                    <div className="p-4 glass-box">
                      <h5 className="text-[11px] font-bold tracking-[0.06em] text-primary mb-2 uppercase">Winning Angle</h5>
                      <p className="text-[14px] text-on-surface-variant italic">{emailData.winningAngle}</p>
                    </div>
                    <div className="p-4 glass-box">
                      <h5 className="text-[11px] font-bold tracking-[0.06em] text-secondary mb-2 uppercase">Messaging Style Note</h5>
                      <p className="text-[14px] text-on-surface-variant">{emailData.messagingNote}</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <footer className="w-full h-12 bg-surface-dim flex justify-between items-center px-6 border-t border-outline-variant shrink-0">
              <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface uppercase">
                EBEXTA
              </span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--accent)', boxShadow: '0 0 8px var(--accent-subtle)' }} />
                <span className="text-[11px] font-bold tracking-[0.06em] text-[var(--accent-interactive)] uppercase">Match Engine Online</span>
              </div>
            </footer>
          </section>
        </div>
      </main>
    </div>
  )
}
