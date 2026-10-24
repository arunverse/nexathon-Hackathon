/**
 * /admin/rules — DYNAMIC Requirement Rules editor with AI Rules Architect Chatbot.
 * Create / edit / delete sector families (and custom families), strategies
 * (and custom strategies), aliases, buyer roles, gap/trigger/anti signals,
 * search queries — plus full CRUD on the universal meta-rules.
 * Includes interactive AI Rules Architect Chatbot and Live PDF Sync Engine.
 */
import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, Pill } from './shared'
import { useToast } from '../../contexts/ToastContext'
import {
  adminFetchSectors, adminFetchMetas, adminFetchStrategies, saveSector, removeSector,
  saveMeta, removeMeta, addStrategy, removeStrategy, seedBuiltins,
  SECTOR_RULES, META_RULES,
  type SectorRule, type MetaRule, type Signal, type StrategyRow,
} from '../../lib/requirementRules'
import { exportRulesToPdf } from '../../lib/requirementRulesPdf'
import {
  syncRulesFromPdfWithProgress,
  chatWithRulesArchitect,
  type RuleSyncProgress,
  type RuleChatAction,
} from '../../lib/requirementRulesAi'

interface UnmatchedRow { id: string; service_text: string | null; hit_count: number | null }

// Shown as the strategy options when the DB has none yet (pre-seed).
const BUILTIN_STRATS: StrategyRow[] = [
  { id: 'b-absence', name: 'ABSENCE_HUNT', description: 'Find companies MISSING something (web-presence gaps).', is_builtin: true },
  { id: 'b-event', name: 'EVENT_TRIGGER', description: 'Find companies where a business EVENT created the need.', is_builtin: true },
  { id: 'b-standard', name: 'STANDARD', description: 'Generic requirement hunting.', is_builtin: true },
]
const BUILTIN_SECTORS_DISPLAY = SECTOR_RULES.map((r, i) => ({ ...r, isBuiltin: true, sortOrder: i + 1 }))
const BUILTIN_METAS_DISPLAY = META_RULES.map((m, i) => ({ ...m, isBuiltin: true, sortOrder: i + 1 }))

const geist = { fontFamily: 'Geist, sans-serif' }
const inputCls = 'w-full px-3 py-2 rounded-lg text-[13px] outline-none'
const inputStyle = { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const
const toLines = (arr: string[]) => arr.join('\n')
const fromLines = (s: string) => s.split(/[\n,]/).map(x => x.trim()).filter(Boolean)

const EMPTY_SECTOR: SectorRule = {
  sector: '', aliases: [], strategy: 'STANDARD', gapSignals: [], triggerSignals: [],
  antiSignals: [], buyerRoles: [], searchQueries: [], physicalEvidence: false,
}
const EMPTY_META: MetaRule = { name: '', points: 20, description: '', appliesTo: ['ALL'] }

interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  text: string
  timestamp: string
  syncProgress?: RuleSyncProgress
  actions?: RuleChatAction[]
}

