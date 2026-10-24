import {
  type SectorRule,
  type MetaRule,
  saveSector,
  saveMeta,
  addStrategy,
  adminFetchSectors,
  adminFetchMetas,
  adminFetchStrategies,
} from './requirementRules'
import { callGeminiProxy } from './geminiProxy'
import { extractDocText } from './productAnalysis'
import { safeParseJSON } from './safeJson'

export interface RuleSyncProgress {
  phase: 'reading' | 'extracting' | 'analyzing' | 'applying' | 'completed' | 'error'
  title: string
  detail?: string
  progressPct?: number
  addedSectors?: string[]
  addedMetas?: string[]
  addedStrategies?: string[]
}

export interface RuleChatAction {
  type: 'sector_saved' | 'meta_saved' | 'strategy_saved' | 'sector_deleted' | 'meta_deleted' | 'strategy_deleted'
  name: string
  details?: string
}

export interface RuleChatResponse {
  reply: string
  actionsExecuted: RuleChatAction[]
  refreshed?: boolean
}

/**
 * Upload, parse, and synchronize requirement rules from a PDF with granular real-time progress callbacks.
 */
export async function syncRulesFromPdfWithProgress(
  file: File,
  onProgress: (p: RuleSyncProgress) => void
): Promise<{
  sectorsAdded: number
  metasAdded: number
  strategiesAdded: number
  sectorNames: string[]
  metaNames: string[]
  strategyNames: string[]
  errors: string[]
}> {
  const result = {
    sectorsAdded: 0,
    metasAdded: 0,
    strategiesAdded: 0,
    sectorNames: [] as string[],
    metaNames: [] as string[],
    strategyNames: [] as string[],
    errors: [] as string[],
  }

  // 1. Reading
  onProgress({
    phase: 'reading',
    title: 'Reading uploaded document…',
    detail: `${file.name} (${(file.size / 1024).toFixed(1)} KB)`,
    progressPct: 15,
  })

  // 2. Extracting text
  const rawText = await extractDocText(file, 30000)
  if (!rawText.trim()) {
    const err = 'Could not extract readable text from PDF. The document might be image-based or scanned.'
    onProgress({ phase: 'error', title: 'Extraction failed', detail: err, progressPct: 0 })
    throw new Error(err)
  }

  onProgress({
    phase: 'extracting',
    title: 'Text extracted successfully',
    detail: `Extracted ${rawText.length.toLocaleString()} characters of requirement specifications.`,
    progressPct: 35,
  })

  // 3. AI Analysis
  onProgress({
    phase: 'analyzing',
    title: 'Neural AI Decomposing Rules & Taxonomies…',
    detail: 'Extracting sector families, aliases, target buyer roles, gap/trigger/anti signals, meta-rules, and strategies.',
    progressPct: 60,
  })

  const prompt = `You are EBEXTA Brain's Neural Requirement Architect.
Extract ALL requirement hunting rules, sector families, strategies, signals, and meta-rules from the text below into a clean structured JSON format.

DOCUMENT CONTENT:
"""
${rawText.slice(0, 20000)}
"""

Return ONLY a single valid JSON object:
{
  "strategies": [
    { "name": "STRATEGY_NAME", "description": "Strategy details" }
  ],
  "metaRules": [
    { "name": "META_RULE_NAME", "points": 20, "description": "Signal description", "appliesTo": ["ALL"] }
  ],
  "sectors": [
    {
      "sector": "SECTOR_NAME",
      "aliases": ["keyword1", "keyword2"],
      "strategy": "STANDARD",
      "physicalEvidence": false,
      "buyerRoles": ["CEO", "CTO"],
      "gapSignals": [{ "signal": "Gap detail", "points": 20 }],
      "triggerSignals": [{ "signal": "Trigger detail", "points": 25 }],
      "antiSignals": ["Competitor type"],
      "searchQueries": ["search query example"]
    }
  ]
}`

  const proxyRes = await callGeminiProxy(prompt, {
    action: 'enrich',
    model: 'gemini-flash-latest',
    jsonMode: true,
  })

  const parsed = safeParseJSON<{
    strategies?: Array<{ name?: string; description?: string }>
    metaRules?: Array<{ name?: string; points?: number; description?: string; appliesTo?: string[] }>
    sectors?: Array<{
      sector?: string
      aliases?: string[]
      strategy?: string
      physicalEvidence?: boolean
      buyerRoles?: string[]
      gapSignals?: Array<{ signal: string; points: number }>
      triggerSignals?: Array<{ signal: string; points: number }>
      antiSignals?: string[]
      searchQueries?: string[]
    }>
  }>(proxyRes.text)

  if (!parsed || typeof parsed !== 'object') {
    const err = 'Neural parser could not interpret structured rules from document content.'
    onProgress({ phase: 'error', title: 'Parsing failed', detail: err, progressPct: 0 })
    throw new Error(err)
  }

  // 4. Applying to Database
  const totalItems = (parsed.strategies?.length || 0) + (parsed.metaRules?.length || 0) + (parsed.sectors?.length || 0)
  let processedItems = 0

  onProgress({
    phase: 'applying',
    title: 'Synchronizing into Database…',
    detail: `Applying ${totalItems} parsed items to sector_rules, meta_rules, and rule_strategies.`,
    progressPct: 75,
  })

  // Strategies
  if (Array.isArray(parsed.strategies)) {
    for (const st of parsed.strategies) {
      if (st?.name?.trim()) {
        const cleanName = st.name.trim().toUpperCase().replace(/\s+/g, '_')
        const { error } = await addStrategy(cleanName, st.description || '')
        if (!error) {
          result.strategiesAdded++
          result.strategyNames.push(cleanName)
        } else {
          result.errors.push(`Strategy "${cleanName}": ${error}`)
        }
        processedItems++
        onProgress({
          phase: 'applying',
          title: `Syncing Strategy: ${cleanName}`,
          detail: st.description || undefined,
          progressPct: Math.round(75 + (processedItems / Math.max(1, totalItems)) * 20),
          addedStrategies: [...result.strategyNames],
        })
      }
    }
  }

  // Meta-Rules
  if (Array.isArray(parsed.metaRules)) {
    for (const m of parsed.metaRules) {
      if (m?.name?.trim()) {
        const cleanName = m.name.trim().toUpperCase().replace(/\s+/g, '_')
        const metaRule: MetaRule = {
          name: cleanName,
          points: Number(m.points) || 20,
          description: String(m.description || ''),
          appliesTo: Array.isArray(m.appliesTo) && m.appliesTo.length > 0 ? m.appliesTo : ['ALL'],
        }
        const { error } = await saveMeta(metaRule)
        if (!error) {
          result.metasAdded++
          result.metaNames.push(cleanName)
        } else {
          result.errors.push(`Meta-rule "${cleanName}": ${error}`)
        }
        processedItems++
        onProgress({
          phase: 'applying',
          title: `Syncing Meta-Rule: ${cleanName}`,
          detail: `+${metaRule.points} pts — ${metaRule.description}`,
          progressPct: Math.round(75 + (processedItems / Math.max(1, totalItems)) * 20),
          addedMetas: [...result.metaNames],
        })
      }
    }
  }

  // Sector Families
  if (Array.isArray(parsed.sectors)) {
    for (const s of parsed.sectors) {
      if (s?.sector?.trim()) {
        const cleanSector = s.sector.trim().toUpperCase().replace(/\s+/g, '_')
        const sectorRule: SectorRule = {
          sector: cleanSector,
          aliases: Array.isArray(s.aliases) ? s.aliases.map(a => String(a).trim()).filter(Boolean) : [],
          strategy: s.strategy ? s.strategy.trim().toUpperCase() : 'STANDARD',
          physicalEvidence: !!s.physicalEvidence,
          buyerRoles: Array.isArray(s.buyerRoles) ? s.buyerRoles.map(r => String(r).trim()).filter(Boolean) : [],
          gapSignals: Array.isArray(s.gapSignals) ? s.gapSignals.map(g => ({ signal: String(g.signal || '').trim(), points: Number(g.points) || 20 })).filter(g => g.signal) : [],
          triggerSignals: Array.isArray(s.triggerSignals) ? s.triggerSignals.map(t => ({ signal: String(t.signal || '').trim(), points: Number(t.points) || 25 })).filter(t => t.signal) : [],
          antiSignals: Array.isArray(s.antiSignals) ? s.antiSignals.map(a => String(a).trim()).filter(Boolean) : [],
          searchQueries: Array.isArray(s.searchQueries) ? s.searchQueries.map(q => String(q).trim()).filter(Boolean) : [],
        }
        const { error } = await saveSector(sectorRule)
        if (!error) {
          result.sectorsAdded++
          result.sectorNames.push(cleanSector)
        } else {
          result.errors.push(`Sector "${cleanSector}": ${error}`)
        }
        processedItems++
        onProgress({
          phase: 'applying',
          title: `Syncing Sector Family: ${cleanSector}`,
          detail: `Strategy: ${sectorRule.strategy} · ${sectorRule.gapSignals.length} gap / ${sectorRule.triggerSignals.length} trigger signals`,
          progressPct: Math.round(75 + (processedItems / Math.max(1, totalItems)) * 20),
          addedSectors: [...result.sectorNames],
          addedMetas: [...result.metaNames],
          addedStrategies: [...result.strategyNames],
        })
      }
    }
  }

  // 5. Completed
  onProgress({
    phase: 'completed',
    title: 'Neural Synchronization Complete! 🎉',
    detail: `Synchronized ${result.sectorsAdded} Sector Families, ${result.metasAdded} Meta-Rules, and ${result.strategiesAdded} Strategies. Changes are active for immediate scans.`,
    progressPct: 100,
    addedSectors: result.sectorNames,
    addedMetas: result.metaNames,
    addedStrategies: result.strategyNames,
  })

  return result
}

