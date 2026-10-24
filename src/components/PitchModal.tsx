/**
 * PitchModal — Draft Portfolio export.
 * The document YOUR company presents to the lead (A → B).
 * Step 1: choose one of 5 templates. Step 2: review → Download PDF.
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import type { ScannedLead } from '../lib/scanEngine'
import { type DossierTemplate } from '../lib/dossierPdf'
import { PITCH_TEMPLATES, generatePitchPdf, type PitchProfile } from '../lib/pitchPdf'
import { resolveSenderProfile } from '../lib/senderProfile'
import { logInteractionForCompany } from '../lib/companyMemory'
import { EbextaLogo } from './common/EbextaLogo'
import { checkCredits, consumeCredit } from '../lib/credits'

// Mini page-preview styled as a pitch cover (dark band + accent circle)
function PitchPreview({ t }: { t: DossierTemplate }) {
  return (
    <div className="w-full h-[120px] rounded-lg overflow-hidden relative"
      style={{ background: t.swatch.band, border: '1px solid var(--border-subtle)' }}>
      {/* Accent circle top-right */}
      <div className="absolute -right-4 -top-4 w-16 h-16 rounded-full" style={{ background: t.swatch.accent, opacity: 0.9 }} />
      <div className="absolute right-1 top-3 w-6 h-6 rounded-full" style={{ background: t.swatch.bg }} />
      {/* Title lines */}
      <div className="absolute left-3 top-9 space-y-1.5 w-[60%]">
        <div className="h-[3px] w-[45%] rounded-sm" style={{ background: t.swatch.accent }} />
        <div className="h-[7px] w-[90%] rounded-sm" style={{ background: '#FFFFFF', opacity: 0.92 }} />
        <div className="h-[5px] w-[70%] rounded-sm" style={{ background: '#FFFFFF', opacity: 0.6 }} />
      </div>
      {/* Bottom accent bar */}
      <div className="absolute left-0 right-0 bottom-6 h-[3px]" style={{ background: t.swatch.accent }} />
      <div className="absolute left-3 bottom-2 h-[3px] w-[30%] rounded-sm" style={{ background: '#FFFFFF', opacity: 0.4 }} />
    </div>
  )
}

export function PitchModal({ lead, onClose }: { lead: ScannedLead; onClose: () => void }) {
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2>(1)
  const [selected, setSelected] = useState<DossierTemplate | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [profile, setProfile] = useState<PitchProfile>(() => {
    // Start from onboarding data (localStorage) so the real company name shows
    // immediately, even before Supabase responds.
    const s = resolveSenderProfile(null)
    return { companyName: s.companyName, mission: s.mission, email: s.email || (user?.email ?? '') }
  })

  useEffect(() => {
    if (!user) return
    // setState happens in the promise callback (external system), not sync in the effect
    supabase.from('profiles').select('company_name, mission, sender_email').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        // Merge Supabase profile with onboarding fallback — never fall back to
        // "Your Company" if the user actually entered a name.
        const s = resolveSenderProfile(data)
        setProfile({ companyName: s.companyName, mission: s.mission, email: s.email || (user?.email ?? '') })
      })
  }, [user])

  async function handleDownload() {
    if (!selected || downloading) return
    const gate = await checkCredits('portfolio')
    if (!gate.allowed) {
      alert(gate.reason || 'Credit limit reached. Please top up or upgrade to generate portfolios.')
      return
    }
    setDownloading(true)
    try {
      await consumeCredit('portfolio', { note: `Portfolio generated: ${selected.name} for ${lead.company_name}` })
      // Generates a tailored analysis via Gemini first (~10-20s), then the designed PDF
      await generatePitchPdf(lead, profile, selected)
      // Record it in Company Memory — a proposal is a real interaction and a
      // dated event on the company's trust history. Fire-and-forget.
      void logInteractionForCompany(lead, {
        interactionType: 'proposal_sent',
        subject: `Portfolio: ${selected.name}`,
        bodyPreview: profile.mission || null,
        contactName: (lead.stakeholders ?? [])[0]?.name ?? null,
      })
      onClose()
    } catch (err) {
      console.error('[EBEXTA] Portfolio generation failed:', err)
    } finally {
      setDownloading(false)
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
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]"
              style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
              work
            </span>
            <h2 className="text-[17px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Draft Portfolio: {profile.companyName} → {lead.company_name}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <EbextaLogo variant="horizontal" size={20} />
            <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
              style={{ background: 'var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>
        </div>
        <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
          The presentation document you take to {lead.company_name}: your company, their signals, the deal.
        </p>

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
            <div className="grid grid-cols-3 gap-3 mb-5">
              {PITCH_TEMPLATES.map(t => {
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
                    <PitchPreview t={t} />
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
            <div className="grid grid-cols-[280px_1fr] gap-5 mb-5">
              <div>
                {selected && <PitchPreview t={selected} />}
                <p className="text-[13px] font-bold mt-2.5" style={{ color: 'var(--text-primary)' }}>{selected?.name}</p>
                <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{selected?.description}</p>
              </div>
              <div className="rounded-xl p-4"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                <p className="text-[10px] font-bold tracking-[0.08em] uppercase mb-3" style={{ color: 'var(--text-muted)' }}>
                  Inside your portfolio
                </p>
                {[
                  `Designed cover: ${profile.companyName} × ${lead.company_name}`,
                  `Who we are: your mission, in their language`,
                  `Why ${lead.company_name}: their signals prove you did the homework`,
                  'What you bring to the table: value proposition',
                  lead.business_impact ? 'The opportunity in numbers: fit, deal range, decision window' : 'Suggested engagement scope',
                  'Suggested next steps + your contact block',
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
                {downloading ? 'Writing your tailored analysis…' : 'Download Portfolio PDF'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body
  )
}
