/**
 * CompanyProfilePrompt — Gentle prompt after 5-10 minutes of active session usage
 * asking users to fill in their company details if their profile is incomplete.
 *
 * Includes:
 * - "Fill Details Now" → navigates to /settings
 * - "Remind Me Later" / "Later" → snoozes for 24 hours
 *
 * Missing status is also reflected in the Admin Users view.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, ArrowRight, Clock, Sparkles } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'

const SNOOZE_KEY = 'ebexta_cp_prompt_snoozed'
const SESSION_START_KEY = 'ebexta_session_start_ts'
const PROMPT_DELAY_MS = 5 * 60 * 1000 // 5 minutes

export function CompanyProfilePrompt() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [show, setShow] = useState(false)
  const [missingFields, setMissingFields] = useState<string[]>([])

  const checkCompleteness = useCallback(async () => {
    if (!user) return
    // Don't interrupt if user is already on the settings page
    if (location.pathname === '/settings') {
      setShow(false)
      return
    }

    // Check if snoozed in the last 24h
    try {
      const snoozedAt = localStorage.getItem(SNOOZE_KEY)
      if (snoozedAt) {
        const timeDiff = Date.now() - parseInt(snoozedAt, 10)
        if (timeDiff < 24 * 60 * 60 * 1000) {
          return // still snoozed
        }
      }
    } catch { /* ignore */ }

    // Check session start time
    try {
      let start = sessionStorage.getItem(SESSION_START_KEY)
      if (!start) {
        start = String(Date.now())
        sessionStorage.setItem(SESSION_START_KEY, start)
      }
      const elapsed = Date.now() - parseInt(start, 10)
      if (elapsed < PROMPT_DELAY_MS) {
        return // wait until 5 minutes of usage
      }
    } catch { /* ignore */ }

    // Fetch user profile
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('company_name, mission, company_profile')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) return

      const cp = (profile.company_profile as Record<string, string>) || {}
      const missing: string[] = []

      if (!profile.company_name || profile.company_name.trim() === '' || profile.company_name === 'Your Company') {
        missing.push('Company name')
      }
      if (!profile.mission || profile.mission.trim() === '') {
        missing.push('Mission & offering')
      }
      if (!cp.location || cp.location.trim() === '') {
        missing.push('Location')
      }
      if (!cp.employees || cp.employees.trim() === '') {
        missing.push('Headcount')
      }
      if (!cp.stage || cp.stage.trim() === '') {
        missing.push('Stage')
      }

      if (missing.length > 0) {
        setMissingFields(missing)
        setShow(true)
      } else {
        setShow(false)
      }
    } catch (err) {
      console.error('[EBEXTA] checkCompleteness error:', err)
    }
  }, [user, location.pathname])

  useEffect(() => {
    // Initial check
    void checkCompleteness()

    // Re-check periodically every 30s as session time elapses
    const interval = setInterval(() => {
      void checkCompleteness()
    }, 30000)

    return () => clearInterval(interval)
  }, [checkCompleteness])

  function handleLater() {
    try {
      localStorage.setItem(SNOOZE_KEY, String(Date.now()))
    } catch { /* ignore */ }
    setShow(false)
  }

  function handleCompleteNow() {
    setShow(false)
    navigate('/settings')
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-6 right-6 z-[450] max-w-[420px] w-[calc(100vw-32px)] p-5 rounded-2xl shadow-2xl overflow-hidden"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 24px 48px -12px rgba(0,0,0,0.5)',
          }}
        >
          {/* Top accent glow */}
          <div
            className="absolute top-0 left-0 right-0 h-1"
            style={{ background: 'linear-gradient(90deg, var(--accent), var(--accent-interactive))' }}
          />

          <div className="flex items-start gap-3.5 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(245, 158, 11, 0.12)', color: 'var(--warning)' }}
            >
              <Building2 size={20} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <h3
                  className="text-[14.5px] font-bold tracking-tight"
                  style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  Complete Your Company Profile
                </h3>
                <Sparkles size={14} className="text-amber-500 shrink-0" />
              </div>
              <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                You've been active on EBEXTA for 5+ minutes. Completing your profile unlocks verified member dossiers and enables AI intent matching to accurately represent your business.
              </p>
            </div>
          </div>

          {missingFields.length > 0 && (
            <div
              className="mb-4 px-3 py-2 rounded-xl text-[11.5px] flex items-center gap-1.5 flex-wrap"
              style={{ background: 'rgba(245, 158, 11, 0.07)', border: '1px solid rgba(245, 158, 11, 0.2)' }}
            >
              <span className="font-semibold" style={{ color: 'var(--warning)' }}>
                Missing details:
              </span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {missingFields.slice(0, 3).join(', ')}{missingFields.length > 3 ? ` +${missingFields.length - 3} more` : ''}
              </span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5">
            <button
              onClick={handleLater}
              className="px-3.5 py-2 rounded-xl text-[12px] font-semibold flex items-center gap-1 transition-colors"
              style={{
                background: 'var(--bg-surface)',
                color: 'var(--text-muted)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <Clock size={13} />
              Remind me later
            </button>
            <button
              onClick={handleCompleteNow}
              className="px-4 py-2 rounded-xl text-[12.5px] font-bold flex items-center gap-1.5 transition-all hover:brightness-110 active:scale-95"
              style={{
                background: 'var(--accent)',
                color: 'var(--bg-elevated)',
              }}
            >
              <span>Fill Details Now</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
