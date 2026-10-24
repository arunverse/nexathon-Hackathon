import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { syncVerifiedContactsToMemory } from '../../lib/companyMemory'
import { openExternal } from '../../lib/urlUtils'

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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins !== 1 ? 's' : ''} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs !== 1 ? 's' : ''} ago`
  const days = Math.floor(hrs / 24)
  return `${days} day${days !== 1 ? 's' : ''} ago`
}

function StatusBadge({ status }: { status: VerificationRequest['status'] }) {
  const configs: Record<VerificationRequest['status'], { label: string; bg: string; color: string; border: string }> = {
    pending:          { label: '⏳ Pending',                     bg: 'rgba(90,90,122,0.1)',    color: 'var(--text-muted)',  border: 'rgba(90,90,122,0.2)' },
    in_progress:      { label: '🔍 Verifying',                   bg: 'rgba(67,56,202,0.1)',    color: '#4338CA',  border: 'rgba(67,56,202,0.25)' },
    verified:         { label: '✓ Verified',                     bg: 'rgba(16,185,129,0.1)',   color: 'var(--success)',  border: 'rgba(16,185,129,0.25)' },
    delivered:        { label: '✓ Delivered',                    bg: 'rgba(16,185,129,0.1)',   color: 'var(--success)',  border: 'rgba(16,185,129,0.25)' },
    could_not_verify: { label: "Couldn't verify: credited",     bg: 'rgba(245,158,11,0.1)',   color: 'var(--warning)',  border: 'rgba(245,158,11,0.25)' },
  }
  const cfg = configs[status]
  return (
    <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-[11px] font-bold"
      style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}>
      {cfg.label}
    </span>
  )
}

/**
 * Live verification process timeline — the user watches exactly where their
 * request is inside the EBEXTA pipeline. Auto-refreshes via polling.
 */
function ProcessTimeline({ req }: { req: VerificationRequest }) {
  const failed = req.status === 'could_not_verify'
  const steps = [
    {
      key: 'requested',
      label: 'Request received',
      detail: `Queued ${timeAgo(req.requested_at)}`,
      done: true,
      active: req.status === 'pending',
    },
    {
      key: 'verifying',
      label: 'EBEXTA team verifying',
      detail: 'Human check of email, LinkedIn & role: the barrier between EBEXTA Engine output and a verified contact',
      done: req.status === 'in_progress' || req.status === 'verified' || req.status === 'delivered' || failed,
      active: req.status === 'in_progress',
    },
    failed
      ? {
          key: 'result',
          label: "Couldn't verify: credit returned",
          detail: req.admin_notes ?? 'Our team could not confirm this contact with confidence',
          done: true,
          active: false,
        }
      : {
          key: 'result',
          label: 'Verified & delivered',
          detail: req.delivered_at ? `Delivered ${timeAgo(req.delivered_at)}` : 'Within 24 hours of request',
          done: req.status === 'delivered' || req.status === 'verified',
          active: false,
        },
  ]

  return (
    <div className="mt-3 pl-1">
      {steps.map((s, i) => (
        <div key={s.key} className="flex gap-3">
          {/* Dot + connector */}
          <div className="flex flex-col items-center">
            <div
              className={`w-3 h-3 rounded-full shrink-0 ${s.active ? 'animate-pulse' : ''}`}
              style={{
                background: s.done
                  ? (s.key === 'result' && failed ? 'var(--warning)' : s.active ? '#4338CA' : 'var(--success)')
                  : 'var(--border-subtle)',
                border: s.active ? '2px solid rgba(67,56,202,0.35)' : 'none',
              }}
            />
            {i < steps.length - 1 && (
              <div className="w-px flex-1 min-h-[22px]"
                style={{ background: s.done ? 'rgba(16,185,129,0.35)' : 'var(--border-subtle)' }} />
            )}
          </div>
          {/* Copy */}
          <div className="pb-3 -mt-0.5">
            <p className="text-[12px] font-semibold"
              style={{ color: s.done ? 'var(--text-primary)' : 'var(--text-muted)' }}>
              {s.label}
              {s.active && (
                <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded"
                  style={{ background: 'rgba(67,56,202,0.1)', color: '#4338CA', border: '1px solid rgba(67,56,202,0.2)' }}>
                  LIVE
                </span>
              )}
            </p>
            <p className="text-[11px] mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{s.detail}</p>
          </div>
        </div>
      ))}
    </div>
  )
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }
  return (
    <button onClick={handleCopy}
      className="ml-2 px-2 py-0.5 rounded text-[10px] font-bold transition-all"
      style={{
        background: copied ? 'rgba(16,185,129,0.15)' : 'var(--accent-subtle)',
        border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'var(--accent-subtle)'}`,
        color: copied ? 'var(--success)' : 'var(--accent-interactive)',
      }}>
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

