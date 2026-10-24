/**
 * /admin/queue — Verification Queue.
 * Review, action, and deliver verification requests. Live Supabase data.
 */

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { logSystemEvent } from '../../lib/adminLog'
import { sanitizeText, sanitizeUrl } from '../../lib/sanitize'
import { PageHeader, Loading } from './shared'
import { hoursAgo, timeAgoLabel } from './adminUtils'
import { COUNTRY_CODES, splitPhone } from '../../components/PhoneField'

// ── Types ──────────────────────────────────────────────────────────────────────

interface VerificationRequest {
  id: string
  user_id: string
  lead_id: string | null
  company_name: string | null
  company_domain: string | null
  contact_name: string | null
  contact_title: string | null
  status: 'pending' | 'in_progress' | 'verified' | 'delivered' | 'could_not_verify'
  verified_email: string | null
  verified_phone: string | null
  verified_linkedin: string | null
  verified_name: string | null
  verified_position: string | null
  verified_website: string | null
  verified_evidence_url: string | null
  evidence_expires_at: string | null
  confidence_score: number | null
  admin_notes: string | null
  requested_at: string
  delivered_at: string | null
}

type FilterTab = 'pending' | 'in_progress' | 'delivered' | 'could_not_verify' | 'all'

function isOverdue(req: VerificationRequest): boolean {
  return (
    (req.status === 'pending' || req.status === 'in_progress') &&
    hoursAgo(req.requested_at) > 24
  )
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2800)
    return () => clearTimeout(t)
  }, [onDone])
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.96 }}
      className="fixed bottom-6 right-6 z-[300] px-5 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-2"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid rgba(16,185,129,0.3)',
        color: 'var(--text-primary)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <span
        className="material-symbols-outlined text-[16px]"
        style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}
      >
        check_circle
      </span>
      {message}
    </motion.div>
  )
}

