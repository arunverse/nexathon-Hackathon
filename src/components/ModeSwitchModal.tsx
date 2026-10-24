/**
 * ModeSwitchModal — when the user flips Seeker ⇄ Provider, EBEXTA asks the
 * main default questions for the new mode. Answers are pre-filled from the
 * profile: the user can edit, or just click OK → Next through each step.
 * The final step saves everything and launches a fresh scan so the leads
 * actually match the NEW mode (opposite-side matching).
 */

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { sanitizeText, MISSION_MAX } from '../lib/sanitize'

const ROLE_OPTIONS = ['CEO', 'Founder', 'CTO', 'CFO', 'CMO', 'COO', 'VP Sales', 'Head of Procurement', 'Director']
const INDUSTRY_OPTIONS = ['B2B SaaS', 'Fintech', 'Healthcare', 'E-commerce', 'Education', 'Manufacturing', 'Retail', 'Logistics', 'Real Estate', 'Hospitality']

interface ModeSwitchModalProps {
  newMode: 'seeker' | 'provider'
  onClose: () => void
  onConfirmed: () => void
}

// "Others" free-text adder — lets the user contribute a custom option that then
// behaves exactly like a selected chip (flows into the scan filters).
function OtherAdder({ placeholder, onAdd }: { placeholder: string; onAdd: (v: string) => void }) {
  const [v, setV] = useState('')
  const add = () => { const t = v.trim(); if (t) { onAdd(t); setV('') } }
  return (
    <div className="flex gap-1.5 mt-2">
      <input
        value={v}
        onChange={e => setV(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
        placeholder={placeholder}
        className="flex-1 px-3 py-1.5 rounded-xl text-[12px] outline-none"
        style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
      />
      <button onClick={add} className="px-3 py-1.5 rounded-xl text-[12px] font-bold shrink-0"
        style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>Add</button>
    </div>
  )
}

export function ModeSwitchModal({ newMode, onClose, onConfirmed }: ModeSwitchModalProps) {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [saving, setSaving] = useState(false)

  // Answers — pre-filled from last scan filters (lazy init) so "just click OK" works
  const lastFilters = (() => {
    try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { return {} }
  })()
  const [mission, setMission] = useState<string>(lastFilters.mission ?? '')
  const [industries, setIndustries] = useState<string[]>(
    Array.isArray(lastFilters.industries) ? lastFilters.industries : []
  )
  const [roles, setRoles] = useState<string[]>(
    Array.isArray(lastFilters.decisionMakerRoles) && lastFilters.decisionMakerRoles.length > 0
      ? lastFilters.decisionMakerRoles
      : ['CEO', 'Founder']
  )
  const [country] = useState<string>(lastFilters.country ?? 'India')

  // Fall back to the profile mission if filters had none
  useEffect(() => {
    if (!user) return
    supabase.from('profiles').select('mission').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.mission) setMission(prev => prev || data.mission)
      })
  }, [user])

  function toggle(list: string[], set: (v: string[]) => void, value: string) {
    set(list.includes(value) ? list.filter(v => v !== value) : [...list, value])
  }

  async function handleFinish() {
    setSaving(true)
    const cleanMission = sanitizeText(mission, MISSION_MAX)
    // 1. Save mode + mission to profile
    if (user) {
      await supabase.from('profiles').update({ mode: newMode, mission: cleanMission }).eq('id', user.id)
    }
    // 2. Update scan filters for the new mode
    let filters: Record<string, unknown> = {}
    try { filters = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { /* ignore */ }
    filters = {
      ...filters,
      mode: newMode,
      mission: cleanMission,
      industries,
      decisionMakerRoles: roles,
      country,
      excludeCompanies: [],   // fresh slate for the new mode
    }
    localStorage.setItem('ebexta_scan_filters', JSON.stringify(filters))
    window.dispatchEvent(new CustomEvent('ebexta_mode_changed', { detail: { mode: newMode } }))
    window.dispatchEvent(new Event('ebexta_profile_updated'))
    // 3. Invalidate the legacy single-key cache (old-mode leads must never leak).
    //    Per-mode caches (ebexta_leads_seeker / ebexta_leads_provider) stay intact.
    localStorage.removeItem('ebexta_scan_results')
    onConfirmed()
    setSaving(false)
    onClose()
    // 4. Cached scan for THIS mode? Load it. Otherwise run a fresh scan.
    if (localStorage.getItem(`ebexta_leads_${newMode}`)) {
      navigate('/dashboard')
    } else {
      navigate('/scan')
    }
  }

  const modeLabel = newMode === 'provider' ? 'PROVIDER' : 'SEEKER'
  const q1Label = newMode === 'provider'
    ? 'What service do you OFFER? (EBEXTA will find businesses that NEED it, never your competitors)'
    : 'What do you NEED? (EBEXTA will find companies that PROVIDE it)'

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[560px] max-h-[88vh] overflow-y-auto rounded-2xl p-6 custom-scrollbar"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]"
              style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
              swap_horiz
            </span>
            <h2 className="text-[16px] font-bold tracking-tight"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Switching to {modeLabel} mode
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: 'var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
          </button>
        </div>
        <p className="text-[12px] mb-5" style={{ color: 'var(--text-muted)' }}>
          A few quick questions so your new leads match this mode. Edit anything or just click Next.
        </p>

        {/* Step dots */}
        <div className="flex items-center gap-1.5 mb-5">
          {[1, 2, 3].map(s => (
            <div key={s} className="h-1.5 rounded-full flex-1 transition-all"
              style={{ background: step >= s ? 'var(--accent)' : 'var(--border-subtle)' }} />
          ))}
        </div>

        {/* Step 1 — offering / need */}
        {step === 1 && (
          <div>
            <label className="block text-[12px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
              {q1Label}
            </label>
            <textarea
              value={mission}
              /* Capped at the same MISSION_MAX the save path uses — without
                 this, a long description was accepted here and silently
                 truncated on save. */
              onChange={e => setMission(e.target.value.slice(0, MISSION_MAX))}
              rows={5}
              placeholder={newMode === 'provider' ? 'e.g. We design and build websites for small businesses' : 'e.g. We need a payment gateway integration partner'}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-y"
              style={{ background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
            <p className="text-[11px] mt-1.5 text-right mono-val"
              style={{ color: mission.length >= MISSION_MAX * 0.93 ? 'var(--critical)' : 'var(--text-muted)' }}>
              {mission.length} / {MISSION_MAX}
            </p>
          </div>
        )}

        {/* Step 2 — industries + target roles */}
        {step === 2 && (
          <div className="space-y-5">
            <div>
              <label className="block text-[12px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Which industries should EBEXTA {newMode === 'provider' ? 'hunt for demand in' : 'source providers from'}? (optional)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[...INDUSTRY_OPTIONS, ...industries.filter(i => !INDUSTRY_OPTIONS.includes(i))].map(ind => {
                  const on = industries.includes(ind)
                  return (
                    <button key={ind} onClick={() => toggle(industries, setIndustries, ind)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                      style={{
                        background: on ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        border: on ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        color: on ? 'var(--accent-interactive)' : 'var(--text-muted)',
                      }}>
                      {ind}
                    </button>
                  )
                })}
              </div>
              <OtherAdder placeholder="Other industry…" onAdd={v => setIndustries(prev => prev.includes(v) ? prev : [...prev, v])} />
            </div>
            <div>
              <label className="block text-[12px] font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                Who do you want to reach? (EBEXTA finds these roles, or explains who it gave instead & why)
              </label>
              <div className="flex flex-wrap gap-1.5">
                {[...ROLE_OPTIONS, ...roles.filter(r => !ROLE_OPTIONS.includes(r))].map(role => {
                  const on = roles.includes(role)
                  return (
                    <button key={role} onClick={() => toggle(roles, setRoles, role)}
                      className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                      style={{
                        background: on ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                        border: on ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                        color: on ? 'var(--accent-interactive)' : 'var(--text-muted)',
                      }}>
                      {role}
                    </button>
                  )
                })}
              </div>
              <OtherAdder placeholder="Other role…" onAdd={v => setRoles(prev => prev.includes(v) ? prev : [...prev, v])} />
            </div>
          </div>
        )}

        {/* Step 3 — confirm */}
        {step === 3 && (
          <div className="rounded-xl p-4 space-y-3"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <p className="text-[10px] font-bold tracking-[0.08em] uppercase" style={{ color: 'var(--text-muted)' }}>
              Ready to scan in {modeLabel} mode
            </p>
            {[
              [newMode === 'provider' ? 'You offer' : 'You need', mission || 'Not specified'],
              ['Industries', industries.length > 0 ? industries.join(', ') : 'Any'],
              ['Target roles', roles.join(', ') || 'Any decision maker'],
              ['Matching rule', newMode === 'provider'
                ? 'Find businesses that NEED your service: competitors excluded'
                : 'Find companies that PROVIDE what you need: fellow seekers excluded'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3 text-[12.5px]">
                <span className="w-24 shrink-0 font-bold" style={{ color: 'var(--text-muted)' }}>{k}</span>
                <span style={{ color: 'var(--text-primary)' }}>{v}</span>
              </div>
            ))}
          </div>
        )}

        {/* Nav buttons */}
        <div className="flex justify-between mt-6">
          <button
            onClick={() => step === 1 ? onClose() : setStep((step - 1) as 1 | 2)}
            className="px-5 py-2.5 rounded-xl text-[13px] font-medium"
            style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}>
            {step === 1 ? 'Cancel' : '← Back'}
          </button>
          {step < 3 ? (
            <button
              onClick={() => setStep((step + 1) as 2 | 3)}
              disabled={step === 1 && !mission.trim()}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold"
              style={{
                background: (step === 1 && !mission.trim()) ? 'var(--border-subtle)' : 'var(--accent)',
                color: (step === 1 && !mission.trim()) ? 'var(--text-muted)' : 'var(--bg-elevated)',
              }}>
              OK, Next →
            </button>
          ) : (
            <button
              onClick={handleFinish}
              disabled={saving}
              className="px-6 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
              <span className="material-symbols-outlined text-[16px]">radar</span>
              {saving ? 'Saving…' : `Scan as ${modeLabel}`}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  )
}
