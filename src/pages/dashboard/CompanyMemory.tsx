/**
 * /dashboard/companies/:id — THE MEMORY PAGE.
 *
 * One page containing every V2 intelligence section as stacked cards, with a
 * sticky jump nav. This is the "operating system" view of a company: what we
 * know, how we know it, how to sell to them, and what happened.
 *
 * COST RULE: the two Gemini sections generate ONCE on first open and are then
 * served from the Supabase cache. Reopening this page makes NO API call.
 * "Refresh intelligence" is the only way to regenerate.
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { fetchActiveProduct } from '../../lib/productAnalysis'
import { openExternal, normalizeUrl } from '../../lib/urlUtils'
import {
  fetchMemory, fetchTimeline, fetchInteractions, updateMemory,
  addTimelineEvent, logInteraction, moveToStage, PIPELINE_STAGES,
  type CompanyMemory as Memory, type TimelineEvent, type Interaction,
  type InteractionType, type PipelineStage,
} from '../../lib/companyMemory'
import { ensureIntelligence, type IntelligenceBundle } from '../../lib/dealIntel'
import { formatDate } from '../../lib/dateFormat'
import { TrustHistory } from '../../components/memory/TrustHistory'
import { RelationshipTree } from '../../components/memory/RelationshipTree'
import { DealStrategyPanel } from '../../components/memory/DealStrategyPanel'
import { OpportunityStepper } from '../../components/memory/OpportunityStepper'
import { VerificationMatrixPanel } from '../../components/memory/VerificationMatrixPanel'
import { ScoreExplainability } from '../../components/memory/ScoreExplainability'
import { InteractionLog } from '../../components/memory/InteractionLog'
import { OutcomeSelector } from '../../components/memory/OutcomeSelector'
import { TeamPanel } from '../../components/memory/TeamPanel'

const SECTIONS = [
  { id: 'timeline',       label: 'History' },
  { id: 'opportunity',    label: 'Opportunity' },
  { id: 'strategy',       label: 'Strategy' },
  { id: 'relationships',  label: 'People' },
  { id: 'verification',   label: 'Verification' },
  { id: 'explainability', label: 'Why' },
  { id: 'interactions',   label: 'Interactions' },
  { id: 'team',           label: 'Team' },
]

const STAGE_LABEL: Record<PipelineStage, string> = {
  lead: 'Lead', contacted: 'Contacted', meeting: 'Meeting',
  proposal: 'Proposal', won: 'Won', lost: 'Lost',
}

export default function CompanyMemory() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [memory, setMemory] = useState<Memory | null>(null)
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [intel, setIntel] = useState<IntelligenceBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [intelError, setIntelError] = useState<string | null>(null)
  const [userService, setUserService] = useState('')
  const [dealValue, setDealValue] = useState('')
  const [savingValue, setSavingValue] = useState(false)
  const [activeSection, setActiveSection] = useState('timeline')
  const [toast, setToast] = useState<string | null>(null)

  // The on-open generation must fire exactly once per company, even under
  // React StrictMode's double-invoke.
  const intelRequested = useRef<string | null>(null)

  function flash(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 2600)
  }

  // ── What we sell — feeds both Gemini prompts ──
  useEffect(() => {
    if (!user) return
    let alive = true
    ;(async () => {
      const [{ data: profile }, product] = await Promise.all([
        supabase.from('profiles').select('company_name, mission, sender_email').eq('id', user.id).maybeSingle(),
        fetchActiveProduct(user.id).catch(() => null),
      ])
      if (!alive) return
      const sender = resolveSenderProfile(profile)
      const productText = product?.product_name
        ? `${product.product_name}${product.product_description ? `: ${product.product_description}` : ''}`
        : ''
      setUserService(productText || sender.mission || 'B2B services')
    })()
    return () => { alive = false }
  }, [user])

  // ── Load the memory record + its history ──
  const loadAll = useCallback(async () => {
    if (!id) return null
    const [m, ev, ix] = await Promise.all([
      fetchMemory(id), fetchTimeline(id), fetchInteractions(id),
    ])
    setMemory(m)
    setEvents(ev)
    setInteractions(ix)
    setDealValue(m?.deal_value != null ? String(m.deal_value) : '')
    setLoading(false)
    return m
  }, [id])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void loadAll() }, [loadAll])

  // ── Intelligence: cached read, or ONE generation the first time ──
  useEffect(() => {
    if (!memory || !userService) return
    if (intelRequested.current === memory.id) return
    intelRequested.current = memory.id

    const willCallGemini = !memory.relationship_map && !memory.deal_strategy
    let alive = true
    ;(async () => {
      if (willCallGemini) setGenerating(true)
      try {
        const bundle = await ensureIntelligence(memory, userService, false)
        if (!alive) return
        setIntel(bundle)
        setIntelError(bundle.error ?? null)
      } catch (err) {
        if (alive) setIntelError((err as Error)?.message ?? 'Intelligence generation failed')
      } finally {
        if (alive) setGenerating(false)
      }
    })()
    return () => { alive = false }
  }, [memory, userService])

  // ── Scroll spy for the jump nav ──
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        const visible = entries
          .filter(e => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]
        if (visible?.target?.id) setActiveSection(visible.target.id)
      },
      { rootMargin: '-96px 0px -60% 0px', threshold: 0 },
    )
    for (const s of SECTIONS) {
      const el = document.getElementById(s.id)
      if (el) observer.observe(el)
    }
    return () => observer.disconnect()
  }, [loading, intel])

  // ── Actions ──

  async function handleRefreshIntelligence() {
    if (!memory || generating) return
    setGenerating(true); setIntelError(null)
    try {
      const bundle = await ensureIntelligence(memory, userService, true)
      setIntel(bundle)
      setIntelError(bundle.error ?? null)
      const fresh = await fetchMemory(memory.id)
      if (fresh) setMemory(fresh)
      flash('Intelligence refreshed')
    } catch (err) {
      setIntelError((err as Error)?.message ?? 'Refresh failed')
    } finally {
      setGenerating(false)
    }
  }

  async function handleAddNote(title: string, detail: string) {
    if (!memory) return
    await addTimelineEvent({
      memoryId: memory.id,
      eventType: 'note',
      title,
      detail: detail || null,
      isVerified: true,   // the user recorded it — first-party fact
    })
    setEvents(await fetchTimeline(memory.id))
  }

  async function handleLogInteraction(type: InteractionType, subject: string, contact: string) {
    if (!memory) return
    await logInteraction(memory.id, {
      interactionType: type,
      subject,
      contactName: contact || null,
    })
    const [ev, ix] = await Promise.all([fetchTimeline(memory.id), fetchInteractions(memory.id)])
    setEvents(ev); setInteractions(ix)
  }

  async function handleSaveDealValue() {
    if (!memory) return
    const raw = dealValue.trim()
    const parsed = raw === '' ? null : Number(raw.replace(/[^\d.]/g, ''))
    if (parsed != null && !Number.isFinite(parsed)) return
    setSavingValue(true)
    await updateMemory(memory.id, { deal_value: parsed })
    setMemory({ ...memory, deal_value: parsed })
    setSavingValue(false)
    flash('Deal value saved')
  }

  async function handleMoveStage(stage: PipelineStage) {
    if (!memory) return
    await moveToStage(memory.id, stage, stage === 'won' ? memory.deal_value : null)
    setEvents(await fetchTimeline(memory.id))
    flash(`Moved to ${STAGE_LABEL[stage]}`)
  }

  async function handleSaveNotes(text: string) {
    if (!memory) return
    await updateMemory(memory.id, { internal_notes: text })
    setMemory({ ...memory, internal_notes: text })
  }

  /** Pre-fill the email generator with the strategy's angle. */
  function handleUseInOutreach() {
    if (!memory || !intel?.deal_strategy) return
    const leadId = memory.latest_lead_id
    if (!leadId) {
      flash('No lead record linked yet: run a scan that finds this company.')
      return
    }
    try {
      localStorage.setItem(`ebexta_strategy_${leadId}`, JSON.stringify({
        opening_line: intel.deal_strategy.opening_line,
        pitch_first: intel.deal_strategy.pitch_first,
        why_now: intel.deal_strategy.why_now,
      }))
    } catch { /* quota — the editor just won't pre-fill */ }
    navigate(`/dashboard/lead/${leadId}/email`)
  }

  // ── Render ──

  if (loading) {
    return (
      <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8">
          <div className="h-[120px] rounded-2xl animate-pulse mb-4"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
          <div className="h-[300px] rounded-2xl animate-pulse"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }} />
        </main>
      </div>
    )
  }

  if (!memory) {
    return (
      <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
        <Sidebar />
        <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8">
          <div className="rounded-2xl premium-card px-6 py-14 text-center">
            <p className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              This company isn’t in your memory.
            </p>
            <button onClick={() => navigate('/dashboard/companies')}
              className="premium-btn px-4 py-2 rounded-xl text-[13px]">Back to companies</button>
          </div>
        </main>
      </div>
    )
  }

  const snap = (memory.company_snapshot ?? {}) as Record<string, unknown>
  const website = normalizeUrl(String(snap.website ?? ''))
  const contacts = memory.contacts ?? []

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
        <button onClick={() => navigate('/dashboard/companies')}
          className="inline-flex items-center gap-1 text-[12.5px] font-semibold mb-4"
          style={{ color: 'var(--text-muted)' }}>
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          All companies
        </button>

        {/* ── HEADER ── */}
        <motion.header
          initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl premium-card px-5 py-4 mb-4"
          style={{ borderRadius: 16 }}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-[-0.03em] leading-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                {memory.company_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 mt-1">
                {memory.company_domain && (
                  <button onClick={() => openExternal(website ?? `https://${memory.company_domain}`)}
                    className="text-[12.5px] underline" style={{ color: 'var(--accent-interactive)' }}>
                    {memory.company_domain}
                  </button>
                )}
                <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  First seen {formatDate(memory.first_seen)} · Last updated {formatDate(memory.last_updated)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {memory.latest_lead_id && (
                <button onClick={() => navigate(`/dashboard/lead/${memory.latest_lead_id}`)}
                  className="ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold">
                  Lead detail
                </button>
              )}
              <button onClick={handleRefreshIntelligence} disabled={generating}
                className="premium-btn px-3 py-1.5 rounded-lg text-[12px] inline-flex items-center gap-1.5 disabled:opacity-60">
                <span className={`material-symbols-outlined text-[16px] ${generating ? 'animate-spin' : ''}`}>
                  {generating ? 'progress_activity' : 'refresh'}
                </span>
                {generating ? 'Generating…' : 'Refresh intelligence'}
              </button>
            </div>
          </div>

          {/* Outcome + deal value + stage */}
          <div className="mt-4 pt-3.5 grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4"
            style={{ borderTop: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="label-xs mb-1.5">Outcome</p>
              <OutcomeSelector
                memory={memory}
                dealValue={memory.deal_value}
                onSaved={async () => {
                  const fresh = await fetchMemory(memory.id)
                  if (fresh) setMemory(fresh)
                  setEvents(await fetchTimeline(memory.id))
                  flash('Outcome recorded')
                }}
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <p className="label-xs mb-1.5">Deal value</p>
                <div className="flex items-center gap-1.5">
                  <input
                    value={dealValue}
                    onChange={e => setDealValue(e.target.value)}
                    onBlur={handleSaveDealValue}
                    inputMode="decimal"
                    placeholder="0"
                    className="premium-input px-3 py-1.5 rounded-lg text-[13px] mono-val"
                    style={{ width: 120 }}
                  />
                  <button onClick={handleSaveDealValue} disabled={savingValue}
                    className="ghost-btn px-2.5 py-1.5 rounded-lg text-[12px] font-semibold disabled:opacity-50">
                    Save
                  </button>
                </div>
              </div>

              <div>
                <p className="label-xs mb-1.5">Move to</p>
                <select
                  defaultValue=""
                  onChange={e => {
                    const v = e.target.value as PipelineStage
                    if (v) { void handleMoveStage(v); e.target.value = '' }
                  }}
                  className="premium-input px-3 py-1.5 rounded-lg text-[12.5px]"
                >
                  <option value="">Select stage…</option>
                  {PIPELINE_STAGES.map(s => (
                    <option key={s} value={s}>{STAGE_LABEL[s]}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {intelError && (
            <p className="text-[12px] mt-3" style={{ color: 'var(--critical)' }}>
              Some intelligence couldn’t be generated: {intelError}. Everything already cached is
              still shown: try “Refresh intelligence” again in a moment.
            </p>
          )}
        </motion.header>

        {/* ── STICKY JUMP NAV ── */}
        <nav className="sticky top-0 z-30 -mx-4 md:-mx-8 px-4 md:px-8 py-2 mb-4 backdrop-blur"
          style={{ background: 'color-mix(in srgb, var(--bg-base) 88%, transparent)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
            {SECTIONS.map(s => (
              <button
                key={s.id}
                onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                className="px-2.5 py-1 rounded-full text-[12px] font-semibold whitespace-nowrap transition-colors"
                style={activeSection === s.id
                  ? { background: 'var(--accent)', color: 'var(--bg-elevated)' }
                  : { background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                {s.label}
              </button>
            ))}
          </div>
        </nav>

        {/* ── SECTIONS ── */}
        <div className="space-y-4 pb-16">
          <TrustHistory events={events} onAddNote={handleAddNote} />

          <OpportunityStepper timeline={intel?.opportunity_timeline ?? memory.opportunity_timeline} />

          <DealStrategyPanel
            strategy={intel?.deal_strategy ?? memory.deal_strategy}
            generating={generating}
            onGenerate={handleRefreshIntelligence}
            onUseInOutreach={handleUseInOutreach}
          />

          <RelationshipTree
            map={intel?.relationship_map ?? memory.relationship_map}
            generating={generating}
            hasContacts={contacts.length > 0}
            onGenerate={handleRefreshIntelligence}
          />

          <VerificationMatrixPanel matrix={intel?.verification_matrix ?? memory.verification_matrix} />

          <ScoreExplainability snapshot={memory.company_snapshot as Record<string, unknown> | null} />

          <InteractionLog interactions={interactions} onLog={handleLogInteraction} />

          <TeamPanel
            memoryId={memory.id}
            notes={memory.internal_notes}
            onSaveNotes={handleSaveNotes}
          />
        </div>

        {toast && (
          <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl z-50 premium-glass"
            style={{ color: 'var(--text-primary)' }}>
            <p className="text-[13px] font-semibold">{toast}</p>
          </div>
        )}
      </main>
    </div>
  )
}
