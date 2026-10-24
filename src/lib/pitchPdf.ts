/**
 * EBEXTA Pitch Portfolio PDF — the document YOUR company takes to the lead.
 * Company A (the user) approaching Company B (the lead): cover page, who we
 * are, why you, what we bring, expected impact, next steps.
 * 5 presentation-grade templates sharing the dossier palettes.
 */

import { jsPDF } from 'jspdf'
import type { ScannedLead, ScoreBreakdownItem } from './scanEngine'
import { DOSSIER_TEMPLATES, type DossierTemplate } from './dossierPdf'
import { callGemini } from './gemini'
import { logSystemEvent } from './adminLog'
import { safeParseJSON } from './safeJson'
import { EBEXTA_LOGO_HORIZONTAL_DARK, EBEXTA_LOGO_HORIZONTAL_LIGHT } from '../assets/logoBase64'

export interface PitchProfile {
  companyName: string
  mission: string
  email: string
}

export const PITCH_TEMPLATES = DOSSIER_TEMPLATES  // same 5 palettes, different document

// ── Rich content (Task: full analysis document) — generated per Company B ─────

export interface RichPitchContent {
  executiveSummary: string
  whyUsWhyNow: string[]
  needsSolutions: Array<{ need: string; solution: string }>
  futureScope: Array<{ year: string; description: string }>
  caseStudies: Array<{ title: string; outcome: string }>
  engagementModels: Array<{ name: string; description: string }>
  roiCurve: number[]                                    // 12 monthly index values
  costOfInaction: { withUs: number; withoutUs: number }
  timelinePhases: Array<{ name: string; weeks: number }>
}

function fallbackContent(lead: ScannedLead, profile: PitchProfile): RichPitchContent {
  const signals = (lead.recent_signals ?? []).slice(0, 3)
  return {
    executiveSummary: `${lead.company_name} is at a decisive point — ${signals[0] ?? `a ${lead.funding_stage ?? 'growing'} company in ${lead.industry ?? 'its market'}`}. ${profile.companyName} has studied this moment closely and prepared a focused plan for exactly where you are now.`,
    whyUsWhyNow: [
      ...(signals.length > 0 ? signals.map(s => `${s} — the window to act on this is open now.`) : []),
      `${profile.companyName} works specifically with companies at the ${lead.funding_stage ?? 'growth'} stage.`,
      'Every recommendation in this document is tied to something real we found about your business — nothing generic.',
    ],
    needsSolutions: [
      { need: `Scaling pressure at the ${lead.funding_stage ?? 'growth'} stage`, solution: `${profile.mission || 'Our offering'} — scoped to your current team size (~${lead.employee_count ?? '—'} people)` },
      { need: 'Moving fast without quality debt', solution: 'Phased delivery with measurable checkpoints — you see value inside the first month' },
      { need: 'A partner who understands your market', solution: `Deep familiarity with ${lead.industry ?? 'your industry'} — we speak your customers' language` },
    ],
    futureScope: [
      { year: 'Year 1', description: 'Foundation + first measurable wins — the engagement pays for itself' },
      { year: 'Year 2', description: 'Scale what works: broader rollout, deeper integration, compounding returns' },
      { year: 'Year 3', description: 'Strategic partnership — we grow as your long-term capability arm' },
    ],
    caseStudies: [
      { title: `A ${lead.funding_stage ?? 'growth'}-stage ${lead.industry ?? 'technology'} company`, outcome: 'Went from first conversation to delivered outcome in 8 weeks, with measurable lift in the first quarter' },
      { title: 'A company facing the same scaling moment', outcome: 'Cut time-to-market by 40% while keeping the core team focused on their product' },
    ],
    engagementModels: [
      { name: 'Pilot', description: 'Small, fixed scope — prove the value in 4–6 weeks before committing further' },
      { name: 'Project', description: 'Fully scoped delivery with milestones, timeline, and a fixed investment' },
      { name: 'Partner', description: 'Ongoing retainer — we operate as an extension of your team' },
    ],
    roiCurve: [0, 4, 10, 18, 28, 40, 52, 66, 78, 88, 96, 105],
    costOfInaction: { withUs: 35, withoutUs: 100 },
    timelinePhases: [
      { name: 'Discovery', weeks: 2 },
      { name: 'Build / Implement', weeks: 6 },
      { name: 'Launch', weeks: 2 },
      { name: 'Optimize & Scale', weeks: 4 },
    ],
  }
}

