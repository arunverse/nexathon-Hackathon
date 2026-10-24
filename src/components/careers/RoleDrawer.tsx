import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { JobRole } from '../../lib/careersData'

interface RoleDrawerProps {
  role: JobRole | null
  onClose: () => void
  onApply: (role: JobRole) => void
}

const EASE = [0.16, 1, 0.3, 1] as const

export function RoleDrawer({ role, onClose, onApply }: RoleDrawerProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (role) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [role, onClose])

  return (
    <AnimatePresence>
      {role && (
        <div className="fixed inset-0 z-[300] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            onClick={onClose}
            className="fixed inset-0"
            style={{
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)'
            }}
          />

          {/* Slide-over Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.35, ease: EASE }}
            className="relative z-10 w-full max-w-[640px] h-full flex flex-col overflow-hidden shadow-2xl"
            style={{
              background: 'var(--bg-base)',
              borderLeft: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              className="p-6 border-b shrink-0 flex items-start justify-between gap-4"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'color-mix(in srgb, var(--bg-surface) 75%, transparent)',
                backdropFilter: 'blur(12px)'
              }}
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                    style={{
                      background: 'var(--accent-subtle)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--accent-interactive)'
                    }}
                  >
                    {role.department}
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    Full-time
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-semibold inline-flex items-center gap-1"
                    style={{
                      background: 'rgba(16,185,129,0.12)',
                      border: '1px solid rgba(16,185,129,0.25)',
                      color: 'var(--success)'
                    }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)]" />
                    Internship Available
                  </span>
                  <span
                    className="px-2 py-0.5 rounded-md text-[11px] font-medium"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-muted)'
                    }}
                  >
                    {role.location}
                  </span>
                </div>
                <h2
                  className="text-[22px] md:text-[26px] font-bold tracking-tight leading-snug"
                  style={{ fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  {role.title}
                </h2>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-secondary)' }}>
                  Experience: <strong style={{ color: 'var(--text-primary)' }}>{role.experience}</strong>
                </p>
              </div>

              <button
                onClick={onClose}
                className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-colors"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
                aria-label="Close details"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>

            {/* Drawer Body Scroll */}
            <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8">
              {/* Overview */}
              <div>
                <h3
                  className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Role Overview
                </h3>
                <p className="text-[14px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {role.overview}
                </p>
              </div>

              {/* Internship & University Welcome Box */}
              <div
                className="p-4 rounded-xl border flex items-start gap-3"
                style={{
                  background: 'linear-gradient(135deg, rgba(37,99,235,0.06), rgba(16,185,129,0.06))',
                  borderColor: 'rgba(37,99,235,0.25)'
                }}
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }}
                >
                  <span className="material-symbols-outlined text-[18px]">school</span>
                </div>
                <div>
                  <h4 className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                    Available for Full-time & Internship Candidates
                  </h4>
                  <p className="text-[12px] leading-relaxed mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    University students, pre-final/final-year undergraduates, and freshers are welcome to apply as interns. We offer dedicated mentorship, flexible semester arrangements, institutional documentation, and full-time conversion opportunities (PPO).
                  </p>
                </div>
              </div>

              {/* What you'll do */}
              <div>
                <h3
                  className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  What You'll Do
                </h3>
                <ul className="space-y-2.5">
                  {role.responsibilities.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13.5px] leading-snug">
                      <span
                        className="material-symbols-outlined text-[15px] shrink-0 mt-0.5"
                        style={{ color: 'var(--accent-interactive)' }}
                      >
                        check_circle
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* What we're looking for */}
              <div>
                <h3
                  className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3"
                  style={{ color: 'var(--text-muted)' }}
                >
                  What We're Looking For
                </h3>
                <ul className="space-y-2.5">
                  {role.requirements.map((item, i) => (
                    <li key={i} className="flex items-start gap-3 text-[13.5px] leading-snug">
                      <span
                        className="material-symbols-outlined text-[15px] shrink-0 mt-0.5"
                        style={{ color: 'var(--success)' }}
                      >
                        task_alt
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Nice to have */}
              {role.niceToHave.length > 0 && (
                <div>
                  <h3
                    className="text-[12px] font-bold uppercase tracking-[0.08em] mb-3"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Nice-to-Have Skills
                  </h3>
                  <ul className="space-y-2.5">
                    {role.niceToHave.map((item, i) => (
                      <li key={i} className="flex items-start gap-3 text-[13.5px] leading-snug">
                        <span
                          className="material-symbols-outlined text-[15px] shrink-0 mt-0.5"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          add_circle_outline
                        </span>
                        <span style={{ color: 'var(--text-muted)' }}>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* What you'll learn */}
              <div
                className="rounded-xl p-5 border"
                style={{
                  background: 'var(--bg-surface)',
                  borderColor: 'var(--border-subtle)'
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--warning)' }}>
                    school
                  </span>
                  <h3 className="text-[13px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    What You'll Learn & Experience
                  </h3>
                </div>
                <ul className="space-y-2">
                  {role.learnings.map((item, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-[13px] leading-snug">
                      <span className="w-1.5 h-1.5 rounded-full mt-2 shrink-0" style={{ background: 'var(--warning)' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Work Arrangement & Skills */}
              <div className="space-y-4 pt-2">
                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] mb-1.5" style={{ color: 'var(--text-muted)' }}>
                    Work Arrangement
                  </h4>
                  <p className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                    {role.workArrangement}
                  </p>
                </div>

                <div>
                  <h4 className="text-[11px] font-bold uppercase tracking-[0.08em] mb-2" style={{ color: 'var(--text-muted)' }}>
                    Key Skills & Technologies
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {role.skills.map(s => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-semibold"
                        style={{
                          background: 'var(--bg-elevated)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Drawer Footer CTA */}
            <div
              className="p-5 border-t shrink-0 flex items-center justify-between gap-4"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'color-mix(in srgb, var(--bg-surface) 90%, transparent)'
              }}
            >
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Ready to apply?
                </p>
                <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                  Fast review · Response within 3 business days
                </p>
              </div>

              <button
                onClick={() => onApply(role)}
                className="px-6 h-11 rounded-xl text-[14px] font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-md"
                style={{
                  background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                  color: 'var(--bg-elevated)'
                }}
              >
                Apply for this Role
                <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
              </button>
            </div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
