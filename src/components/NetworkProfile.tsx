/**
 * NetworkProfile — company profile and bilateral intelligence dossier.
 * If another member requests this dossier, the uploaded company details must be
 * verified and approved by EBEXTA Admin ("OK / Yes").
 * Once verified, the full 13-point dossier unlocks with the Admin Verified seal.
 */
import { useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { isAuthorizedAdminEmail } from '../lib/adminAuth'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

interface Net {
  id: string
  company_name: string | null
  mission: string | null
  website: string | null
  mode: string | null
  company_profile: Record<string, string> | null
}

interface Intent {
  requirement: string | null
  industry_tags: string[] | null
  created_at: string
}

interface DossierRecord {
  content: Record<string, string>
  created_at: string
}

interface DossierReqRecord {
  id: string
  status: string
  created_at: string
}

export function NetworkProfile({ userId, onClose }: { userId: string; onClose: () => void }) {
  const [net, setNet] = useState<Net | null>(null)
  const [intent, setIntent] = useState<Intent | null>(null)
  const [dossier, setDossier] = useState<DossierRecord | null>(null)
  const [dossierReq, setDossierReq] = useState<DossierReqRecord | null>(null)
  const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [requesting, setRequesting] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const currentUid = session?.user?.id

      const [{ data: p }, { data: di }] = await Promise.all([
        supabase.from('network_profiles').select('id, company_name, mission, website, mode, company_profile').eq('id', userId).maybeSingle(),
        supabase.from('declared_intents').select('requirement, industry_tags, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      ])

      setNet(p as Net)
      setIntent(di as Intent)

      if (currentUid) {
        if (currentUid === userId) {
          setIsOwnerOrAdmin(true)
        } else {
          // Check if current user is an authorized admin
          const { data: prof } = await supabase.from('profiles').select('is_admin').eq('id', currentUid).maybeSingle()
          if (isAuthorizedAdminEmail(session?.user?.email) && prof?.is_admin) {
            setIsOwnerOrAdmin(true)
          }

          // Check if dossier has been delivered
          const { data: dos } = await supabase.from('dossiers')
            .select('content, created_at')
            .eq('subject_id', userId)
            .maybeSingle()
          if (dos) setDossier(dos as DossierRecord)

          // Check dossier request status
          const { data: req } = await supabase.from('dossier_requests')
            .select('id, status, created_at')
            .eq('subject_id', userId)
            .maybeSingle()
          if (req) setDossierReq(req as DossierReqRecord)
        }
      }
    } catch (err) {
      console.warn('Error loading network profile:', err)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => { void load() }, [load])

  const handleRequestDossier = async () => {
    setRequesting(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        showToast('Please sign in to request a verified company dossier.')
        return
      }

      const { data: reqId, error } = await supabase.rpc('ebexta_request_dossier', { subject_user: userId })
      if (error) {
        showToast(`Request error: ${error.message}`)
      } else {
        setDossierReq({
          id: reqId as string,
          status: 'pending',
          created_at: new Date().toISOString(),
        })
        showToast('✓ Request submitted to EBEXTA Admin! Dossier will unlock once verified.')
      }
    } catch (err: any) {
      showToast(err.message || 'Failed to request dossier.')
    } finally {
      setRequesting(false)
    }
  }

  const company = net?.company_name || 'EBEXTA member'
  const mode = (net?.mode || 'seeker')
  const cp = net?.company_profile ?? {}
  const dc = dossier?.content ?? {}

  // Determine if full dossier is unlocked
  const isUnlocked = Boolean(isOwnerOrAdmin || dossier)
  const isPending = !isUnlocked && (dossierReq?.status === 'pending' || dossierReq?.status === 'researching')
  const isDeclined = !isUnlocked && dossierReq?.status === 'declined'

  // Get value優先: verified dossier content -> member self-declared company_profile
  const val = (k: string, fallback = '') => (dc[k] || cp[k]?.trim() || fallback)

  // The 12-13 fields
  const fields: { icon: string; n: number; title: string; body: string }[] = [
    { icon: 'trending_up', n: 2, title: 'Future Scope', body: val('future_scope', dc.additional_intel || net?.mission || '') },
    { icon: 'payments', n: 3, title: 'Financial & Funding', body: val('financial_funding', dc.funding || '') },
    { icon: 'flag', n: 4, title: 'Strategic Needs', body: val('strategic_needs', intent?.requirement || '') },
    { icon: 'rocket_launch', n: 5, title: 'Major Projects', body: val('major_projects', dc.major_projects || '') },
    { icon: 'badge', n: 6, title: 'Employees', body: val('employees', dc.employees || '') },
    { icon: 'monitoring', n: 7, title: 'Revenue', body: val('revenue', dc.revenue || '') },
    { icon: 'stairs', n: 8, title: 'Stage', body: val('stage', dc.stage || '') },
    { icon: 'location_on', n: 9, title: 'Location', body: val('location', dc.location || '') },
    { icon: 'radar', n: 10, title: 'Recent Signals', body: val('recent_signals', intent ? `Posted intent ${new Date(intent.created_at).toLocaleDateString()}: “${intent.requirement}”` : '') },
    { icon: 'contacts', n: 11, title: 'Key Contacts', body: val('key_contacts', dc.key_contacts || '') },
    { icon: 'shield', n: 12, title: 'Data Integrity', body: val('data_integrity', dc.data_integrity || (isUnlocked ? 'Verified by EBEXTA Admin' : 'Self-declared by the member.')) },
  ]

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[210]"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(3px)' }}
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        transition={{ type: 'tween', duration: 0.3 }}
        className="fixed right-0 top-0 h-full w-full max-w-[540px] z-[220] overflow-y-auto custom-scrollbar"
        style={{ background: 'var(--bg-base)', borderLeft: '1px solid var(--border-subtle)' }}
      >
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-start gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-[20px] font-bold shrink-0 shadow-sm"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
            >
              {company[0]?.toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-[20px] font-bold truncate" style={geist}>{company}</h3>
                {isUnlocked && (
                  <span
                    className="text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1"
                    style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }}
                  >
                    <span className="material-symbols-outlined text-[13px]">verified</span>
                    Admin Verified
                  </span>
                )}
              </div>
              <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
                {mode.toUpperCase()} · EBEXTA member{net?.website ? ` · ${net.website}` : ''}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center transition-colors hover:bg-white/10"
              style={{ background: 'var(--border-subtle)' }}
            >
              <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
            </button>
          </div>

          {toast && (
            <div
              className="p-3 rounded-xl text-[12px] font-semibold flex items-center gap-2"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--border-subtle)' }}
            >
              <span className="material-symbols-outlined text-[16px]">info</span>
              <span>{toast}</span>
            </div>
          )}

          {loading ? (
            <div className="py-12 text-center">
              <span className="material-symbols-outlined text-[28px] animate-spin mb-2" style={{ color: 'var(--accent-interactive)' }}>sync</span>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading verified profile…</p>
            </div>
          ) : (
            <>
              {/* STATUS BANNER & WORKFLOW */}
              {isUnlocked ? (
                <div
                  className="p-3.5 rounded-xl flex items-start gap-3"
                  style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)' }}
                >
                  <span className="material-symbols-outlined text-[22px] shrink-0" style={{ color: 'var(--success)' }}>
                    verified_user
                  </span>
                  <div className="text-[12px]">
                    <p className="font-bold" style={{ color: 'var(--success)' }}>Verified Bilateral Dossier Unlocked</p>
                    <p className="mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                      This member's uploaded company details and business credentials have been audited and approved by the EBEXTA Admin team.
                    </p>
                    {dossier?.content?.trust_score && (
                      <p className="mt-1 font-mono text-[11px] font-semibold" style={{ color: 'var(--accent-interactive)' }}>
                        Trust Score: {dossier.content.trust_score}
                      </p>
                    )}
                  </div>
                </div>
              ) : isPending ? (
                <div
                  className="p-4 rounded-xl space-y-2"
                  style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.3)' }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="material-symbols-outlined text-[20px] animate-pulse" style={{ color: 'var(--warning)' }}>
                        hourglass_top
                      </span>
                      <span className="text-[13px] font-bold" style={{ color: 'var(--warning)' }}>
                        Dossier Verification Pending
                      </span>
                    </div>
                    <span
                      className="text-[9px] font-bold px-2 py-0.5 rounded uppercase"
                      style={{ background: 'rgba(245,158,11,0.2)', color: 'var(--warning)' }}
                    >
                      Admin Review In Progress
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Your request to access {company}'s verified dossier has been received. The subject's uploaded company records and registry documents are currently being verified by the EBEXTA Admin team.
                  </p>
                  <p className="text-[11px] font-medium" style={{ color: 'var(--text-muted)' }}>
                    As soon as admin verifies and clicks "OK / Yes", the full company profile and verified intel will unlock automatically.
                  </p>
                </div>
              ) : isDeclined ? (
                <div
                  className="p-4 rounded-xl space-y-2"
                  style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--critical)' }}>
                      cancel
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: 'var(--critical)' }}>
                      Dossier Request Declined
                    </span>
                  </div>
                  <p className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>
                    Your request to access {company}'s confidential dossier was not approved at this time.
                  </p>
                </div>
              ) : (
                <div
                  className="p-4 rounded-xl space-y-3"
                  style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent-interactive)' }}>
                      lock
                    </span>
                    <span className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>
                      Admin Verification Required
                    </span>
                  </div>
                  <p className="text-[12px] leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    To protect member privacy and ensure high-conviction dealflow, this company's uploaded financial details, strategic needs, and verified contacts require admin verification before release.
                  </p>
                  <button
                    onClick={handleRequestDossier}
                    disabled={requesting}
                    className="w-full py-2.5 px-4 rounded-xl text-[12px] font-bold flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-[0.99]"
                    style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
                  >
                    <span className="material-symbols-outlined text-[16px]">verified</span>
                    <span>{requesting ? 'Submitting Request…' : 'Request Verified Company Dossier'}</span>
                  </button>
                </div>
              )}

              {/* About Section */}
              {net?.mission && (
                <div className="rounded-xl p-4" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="material-symbols-outlined text-[18px]" style={{ color: 'var(--accent-interactive)' }}>info</span>
                    <p className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>1. About</p>
                  </div>
                  <p className="text-[13.5px]" style={{ color: 'var(--text-primary)' }}>{net.mission}</p>
                </div>
              )}

              {/* Dossier Fields */}
              <div className="space-y-2.5">
                {fields.map(f => {
                  const isLocked = !isUnlocked && f.n > 2 && f.n !== 10
                  return (
                    <div
                      key={f.n}
                      className="rounded-xl p-4 transition-all"
                      style={{
                        background: 'var(--bg-elevated)',
                        border: '1px solid var(--border-subtle)',
                        opacity: isLocked ? 0.75 : 1
                      }}
                    >
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2">
                          <span
                            className="material-symbols-outlined text-[18px]"
                            style={{ color: isLocked ? 'var(--text-muted)' : (f.body ? 'var(--accent-interactive)' : 'var(--border-strong)') }}
                          >
                            {isLocked ? 'lock' : f.icon}
                          </span>
                          <p className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                            {f.n}. {f.title}
                          </p>
                        </div>
                        {isLocked && (
                          <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded" style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}>
                            Locked
                          </span>
                        )}
                      </div>

                      {isLocked ? (
                        <p className="text-[12px] italic select-none blur-[3px]" style={{ color: 'var(--text-muted)' }}>
                          Requires EBEXTA Admin verification to view confidential company intel.
                        </p>
                      ) : (
                        <p className="text-[13.5px] whitespace-pre-wrap" style={{ color: f.body ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                          {f.body || 'Not shared yet'}
                        </p>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </motion.aside>
    </>
  )
}

