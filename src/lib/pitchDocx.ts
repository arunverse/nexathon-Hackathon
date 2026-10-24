/**
 * EBEXTA Pitch Portfolio — Word (.docx) export.
 * The document YOUR company (Company A) takes to the lead (Company B).
 * Reuses the same Gemini-generated tailored analysis as the PDF version, and
 * the same 5 template palettes, but renders a fully editable Word document.
 */

import {
  Document, Packer, Paragraph, TextRun,
  Table, TableRow, TableCell, WidthType, BorderStyle, ShadingType, PageBreak,
} from 'docx'
import type { ScannedLead } from './scanEngine'
import type { DossierTemplate } from './dossierPdf'
import { generateRichContent, type PitchProfile } from './pitchPdf'
import { logSystemEvent } from './adminLog'

// RGB [r,g,b] → "RRGGBB" hex (no #), docx-friendly
const hex = (rgb: [number, number, number]) =>
  rgb.map(v => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')

const FULL = { size: 100, type: WidthType.PERCENTAGE } as const

export async function generatePitchDocx(
  lead: ScannedLead,
  profile: PitchProfile,
  template: DossierTemplate,
): Promise<void> {
  const content = await generateRichContent(lead, profile)
  const c = template.colors
  const accent = hex(c.accent)
  const heading = hex(c.heading)
  const muted = hex(c.muted)
  const cardBg = hex(c.cardBg)
  const font = template.font === 'times' ? 'Georgia' : template.font === 'courier' ? 'Consolas' : 'Calibri'
  const company = profile.companyName || 'Your Company'

  const children: Array<Paragraph | Table> = []

  const spacer = (after = 120) => new Paragraph({ spacing: { after }, children: [] })

  function sectionHeader(num: number, title: string) {
    children.push(
      new Paragraph({
        spacing: { before: 280, after: 120 },
        border: { bottom: { color: accent, style: BorderStyle.SINGLE, size: 8, space: 4 } },
        children: [
          new TextRun({ text: `${num}. `, bold: true, color: accent, size: 26, font }),
          new TextRun({ text: title, bold: true, color: heading, size: 26, font }),
        ],
      }),
    )
  }

  function para(text: string, opts: { muted?: boolean; bold?: boolean; italics?: boolean; size?: number } = {}) {
    children.push(
      new Paragraph({
        spacing: { after: 120 },
        children: [
          new TextRun({
            text,
            color: opts.muted ? muted : '222222',
            bold: opts.bold,
            italics: opts.italics,
            size: opts.size ?? 21,
            font,
          }),
        ],
      }),
    )
  }

  function bullet(text: string, bold = false) {
    children.push(
      new Paragraph({
        bullet: { level: 0 },
        spacing: { after: 80 },
        children: [new TextRun({ text, bold, color: bold ? heading : '222222', size: 21, font })],
      }),
    )
  }

  // Two-column shaded table used for stat cards / mini charts-as-tables
  function shadedRow(label: string, value: string, valueColor = accent) {
    return new TableRow({
      children: [
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: cardBg, color: 'auto' },
          width: { size: 60, type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: label, size: 19, color: '333333', font })] })],
        }),
        new TableCell({
          shading: { type: ShadingType.CLEAR, fill: cardBg, color: 'auto' },
          width: { size: 40, type: WidthType.PERCENTAGE },
          margins: { top: 60, bottom: 60, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: value, bold: true, size: 20, color: valueColor, font })] })],
        }),
      ],
    })
  }

  function tableFrom(rows: TableRow[]) {
    children.push(
      new Table({
        width: FULL,
        borders: {
          top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
          insideVertical: { style: BorderStyle.SINGLE, size: 4, color: 'FFFFFF' },
        },
        rows,
      }),
    )
    children.push(spacer(160))
  }

  // ── COVER ──────────────────────────────────────────────────────────────────
  children.push(
    new Paragraph({ spacing: { before: 1400, after: 80 }, children: [
      new TextRun({ text: 'PARTNERSHIP PROPOSAL', bold: true, color: accent, size: 22, font }),
    ] }),
    new Paragraph({ spacing: { after: 240 }, children: [
      new TextRun({ text: `Prepared exclusively for ${lead.company_name}`, color: muted, size: 20, font }),
    ] }),
    new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: company, bold: true, color: heading, size: 64, font }),
    ] }),
    new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: '×', bold: true, color: accent, size: 40, font }),
    ] }),
    new Paragraph({ spacing: { after: 280 }, children: [
      new TextRun({ text: lead.company_name, bold: true, color: heading, size: 48, font }),
    ] }),
    new Paragraph({ spacing: { after: 120 }, children: [
      new TextRun({ text: `A tailored proposal for ${lead.company_name} — prepared by ${company}.`, color: '333333', size: 22, font }),
    ] }),
    new Paragraph({ spacing: { after: 40 }, children: [
      new TextRun({ text: new Date().toLocaleDateString('en-US', { dateStyle: 'long' }), color: accent, size: 18, font }),
    ] }),
    new Paragraph({ children: [
      new TextRun({ text: profile.email || '', color: muted, size: 18, font }),
    ] }),
    new Paragraph({ children: [new PageBreak()] }),
  )

  // 1 — Executive Summary
  sectionHeader(1, 'Executive Summary')
  para(content.executiveSummary)
  para(`Prepared by ${company}${profile.mission ? ' · ' + profile.mission : ''}`, { muted: true, size: 18 })

  // 2 — Why Us × Why Now
  sectionHeader(2, 'Why Us × Why Now')
  content.whyUsWhyNow.forEach(p => bullet(p, true))
  if (lead.description) para(`About ${lead.company_name}: ${lead.description}`, { muted: true, size: 18 })

  // 3 — Needs → Solutions
  sectionHeader(3, 'Your Strategic Needs → Our Solutions')
  content.needsSolutions.forEach((pair, i) => {
    children.push(new Paragraph({ spacing: { before: 120, after: 20 }, children: [
      new TextRun({ text: `${i + 1}. NEED: ${pair.need}`, bold: true, color: heading, size: 20, font }),
    ] }))
    children.push(new Paragraph({ spacing: { after: 100 }, children: [
      new TextRun({ text: `→ ${pair.solution}`, color: accent, size: 20, font }),
    ] }))
  })

  // 4 — The Numbers That Matter
  sectionHeader(4, 'The Numbers That Matter')
  if (lead.business_impact) {
    tableFrom([
      shadedRow('Fit / Success probability', `${lead.business_impact.success_probability}%`),
      shadedRow('Expected deal range', `${lead.business_impact.expected_deal_size_min} – ${lead.business_impact.expected_deal_size_max}`),
      shadedRow('Decision window', `${lead.business_impact.estimated_decision_days} days`),
    ])
  }
  // ROI curve as a monthly table
  para('Projected ROI curve — 12 months (relative index)', { bold: true, size: 18 })
  tableFrom(
    content.roiCurve.slice(0, 12).map((v, i) => shadedRow(`Month ${i + 1}`, `${Math.round(v)}`)),
  )
  // Cost of inaction
  para('Cost of inaction vs working with us (relative index)', { bold: true, size: 18 })
  tableFrom([
    shadedRow('Without action', String(Math.round(content.costOfInaction.withoutUs)), 'C43C3C'),
    shadedRow(`With ${company}`, String(Math.round(content.costOfInaction.withUs)), '2D8C5A'),
  ])
  // Timeline
  para(`Implementation timeline — ${content.timelinePhases.reduce((s, p) => s + Math.max(1, p.weeks), 0)} weeks`, { bold: true, size: 18 })
  tableFrom(content.timelinePhases.map(p => shadedRow(p.name, `${Math.max(1, p.weeks)} weeks`)))
  para('Projections are estimates from EBEXTA market intelligence + our delivery history — refined together in our first conversation.', { muted: true, size: 16, italics: true })

  // 5 — Future scope
  sectionHeader(5, 'Where This Partnership Goes — Year 1 to 3')
  content.futureScope.forEach(f => {
    children.push(new Paragraph({ spacing: { before: 100, after: 20 }, children: [
      new TextRun({ text: f.year, bold: true, color: accent, size: 21, font }),
    ] }))
    para(f.description, { size: 19 })
  })

  // 6 — Case studies
  sectionHeader(6, 'Proof — Case Studies')
  content.caseStudies.forEach(cs => {
    children.push(new Paragraph({ spacing: { before: 100, after: 20 }, children: [
      new TextRun({ text: cs.title, bold: true, color: heading, size: 20, font }),
    ] }))
    para(cs.outcome, { muted: true, size: 18 })
  })

  // 7 — Engagement models
  sectionHeader(7, 'How We Can Work Together')
  tableFrom(content.engagementModels.map(m => shadedRow(m.name, m.description, '333333')))

  // 8 — Next steps
  sectionHeader(8, 'Suggested Next Steps')
  bullet('A 30-minute intro call — we walk through this document and answer everything', true)
  bullet('We deliver a scoped, priced proposal within one week of that call', true)
  bullet('You decide with full clarity — no pressure, no lock-in', true)
  children.push(new Paragraph({ spacing: { before: 200, after: 20 }, children: [
    new TextRun({ text: `Let's talk — ${company}`, bold: true, color: heading, size: 24, font }),
  ] }))
  children.push(new Paragraph({ children: [
    new TextRun({ text: profile.email || '', color: accent, size: 20, font }),
  ] }))

  const doc = new Document({
    creator: company,
    title: `Partnership Proposal — ${company} to ${lead.company_name}`,
    styles: { default: { document: { run: { font } } } },
    sections: [{
      properties: {},
      footers: undefined,
      children,
    }],
  })

  const blob = await Packer.toBlob(doc)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `Pitch_${company.replace(/\s+/g, '_')}_to_${lead.company_name.replace(/\s+/g, '_')}.docx`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)

  void logSystemEvent({
    eventType: 'export',
    message: `Pitch portfolio DOCX — ${company} → ${lead.company_name} (${template.name})`,
    metadata: { template: template.id, leadId: lead.id, format: 'docx' },
  })
}
