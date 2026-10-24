/**
 * DossierModal — interactive PDF export flow.
 * Step 1: pick one of 5 templates (live mini-previews).
 * Step 2: confirm summary → Download PDF.
 * Rendered via portal to <body> (escapes transformed ancestors).
 */

import { useState } from 'react'
import { createPortal } from 'react-dom'
import type { ScannedLead } from '../lib/scanEngine'
import { DOSSIER_TEMPLATES, generateDossierPdf, type DossierTemplate } from '../lib/dossierPdf'
import { EbextaLogo } from './common/EbextaLogo'
import { checkCredits, consumeCredit } from '../lib/credits'

// CSS mini-preview of a template (fake page thumbnail)
function TemplatePreview({ t }: { t: DossierTemplate }) {
  const isSidebar = t.headerStyle === 'sidebar'
  const isMinimal = t.headerStyle === 'minimal'
  return (
    <div
      className="w-full h-[120px] rounded-lg overflow-hidden relative"
      style={{ background: t.swatch.bg, border: '1px solid var(--border-subtle)' }}
    >
      {/* Sidebar stripe */}
      {isSidebar && <div className="absolute left-0 top-0 bottom-0 w-[6px]" style={{ background: t.swatch.band }} />}
      {/* Header band */}
      {!isMinimal ? (
        <div className="h-[30px] flex items-end px-3 pb-1.5" style={{ background: t.swatch.band }}>
          <div className="h-[7px] w-[60%] rounded-sm" style={{ background: t.swatch.bg, opacity: 0.9 }} />
        </div>
      ) : (
        <div className="px-3 pt-3">
          <div className="h-[8px] w-[55%] rounded-sm mb-1.5" style={{ background: t.swatch.text }} />
          <div className="h-[2px] w-full" style={{ background: t.swatch.text }} />
        </div>
      )}
      {/* Score cards */}
      <div className="flex gap-1.5 px-3 mt-2">
        {[0, 1, 2].map(i => (
          <div key={i} className="flex-1 h-[18px] rounded-sm flex items-center justify-center"
            style={{ background: t.id === 'noir' ? '#21242C' : 'rgba(0,0,0,0.06)' }}>
            <div className="h-[5px] w-[60%] rounded-sm" style={{ background: t.swatch.accent }} />
          </div>
        ))}
      </div>
      {/* Text lines */}
      <div className="px-3 mt-2 space-y-1">
        <div className="h-[3px] w-[35%] rounded-sm" style={{ background: t.swatch.accent }} />
        {[90, 75, 82].map((w, i) => (
          <div key={i} className="h-[3px] rounded-sm" style={{ width: `${w}%`, background: t.swatch.text, opacity: 0.25 }} />
        ))}
      </div>
    </div>
  )
}

export function DossierModal({ lead, onClose }: { lead: ScannedLead; onClose: () => void }) {
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<DossierTemplate | null>(null)
  const [downloading, setDownloading] = useState(false)

  async function handleDownload() {
    if (!selected || downloading) return
    const gate = await checkCredits('dossier')
    if (!gate.allowed) {
      alert(gate.reason || 'You have used all available dossier credits. Please upgrade or top up to continue.')
      return
    }
    setDownloading(true)
    try {
      await consumeCredit('dossier', { note: `Dossier generated: ${lead.company_name}` })
      generateDossierPdf(lead, selected)
    } finally {
      setDownloading(false)
      onClose()
    }
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[860px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 custom-scrollbar"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-lg)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]"
              style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
              picture_as_pdf
            </span>
            <h2 className="text-[17px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Export Dossier: {lead.company_name}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <EbextaLogo variant="horizontal" size={20} />
            <button onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-5">
          {[1, 2].map(s => (
            <div key={s} className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: step >= s ? 'var(--accent)' : 'var(--border-subtle)',
                  color: step >= s ? 'var(--bg-elevated)' : 'var(--text-muted)',
                }}>
                {s}
              </div>
              <span className="text-[11px] font-semibold"
                style={{ color: step >= s ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {s === 1 ? 'Choose template' : 'Review & download'}
              </span>
              {s === 1 && <div className="w-8 h-px mx-1" style={{ background: 'var(--border-subtle)' }} />}
            </div>
          ))}
        </div>

        {step === 1 ? (
          <>
            {/* Template grid */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {DOSSIER_TEMPLATES.map(t => {
                const isSel = selected?.id === t.id
                return (
                  <button
                    key={t.id}
                    onClick={() => setSelected(t)}
                    className="text-left rounded-xl p-3 transition-all"
                    style={{
                      background: isSel ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                      border: isSel ? '2px solid var(--accent)' : '1px solid var(--border-subtle)',
                    }}
                  >
                    <TemplatePreview t={t} />
                    <div className="flex items-center gap-1.5 mt-2.5 mb-0.5">
                      <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                      {isSel && (
                        <span className="material-symbols-outlined text-[14px]"
                          style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                          check_circle
                        </span>
                      )}
                    </div>
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{t.description}</p>
                  </button>
                )
              })}
            </div>

            {/* Next */}
            <div className="flex justify-end gap-2">
              <button onClick={onClose}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                Cancel
              </button>
              <button
                onClick={() => selected && setStep(2)}
                disabled={!selected}
                className="px-6 py-2.5 rounded-xl text-[13px] font-bold transition-all"
                style={{
                  background: selected ? 'var(--accent)' : 'var(--border-subtle)',
                  color: selected ? 'var(--bg-elevated)' : 'var(--text-muted)',
                  cursor: selected ? 'pointer' : 'not-allowed',
                }}>
                Next →
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Step 2 — review */}
            <div className="grid grid-cols-[280px_1fr] gap-5 mb-5">
              <div>
                {selected && <TemplatePreview t={selected} />}
                <p className="text-[13px] font-bold mt-2.5" style={{ color: 'var(--text-primary)' }}>{selected?.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selected?.description}</p>
              </div>
              <div className="rounded-xl p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                  What's included
                </p>
                {[
                  `Company profile: ${lead.industry ?? 'N/A'} · ${lead.location ?? 'N/A'}`,
                  `Scores: Intent ${lead.intent_score}% · Match ${lead.match_score}% · Confidence ${lead.confidence_score}%`,
                  `${(lead.stakeholders ?? []).length} key contact${(lead.stakeholders ?? []).length !== 1 ? 's' : ''}`,
                  `${(lead.recent_signals ?? []).length} recent signal${(lead.recent_signals ?? []).length !== 1 ? 's' : ''} + intent flags`,
                  lead.business_impact ? 'Business impact prediction + deal size' : 'Source & integrity summary',
                  'Source links & AI-verification disclaimer',
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-2 mb-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5"
                      style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                      check_circle
                    </span>
                    <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex justify-between">
              <button onClick={() => setStep(1)}
                className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
                ← Back to templates
              </button>
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="px-6 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2"
                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                <span className="material-symbols-outlined text-[16px]">download</span>
                {downloading ? 'Generating…' : 'Download PDF'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
