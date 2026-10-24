/**
 * HelpButton — a small, persistent "?" in the bottom-left corner that opens a
 * gentle help menu: replay the product tour, quick guides, and contact support.
 * Never intrusive; sits opposite the toast stack (bottom-right).
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'

const GUIDES = {
  scans: {
    title: 'How scans work',
    body: 'Pick your mode (Seeker if you need a service, or Provider if you offer one), then run a scan. EBEXTA searches live sources, scores every company on intent, match and confidence, verifies the links, and returns your matched companies in a few minutes. You only ever see the opposite side, never competitors.',
  },
  verify: {
    title: 'What verification means',
    body: "Each opportunity shows how much we could confirm. “Verified by EBEXTA” means our team cross-referenced and validated the contact against genuine public sources and official registries.",
  },
} as const

export function HelpButton({ onStartTour }: { onStartTour?: () => void }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [guide, setGuide] = useState<keyof typeof GUIDES | null>(null)

  function startTour() {
    setOpen(false)
    if (onStartTour) onStartTour()
    else {
      try { localStorage.setItem('ebexta_replay_tour', '1') } catch { /* ignore */ }
      navigate('/dashboard')
    }
  }

  const item = 'w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-[13px] font-medium text-left transition-colors'

  return createPortal(
    <>
      {/* The sidebar is a fixed 240px column, so `left-5` put this button —
          and its 220px panel — directly on top of the credit meter and user
          strip. Clear the sidebar on md+; stay bottom-left on mobile where the
          sidebar is a drawer. */}
      <div className="fixed z-[300] bottom-5 left-5 md:left-[264px] flex flex-col items-start gap-2">
        {open && (
          <div className="rounded-2xl p-1.5 w-[220px] animate-[toastIn_0.18s_ease]"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)', fontFamily: 'Geist, Inter, sans-serif' }}>
            <button className={item} style={{ color: 'var(--accent-interactive)' }} onClick={startTour}>
              <span className="material-symbols-outlined text-[18px]">tour</span> Take the tour
            </button>
            <button className={item} style={{ color: 'var(--text-secondary)' }} onClick={() => { setGuide('scans'); setOpen(false) }}>
              <span className="material-symbols-outlined text-[18px]">radar</span> How scans work
            </button>
            <button className={item} style={{ color: 'var(--text-secondary)' }} onClick={() => { setGuide('verify'); setOpen(false) }}>
              <span className="material-symbols-outlined text-[18px]">verified</span> What verification means
            </button>
            <a className={item} style={{ color: 'var(--text-secondary)' }} href="mailto:support@ebexta.com" onClick={() => setOpen(false)}>
              <span className="material-symbols-outlined text-[18px]">mail</span> Contact support
            </a>
          </div>
        )}
        <button onClick={() => setOpen(o => !o)} aria-label="Help"
          className="w-11 h-11 rounded-full flex items-center justify-center transition-transform hover:scale-105"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)' }}>
          <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--accent-interactive)' }}>{open ? 'close' : 'help'}</span>
        </button>
      </div>

      {guide && (
        <div className="fixed inset-0 z-[330] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
          onClick={e => { if (e.target === e.currentTarget) setGuide(null) }}>
          <div className="w-full max-w-[440px] rounded-2xl p-6" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)', fontFamily: 'Geist, Inter, sans-serif' }}>
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)' }}>{GUIDES[guide].title}</h2>
              <button onClick={() => setGuide(null)} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
              </button>
            </div>
            <p className="text-[13.5px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{GUIDES[guide].body}</p>
            <div className="flex justify-end mt-5">
              <button onClick={() => setGuide(null)} className="px-5 py-2.5 rounded-xl text-[13px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>Got it</button>
            </div>
          </div>
        </div>
      )}
    </>,
    document.body,
  )
}