/**
 * Conversational AI Rule Architect Assistant.
 * Answers questions, explains strategies, or directly creates/updates/deletes requirement rules via natural language.
 */
export async function chatWithRulesArchitect(
  message: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = []
): Promise<RuleChatResponse> {
  const [sectors, metas, strategies] = await Promise.all([
    adminFetchSectors(),
    adminFetchMetas(),
    adminFetchStrategies(),
  ])

  const historyContext = history.length > 0
    ? `\nPREVIOUS CONVERSATION:\n${history.slice(-4).map(h => `${h.role === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}\n`
    : ''

  const contextSummary = `CURRENT DATABASE RULES STATE:
- Total Sector Families: ${sectors.length} (${sectors.map(s => s.sector).slice(0, 15).join(', ')}${sectors.length > 15 ? '...' : ''})
- Total Meta-Rules: ${metas.length} (${metas.map(m => m.name).slice(0, 10).join(', ')})
- Total Strategies: ${strategies.length} (${strategies.map(s => s.name).join(', ')})`

  const prompt = `You are the EBEXTA Neural Requirement Rules Architect & Administrator AI.
You help admins inspect, understand, create, update, and manage requirement rules, sectors, strategies, and meta-rules.

${contextSummary}
${historyContext}
USER INSTRUCTION/MESSAGE:
"${message}"

If the user wants to ADD, CREATE, MODIFY, or DELETE a rule/sector/strategy, output a JSON object containing the action directives AND an informative markdown reply.
If the user is asking a question or explanation, answer concisely and authoritatively.

OUTPUT FORMAT (Valid JSON only):
{
  "reply": "Markdown explanation or confirmation of changes made",
  "actions": [
    {
      "action": "SAVE_SECTOR",
      "sector": {
        "sector": "NAME",
        "aliases": ["alias1", "alias2"],
        "strategy": "STANDARD",
        "physicalEvidence": false,
        "buyerRoles": ["CEO", "CTO"],
        "gapSignals": [{ "signal": "description", "points": 20 }],
        "triggerSignals": [{ "signal": "description", "points": 25 }],
        "antiSignals": ["Competitor"],
        "searchQueries": ["example query"]
      }
    },
    {
      "action": "SAVE_META",
      "meta": { "name": "RULE_NAME", "points": 20, "description": "...", "appliesTo": ["ALL"] }
    },
    {
      "action": "ADD_STRATEGY",
      "strategy": { "name": "STRAT_NAME", "description": "..." }
    }
  ]
}`

  try {
    const res = await callGeminiProxy(prompt, {
      action: 'enrich',
      model: 'gemini-flash-latest',
      jsonMode: true,
    })

    const parsed = safeParseJSON<{
      reply?: string
      actions?: Array<{
        action: 'SAVE_SECTOR' | 'SAVE_META' | 'ADD_STRATEGY' | 'DELETE_SECTOR' | 'DELETE_META' | 'DELETE_STRATEGY'
        sector?: SectorRule
        meta?: MetaRule
        strategy?: { name: string; description?: string }
        id?: string
      }>
    }>(res.text)

    const actionsExecuted: RuleChatAction[] = []
    let refreshed = false

    if (parsed && Array.isArray(parsed.actions)) {
      for (const act of parsed.actions) {
        if (act.action === 'SAVE_SECTOR' && act.sector?.sector) {
          const s = act.sector
          s.sector = s.sector.toUpperCase().replace(/\s+/g, '_')
          await saveSector(s)
          actionsExecuted.push({ type: 'sector_saved', name: s.sector, details: `Strategy: ${s.strategy || 'STANDARD'}` })
          refreshed = true
        } else if (act.action === 'SAVE_META' && act.meta?.name) {
          const m = act.meta
          m.name = m.name.toUpperCase().replace(/\s+/g, '_')
          await saveMeta(m)
          actionsExecuted.push({ type: 'meta_saved', name: m.name, details: `+${m.points} pts` })
          refreshed = true
        } else if (act.action === 'ADD_STRATEGY' && act.strategy?.name) {
          const name = act.strategy.name.toUpperCase().replace(/\s+/g, '_')
          await addStrategy(name, act.strategy.description || '')
          actionsExecuted.push({ type: 'strategy_saved', name })
          refreshed = true
        }
      }
    }

    return {
      reply: parsed?.reply || 'Requirement rules updated.',
      actionsExecuted,
      refreshed,
    }
  } catch (err) {
    return {
      reply: `Sorry, encountered an issue analyzing the rule command: ${(err as Error)?.message || err}`,
      actionsExecuted: [],
      refreshed: false,
    }
  }
}