export default function VerifiedContactsPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [requests, setRequests] = useState<VerificationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // Live monitor: initial load + poll every 20s so admin-side progress
  // (Start → Deliver) appears here without a manual refresh.
  useEffect(() => {
    if (!user) return
    let cancelled = false

    async function load() {
      const { data } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user!.id)
        .order('requested_at', { ascending: false })
      if (!cancelled) {
        setRequests((data ?? []) as VerificationRequest[])
        setLoading(false)
      }
      // Fold delivered contacts into Company Memory (merge + VERIFIED timeline
      // event). Idempotent, so polling never duplicates anything.
      void syncVerifiedContactsToMemory()
    }

    load()
    const interval = setInterval(load, 20_000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [user])

  const pending    = requests.filter(r => r.status === 'pending').length
  const verifying  = requests.filter(r => r.status === 'in_progress').length
  const delivered  = requests.filter(r => r.status === 'delivered' || r.status === 'verified').length

  function toggleExpand(id: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 max-w-3xl w-full min-w-0">
        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-7"
        >
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]"
              style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
              verified_user
            </span>
            <h1 className="text-[26px] font-bold tracking-[-0.03em]"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Verified Contacts
            </h1>
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Monitor every verification live. AI-found links stay <strong>Partially Verified</strong> until a EBEXTA
            human confirms them; that barrier is why a delivered contact can be trusted.
          </p>
        </motion.div>

        {/* Summary strip */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.4 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-7"
        >
          {[
            { label: 'Pending',   value: pending,   color: 'var(--text-muted)',  glow: 'rgba(90,90,122,0.08)' },
            { label: 'Verifying', value: verifying, color: '#4338CA',  glow: 'rgba(67,56,202,0.08)' },
            { label: 'Delivered', value: delivered, color: 'var(--success)',  glow: 'rgba(16,185,129,0.08)' },
          ].map(({ label, value, color, glow }) => (
            <div key={label} className="rounded-xl p-4 text-center"
              style={{ background: glow, border: `1px solid ${color}20` }}>
              <p className="text-[28px] font-bold font-mono leading-none mb-1" style={{ color }}>{value}</p>
              <p className="text-[11px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--text-muted)' }}>{label}</p>
            </div>
          ))}
        </motion.div>

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center gap-4 mt-20">
            <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--success)', borderTopColor: 'transparent' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading requests…</p>
          </div>
        ) : requests.length === 0 ? (
          /* Empty state */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="flex flex-col items-center text-center py-20 px-8"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)' }}>
              <span className="material-symbols-outlined text-[30px]"
                style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                verified_user
              </span>
            </div>
            <p className="text-[18px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No verification requests yet
            </p>
            <p className="text-[13px] max-w-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              Request a verified contact from any opportunity. Our team validates the real email and decision-maker details against verified public sources.
            </p>
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
              <span className="material-symbols-outlined text-[18px]">hub</span>
              Go to Leads
            </button>
          </motion.div>
        ) : (
          /* Request cards */
          <div className="space-y-3">
            <AnimatePresence>
              {requests.map((req, i) => {
                const isExpanded = expanded.has(req.id)
                const showDetails = req.status === 'delivered' || req.status === 'verified'
                const showCredited = req.status === 'could_not_verify'

                return (
                  <motion.div
                    key={req.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04, duration: 0.35 }}
                    className="rounded-xl overflow-hidden"
                    style={{
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border-subtle)',
                    }}
                  >
                    {/* Card header */}
                    <div
                      className="flex items-start justify-between p-4"
                      style={{ cursor: (showDetails || showCredited) ? 'pointer' : 'default' }}
                      onClick={() => (showDetails || showCredited) && toggleExpand(req.id)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
                            {req.verified_name ?? req.contact_name ?? 'Contact'}
                          </span>
                          {(req.verified_position ?? req.contact_title) && (
                            <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>· {req.verified_position ?? req.contact_title}</span>
                          )}
                        </div>
                        <p className="text-[12px] mb-2" style={{ color: 'var(--text-secondary)' }}>
                          {req.company_name ?? 'Company'}
                          {req.company_domain && <span style={{ color: 'var(--text-muted)' }}> · {req.company_domain}</span>}
                        </p>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={req.status} />
                          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                            {timeAgo(req.requested_at)}
                          </span>
                        </div>

                        {/* Live verification process monitor */}
                        <ProcessTimeline req={req} />
                      </div>
                      {(showDetails || showCredited) && (
                        <span className="material-symbols-outlined text-[18px] ml-3 shrink-0 transition-transform duration-200"
                          style={{
                            color: 'var(--text-muted)',
                            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                          }}>
                          expand_more
                        </span>
                      )}
                    </div>

                    {/* Expanded details */}
                    <AnimatePresence>
                      {isExpanded && showDetails && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="px-4 pb-4 space-y-2.5"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            <p className="text-[10px] font-bold tracking-[0.08em] uppercase pt-3"
                              style={{ color: 'var(--text-muted)' }}>
                              Verified Details
                            </p>

                            {req.verified_email && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                                  mail
                                </span>
                                <span style={{ color: 'var(--text-primary)' }}>{req.verified_email}</span>
                                <CopyButton text={req.verified_email} />
                              </div>
                            )}

                            {req.confidence_score != null && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                                  verified
                                </span>
                                <span style={{ color: 'var(--text-secondary)' }}>{req.confidence_score}% confidence</span>
                              </div>
                            )}

                            {req.verified_linkedin && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: '#4338CA', fontVariationSettings: "'FILL' 1" }}>
                                  manage_search
                                </span>
                                <button
                                  type="button"
                                  onClick={() => openExternal(req.verified_linkedin, `${req.contact_name || ''} ${req.company_name || ''}`)}
                                  className="underline transition-colors text-left cursor-pointer"
                                  style={{ color: '#4338CA' }}
                                  onMouseEnter={e => (e.currentTarget.style.color = '#4F46E5')}
                                  onMouseLeave={e => (e.currentTarget.style.color = '#4338CA')}>
                                  View LinkedIn
                                </button>
                              </div>
                            )}

                            {req.verified_phone && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}>
                                  call
                                </span>
                                <span style={{ color: 'var(--text-primary)' }}>{req.verified_phone}</span>
                                <CopyButton text={req.verified_phone} />
                              </div>
                            )}

                            {req.verified_website && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                                  language
                                </span>
                                <a href={req.verified_website} target="_blank" rel="noopener noreferrer"
                                  className="underline" style={{ color: 'var(--accent-interactive)' }}>
                                  {req.verified_website.replace(/^https?:\/\/(www\.)?/, '')}
                                </a>
                              </div>
                            )}

                            {req.verified_evidence_url && (
                              <div className="flex items-center text-[13px]">
                                <span className="material-symbols-outlined text-[15px] mr-2"
                                  style={{ color: 'var(--warning)', fontVariationSettings: "'FILL' 1" }}>
                                  link
                                </span>
                                <a href={req.verified_evidence_url} target="_blank" rel="noopener noreferrer"
                                  className="underline" style={{ color: 'var(--warning)' }}>
                                  Evidence source
                                </a>
                                {req.evidence_expires_at && (
                                  <span className="ml-2 text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                    (expires {new Date(req.evidence_expires_at).toLocaleDateString()})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}

                      {isExpanded && showCredited && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25 }}
                          style={{ overflow: 'hidden' }}
                        >
                          <div className="px-4 pb-4"
                            style={{ borderTop: '1px solid var(--border-subtle)' }}>
                            {req.admin_notes && (
                              <p className="text-[12px] mt-3 mb-2" style={{ color: 'var(--text-secondary)' }}>
                                {req.admin_notes}
                              </p>
                            )}
                            <div className="flex items-center gap-2 text-[12px] mt-3"
                              style={{ color: 'var(--warning)' }}>
                              <span className="material-symbols-outlined text-[15px]"
                                style={{ fontVariationSettings: "'FILL' 1" }}>
                                credit_card
                              </span>
                              No charge: credit returned to your account
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </main>
    </div>
  )
}