function StatusBadge({ status }: { status: VerificationRequest['status'] }) {
  const configs: Record<VerificationRequest['status'], { label: string; bg: string; color: string; border: string }> = {
    pending:          { label: '⏳ Pending',         bg: 'rgba(90,90,122,0.12)',  color: 'var(--text-secondary)', border: 'rgba(90,90,122,0.25)' },
    in_progress:      { label: '🔍 In Progress',     bg: 'rgba(99,102,241,0.1)',  color: '#4338CA', border: 'rgba(99,102,241,0.25)' },
    verified:         { label: '✓ Verified',          bg: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: 'rgba(16,185,129,0.25)' },
    delivered:        { label: '✓ Delivered',         bg: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: 'rgba(16,185,129,0.25)' },
    could_not_verify: { label: "✗ Couldn't Verify",  bg: 'rgba(245,158,11,0.1)', color: 'var(--warning)', border: 'rgba(245,158,11,0.25)' },
  }
  const cfg = configs[status]
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-lg text-[10px] font-bold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
    >
      {cfg.label}
    </span>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
      className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
      style={{
        background: copied ? 'rgba(16,185,129,0.15)' : 'var(--accent-subtle)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--accent-subtle)'}`,
        color: copied ? 'var(--success)' : 'var(--accent-interactive)',
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ── Request Card ───────────────────────────────────────────────────────────────

function RequestCard({
  req,
  duplicateCount,
  onUpdated,
  onToast,
}: {
  req: VerificationRequest
  duplicateCount: number
  onUpdated: () => void
  onToast: (msg: string) => void
}) {
  const [deliverForm, setDeliverForm] = useState({
    verified_name: req.contact_name ?? '',
    verified_position: req.contact_title ?? '',
    verified_email: '',
    verified_phone: '+91 ',
    verified_website: req.company_domain ? `https://${req.company_domain}` : '',
    verified_linkedin: '',
    verified_evidence_url: '',
    confidence_score: '',
  })
  const [cantVerifyNote, setCantVerifyNote] = useState('')
  const [showCantVerifyInput, setShowCantVerifyInput] = useState(false)
  const [saving, setSaving] = useState(false)

  const overdue = isOverdue(req)
  const showDeliverForm = req.status === 'pending' || req.status === 'in_progress'

  async function handleStart() {
    setSaving(true)
    await supabase
      .from('verification_requests')
      .update({ status: 'in_progress' })
      .eq('id', req.id)
    setSaving(false)
    onUpdated()
  }

  async function handleDeliver(e: React.FormEvent) {
    e.preventDefault()
    if (!deliverForm.verified_email.trim()) return
    setSaving(true)

    const now = new Date()
    // Evidence links are temporary — valid for 30 days from delivery.
    const evidenceExpiry = deliverForm.verified_evidence_url.trim()
      ? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null
    const confidence = deliverForm.confidence_score ? parseInt(deliverForm.confidence_score) : null
    // Sanitize every admin-entered field before it's stored — this data is
    // shown directly to the requesting user, so it gets the same treatment
    // as any other user-input write path (S4 / D3).
    const verifiedName = sanitizeText(deliverForm.verified_name.trim(), 200) || req.contact_name || null
    const verifiedPosition = sanitizeText(deliverForm.verified_position.trim(), 200) || req.contact_title || null
    const verifiedEmail = sanitizeText(deliverForm.verified_email.trim(), 320)
    const verifiedPhone = sanitizeText(deliverForm.verified_phone.trim(), 40) || null
    const verifiedWebsite = sanitizeUrl(deliverForm.verified_website.trim()) || null
    const verifiedLinkedin = sanitizeUrl(deliverForm.verified_linkedin.trim()) || null
    const verifiedEvidenceUrl = sanitizeUrl(deliverForm.verified_evidence_url.trim()) || null

    const { error: updErr } = await supabase
      .from('verification_requests')
      .update({
        status: 'delivered',
        verified_name: verifiedName,
        verified_position: verifiedPosition,
        verified_email: verifiedEmail,
        verified_phone: verifiedPhone,
        verified_website: verifiedWebsite,
        verified_linkedin: verifiedLinkedin,
        verified_evidence_url: verifiedEvidenceUrl,
        evidence_expires_at: evidenceExpiry,
        confidence_score: confidence,
        delivered_at: now.toISOString(),
      })
      .eq('id', req.id)
    if (updErr) console.error('[EBEXTA Admin] deliver update failed:', updErr.message)

    // Mirror into the persistent verified-contacts pool (admin's saved section
    // + source of truth the user's dashboard reflects). Non-fatal on failure.
    const { error: poolErr } = await supabase.from('verified_contacts').insert({
      request_id: req.id,
      user_id: req.user_id,
      lead_id: req.lead_id,
      company_name: req.company_name,
      company_domain: req.company_domain,
      contact_name: verifiedName,
      contact_position: verifiedPosition,
      contact_email: verifiedEmail,
      contact_phone: verifiedPhone,
      contact_website: verifiedWebsite,
      contact_linkedin: verifiedLinkedin,
      evidence_url: verifiedEvidenceUrl,
      evidence_expires_at: evidenceExpiry,
      confidence_score: confidence,
      verified_by: 'ebexta_admin',
    })
    if (poolErr) console.warn('[EBEXTA Admin] verified_contacts insert failed (run verified_contacts_migration.sql):', poolErr.message)

    void logSystemEvent({
      userId: req.user_id,
      eventType: 'verification',
      message: `Verification delivered: ${req.company_name ?? 'unknown company'} / ${verifiedName ?? 'unknown contact'}`,
    })
    setSaving(false)
    onToast('Delivered to user & saved to verified pool.')
    onUpdated()
  }

  async function handleCantVerify() {
    setSaving(true)
    await supabase
      .from('verification_requests')
      .update({
        status: 'could_not_verify',
        admin_notes: sanitizeText(cantVerifyNote.trim(), 1000) || null,
      })
      .eq('id', req.id)

    // We couldn't deliver, so the user must not pay. Real refund, logged to the
    // ledger — the "User credited" toast below is now actually true.
    let { error: refundErr } = await supabase.rpc('ebexta_admin_refund', {
      p_user: req.user_id,
      p_action: 'verified_contact',
      p_note: `Could not verify ${req.contact_name ?? 'contact'} at ${req.company_name ?? 'company'}`,
    })
    if (refundErr) {
      const res2 = await supabase.rpc('ketag_admin_refund', {
        p_user: req.user_id,
        p_action: 'verified_contact',
        p_note: `Could not verify ${req.contact_name ?? 'contact'} at ${req.company_name ?? 'company'}`,
      })
      if (!res2.error) refundErr = null
    }
    if (refundErr) {
      // Direct update fallback
      const { data: prof } = await supabase.from('profiles').select('credits, credit_limit').eq('id', req.user_id).maybeSingle()
      if (prof) {
        const cur = prof.credits ?? prof.credit_limit ?? 1000
        const { error: pErr } = await supabase.from('profiles').update({ credits: cur + 1 }).eq('id', req.user_id)
        if (!pErr) refundErr = null
      }
    }
    if (refundErr) console.error('[EBEXTA] verified-contact refund failed:', refundErr.message)

    void logSystemEvent({
      userId: req.user_id,
      eventType: 'verification',
      message: `Could not verify: ${req.company_name ?? 'unknown company'} / ${req.contact_name ?? 'unknown contact'}`,
    })
    setSaving(false)
    onToast(refundErr ? 'Marked: refund failed, check the ledger.' : 'Marked. Credit refunded.')
    onUpdated()
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="rounded-xl overflow-hidden"
      style={{
        background: overdue ? 'rgba(220,38,38,0.04)' : 'var(--bg-surface)',
        border: overdue ? '1px solid rgba(220,38,38,0.2)' : '1px solid var(--border-subtle)',
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[15px] font-bold mb-0.5" style={{ color: 'var(--text-primary)' }}>
              {req.company_name ?? '—'}
            </p>

            <p className="text-[12px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>
              {req.contact_name ?? '—'}
              {req.contact_title && (
                <span style={{ color: 'var(--text-muted)' }}> · {req.contact_title}</span>
              )}
            </p>

            {req.company_domain && (
              <div className="flex items-center mb-2">
                <span className="text-[12px] font-mono" style={{ color: '#4338CA' }}>
                  {req.company_domain}
                </span>
                <CopyButton text={req.company_domain} />
                <span className="ml-2 text-[10px]" style={{ color: 'var(--text-muted)' }}>
                  (paste into Hunter.io)
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={req.status} />
              <span
                className="text-[11px] font-medium"
                style={{ color: overdue ? '#DC2626' : 'var(--text-muted)' }}
              >
                {overdue && '⚠ Overdue · '}
                {timeAgoLabel(req.requested_at)}
              </span>

              {duplicateCount > 1 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold"
                  style={{
                    background: 'rgba(99,102,241,0.1)',
                    color: '#4338CA',
                    border: '1px solid rgba(99,102,241,0.2)',
                  }}
                >
                  ↗ {duplicateCount} users want this
                </span>
              )}
            </div>
          </div>

          {req.status === 'pending' && (
            <button
              onClick={handleStart}
              disabled={saving}
              className="shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
              style={{
                background: 'rgba(99,102,241,0.12)',
                color: '#4338CA',
                border: '1px solid rgba(99,102,241,0.25)',
              }}
            >
              {saving ? '…' : 'Start'}
            </button>
          )}
        </div>

        {showDeliverForm && (
          <form onSubmit={handleDeliver} className="mt-4 space-y-2.5">
            <div
              className="text-[10px] font-bold tracking-[0.07em] uppercase mb-2"
              style={{ color: 'var(--text-muted)' }}
            >
              Deliver Results
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Contact name"
                value={deliverForm.verified_name}
                onChange={e => setDeliverForm(f => ({ ...f, verified_name: e.target.value }))}
                className="px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                placeholder="Position / title"
                value={deliverForm.verified_position}
                onChange={e => setDeliverForm(f => ({ ...f, verified_position: e.target.value }))}
                className="px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              />
              <div className="col-span-2">
                <input
                  required
                  type="email"
                  placeholder="Verified email *"
                  value={deliverForm.verified_email}
                  onChange={e => setDeliverForm(f => ({ ...f, verified_email: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
                />
              </div>
              <input
                type="text"
                placeholder="Website (optional)"
                value={deliverForm.verified_website}
                onChange={e => setDeliverForm(f => ({ ...f, verified_website: e.target.value }))}
                className="px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              />
              <input
                type="text"
                placeholder="LinkedIn URL (optional)"
                value={deliverForm.verified_linkedin}
                onChange={e => setDeliverForm(f => ({ ...f, verified_linkedin: e.target.value }))}
                className="px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              />
              <div className="flex gap-1.5">
                <select
                  aria-label="Country code"
                  value={splitPhone(deliverForm.verified_phone).code}
                  onChange={e => setDeliverForm(f => ({
                    ...f,
                    verified_phone: `${e.target.value} ${splitPhone(f.verified_phone).number}`.trim(),
                  }))}
                  className="px-2 py-2 rounded-lg text-[12px] outline-none shrink-0 cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)', maxWidth: 104 }}
                >
                  {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
                </select>
                <input
                  type="tel"
                  inputMode="tel"
                  placeholder="Phone (optional)"
                  value={splitPhone(deliverForm.verified_phone).number}
                  onChange={e => setDeliverForm(f => ({
                    ...f,
                    verified_phone: `${splitPhone(f.verified_phone).code} ${e.target.value.replace(/[^\d\s-]/g, '')}`.trim(),
                  }))}
                  className="flex-1 min-w-0 px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
                />
              </div>
              <input
                type="number"
                min={0}
                max={100}
                placeholder="Confidence score (0–100)"
                value={deliverForm.confidence_score}
                onChange={e => setDeliverForm(f => ({ ...f, confidence_score: e.target.value }))}
                className="px-3 py-2 rounded-lg text-[12px] outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
              />
              <div className="col-span-2">
                <input
                  type="text"
                  placeholder="Evidence URL (expires in 30 days, optional)"
                  value={deliverForm.verified_evidence_url}
                  onChange={e => setDeliverForm(f => ({ ...f, verified_evidence_url: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg text-[12px] outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)', color: 'var(--text-primary)' }}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                style={{
                  background: 'rgba(16,185,129,0.12)',
                  color: 'var(--success)',
                  border: '1px solid rgba(16,185,129,0.25)',
                }}
              >
                {saving ? 'Saving…' : 'Deliver ✓'}
              </button>

              {!showCantVerifyInput && (
                <button
                  type="button"
                  onClick={() => setShowCantVerifyInput(true)}
                  className="px-4 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                  style={{
                    background: 'rgba(245,158,11,0.08)',
                    color: 'var(--warning)',
                    border: '1px solid rgba(245,158,11,0.2)',
                  }}
                >
                  Couldn't Verify
                </button>
              )}
            </div>

            <AnimatePresence>
              {showCantVerifyInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="flex gap-2 pt-1">
                    <input
                      type="text"
                      placeholder="Note for user (optional)"
                      value={cantVerifyNote}
                      onChange={e => setCantVerifyNote(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(245,158,11,0.2)',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleCantVerify}
                      disabled={saving}
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all"
                      style={{
                        background: 'rgba(245,158,11,0.12)',
                        color: 'var(--warning)',
                        border: '1px solid rgba(245,158,11,0.25)',
                      }}
                    >
                      {saving ? '…' : 'Confirm'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowCantVerifyInput(false)}
                      className="px-3 py-1.5 rounded-lg text-[11px] transition-all"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        )}
      </div>
    </motion.div>
  )
}

// ── Main queue page ────────────────────────────────────────────────────────────

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'pending',          label: 'Pending' },
  { key: 'in_progress',      label: 'In Progress' },
  { key: 'delivered',        label: 'Delivered' },
  { key: 'could_not_verify', label: "Couldn't Verify" },
  { key: 'all',              label: 'All' },
]

export default function AdminQueue() {
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<FilterTab>('pending')
  const [toast, setToast] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    const { data, error } = await supabase
      .from('verification_requests')
      .select('*')
      .order('requested_at', { ascending: false })

    if (error) {
      console.error('[EBEXTA Admin] Failed to load verification_requests:', error.message)
      console.warn('[EBEXTA Admin] If you see RLS errors, run supabase/admin_migration.sql')
    }
    setRequests((data ?? []) as VerificationRequest[])
    setLoading(false)
  }, [])

  // Fetch-on-mount + LIVE polling every 15s — new user requests appear without refresh.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => {
    loadRequests()
    const interval = setInterval(loadRequests, 15_000)
    return () => clearInterval(interval)
  }, [loadRequests])

  // Duplicate detection
  const duplicateMap: Record<string, number> = {}
  requests.forEach(r => {
    const key = `${r.company_domain ?? ''}|${r.contact_name ?? ''}`
    if (key !== '|') {
      duplicateMap[key] = (duplicateMap[key] || 0) + 1
    }
  })

  const pending    = requests.filter(r => r.status === 'pending').length
  const inProgress = requests.filter(r => r.status === 'in_progress').length
  const delivered  = requests.filter(r => r.status === 'delivered' || r.status === 'verified').length
  const overdue    = requests.filter(isOverdue).length

  const filtered = activeTab === 'all'
    ? requests
    : activeTab === 'delivered'
      ? requests.filter(r => r.status === 'delivered' || r.status === 'verified')
      : requests.filter(r => r.status === activeTab)

  return (
    <div className="max-w-4xl">
      <PageHeader
        icon="fact_check"
        title="Verification Queue"
        subtitle="Review, action, and deliver verification requests."
      />

      {/* Count strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Pending',     value: pending,    color: 'var(--text-secondary)', glow: 'rgba(90,90,122,0.08)' },
          { label: 'In Progress', value: inProgress, color: '#4338CA', glow: 'rgba(99,102,241,0.08)' },
          { label: 'Delivered',   value: delivered,  color: 'var(--success)', glow: 'rgba(16,185,129,0.08)' },
          { label: 'Overdue',     value: overdue,    color: overdue > 0 ? '#DC2626' : 'var(--text-muted)', glow: overdue > 0 ? 'rgba(220,38,38,0.08)' : 'rgba(90,90,122,0.04)' },
        ].map(({ label, value, color, glow }) => (
          <div
            key={label}
            className="rounded-xl p-4 text-center"
            style={{ background: glow, border: `1px solid ${color}20` }}
          >
            <p className="text-[28px] font-bold font-mono leading-none mb-1" style={{ color }}>{value}</p>
            <p className="text-[10px] font-bold tracking-[0.07em] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 mb-5 flex-wrap">
        {FILTER_TABS.map(tab => {
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                color: isActive ? 'var(--warning)' : 'var(--text-muted)',
                border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      {loading ? (
        <Loading label="Loading requests…" />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center text-center py-20">
          <p className="text-[15px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
            No {activeTab === 'all' ? '' : activeTab.replace('_', ' ')} requests
          </p>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            {activeTab === 'pending' ? 'All caught up.' : 'Nothing here yet.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence>
            {filtered.map((req, i) => {
              const key = `${req.company_domain ?? ''}|${req.contact_name ?? ''}`
              const dupCount = duplicateMap[key] ?? 1
              return (
                <motion.div
                  key={req.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <RequestCard
                    req={req}
                    duplicateCount={dupCount}
                    onUpdated={loadRequests}
                    onToast={msg => setToast(msg)}
                  />
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </div>
  )
}