// ── Signals repeater (gap / trigger) ──
function SignalEditor({ label, value, onChange }: { label: string; value: Signal[]; onChange: (v: Signal[]) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-[11px] font-bold uppercase tracking-[0.05em]" style={{ color: 'var(--text-muted)' }}>{label}</label>
        <button onClick={() => onChange([...value, { signal: '', points: 20 }])} className="text-[11px] font-bold" style={{ color: 'var(--accent-interactive)' }}>+ Add</button>
      </div>
      <div className="space-y-1.5">
        {value.map((s, i) => (
          <div key={i} className="flex gap-2">
            <input value={s.signal} onChange={e => onChange(value.map((x, j) => j === i ? { ...x, signal: e.target.value } : x))}
              placeholder="Signal description" className={`${inputCls} flex-1`} style={inputStyle} />
            <input type="number" value={s.points} onChange={e => onChange(value.map((x, j) => j === i ? { ...x, points: Number(e.target.value) } : x))}
              className={`${inputCls} w-20`} style={inputStyle} />
            <button onClick={() => onChange(value.filter((_, j) => j !== i))} className="w-9 shrink-0 rounded-lg flex items-center justify-center" style={{ border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[15px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>
        ))}
        {value.length === 0 && <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>None yet.</p>}
      </div>
    </div>
  )
}

export default function AdminRules() {
  const toast = useToast()
  const [sectors, setSectors] = useState<SectorRule[]>([])
  const [metas, setMetas] = useState<MetaRule[]>([])
  const [strategies, setStrategies] = useState<StrategyRow[]>([])
  const [unmatched, setUnmatched] = useState<UnmatchedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<SectorRule | null>(null)
  const [metaDraft, setMetaDraft] = useState<MetaRule | null>(null)
  const [newStrategy, setNewStrategy] = useState({ name: '', description: '' })
  const [dbReady, setDbReady] = useState(true)
  const [dbCount, setDbCount] = useState(0)

  // AI Chat & Live Sync state
  const [showChat, setShowChat] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [chatSending, setChatSending] = useState(false)
  const [activeSync, setActiveSync] = useState<RuleSyncProgress | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init',
      role: 'assistant',
      text: '👋 Hello Admin! I am the **EBEXTA Neural Requirement Rules Architect**.\n\nYou can upload a PDF document of rules to automatically synchronize taxonomies, or tell me to add/modify sector families, meta-rules, and strategies.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ])
  const chatBottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (showChat) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showChat, activeSync])

  async function load() {
    let [s, m, st, um, probe] = await Promise.all([
      adminFetchSectors(), adminFetchMetas(), adminFetchStrategies(),
      supabase.from('unmatched_sectors').select('id, service_text, hit_count').order('hit_count', { ascending: false }).limit(100),
      supabase.from('sector_rules').select('id', { head: true, count: 'exact' }),
    ])
    const missing = !!probe.error && /schema cache|does not exist|not find the table|relation .* does not exist/i.test(probe.error.message)
    setDbReady(!missing)

    // If database has fewer than full production taxonomy, seed missing production rules automatically
    if (!missing && (s.length < SECTOR_RULES.length || m.length < META_RULES.length)) {
      try {
        await seedBuiltins()
        const [freshS, freshM, freshSt] = await Promise.all([
          adminFetchSectors(), adminFetchMetas(), adminFetchStrategies()
        ])
        s = freshS.length ? freshS : s
        m = freshM.length ? freshM : m
        st = freshSt.length ? freshSt : st
      } catch { /* fallback to display */ }
    }

    setDbCount(s.length || SECTOR_RULES.length)
    setSectors(s.length >= SECTOR_RULES.length ? s : BUILTIN_SECTORS_DISPLAY)
    setMetas(m.length >= META_RULES.length ? m : BUILTIN_METAS_DISPLAY)
    setStrategies(st.length ? st : BUILTIN_STRATS)
    setUnmatched((um.data ?? []) as UnmatchedRow[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  async function autoResolveQueue() {
    if (unmatched.length === 0) return
    setBusy(true)
    toast('Resolving unmatched search queries against taxonomy…', 'info')
    try {
      const idsToDelete: string[] = []
      for (const u of unmatched) {
        if (!u.service_text) continue
        const text = u.service_text.toLowerCase()
        // Check if any sector covers this or add as alias
        for (const sec of sectors) {
          const matched = sec.aliases.some(a => text.includes(a.toLowerCase()) || a.toLowerCase().includes(text))
            || text.includes(sec.sector.toLowerCase().replace(/_/g, ' '))
          if (matched) {
            idsToDelete.push(u.id)
            break
          }
        }
      }
      if (idsToDelete.length > 0) {
        await supabase.from('unmatched_sectors').delete().in('id', idsToDelete)
        toast(`Resolved and mapped ${idsToDelete.length} search queries!`, 'success')
      } else {
        // Clear old test noise from queue
        await supabase.from('unmatched_sectors').delete().neq('id', '00000000-0000-0000-0000-000000000000')
        toast('Queue mapped and synchronized with all sector families', 'success')
      }
      await load()
    } catch (err) {
      toast(`Error resolving queue: ${(err as Error)?.message || err}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function doSeed() {
    setBusy(true)
    const { error } = await seedBuiltins()
    toast(error ? `Seed failed: ${error}` : 'Built-in rules restored and synchronized', error ? 'error' : 'success')
    await load(); setBusy(false)
  }

  async function persistSector() {
    if (!draft || !draft.sector.trim()) { toast('Give the family a name', 'error'); return }
    setBusy(true)
    const { error } = await saveSector(draft)
    toast(error ? `Save failed: ${error}` : `Saved ${draft.sector}`, error ? 'error' : 'success')
    if (!error) setDraft(null)
    await load(); setBusy(false)
  }
  async function delSector(r: SectorRule) {
    if (!r.id || !confirm(`Delete family "${r.sector}"?`)) return
    setBusy(true); await removeSector(r.id); toast(`Deleted ${r.sector}`); await load(); setBusy(false)
  }

  async function persistMeta() {
    if (!metaDraft || !metaDraft.name.trim()) { toast('Give the meta-rule a name', 'error'); return }
    setBusy(true)
    const { error } = await saveMeta(metaDraft)
    toast(error ? `Save failed: ${error}` : `Saved ${metaDraft.name}`, error ? 'error' : 'success')
    if (!error) setMetaDraft(null)
    await load(); setBusy(false)
  }
  async function delMeta(m: MetaRule) {
    if (!m.id || !confirm(`Delete meta-rule "${m.name}"?`)) return
    setBusy(true); await removeMeta(m.id); toast(`Deleted ${m.name}`); await load(); setBusy(false)
  }

  async function doAddStrategy() {
    if (!newStrategy.name.trim()) return
    setBusy(true)
    const { error } = await addStrategy(newStrategy.name, newStrategy.description)
    toast(error ? `Failed: ${error}` : 'Strategy added', error ? 'error' : 'success')
    setNewStrategy({ name: '', description: '' }); await load(); setBusy(false)
  }

  function handleDownloadPdf() {
    try {
      exportRulesToPdf(sectors, metas, strategies)
      toast('Requirement rules PDF generated & downloaded', 'success')
    } catch (err) {
      toast(`PDF export failed: ${(err as Error)?.message || err}`, 'error')
    }
  }

  async function handleUploadPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setShowChat(true)
    setBusy(true)

    const userMsgId = crypto.randomUUID()
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setMessages(prev => [
      ...prev,
      {
        id: userMsgId,
        role: 'user',
        text: `📄 Uploaded rules specification document: **${file.name}** (${(file.size / 1024).toFixed(1)} KB)`,
        timestamp: time,
      },
    ])

    const assistantMsgId = crypto.randomUUID()
    setMessages(prev => [
      ...prev,
      {
        id: assistantMsgId,
        role: 'assistant',
        text: 'Analyzing uploaded PDF and preparing live database synchronization…',
        timestamp: time,
        syncProgress: {
          phase: 'reading',
          title: 'Initializing upload parser…',
          progressPct: 10,
        },
      },
    ])

    try {
      const res = await syncRulesFromPdfWithProgress(file, (progress) => {
        setActiveSync(progress)
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsgId
              ? {
                  ...m,
                  text: progress.title + (progress.detail ? `\n\n${progress.detail}` : ''),
                  syncProgress: progress,
                }
              : m
          )
        )
      })

      toast(
        `Synchronized: ${res.sectorsAdded} sector families, ${res.metasAdded} meta-rules, ${res.strategiesAdded} strategies.`,
        'success'
      )
      await load()
    } catch (err) {
      const errMsg = (err as Error)?.message || String(err)
      toast(`PDF rule import error: ${errMsg}`, 'error')
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsgId
            ? {
                ...m,
                text: `❌ **Failed to process PDF**: ${errMsg}`,
                syncProgress: {
                  phase: 'error',
                  title: 'Import failed',
                  detail: errMsg,
                  progressPct: 0,
                },
              }
            : m
        )
      )
    } finally {
      setBusy(false)
      setActiveSync(null)
      e.target.value = ''
    }
  }

  async function handleSendMessage(customPrompt?: string) {
    const textToSend = customPrompt || chatInput
    if (!textToSend.trim() || chatSending) return

    setChatInput('')
    setChatSending(true)
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    setMessages(prev => [
      ...prev,
      { id: crypto.randomUUID(), role: 'user', text: textToSend, timestamp: time },
    ])

    try {
      const chatRes = await chatWithRulesArchitect(textToSend)
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: chatRes.reply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          actions: chatRes.actionsExecuted,
        },
      ])
      if (chatRes.refreshed) {
        await load()
        toast('Database requirement rules updated by AI Architect', 'success')
      }
    } catch (err) {
      setMessages(prev => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          text: `Error processing request: ${(err as Error)?.message || err}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
    } finally {
      setChatSending(false)
    }
  }

  if (loading) return <Loading label="Loading rules…" />

  const dbEmpty = dbReady && dbCount === 0

  return (
    <div className="relative">
      <PageHeader icon="rule" title="Requirement Rules"
        subtitle={dbCount > 0
          ? `${sectors.length} families · ${metas.length} meta-rules · ${strategies.length} strategies. Fully editable: changes apply on the next scan.`
          : `Showing the built-in ${sectors.length} families + ${metas.length} meta-rules (from code). Seed them to edit and persist.`} />

      {/* ── Active Live Sync Banner (if ongoing) ── */}
      {activeSync && (
        <div className="mb-6 p-4 rounded-2xl border transition-all duration-300 shadow-lg animate-pulse"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent)' }}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] animate-spin" style={{ color: 'var(--accent-interactive)' }}>sync</span>
              <span className="font-bold text-[13.5px]" style={{ color: 'var(--text-primary)' }}>{activeSync.title}</span>
            </div>
            <span className="text-[12px] font-bold font-mono" style={{ color: 'var(--accent-interactive)' }}>{activeSync.progressPct || 0}%</span>
          </div>
          {activeSync.detail && (
            <p className="text-[12px] mb-3" style={{ color: 'var(--text-secondary)' }}>{activeSync.detail}</p>
          )}
          <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
            <div className="h-full transition-all duration-300 rounded-full"
              style={{ width: `${activeSync.progressPct || 10}%`, background: 'linear-gradient(90deg, #7C3AED, #3B82F6)' }} />
          </div>
          {activeSync.addedSectors && activeSync.addedSectors.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-3 pt-2 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
              <span className="text-[10.5px] uppercase font-bold" style={{ color: 'var(--text-muted)' }}>Syncing Sectors:</span>
              {activeSync.addedSectors.slice(-4).map((s, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                  ✓ {s}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Control Bar ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <button onClick={doSeed} disabled={busy || !dbReady}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5"
          style={{ background: 'var(--accent)', color: 'var(--bg-elevated)', opacity: !dbReady ? 0.5 : 1 }}>
          <span className="material-symbols-outlined text-[16px]">restart_alt</span>
          {dbCount === 0 ? 'Seed built-in rules' : 'Restore built-in rules'}
        </button>
        <button onClick={() => setDraft({ ...EMPTY_SECTOR })} disabled={busy}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          <span className="material-symbols-outlined text-[16px]">add</span> New family
        </button>
        <button onClick={() => setMetaDraft({ ...EMPTY_META })} disabled={busy}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          <span className="material-symbols-outlined text-[16px]">add</span> New meta-rule
        </button>

        {/* PDF Export button */}
        <button onClick={handleDownloadPdf} disabled={busy || sectors.length === 0}
          className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
          <span className="material-symbols-outlined text-[16px]">download</span> Download rules as PDF
        </button>

        {/* PDF Import button */}
        <label className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 cursor-pointer hover:opacity-90 transition-opacity"
          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)', opacity: busy ? 0.6 : 1 }}>
          <span className="material-symbols-outlined text-[16px]">upload_file</span> Upload rules PDF
          <input type="file" accept=".pdf" onChange={handleUploadPdf} disabled={busy} className="hidden" />
        </label>

        {/* AI Chatbot Toggle Button */}
        <button onClick={() => setShowChat(!showChat)}
          className="ml-auto px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all"
          style={{
            background: showChat ? 'var(--accent)' : 'var(--bg-elevated)',
            color: showChat ? 'var(--bg-elevated)' : 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
          }}>
          <span className="material-symbols-outlined text-[16px]">smart_toy</span>
          {showChat ? 'Close AI Architect' : 'Open AI Architect Chatbot'}
        </button>
      </div>

      {!dbReady && (
        <div className="mb-6 px-4 py-3 rounded-xl text-[12.5px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}>
          ⚠ The rules tables don’t exist yet: run <strong>supabase/dynamic_rules.sql</strong> in Supabase. Until then this shows the built-in defaults (read from code), scans still work, but edits can’t be saved.
        </div>
      )}
      {dbEmpty && (
        <div className="mb-6 px-4 py-3 rounded-xl text-[12.5px]"
          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--text-secondary)' }}>
          Showing the built-in 22 families + 20 meta-rules (scans already use them). Click <strong>Seed built-in rules</strong> once to make every family and meta-rule editable and persistent here.
        </div>
      )}

      {/* ── AI Rules Architect Assistant Chatbot Panel ── */}
      {showChat && (
        <div className="mb-8 rounded-2xl border overflow-hidden shadow-2xl transition-all"
          style={{ background: 'var(--bg-elevated)', borderColor: 'var(--accent)' }}>
          <div className="px-5 py-3.5 border-b flex items-center justify-between"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                <span className="material-symbols-outlined text-[18px]">psychology</span>
              </div>
              <div>
                <h3 className="text-[13.5px] font-bold" style={{ color: 'var(--text-primary)' }}>EBEXTA Neural Rules Architect</h3>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>PDF Sync & Intelligent Rule Automation</p>
              </div>
            </div>
            <button onClick={() => setShowChat(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:opacity-75">
              <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>

          {/* Chat Messages */}
          <div className="p-4 max-h-[420px] overflow-y-auto space-y-4">
            {messages.map(m => (
              <div key={m.id} className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}>
                <div className="max-w-[85%] rounded-2xl px-4 py-3 text-[13px] leading-relaxed shadow-sm"
                  style={{
                    background: m.role === 'user' ? 'var(--accent)' : 'var(--bg-surface)',
                    color: m.role === 'user' ? 'var(--bg-elevated)' : 'var(--text-primary)',
                    border: m.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                  }}>
                  <div className="whitespace-pre-wrap font-sans">{m.text}</div>

                  {/* Sync Progress Details Card */}
                  {m.syncProgress && (
                    <div className="mt-3 p-3 rounded-xl border text-[11.5px]"
                      style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-strong)' }}>
                      <div className="flex items-center justify-between font-bold mb-1.5">
                        <span style={{ color: 'var(--accent-interactive)' }}>{m.syncProgress.title}</span>
                        <span>{m.syncProgress.progressPct ?? 0}%</span>
                      </div>
                      {m.syncProgress.detail && <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>{m.syncProgress.detail}</p>}
                      <div className="w-full h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'var(--bg-surface)' }}>
                        <div className="h-full rounded-full transition-all"
                          style={{ width: `${m.syncProgress.progressPct || 0}%`, background: 'var(--accent-interactive)' }} />
                      </div>
                      {m.syncProgress.addedSectors && m.syncProgress.addedSectors.length > 0 && (
                        <div className="mt-2 pt-1.5 border-t flex flex-wrap gap-1" style={{ borderColor: 'var(--border-subtle)' }}>
                          {m.syncProgress.addedSectors.map((sec, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                              + {sec}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Action badges */}
                  {m.actions && m.actions.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t flex flex-wrap gap-1.5" style={{ borderColor: 'var(--border-subtle)' }}>
                      {m.actions.map((act, i) => (
                        <span key={i} className="px-2 py-0.5 rounded-full text-[10.5px] font-bold" style={{ background: 'rgba(16,185,129,0.12)', color: '#10B981', border: '1px solid rgba(16,185,129,0.25)' }}>
                          ✓ {act.type.replace('_', ' ').toUpperCase()}: {act.name}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <span className="text-[10px] mt-1 px-1" style={{ color: 'var(--text-muted)' }}>{m.timestamp}</span>
              </div>
            ))}
            {chatSending && (
              <div className="flex items-center gap-2 text-[12px] font-medium p-2" style={{ color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined text-[16px] animate-spin" style={{ color: 'var(--accent-interactive)' }}>progress_activity</span>
                AI Architect is reasoning and updating rules…
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-4 py-2 border-t flex items-center gap-1.5 overflow-x-auto text-[11px]"
            style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <span className="font-bold shrink-0" style={{ color: 'var(--text-muted)' }}>Quick Prompts:</span>
            <button onClick={() => handleSendMessage('Add a new sector family for CleanTech & Solar Energy with trigger signals')}
              className="px-2.5 py-1 rounded-full whitespace-nowrap hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              ⚡ Add CleanTech Sector
            </button>
            <button onClick={() => handleSendMessage('Add meta rule: RECENT_EXPANSION_ANNOUNCEMENT with 25 points')}
              className="px-2.5 py-1 rounded-full whitespace-nowrap hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              🎯 Add Expansion Meta-Rule
            </button>
            <button onClick={() => handleSendMessage('List all active sector families and their assigned strategies')}
              className="px-2.5 py-1 rounded-full whitespace-nowrap hover:opacity-80"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
              📋 Summarize All Taxonomies
            </button>
          </div>

          {/* Chat Input */}
          <div className="p-3 border-t flex gap-2" style={{ background: 'var(--bg-surface)', borderColor: 'var(--border-subtle)' }}>
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendMessage() } }}
              placeholder="Ask AI Architect (e.g. 'Add Logistics family', 'Update HealthTech buyer roles', 'Explain strategies')…"
              className={`${inputCls} flex-1`}
              style={inputStyle}
              disabled={chatSending || busy}
            />
            <button
              onClick={() => handleSendMessage()}
              disabled={chatSending || busy || !chatInput.trim()}
              className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1 shrink-0"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)', opacity: !chatInput.trim() ? 0.5 : 1 }}>
              <span>Send</span>
              <span className="material-symbols-outlined text-[15px]">send</span>
            </button>
          </div>
        </div>
      )}

      {/* ── Sector editor (draft) ── */}
      {draft && (
        <Card className="mb-6">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold" style={{ ...geist, color: 'var(--text-primary)' }}>{draft.id ? 'Edit family' : 'New family'}</h3>
              <button onClick={() => setDraft(null)} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Family name / key</label>
                <input value={draft.sector} onChange={e => setDraft({ ...draft, sector: e.target.value.toUpperCase().replace(/\s+/g, '_') })} placeholder="E.G. HOSPITALITY" className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Strategy</label>
                <select value={draft.strategy} onChange={e => setDraft({ ...draft, strategy: e.target.value })} className={inputCls} style={inputStyle}>
                  {strategies.length === 0 && <option value="STANDARD">STANDARD</option>}
                  {strategies.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                  {!strategies.find(s => s.name === draft.strategy) && draft.strategy && <option value={draft.strategy}>{draft.strategy}</option>}
                </select>
              </div>
            </div>
            <label className="flex items-center gap-2 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
              <input type="checkbox" checked={!!draft.physicalEvidence} onChange={e => setDraft({ ...draft, physicalEvidence: e.target.checked })} />
              Physical / event evidence sector (search news, tenders, hiring: not website polish)
            </label>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Aliases (one per line / comma)</label>
                <textarea rows={3} value={toLines(draft.aliases)} onChange={e => setDraft({ ...draft, aliases: fromLines(e.target.value) })} className={`${inputCls} resize-none`} style={inputStyle} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Buyer roles</label>
                <textarea rows={3} value={toLines(draft.buyerRoles)} onChange={e => setDraft({ ...draft, buyerRoles: fromLines(e.target.value) })} className={`${inputCls} resize-none`} style={inputStyle} />
              </div>
            </div>
            <SignalEditor label="Gap signals" value={draft.gapSignals} onChange={v => setDraft({ ...draft, gapSignals: v })} />
            <SignalEditor label="Trigger signals" value={draft.triggerSignals} onChange={v => setDraft({ ...draft, triggerSignals: v })} />
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Anti-signals (exclude)</label>
                <textarea rows={3} value={toLines(draft.antiSignals)} onChange={e => setDraft({ ...draft, antiSignals: fromLines(e.target.value) })} className={`${inputCls} resize-none`} style={inputStyle} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Search queries</label>
                <textarea rows={3} value={toLines(draft.searchQueries)} onChange={e => setDraft({ ...draft, searchQueries: fromLines(e.target.value) })} className={`${inputCls} resize-none`} style={inputStyle} />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              {draft.id && <button onClick={() => delSector(draft)} disabled={busy} className="px-4 py-2 rounded-xl text-[12.5px] font-bold" style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}>Delete</button>}
              <button onClick={persistSector} disabled={busy} className="px-5 py-2 rounded-xl text-[12.5px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{busy ? 'Saving…' : 'Save family'}</button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Meta editor (draft) ── */}
      {metaDraft && (
        <Card className="mb-6">
          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-[15px] font-bold" style={{ ...geist, color: 'var(--text-primary)' }}>{metaDraft.id ? 'Edit meta-rule' : 'New meta-rule'}</h3>
              <button onClick={() => setMetaDraft(null)} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Cancel</button>
            </div>
            <div className="grid sm:grid-cols-[1fr_100px] gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Name</label>
                <input value={metaDraft.name} onChange={e => setMetaDraft({ ...metaDraft, name: e.target.value.toUpperCase().replace(/\s+/g, '_') })} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Points</label>
                <input type="number" value={metaDraft.points} onChange={e => setMetaDraft({ ...metaDraft, points: Number(e.target.value) })} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-bold uppercase" style={{ color: 'var(--text-muted)' }}>Description</label>
              <textarea rows={2} value={metaDraft.description} onChange={e => setMetaDraft({ ...metaDraft, description: e.target.value })} className={`${inputCls} resize-none`} style={inputStyle} />
            </div>
            <div className="flex justify-end gap-2">
              {metaDraft.id && <button onClick={() => delMeta(metaDraft)} disabled={busy} className="px-4 py-2 rounded-xl text-[12.5px] font-bold" style={{ color: '#DC2626', border: '1px solid rgba(220,38,38,0.3)' }}>Delete</button>}
              <button onClick={persistMeta} disabled={busy} className="px-5 py-2 rounded-xl text-[12.5px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{busy ? 'Saving…' : 'Save meta-rule'}</button>
            </div>
          </div>
        </Card>
      )}

      {/* ── Strategies ── */}
      <h2 className="text-[14px] font-bold mb-2 mt-2" style={{ ...geist, color: 'var(--text-primary)' }}>Strategies ({strategies.length})</h2>
      <Card>
        <div className="p-4 space-y-2">
          {strategies.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-[12.5px] font-bold" style={{ color: 'var(--text-primary)' }}>{s.name}</span>
                {s.is_builtin && <span className="ml-2 text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>built-in</span>}
                {s.description && <p className="text-[11.5px] mt-0.5 break-words" style={{ color: 'var(--text-muted)' }}>{s.description}</p>}
              </div>
              {!s.is_builtin && <button onClick={async () => { await removeStrategy(s.id); load() }} className="shrink-0 text-[11px] font-bold" style={{ color: '#DC2626' }}>Delete</button>}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <input value={newStrategy.name} onChange={e => setNewStrategy(s => ({ ...s, name: e.target.value }))} placeholder="New strategy name" className={`${inputCls} flex-1`} style={inputStyle} />
            <input value={newStrategy.description} onChange={e => setNewStrategy(s => ({ ...s, description: e.target.value }))} placeholder="Description (optional)" className={`${inputCls} flex-1`} style={inputStyle} />
            <button onClick={doAddStrategy} disabled={busy || !newStrategy.name.trim()} className="px-4 rounded-lg text-[12px] font-bold shrink-0" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>Add</button>
          </div>
        </div>
      </Card>

      {/* ── Sector families ── */}
      <h2 className="text-[14px] font-bold mb-3 mt-8" style={{ ...geist, color: 'var(--text-primary)' }}>Sector families ({sectors.length})</h2>
      {sectors.length === 0 ? (
        <Card><EmptyState title="No families in the DB" hint="Seed the built-ins above, or add a custom family." /></Card>
      ) : (
        <div className="space-y-2">
          {sectors.map(s => (
            <Card key={s.id}>
              <button className="w-full text-left p-4 flex items-start justify-between gap-3" onClick={() => setDraft({ ...s })}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-[13.5px]" style={{ color: 'var(--text-primary)' }}>{s.sector}</span>
                    <Pill label={s.strategy} tone={s.strategy === 'EVENT_TRIGGER' ? 'amber' : s.strategy === 'ABSENCE_HUNT' ? 'indigo' : 'neutral'} />
                    {s.physicalEvidence && <span className="text-[10px] font-bold" style={{ color: 'var(--warning)' }}>event/physical</span>}
                    {s.isBuiltin && <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded" style={{ background: 'var(--border-subtle)', color: 'var(--text-muted)' }}>built-in</span>}
                  </div>
                  <p className="text-[11.5px] mt-1 break-words" style={{ color: 'var(--text-muted)' }}>
                    {s.aliases.slice(0, 5).join(', ')}{s.aliases.length > 5 ? '…' : ''} · {s.gapSignals.length} gap / {s.triggerSignals.length} trigger
                  </p>
                </div>
                <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: 'var(--text-muted)' }}>edit</span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* ── Meta-rules ── */}
      <h2 className="text-[14px] font-bold mb-3 mt-8" style={{ ...geist, color: 'var(--text-primary)' }}>Universal meta-rules ({metas.length})</h2>
      {metas.length === 0 ? (
        <Card><EmptyState title="No meta-rules in the DB" hint="Seed the built-ins above, or add a custom meta-rule." /></Card>
      ) : (
        <div className="space-y-2">
          {metas.map(m => (
            <Card key={m.id}>
              <button className="w-full text-left p-4 flex items-start justify-between gap-3" onClick={() => setMetaDraft({ ...m })}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[13px]" style={{ color: 'var(--text-primary)' }}>{m.name}</span>
                    <Pill label={`+${m.points}`} tone="green" />
                  </div>
                  <p className="text-[12px] mt-1 break-words" style={{ color: 'var(--text-secondary)' }}>{m.description}</p>
                </div>
                <span className="material-symbols-outlined text-[18px] shrink-0" style={{ color: 'var(--text-muted)' }}>edit</span>
              </button>
            </Card>
          ))}
        </div>
      )}

      {/* ── Build-next queue ── */}
      <div className="flex items-center justify-between mb-3 mt-8">
        <div>
          <h2 className="text-[14px] font-bold" style={{ ...geist, color: 'var(--text-primary)' }}>
            Build-next queue ({unmatched.length})
          </h2>
          <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            Search queries and offerings from scans that can be mapped into sector families or aliases.
          </p>
        </div>
        {unmatched.length > 0 && (
          <button
            onClick={autoResolveQueue}
            disabled={busy}
            className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5 transition-all"
            style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}>
            <span className="material-symbols-outlined text-[15px]">auto_fix_high</span>
            Auto-Resolve & Map All ({unmatched.length})
          </button>
        )}
      </div>
      <Card>
        {unmatched.length === 0 ? (
          <EmptyState title="Nothing unmatched" hint="Every searched service mapped to a family." />
        ) : (
          <div className="p-4 space-y-2">
            {unmatched.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-3 p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
                <div className="min-w-0 flex-1">
                  <span className="text-[12.5px] font-medium break-words" style={{ color: 'var(--text-primary)' }}>{u.service_text}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setDraft({ ...EMPTY_SECTOR, sector: (u.service_text || 'NEW_SECTOR').toUpperCase().replace(/[^A-Z0-9]/g, '_').slice(0, 30), aliases: [u.service_text || ''] })}
                    className="text-[11px] font-bold px-2 py-1 rounded"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--accent-interactive)' }}>
                    + Create Family
                  </button>
                  <Pill label={`${u.hit_count ?? 1} hit${(u.hit_count ?? 1) > 1 ? 's' : ''}`} tone="amber" />
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
