import jsPDF from 'jspdf'
import {
  type SectorRule,
  type MetaRule,
  type StrategyRow,
  saveSector,
  saveMeta,
  addStrategy,
} from './requirementRules'
import { callGeminiProxy } from './geminiProxy'
import { extractDocText } from './productAnalysis'
import { safeParseJSON } from './safeJson'

export interface ImportResult {
  strategiesAdded: number
  metasAdded: number
  sectorsAdded: number
  errors: string[]
}

/**
 * Generate and download a comprehensive, professional PDF document of all Requirement Rules.
 */
export function exportRulesToPdf(
  sectors: SectorRule[],
  metas: MetaRule[],
  strategies: StrategyRow[]
): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 40
  const contentWidth = pageWidth - margin * 2
  let y = 50

  const primaryColor: [number, number, number] = [26, 31, 44]
  const accentColor: [number, number, number] = [124, 58, 237]
  const secondaryColor: [number, number, number] = [100, 116, 139]
  const textColor: [number, number, number] = [30, 41, 59]
  const lightBg: [number, number, number] = [248, 250, 252]
  const borderColor: [number, number, number] = [226, 232, 240]

  function checkPageBreak(requiredSpace = 60) {
    if (y + requiredSpace > pageHeight - margin) {
      doc.addPage()
      y = margin + 15
      drawPageHeader()
    }
  }

  function drawPageHeader() {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...secondaryColor)
    doc.text('EBEXTA Intelligence Engine — Requirement Rules Specification', margin, margin - 5)
    doc.text(`Page ${doc.getNumberOfPages()}`, pageWidth - margin, margin - 5, { align: 'right' })
    doc.setDrawColor(...borderColor)
    doc.line(margin, margin, pageWidth - margin, margin)
    y = margin + 20
  }

  // Cover / Header
  doc.setFillColor(...lightBg)
  doc.roundedRect(margin, y, contentWidth, 75, 8, 8, 'F')
  doc.setDrawColor(...accentColor)
  doc.setLineWidth(1.5)
  doc.roundedRect(margin, y, contentWidth, 75, 8, 8, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.setTextColor(...primaryColor)
  doc.text('EBEXTA Neural Requirement Rules', margin + 18, y + 28)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.setTextColor(...secondaryColor)
  doc.text(
    `Comprehensive Taxonomy: ${sectors.length} Sector Families · ${metas.length} Meta-Rules · ${strategies.length} Strategies`,
    margin + 18,
    y + 46
  )
  doc.text(`Exported: ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, margin + 18, y + 60)

  y += 95

  // Section 1: Universal Meta-Rules
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...accentColor)
  doc.text('1. Universal Meta-Rules', margin, y)
  y += 15

  metas.forEach((m, idx) => {
    checkPageBreak(50)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.75)
    doc.roundedRect(margin, y, contentWidth, 38, 4, 4, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...primaryColor)
    doc.text(`${idx + 1}. ${m.name}`, margin + 12, y + 15)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9)
    if (m.points < 0) {
      doc.setTextColor(220, 38, 38)
      doc.text(`${m.points} pts`, pageWidth - margin - 15, y + 15, { align: 'right' })
    } else {
      doc.setTextColor(16, 185, 129)
      doc.text(`+${m.points} pts`, pageWidth - margin - 15, y + 15, { align: 'right' })
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...textColor)
    const splitDesc = doc.splitTextToSize(m.description || 'No description provided', contentWidth - 24)
    doc.text(splitDesc, margin + 12, y + 28)

    y += 44
  })

  y += 15

  // Section 2: Core Strategies
  checkPageBreak(80)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...accentColor)
  doc.text('2. Core Strategies', margin, y)
  y += 15

  strategies.forEach((st, idx) => {
    checkPageBreak(45)
    doc.setFillColor(255, 255, 255)
    doc.setDrawColor(...borderColor)
    doc.setLineWidth(0.75)
    doc.roundedRect(margin, y, contentWidth, 34, 4, 4, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...primaryColor)
    doc.text(`${idx + 1}. ${st.name}`, margin + 12, y + 14)

    if (st.is_builtin) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(7.5)
      doc.setTextColor(...secondaryColor)
      doc.text('BUILT-IN', pageWidth - margin - 15, y + 14, { align: 'right' })
    }

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...textColor)
    doc.text(st.description || 'General requirement matching strategy', margin + 12, y + 26)

    y += 40
  })

  y += 15

  // Section 3: Sector Families
  checkPageBreak(80)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...accentColor)
  doc.text('3. Sector Families & Precision Rules', margin, y)
  y += 15

  sectors.forEach((sec, idx) => {
    checkPageBreak(120)

    doc.setFillColor(...lightBg)
    doc.setDrawColor(...accentColor)
    doc.setLineWidth(1)
    doc.roundedRect(margin, y, contentWidth, 24, 4, 4, 'FD')

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10.5)
    doc.setTextColor(...primaryColor)
    doc.text(`${idx + 1}. ${sec.sector}`, margin + 10, y + 16)

    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...accentColor)
    doc.text(`Strategy: ${sec.strategy || 'STANDARD'}`, pageWidth - margin - 12, y + 16, { align: 'right' })

    y += 32

    // Details box
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...textColor)

    if (sec.aliases && sec.aliases.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Aliases / Triggers: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const aliasText = doc.splitTextToSize(sec.aliases.join(', '), contentWidth - 110)
      doc.text(aliasText, margin + 95, y)
      y += aliasText.length * 12 + 4
    }

    if (sec.buyerRoles && sec.buyerRoles.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Target Roles: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const roleText = doc.splitTextToSize(sec.buyerRoles.join(', '), contentWidth - 110)
      doc.text(roleText, margin + 95, y)
      y += roleText.length * 12 + 4
    }

    if (sec.gapSignals && sec.gapSignals.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Gap Signals: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const gapStr = sec.gapSignals.map(g => `${g.signal} (+${g.points}pts)`).join('; ')
      const gapText = doc.splitTextToSize(gapStr, contentWidth - 110)
      doc.text(gapText, margin + 95, y)
      y += gapText.length * 12 + 4
    }

    if (sec.triggerSignals && sec.triggerSignals.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Trigger Signals: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const trigStr = sec.triggerSignals.map(t => `${t.signal} (+${t.points}pts)`).join('; ')
      const trigText = doc.splitTextToSize(trigStr, contentWidth - 110)
      doc.text(trigText, margin + 95, y)
      y += trigText.length * 12 + 4
    }

    if (sec.antiSignals && sec.antiSignals.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Anti-Signals: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const antiText = doc.splitTextToSize(sec.antiSignals.join(', '), contentWidth - 110)
      doc.text(antiText, margin + 95, y)
      y += antiText.length * 12 + 4
    }

    if (sec.searchQueries && sec.searchQueries.length > 0) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.text('Search Queries: ', margin + 8, y)
      doc.setFont('helvetica', 'normal')
      const qText = doc.splitTextToSize(sec.searchQueries.join(' | '), contentWidth - 110)
      doc.text(qText, margin + 95, y)
      y += qText.length * 12 + 4
    }

    y += 10
    doc.setDrawColor(...borderColor)
    doc.line(margin, y, pageWidth - margin, y)
    y += 14
  })

  y += 15

  // Section 4: Qualification & Accuracy Safeguards
  checkPageBreak(80)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(...accentColor)
  doc.text('4. Qualification & Accuracy Safeguards', margin, y)
  y += 15

  const safeguards = [
    '1. Company identity must be resolved before scoring a requirement. Match legal/company name, domain, location, industry and other identifiers where available.',
    '2. One company + one concrete requirement = one opportunity. Do not create multiple leads from duplicate evidence.',
    '3. Requirement Score, Evidence Confidence, Contact Confidence and Outreach Readiness must remain separate fields.',
    '4. "Interested" requires explicit or strong buying evidence. A high score alone is not interest.',
    '5. A client possibility requires requirement + relevant timing + concrete evidence + relevant buyer role/contact. It is not a conversion guarantee.',
    '6. Anti-signals can suppress an otherwise high score. Recent proof that the need is already solved must take priority.',
    '7. Do not fabricate intent, contact details, company websites, evidence, vendor relationships, or buying activity.',
    '8. If evidence is weak or conflicting, return fewer opportunities rather than padding results.',
    '9. Use recency and source quality. Current official/company evidence should generally outrank stale or weak third-party mentions.',
    '10. Calibrate thresholds from actual EBEXTA test outcomes by sector and requirement type.',
    '11. Relevant buyer role must be inferred from the requirement and industry, then verified where possible. Never treat a generic "management team" result as a verified contact.',
    '12. If no verified requirement exists, label the result as "Insufficient evidence" rather than forcing a lead.',
  ]

  safeguards.forEach(sg => {
    checkPageBreak(30)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(...textColor)
    const sgText = doc.splitTextToSize(sg, contentWidth)
    doc.text(sgText, margin, y)
    y += sgText.length * 12 + 4
  })

  const filename = `ebexta-requirement-rules-${new Date().toISOString().split('T')[0]}.pdf`
  doc.save(filename)
}

/**
 * Upload, parse, and synchronize requirement rules from a PDF file.
 */
export async function importRulesFromPdf(file: File): Promise<ImportResult> {
  const result: ImportResult = {
    strategiesAdded: 0,
    metasAdded: 0,
    sectorsAdded: 0,
    errors: [],
  }

  const rawText = await extractDocText(file)
  if (!rawText.trim()) {
    throw new Error('Could not extract readable text from the uploaded PDF document.')
  }

  const prompt = `You are EBEXTA's Requirement Rules Parser & System Synchronizer.
Your goal is to parse the rules, sector families, strategies, signals, and meta-rules from the text below into a clean, complete structured JSON payload.

Input text from document:
"""
${rawText.slice(0, 15000)}
"""

Return ONLY a single valid JSON object (no markdown, no backticks, no wrapping text):
{
  "strategies": [
    {
      "name": "STRATEGY_NAME",
      "description": "Short explanation of strategy"
    }
  ],
  "metaRules": [
    {
      "name": "META_RULE_NAME",
      "points": 20,
      "description": "What this universal signal proves",
      "appliesTo": ["ALL"]
    }
  ],
  "sectors": [
    {
      "sector": "FAMILY_NAME",
      "aliases": ["keyword1", "keyword2"],
      "strategy": "STANDARD",
      "physicalEvidence": false,
      "buyerRoles": ["CEO", "CTO", "Head of Engineering"],
      "gapSignals": [
        { "signal": "Missing modern payment gateway", "points": 20 }
      ],
      "triggerSignals": [
        { "signal": "Recent series A funding round", "points": 25 }
      ],
      "antiSignals": ["Competitor agency", "Consulting firm"],
      "searchQueries": ["companies hiring developers", "startups expansion"]
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
    throw new Error('AI could not extract structured rules from this document. Please ensure the PDF contains clear rule descriptions.')
  }

  // 1. Process Strategies
  if (Array.isArray(parsed.strategies)) {
    for (const st of parsed.strategies) {
      if (st?.name?.trim()) {
        const { error } = await addStrategy(st.name.trim().toUpperCase().replace(/\s+/g, '_'), st.description || '')
        if (!error) result.strategiesAdded++
        else result.errors.push(`Strategy "${st.name}": ${error}`)
      }
    }
  }

  // 2. Process Meta-Rules
  if (Array.isArray(parsed.metaRules)) {
    for (const m of parsed.metaRules) {
      if (m?.name?.trim()) {
        const metaRule: MetaRule = {
          name: m.name.trim().toUpperCase().replace(/\s+/g, '_'),
          points: Number(m.points) || 20,
          description: String(m.description || ''),
          appliesTo: Array.isArray(m.appliesTo) && m.appliesTo.length > 0 ? m.appliesTo : ['ALL'],
        }
        const { error } = await saveMeta(metaRule)
        if (!error) result.metasAdded++
        else result.errors.push(`Meta-rule "${m.name}": ${error}`)
      }
    }
  }

  // 3. Process Sector Families
  if (Array.isArray(parsed.sectors)) {
    for (const s of parsed.sectors) {
      if (s?.sector?.trim()) {
        const sectorRule: SectorRule = {
          sector: s.sector.trim().toUpperCase().replace(/\s+/g, '_'),
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
        if (!error) result.sectorsAdded++
        else result.errors.push(`Sector "${s.sector}": ${error}`)
      }
    }
  }

  return result
}