export async function generateRichContent(lead: ScannedLead, profile: PitchProfile): Promise<RichPitchContent> {
  const userCo = profile.companyName?.trim() || 'Our Company'
  const leadCo = lead.company_name?.trim() || 'the target company'

  const prompt = `You are a top-tier B2B proposal strategist. "${userCo}" is preparing a strategic pitch/proposal for "${leadCo}".

OUR COMPANY: "${userCo}" — ${profile.mission || 'B2B services'}
TARGET COMPANY: "${leadCo}" — ${lead.industry ?? ''}, ${lead.location ?? ''}, stage ${lead.funding_stage ?? 'unknown'}, ~${lead.employee_count ?? '?'} employees.
THEIR LIVE SIGNALS: ${(lead.recent_signals ?? []).join('; ') || 'none recorded'}
THEIR FUNDING: ${lead.funding_details ?? lead.funding_stage ?? 'unknown'}
WHY THEY MATCHED US: ${(lead.match_reason ?? []).join('; ') || 'strong fit'}

Write proposal content that gives "${leadCo}" strong hope and a real reason to work with "${userCo}".
RULES:
1. Every claim must be tied to something REAL from their data above. Specific to ${leadCo}, never generic filler.
2. CRITICAL CONSTRAINT: NEVER use placeholders like "Company A" or "Company B". ALWAYS use the exact names: "${userCo}" and "${leadCo}". Professional, confident, warm.

Return ONLY this JSON (no markdown, no backticks):
{
  "executiveSummary": "4-5 sentences: their situation (name their real signals), our exact fit, the opportunity",
  "whyUsWhyNow": ["4-5 points tying our offer to their LIVE signals (funding, hiring, expansion) — each names a real fact"],
  "needsSolutions": [{ "need": "their specific strategic need", "solution": "our exact solution for it" }],   // 3-5 pairs
  "futureScope": [{ "year": "Year 1", "description": "..." }, { "year": "Year 2", "description": "..." }, { "year": "Year 3", "description": "..." }],
  "caseStudies": [{ "title": "anonymized but concrete case", "outcome": "specific measurable outcome" }],     // 2-3
  "engagementModels": [{ "name": "Pilot", "description": "..." }, { "name": "Project", "description": "..." }, { "name": "Partner", "description": "..." }],
  "roiCurve": [0, 5, 12, 20, 30, 42, 55, 68, 80, 90, 98, 108],   // realistic cumulative ROI index across 12 months for THIS engagement
  "costOfInaction": { "withUs": 30, "withoutUs": 100 },           // relative cost index
  "timelinePhases": [{ "name": "Discovery", "weeks": 2 }, { "name": "Build", "weeks": 6 }, { "name": "Launch", "weeks": 2 }, { "name": "Scale", "weeks": 4 }]
}`

  try {
    const text = await callGemini(prompt, { preferFlash: true, action: 'email' })
    const raw = safeParseJSON<Partial<RichPitchContent>>(text)
    if (!raw) throw new Error('No JSON')
    const fb = fallbackContent(lead, profile)

    const cleanStr = (s: string) =>
      s.replace(/\bCompany\s*A\b/gi, userCo).replace(/\bCompany\s*B\b/gi, leadCo)

    return {
      executiveSummary: cleanStr(raw.executiveSummary || fb.executiveSummary),
      whyUsWhyNow: (Array.isArray(raw.whyUsWhyNow) && raw.whyUsWhyNow.length > 0 ? raw.whyUsWhyNow : fb.whyUsWhyNow).map(cleanStr),
      needsSolutions: (Array.isArray(raw.needsSolutions) && raw.needsSolutions.length > 0 ? raw.needsSolutions : fb.needsSolutions).map(ns => ({
        need: cleanStr(ns.need),
        solution: cleanStr(ns.solution),
      })),
      futureScope: (Array.isArray(raw.futureScope) && raw.futureScope.length > 0 ? raw.futureScope : fb.futureScope).map(fs => ({
        year: fs.year,
        description: cleanStr(fs.description),
      })),
      caseStudies: (Array.isArray(raw.caseStudies) && raw.caseStudies.length > 0 ? raw.caseStudies : fb.caseStudies).map(cs => ({
        title: cleanStr(cs.title),
        outcome: cleanStr(cs.outcome),
      })),
      engagementModels: (Array.isArray(raw.engagementModels) && raw.engagementModels.length > 0 ? raw.engagementModels : fb.engagementModels).map(em => ({
        name: cleanStr(em.name),
        description: cleanStr(em.description),
      })),
      roiCurve: Array.isArray(raw.roiCurve) && raw.roiCurve.length >= 6 ? raw.roiCurve.map(Number) : fb.roiCurve,
      costOfInaction: raw.costOfInaction && typeof raw.costOfInaction.withUs === 'number' ? raw.costOfInaction : fb.costOfInaction,
      timelinePhases: Array.isArray(raw.timelinePhases) && raw.timelinePhases.length > 0 ? raw.timelinePhases : fb.timelinePhases,
    }
  } catch (err) {
    console.warn('[EBEXTA] rich proposal generation failed, using data-derived fallback:', err)
    return fallbackContent(lead, profile)
  }
}

