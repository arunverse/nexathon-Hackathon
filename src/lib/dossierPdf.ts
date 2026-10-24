/**
 * EBEXTA Dossier PDF generator — 5 selectable templates.
 * Pure client-side via jsPDF. Every template renders the same intelligence,
 * with its own palette, typography, and header treatment.
 */

import { jsPDF } from 'jspdf'
import type { ScannedLead } from './scanEngine'
import { logSystemEvent } from './adminLog'
import { EBEXTA_LOGO_HORIZONTAL_DARK, EBEXTA_LOGO_HORIZONTAL_LIGHT } from '../assets/logoBase64'

// ── Template definitions ────────────────────────────────────────────────────────

export interface DossierTemplate {
  id: string
  name: string
  description: string
  /** Preview swatches for the picker UI */
  swatch: { bg: string; band: string; accent: string; text: string }
  font: 'helvetica' | 'times' | 'courier'
  /** RGB colors used inside the PDF */
  colors: {
    pageBg: [number, number, number] | null   // null = white page
    band: [number, number, number]            // header band
    bandText: [number, number, number]
    heading: [number, number, number]
    text: [number, number, number]
    muted: [number, number, number]
    accent: [number, number, number]
    cardBg: [number, number, number]
    rule: [number, number, number]
  }
  headerStyle: 'band' | 'sidebar' | 'minimal' | 'split' | 'dark'
}

export const DOSSIER_TEMPLATES: DossierTemplate[] = [
  {
    id: 'executive',
    name: 'Executive Slate',
    description: 'Navy & gold, serif — boardroom-ready',
    swatch: { bg: '#FFFFFF', band: '#1D2636', accent: '#C9A227', text: '#1D2636' },
    font: 'times',
    colors: {
      pageBg: null,
      band: [29, 38, 54],
      bandText: [255, 255, 255],
      heading: [29, 38, 54],
      text: [40, 45, 60],
      muted: [120, 126, 140],
      accent: [201, 162, 39],
      cardBg: [244, 245, 248],
      rule: [220, 222, 228],
    },
    headerStyle: 'band',
  },
  {
    id: 'amber',
    name: 'Amber Pulse',
    description: 'EBEXTA house style — warm amber accents',
    swatch: { bg: '#FFFBF4', band: '#F59E0B', accent: '#B45309', text: '#3A2E1A' },
    font: 'helvetica',
    colors: {
      pageBg: [255, 251, 244],
      band: [245, 158, 11],
      bandText: [58, 34, 5],
      heading: [58, 46, 26],
      text: [70, 60, 40],
      muted: [150, 135, 110],
      accent: [180, 83, 9],
      cardBg: [250, 240, 222],
      rule: [235, 220, 195],
    },
    headerStyle: 'split',
  },
  {
    id: 'mono',
    name: 'Minimal Mono',
    description: 'Black & white, typewriter — zero noise',
    swatch: { bg: '#FFFFFF', band: '#111111', accent: '#111111', text: '#111111' },
    font: 'courier',
    colors: {
      pageBg: null,
      band: [17, 17, 17],
      bandText: [255, 255, 255],
      heading: [17, 17, 17],
      text: [30, 30, 30],
      muted: [110, 110, 110],
      accent: [17, 17, 17],
      cardBg: [243, 243, 243],
      rule: [200, 200, 200],
    },
    headerStyle: 'minimal',
  },
  {
    id: 'corporate',
    name: 'Corporate Blue',
    description: 'Classic blue sidebar — consulting style',
    swatch: { bg: '#FFFFFF', band: '#1E40AF', accent: '#2563EB', text: '#1E293B' },
    font: 'helvetica',
    colors: {
      pageBg: null,
      band: [30, 64, 175],
      bandText: [255, 255, 255],
      heading: [30, 41, 59],
      text: [45, 55, 72],
      muted: [116, 128, 145],
      accent: [37, 99, 235],
      cardBg: [239, 244, 252],
      rule: [214, 224, 240],
    },
    headerStyle: 'sidebar',
  },
  {
    id: 'noir',
    name: 'Noir',
    description: 'Dark pages, light type — high contrast',
    swatch: { bg: '#16181D', band: '#0B0C0F', accent: '#F59E0B', text: '#ECEDEF' },
    font: 'helvetica',
    colors: {
      pageBg: [22, 24, 29],
      band: [11, 12, 15],
      bandText: [236, 237, 239],
      heading: [236, 237, 239],
      text: [205, 208, 214],
      muted: [130, 135, 145],
      accent: [245, 158, 11],
      cardBg: [33, 36, 44],
      rule: [55, 59, 70],
    },
    headerStyle: 'dark',
  },
]

// ── Generator ───────────────────────────────────────────────────────────────────

const PAGE_W = 210
const PAGE_H = 297
const M = 18            // page margin
const BOTTOM = PAGE_H - 20