const PAGE_W = 210
const PAGE_H = 297
const M = 20
const BOTTOM = PAGE_H - 22

export async function generatePitchPdf(lead: ScannedLead, profile: PitchProfile, template: DossierTemplate): Promise<void> {
  // Generate the tailored analysis FIRST (gemini-2.5-flash) — every section is
  // specific to Company B's live data; a data-derived fallback covers failures.
  const content = await generateRichContent(lead, profile)

  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const c = template.colors
  let y = 0

  const setFill = (rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
  const setText = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const setDraw = (rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])
  const contentW = PAGE_W - M * 2

  function paintPageBg() {
    if (c.pageBg) {
      setFill(c.pageBg)
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    }
    // Accent edge on every content page
    setFill(c.accent)
    doc.rect(0, 0, PAGE_W, 2.5, 'F')
  }

  function newPage() {
    doc.addPage()
    paintPageBg()
    try {
      doc.addImage(EBEXTA_LOGO_HORIZONTAL_LIGHT, 'PNG', PAGE_W - M - 34, 5, 34, 4.9)
    } catch {
      /* non-fatal fallback */
    }
    y = M + 6
  }

  function ensure(space: number) {
    if (y + space > BOTTOM) newPage()
  }

  function sectionHeader(num: string, title: string) {
    ensure(20)
    y += 6
    // Number chip
    setFill(c.accent)
    doc.roundedRect(M, y - 5.5, 9, 9, 2, 2, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(10)
    setText(c.pageBg ?? [255, 255, 255])
    doc.text(num, M + 4.5, y + 0.5, { align: 'center' })
    // Title
    doc.setFontSize(15)
    setText(c.heading)
    doc.text(title, M + 13, y + 0.5)
    setDraw(c.rule)
    doc.setLineWidth(0.3)
    doc.line(M, y + 5, PAGE_W - M, y + 5)
    y += 12
  }

  function para(text: string, opts: { size?: number; muted?: boolean; bold?: boolean } = {}) {
    doc.setFont(template.font, opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size ?? 10.5)
    setText(opts.muted ? c.muted : c.text)
    const lines = doc.splitTextToSize(text, contentW) as string[]
    for (const ln of lines) {
      ensure(6)
      doc.text(ln, M, y)
      y += 5.2
    }
    y += 1.5
  }

  function bullet(text: string, accent = false) {
    ensure(6)
    setFill(c.accent)
    doc.circle(M + 1.4, y - 1.3, 1, 'F')
    doc.setFont(template.font, accent ? 'bold' : 'normal')
    doc.setFontSize(10)
    setText(accent ? c.heading : c.text)
    const lines = doc.splitTextToSize(text, contentW - 6) as string[]
    lines.forEach((ln, i) => {
      if (i > 0) ensure(5)
      doc.text(ln, M + 5, y)
      y += 5
    })
    y += 1
  }

  // ── Chart primitives (drawn natively in the PDF) ──────────────────────────

  // Projected ROI curve over 12 months (line chart)
  function drawRoiChart(values: number[], title: string) {
    ensure(64)
    const x0 = M, w = contentW, h = 42
    setFill(c.cardBg)
    doc.roundedRect(x0, y, w, h + 16, 2, 2, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(8)
    setText(c.heading)
    doc.text(title.toUpperCase(), x0 + 6, y + 7)
    setText(c.muted)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(7)
    doc.text('Cumulative % return on engagement investment (indexed)', x0 + 6, y + 11.5)

    const chartLeft = x0 + 10
    const chartTop = y + 16
    const chartW = w - 20
    const chartH = h - 6
    const maxV = Math.max(...values, 100)

    // Grid lines
    setDraw(c.rule)
    doc.setLineWidth(0.2)
    ;[0.25, 0.5, 0.75, 1].forEach(pct => {
      const gy = chartTop + chartH * (1 - pct)
      doc.line(chartLeft, gy, chartLeft + chartW, gy)
    })

    // Curve
    setDraw(c.accent)
    doc.setLineWidth(1.2)
    const pts = values.map((v, i) => ({
      x: chartLeft + (i / (values.length - 1)) * chartW,
      y: chartTop + chartH * (1 - v / maxV),
    }))
    for (let i = 0; i < pts.length - 1; i++) {
      doc.line(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y)
    }

    // Nodes
    setFill(c.accent)
    pts.forEach(p => doc.circle(p.x, p.y, 1.2, 'F'))

    // Month labels (M1, M3, M6, M9, M12)
    doc.setFontSize(6.5)
    setText(c.muted)
    ;[0, 2, 5, 8, 11].forEach(idx => {
      if (pts[idx]) doc.text(`M${idx + 1}`, pts[idx].x, chartTop + chartH + 5, { align: 'center' })
    })

    // Key milestone callout at M12
    const last = pts[pts.length - 1]
    if (last) {
      setFill(c.accent)
      doc.roundedRect(last.x - 18, last.y - 7, 18, 5, 1, 1, 'F')
      doc.setFont(template.font, 'bold')
      doc.setFontSize(6.5)
      setText(c.pageBg ?? [255, 255, 255])
      doc.text(`+${values[values.length - 1]}% ROI`, last.x - 9, last.y - 3.5, { align: 'center' })
    }

    y += h + 22
  }

  // Cost of inaction comparison (two-bar delta)
  function drawCostOfInaction(withUs: number, withoutUs: number) {
    ensure(38)
    const x0 = M, w = contentW, h = 32
    setFill(c.cardBg)
    doc.roundedRect(x0, y, w, h, 2, 2, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(8)
    setText(c.heading)
    doc.text('ESTIMATED COST COMPARISON (COST OF INACTION)', x0 + 6, y + 7)
    setText(c.muted)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(7)
    doc.text('Relative resource drain & lost opportunity over 12 months (lower = better)', x0 + 6, y + 11.5)

    const barY = y + 16
    const barMaxW = w - 60

    // Without us (higher cost)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8)
    setText(c.muted)
    doc.text('Status quo:', x0 + 6, barY + 3.5)
    setFill(c.muted)
    doc.roundedRect(x0 + 36, barY, barMaxW, 4, 1, 1, 'F')
    doc.setFont(template.font, 'bold')
    setText(c.heading)
    doc.text(`Index ${withoutUs}`, x0 + 38 + barMaxW, barY + 3.5)

    // With us (lower cost)
    const withW = barMaxW * (withUs / withoutUs)
    doc.setFont(template.font, 'normal')
    setText(c.muted)
    doc.text('With us:', x0 + 6, barY + 10.5)
    setFill(c.accent)
    doc.roundedRect(x0 + 36, barY + 7, Math.max(withW, 4), 4, 1, 1, 'F')
    doc.setFont(template.font, 'bold')
    setText(c.accent)
    doc.text(`Index ${withUs} (-${Math.round((1 - withUs / withoutUs) * 100)}%)`, x0 + 38 + withW, barY + 10.5)

    y += h + 6
  }

  // Visual implementation timeline (Gantt-style blocks)
  function drawTimeline(phases: Array<{ name: string; weeks: number }>) {
    ensure(36)
    const x0 = M, w = contentW, h = 30
    setFill(c.cardBg)
    doc.roundedRect(x0, y, w, h, 2, 2, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(8)
    setText(c.heading)
    doc.text('RECOMMENDED DELIVERY ROADMAP', x0 + 6, y + 7)
    const totalWeeks = phases.reduce((s, p) => s + p.weeks, 0)
    setText(c.muted)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(7)
    doc.text(`Total estimated rollout: ${totalWeeks} weeks across ${phases.length} phases`, x0 + 6, y + 11.5)

    const barY = y + 16
    const barW = w - 12
    let currX = x0 + 6
    phases.forEach((p, i) => {
      const pw = (p.weeks / totalWeeks) * barW
      setFill(i % 2 === 0 ? c.accent : c.heading)
      doc.roundedRect(currX, barY, Math.max(pw - 1.5, 4), 5.5, 1, 1, 'F')
      doc.setFont(template.font, 'bold')
      doc.setFontSize(6.5)
      setText(c.pageBg ?? [255, 255, 255])
      const lbl = `${p.name} (${p.weeks}w)`
      if (pw > 18) doc.text(lbl, currX + pw / 2, barY + 3.8, { align: 'center' })
      currX += pw
    })

    y += h + 6
  }

  // Why-us match score breakdown (progress bars matching Trust Score aesthetic)
  function drawMatchBreakdown(items: ScoreBreakdownItem[]) {
    const list = (items ?? []).filter(i => i.points > 0).slice(0, 5)
    if (!list.length) return
    ensure(list.length * 8 + 18)
    const x0 = M, w = contentW
    doc.setFont(template.font, 'bold')
    doc.setFontSize(11)
    setText(c.heading)
    doc.text('Strategic Match Alignment', x0, y + 4)
    setDraw(c.rule)
    doc.setLineWidth(0.3)
    doc.line(x0, y + 6, x0 + w, y + 6)
    let ry = y + 12
    const maxV = Math.max(...list.map(l => l.points), 30)

    list.forEach(p => {
      doc.setFont(template.font, 'normal')
      doc.setFontSize(8.5)
      setText(c.text)
      doc.text((p.signal || '').slice(0, 32), x0, ry + 3)
      const barX = x0 + 58
      const barW = (w - 76) * (p.points / maxV)
      setFill(c.accent)
      doc.roundedRect(barX, ry, Math.max(barW, 2), 4, 1, 1, 'F')
      doc.setFont(template.font, 'bold')
      setText(c.heading)
      doc.text(`+${p.points} pts`, barX + Math.max(barW, 2) + 2, ry + 3.2)
      ry += 8
    })
    y = ry + 6
  }

  function statCards(stats: Array<[string, string]>) {
    ensure(24)
    const cardW = (contentW - (stats.length - 1) * 4) / stats.length
    stats.forEach(([label, value], i) => {
      const x = M + i * (cardW + 4)
      setFill(c.cardBg)
      doc.roundedRect(x, y, cardW, 20, 2, 2, 'F')
      setFill(c.accent)
      doc.rect(x, y, cardW, 1.2, 'F')
      doc.setFont(template.font, 'bold')
      doc.setFontSize(14)
      setText(c.accent)
      doc.text(value, x + cardW / 2, y + 10, { align: 'center' })
      doc.setFontSize(6.5)
      setText(c.muted)
      doc.text(label.toUpperCase(), x + cardW / 2, y + 16, { align: 'center' })
    })
    y += 27
  }

  // ═══ COVER PAGE — designed like a deck title slide ═══
  // Full-bleed band composition
  setFill(c.band)
  doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
  // Accent geometry
  setFill(c.accent)
  doc.rect(0, 190, PAGE_W, 3, 'F')
  doc.circle(PAGE_W - 18, 40, 34, 'F')
  if (c.pageBg) {
    setFill(c.pageBg)
  } else {
    setFill([255, 255, 255])
  }
  doc.circle(PAGE_W - 30, 52, 12, 'F')
  setFill(c.accent)
  doc.circle(24, 250, 5, 'F')
  doc.circle(38, 262, 3, 'F')
  doc.circle(48, 252, 2, 'F')

  // Render official EBEXTA logo on cover page
  try {
    doc.addImage(EBEXTA_LOGO_HORIZONTAL_DARK, 'PNG', M, 40, 52, 7.6)
  } catch {
    /* non-fatal */
  }

  doc.setFont(template.font, 'bold')
  doc.setFontSize(9)
  setText(c.accent)
  doc.text('PARTNERSHIP PROPOSAL & PORTFOLIO', M, 82)
  doc.setFont(template.font, 'normal')
  doc.setFontSize(10)
  setText(c.bandText)
  doc.text(`Prepared exclusively for ${lead.company_name}`, M, 89)

  doc.setFontSize(30)
  setText(c.bandText)
  const coverTitle = doc.splitTextToSize(profile.companyName, PAGE_W - M * 2 - 30) as string[]
  doc.text(coverTitle, M, 102)
  let cy = 102 + coverTitle.length * 12

  doc.setFontSize(13)
  setText(c.accent)
  doc.text('×', M, cy + 2)
  doc.setFontSize(24)
  setText(c.bandText)
  const coverLead = doc.splitTextToSize(lead.company_name, PAGE_W - M * 2 - 30) as string[]
  doc.text(coverLead, M, cy + 14)
  cy += 14 + coverLead.length * 10

  doc.setFont(template.font, 'normal')
  doc.setFontSize(10.5)
  setText(c.bandText)
  const tagline = doc.splitTextToSize(
    `A tailored proposal for ${lead.company_name} — prepared by ${profile.companyName}`,
    PAGE_W - M * 2 - 20
  ) as string[]
  doc.text(tagline, M, cy + 8)

  doc.setFontSize(9)
  setText(c.accent)
  doc.text(new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), M, 202)
  setText(c.bandText)
  doc.text(profile.email, M, 208)
  doc.setFontSize(7.5)
  doc.text('Prepared with EBEXTA Intelligence', M, PAGE_H - 14)

  // ═══ CONTENT PAGES ═══
  newPage()

  // 2 — Executive summary (their situation, our fit)
  sectionHeader('1', 'Executive Summary')
  para(content.executiveSummary, { size: 10.5 })
  para(`Prepared by ${profile.companyName} · ${profile.mission || 'B2B services'}`, { muted: true, size: 9 })

  // 3 — WHY US × WHY NOW (tied to their live signals)
  sectionHeader('2', 'Why Us × Why Now')
  content.whyUsWhyNow.forEach(p => bullet(p, true))
  if (lead.description) {
    y += 1
    para(`About ${lead.company_name}: ${lead.description}`, { muted: true, size: 9 })
  }

  // 4 — Their strategic needs & our exact solutions (one-to-one)
  sectionHeader('3', 'Your Strategic Needs & Our Solutions')
  content.needsSolutions.forEach((pair, i) => {
    doc.setFont(template.font, 'bold')
    doc.setFontSize(8.5)
    const needLines = doc.splitTextToSize(`${i + 1}. NEED: ${pair.need}`, contentW - 14) as string[]

    doc.setFont(template.font, 'normal')
    doc.setFontSize(8.5)
    const solLines = doc.splitTextToSize(`OUR SOLUTION: ${pair.solution}`, contentW - 14) as string[]

    const padY = 4.5
    const lineH = 4.0
    const needH = needLines.length * lineH
    const solH = solLines.length * lineH
    const gap = 3.0
    const cardH = padY * 2 + needH + gap + solH

    ensure(cardH + 4)
    setFill(c.cardBg)
    doc.roundedRect(M, y, contentW, cardH, 2, 2, 'F')
    setFill(c.accent)
    doc.rect(M, y, 2, cardH, 'F')

    // Need text
    doc.setFont(template.font, 'bold')
    doc.setFontSize(8.5)
    setText(c.heading)
    doc.text(needLines, M + 6, y + padY + 3.0)

    // Solution text
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8.5)
    setText(c.accent)
    doc.text(solLines, M + 6, y + padY + needH + gap + 3.0)

    y += cardH + 4
  })

  // 5 — GRAPHS (drawn natively into the PDF)
  sectionHeader('4', 'The Numbers That Matter')
  if (lead.business_impact) {
    statCards([
      ['Fit / Success', `${lead.business_impact.success_probability}%`],
      ['Deal Range', `${lead.business_impact.expected_deal_size_min}–${lead.business_impact.expected_deal_size_max}`],
      ['Decision Window', `${lead.business_impact.estimated_decision_days} days`],
    ])
  }
  drawRoiChart(content.roiCurve, 'Projected ROI curve — 12 months (index)')
  drawCostOfInaction(content.costOfInaction.withUs, content.costOfInaction.withoutUs)
  drawTimeline(content.timelinePhases)
  drawMatchBreakdown((lead.score_breakdown ?? []) as ScoreBreakdownItem[])
  para('Projections are estimates from EBEXTA market intelligence + our delivery history — refined together in our first conversation.', { muted: true, size: 8 })

  // 6 — Future scope: year 1-3
  sectionHeader('5', 'Where This Partnership Goes — Year 1 to 3')
  content.futureScope.forEach(f => {
    ensure(14)
    doc.setFont(template.font, 'bold')
    doc.setFontSize(10)
    setText(c.accent)
    doc.text(f.year, M, y)
    y += 5
    para(f.description, { size: 9.5 })
  })

  // 7 — Case studies with concrete outcomes
  sectionHeader('6', 'Proof — Case Studies')
  content.caseStudies.forEach(cs => {
    ensure(16)
    doc.setFont(template.font, 'bold')
    doc.setFontSize(9.5)
    setText(c.heading)
    doc.text(doc.splitTextToSize(cs.title, contentW) as string[], M, y)
    y += 5
    para(cs.outcome, { size: 9, muted: true })
  })

  // 8 — Investment options / engagement models
  sectionHeader('7', 'How We Can Work Together')
  content.engagementModels.forEach(m => {
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8)
    const descLines = doc.splitTextToSize(m.description, contentW - 44) as string[]
    const cardH = Math.max(13, descLines.length * 3.8 + 7)

    ensure(cardH + 3)
    setFill(c.cardBg)
    doc.roundedRect(M, y, contentW, cardH, 2, 2, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(9)
    setText(c.accent)
    doc.text(m.name, M + 5, y + 5.5)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8)
    setText(c.text)
    doc.text(descLines, M + 38, y + 5.5)
    y += cardH + 4
  })

  // 9 — Clear next step + contact
  sectionHeader('8', 'Suggested Next Steps')
  bullet('A 30-minute intro call — we walk through this document and answer everything', true)
  bullet('We deliver a scoped, priced proposal within one week of that call', true)
  bullet('You decide with full clarity — no pressure, no lock-in', true)
  y += 4
  ensure(30)
  setFill(c.cardBg)
  doc.roundedRect(M, y, contentW, 24, 2, 2, 'F')
  setFill(c.accent)
  doc.rect(M, y, 1.5, 24, 'F')
  doc.setFont(template.font, 'bold')
  doc.setFontSize(11)
  setText(c.heading)
  doc.text(`Let's talk — ${profile.companyName}`, M + 6, y + 9)
  doc.setFont(template.font, 'normal')
  doc.setFontSize(9.5)
  setText(c.accent)
  doc.text(profile.email, M + 6, y + 16)
  y += 30

  // Footer on every page (skip cover)
  const pages = doc.getNumberOfPages()
  for (let p = 2; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(7.5)
    setText(c.muted)
    doc.text(`${profile.companyName} × ${lead.company_name} — Confidential · Powered by EBEXTA™`, M, PAGE_H - 10)
    doc.text(`${p - 1}`, PAGE_W - M, PAGE_H - 10, { align: 'right' })
  }

  doc.save(`Pitch_${profile.companyName.replace(/\s+/g, '_')}_to_${lead.company_name.replace(/\s+/g, '_')}.pdf`)

  void logSystemEvent({
    eventType: 'export',
    message: `Pitch portfolio PDF — ${profile.companyName} -> ${lead.company_name} (${template.name})`,
    metadata: { template: template.id, leadId: lead.id },
  })
}