export function generateDossierPdf(lead: ScannedLead, template: DossierTemplate): void {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const c = template.colors
  const sidebar = template.headerStyle === 'sidebar'
  const left = sidebar ? M + 8 : M
  const contentW = PAGE_W - left - M
  let y = 0

  const setFill = (rgb: [number, number, number]) => doc.setFillColor(rgb[0], rgb[1], rgb[2])
  const setText = (rgb: [number, number, number]) => doc.setTextColor(rgb[0], rgb[1], rgb[2])
  const setDraw = (rgb: [number, number, number]) => doc.setDrawColor(rgb[0], rgb[1], rgb[2])

  function paintPageBg() {
    if (c.pageBg) {
      setFill(c.pageBg)
      doc.rect(0, 0, PAGE_W, PAGE_H, 'F')
    }
    if (sidebar) {
      setFill(c.band)
      doc.rect(0, 0, 6, PAGE_H, 'F')
    }
  }

  function newPage() {
    doc.addPage()
    paintPageBg()
    y = M
  }

  function ensure(space: number) {
    if (y + space > BOTTOM) newPage()
  }

  function sectionTitle(title: string) {
    ensure(14)
    y += 4
    doc.setFont(template.font, 'bold')
    doc.setFontSize(10.5)
    setText(c.accent)
    doc.text(title.toUpperCase(), left, y)
    setDraw(c.rule)
    doc.setLineWidth(0.3)
    doc.line(left, y + 1.8, left + contentW, y + 1.8)
    y += 7
  }

  function bodyLine(text: string, opts: { bold?: boolean; muted?: boolean; size?: number; indent?: number } = {}) {
    doc.setFont(template.font, opts.bold ? 'bold' : 'normal')
    doc.setFontSize(opts.size ?? 9.5)
    setText(opts.muted ? c.muted : c.text)
    const x = left + (opts.indent ?? 0)
    const lines = doc.splitTextToSize(text, contentW - (opts.indent ?? 0)) as string[]
    for (const ln of lines) {
      ensure(5)
      doc.text(ln, x, y)
      y += 4.6
    }
  }

  function bullet(text: string) {
    ensure(5)
    setFill(c.accent)
    doc.circle(left + 1.2, y - 1.2, 0.8, 'F')
    bodyLine(text, { indent: 4.5 })
  }

  function labelValue(label: string, value: string) {
    ensure(5.4)
    doc.setFont(template.font, 'bold')
    doc.setFontSize(9)
    setText(c.muted)
    doc.text(label, left, y)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(9.5)
    setText(c.text)
    const lines = doc.splitTextToSize(value, contentW - 42) as string[]
    doc.text(lines, left + 40, y)
    y += Math.max(1, lines.length) * 4.6 + 0.8
  }

  // ── Page background ──
  paintPageBg()

  // ── Header ──
  const generated = new Date().toLocaleDateString('en-US', { dateStyle: 'long' })
  if (template.headerStyle === 'minimal') {
    y = M + 4
    try {
      doc.addImage(EBEXTA_LOGO_HORIZONTAL_LIGHT, 'PNG', left, y - 2, 33, 4.8)
    } catch {
      doc.setFont(template.font, 'bold')
      doc.setFontSize(9)
      setText(c.muted)
      doc.text('EBEXTA™ INTELLIGENCE DOSSIER', left, y)
    }
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8.5)
    setText(c.muted)
    doc.text(generated, PAGE_W - M, y, { align: 'right' })
    y += 8
    doc.setFontSize(22)
    setText(c.heading)
    doc.text(lead.company_name, left, y)
    y += 6
    setDraw(c.heading)
    doc.setLineWidth(0.8)
    doc.line(left, y, left + contentW, y)
    y += 8
  } else {
    const bandH = template.headerStyle === 'split' ? 34 : 40
    setFill(c.band)
    doc.rect(0, 0, PAGE_W, bandH, 'F')
    if (template.headerStyle === 'split') {
      setFill(c.pageBg ?? [255, 255, 255])
      doc.rect(0, bandH, PAGE_W, 2, 'F')
      setFill(c.accent)
      doc.rect(0, bandH, 70, 2, 'F')
    }
    try {
      doc.addImage(EBEXTA_LOGO_HORIZONTAL_DARK, 'PNG', left, 7, 33, 4.8)
    } catch {
      doc.setFont(template.font, 'bold')
      doc.setFontSize(8.5)
      setText(c.bandText)
      doc.text('EBEXTA™ INTELLIGENCE DOSSIER', left, 12)
    }
    doc.setFont(template.font, 'normal')
    doc.setFontSize(8.5)
    setText(c.bandText)
    doc.text(generated, PAGE_W - M, 12, { align: 'right' })
    doc.setFontSize(21)
    doc.text(lead.company_name, left, bandH / 2 + 7)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(9)
    doc.text(
      `${lead.industry ?? ''} · ${lead.location ?? ''} · ${lead.funding_stage ?? ''}`.slice(0, 110),
      left, bandH / 2 + 14
    )
    y = bandH + 12
  }

  // ── Scores row (3 cards) ──
  const scores: Array<[string, string]> = [
    ['INTENT SCORE', `${lead.intent_score ?? 0}%`],
    ['MATCH SCORE', `${lead.match_score ?? 0}%`],
    ['CONFIDENCE', `${lead.confidence_score ?? 0}%`],
  ]
  const cardW = (contentW - 8) / 3
  scores.forEach(([lab, val], i) => {
    const x = left + i * (cardW + 4)
    setFill(c.cardBg)
    doc.roundedRect(x, y, cardW, 18, 1.5, 1.5, 'F')
    doc.setFont(template.font, 'bold')
    doc.setFontSize(15)
    setText(c.accent)
    doc.text(val, x + cardW / 2, y + 9, { align: 'center' })
    doc.setFontSize(7)
    setText(c.muted)
    doc.text(lab, x + cardW / 2, y + 14.5, { align: 'center' })
  })
  y += 26

  // ── Company profile ──
  sectionTitle('Company Profile')
  labelValue('Industry', lead.industry ?? 'N/A')
  labelValue('Location', lead.location ?? 'N/A')
  labelValue('Stage', lead.funding_stage ?? 'N/A')
  labelValue('Employees', lead.employee_count?.toLocaleString() ?? 'N/A')
  labelValue('Revenue', lead.annual_revenue ?? lead.turnover ?? 'Unknown')
  labelValue('Website', lead.website || 'N/A')
  labelValue('LinkedIn', lead.linkedin_url || lead.company_linkedin || 'N/A')
  labelValue('Verification', (lead.verification_status ?? '').replace(/_/g, ' ') || 'N/A')
  if (lead.description) {
    y += 1
    bodyLine(lead.description)
  }

  // ── Why this match ──
  const why: string[] = lead.match_reason ?? lead.business_impact?.match_reasons ?? []
  if (why.length > 0 || lead.strongly_recommended) {
    sectionTitle('Why This Match')
    if (lead.strongly_recommended) bullet('Declared Intent Match — actively seeking what you offer')
    why.forEach(r => bullet(r))
  }

  // ── Business impact ──
  if (lead.business_impact) {
    sectionTitle('Business Impact Prediction')
    labelValue('Success Prob.', `${lead.business_impact.success_probability}%`)
    labelValue('Response Prob.', `${lead.business_impact.response_probability}%`)
    labelValue('Decision Time', `${lead.business_impact.estimated_decision_days} days`)
    labelValue('Deal Size', `${lead.business_impact.expected_deal_size_min} – ${lead.business_impact.expected_deal_size_max}`)
  }

  // ── Intent flags + signals ──
  if ((lead.intent_flags ?? []).length > 0) {
    sectionTitle('Intent Flags')
    bodyLine((lead.intent_flags ?? []).join('  ·  '), { bold: true })
  }
  if ((lead.recent_signals ?? []).length > 0) {
    sectionTitle('Recent Signals')
    ;(lead.recent_signals ?? []).forEach(s => bullet(s))
  }

  // ── Funding ──
  if (lead.funding_details || lead.investment_history) {
    sectionTitle('Funding & Investment')
    if (lead.funding_details) labelValue('Latest', lead.funding_details)
    if (lead.investment_history) labelValue('History', lead.investment_history)
    if (lead.funding_source_url) labelValue('Source', lead.funding_source_url)
  }

  // ── Key contacts ──
  const contacts = lead.stakeholders ?? []
  if (contacts.length > 0) {
    sectionTitle('Key Contacts')
    contacts.forEach((s, i) => {
      ensure(11)
      doc.setFont(template.font, 'bold')
      doc.setFontSize(10)
      setText(c.heading)
      doc.text(`${i + 1}. ${s.name}`, left, y)
      y += 4.6
      bodyLine(
        `${s.title}${s.email ? ` · ${s.email}` : ''}${i === 0 ? '  (primary contact)' : ''}`,
        { muted: true, indent: 5 }
      )
      y += 1
    })
  }

  // ── Source + disclaimer ──
  sectionTitle('Source & Integrity')
  labelValue('Evidence', lead.evidence_source_url || 'EBEXTA Engine inferred — verify independently')
  labelValue('Trust Score', `${lead.trust_score ?? 0} / 100`)
  y += 3
  bodyLine('EBEXTA Engine intelligence. Verify key details before outreach.', { muted: true, size: 8.5 })

  // ── Footer on every page ──
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    doc.setFont(template.font, 'normal')
    doc.setFontSize(7.5)
    setText(c.muted)
    doc.text('EBEXTA™ Verified B2B Intelligence · Confidential Intelligence Dossier · All Rights Reserved', M, PAGE_H - 8)
    doc.text(`Page ${p} of ${pages}`, PAGE_W - M, PAGE_H - 8, { align: 'right' })
  }

  doc.save(`EBEXTA_Dossier_${lead.company_name.replace(/\s+/g, '_')}.pdf`)

  void logSystemEvent({
    eventType: 'export',
    message: `Dossier PDF — ${lead.company_name} (${template.name})`,
    metadata: { template: template.id, leadId: lead.id },
  })
}
