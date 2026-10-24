/**
 * /admin/users — EVERY profile in full: company, email, mode, mission/offering,
 * plan, created date, last active. Drilldown per user: scans (with the filters
 * they used), leads, saved leads, verification requests, declared intents,
 * API usage. The admin can fully track what each user is doing.
 */

import { Fragment, useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, Th, Td, Pill } from './shared'
import { fmtDate, timeAgoLabel, verificationTone } from './adminUtils'
import { adminDeleteUser } from './adminActions'
import { logAdminAction } from '../../lib/adminLog'

interface Profile {
  id: string
  name?: string | null
  email?: string | null
  company_name: string | null
  sender_email: string | null
  mission: string | null
  mode: string | null
  plan: string | null
  credits: number | null
  credit_limit: number | null
  is_blocked: boolean | null
  created_at: string
  plan_status?: string | null
  plan_expires_at?: string | null
  company_profile?: Record<string, string> | null
  [key: string]: unknown
}

interface Counts {
  scans: number
  leads: number
  requests: number
  saved: number
  intents: number
  apiCalls: number
  tokens: number
}

const ZERO: Counts = { scans: 0, leads: 0, requests: 0, saved: 0, intents: 0, apiCalls: 0, tokens: 0 }

interface DrilldownData {
  scans: Array<{ id: string; status: string | null; mode: string | null; created_at: string; filters: Record<string, unknown> | null }>
  leads: Array<{ id: string; company_name: string | null; intent_score: number | null; verification_status: string | null; created_at: string }>
  requests: Array<{ id: string; company_name: string | null; contact_name: string | null; status: string | null; requested_at: string }>
  saved: Array<{ id: string; lead_snapshot: { company_name?: string } | null; saved_at: string }>
  intents: Array<{ id: string; requirement: string; mode: string | null; expires_at: string | null }>
}

function filtersSummary(f: Record<string, unknown> | null): string {
  if (!f) return '—'
  const parts: string[] = []
  if (f.mission) parts.push(String(f.mission).slice(0, 40))
  if (Array.isArray(f.industries) && f.industries.length) parts.push(`ind: ${(f.industries as string[]).slice(0, 2).join(', ')}`)
  if (f.country) parts.push(String(f.country))
  if (Array.isArray(f.decisionMakerRoles) && f.decisionMakerRoles.length) parts.push(`roles: ${(f.decisionMakerRoles as string[]).slice(0, 2).join(', ')}`)
  return parts.join(' · ') || '—'
}

// Cost estimate (keep in sync with AdminApi).
// Blended token price (2.5-Flash output is costly; enrichment uses cheaper
// Flash-Lite) — keep in sync with AdminApi's per-model rates.
const EST_USD_PER_1M_TOKENS = 0.8
// Grounding is $35/1000 requests but the paid tier includes a large free daily
// allowance, so only overage past the free quota is billed.
const GROUNDING_USD_PER_CALL = 0.035
const GROUNDING_FREE_PER_DAY = 1500
const GROUNDED_ACTIONS = new Set(['discovery', 'enrich', 'scan'])
const CP_FIELDS_LABELS: [string, string][] = [
  ['future_scope', 'Future Scope'],
  ['financial_funding', 'Financial & Funding'],
  ['strategic_needs', 'Strategic Needs'],
  ['major_projects', 'Major Projects'],
  ['employees', 'Headcount'],
  ['revenue', 'Revenue'],
  ['stage', 'Funding Stage'],
  ['location', 'Location'],
  ['recent_signals', 'Recent Signals'],
  ['key_contacts', 'Key Contacts'],
  ['data_integrity', 'Data Integrity'],
]

function getProfileStatus(p: Profile) {
  const cp = (p.company_profile as Record<string, string>) || {}
  const missing: string[] = []
  if (!p.company_name || p.company_name.trim() === '' || p.company_name === 'Your Company') {
    missing.push('Company name')
  }
  if (!p.mission || p.mission.trim() === '') {
    missing.push('Mission')
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
  const filledCpCount = Object.values(cp).filter(v => typeof v === 'string' && v.trim().length > 0).length
  const isComplete = missing.length === 0 && filledCpCount >= 3
  const status: 'complete' | 'incomplete' = isComplete ? 'complete' : 'incomplete'
  const updatedAt = (p as any).updated_at || (p as any).created_at || null
  const daysSinceUpdate = updatedAt ? Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24)) : 0

  return {
    isComplete,
    status,
    missing,
    filledCpCount,
    filledCount: filledCpCount,
    totalCount: CP_FIELDS_LABELS.length,
    cp,
    updatedAt,
    daysSinceUpdate,
  }
}

const USD_TO_INR = 84

export default function AdminUsers() {
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [counts, setCounts] = useState<Record<string, Counts>>({})
  const [monthUse, setMonthUse] = useState<Record<string, { calls: number; tokens: number; grounded: number }>>({})
  const [lastActive, setLastActive] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [drill, setDrill] = useState<DrilldownData | null>(null)
  const [drillLoading, setDrillLoading] = useState(false)
  const [editLimit, setEditLimit] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionOk, setActionOk] = useState<string | null>(null)
  const [paidByUser, setPaidByUser] = useState<Record<string, number>>({})
  const [deleteTarget, setDeleteTarget] = useState<Profile | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [profileFilter, setProfileFilter] = useState<'all' | 'complete' | 'incomplete'>('all')

  // Total ₹ paid per user (from the payments ledger; safe if the table is absent).
  useEffect(() => {
    supabase.from('payments').select('user_id, amount_inr').eq('status', 'paid')
      .then(({ data }) => {
        if (!data) return
        const agg: Record<string, number> = {}
        for (const r of data as Array<{ user_id: string | null; amount_inr: number | null }>) {
          if (r.user_id) agg[r.user_id] = (agg[r.user_id] ?? 0) + (r.amount_inr ?? 0)
        }
        setPaidByUser(agg)
      })
  }, [])

  // Admin sets the per-user monthly credit (API-call) limit — the gemini Edge
  // Function enforces it.
  async function saveCreditLimit(userId: string, value: string) {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 0) return
    await patchProfile(userId, { credit_limit: n })
  }

  // Privileged profile writes go through the `account` Edge Function (which
  // verifies the caller is_admin). The client can't write these columns directly.
  async function patchProfile(userId: string, patch: Record<string, unknown>) {
    setSavingId(userId)
    setActionError(null); setActionOk(null)
    // Uses a secure SECURITY DEFINER DB function (admin_rpc.sql) — no Edge
    // Function deployment needed. The function re-checks is_admin server-side.
    let { error } = await supabase.rpc('admin_update_profile', {
      target_user: userId,
      updates: patch,
    })
    if (error) {
      // Direct update fallback protected by admin RLS
      const { error: directErr } = await supabase.from('profiles').update(patch).eq('id', userId)
      if (!directErr) {
        error = null
      }
    }
    if (!error) {
      setProfiles(prev => prev.map(p => (p.id === userId ? { ...p, ...patch } : p)))
      void logAdminAction('Updated user profile', { targetType: 'user', targetId: userId, detail: { fields: Object.keys(patch) } })
      setActionOk('Saved. The change is live for the user immediately.')
      setTimeout(() => setActionOk(null), 3500)
    } else {
      const msg = error.message || 'unknown error'
      const forbidden = /forbidden|not an admin/i.test(msg)
      const missing = /could not find|does not exist|schema cache|function/i.test(msg)
      setActionError(
        forbidden
          ? "Save rejected: your account isn't a real admin yet. Run make_admin.sql (sets profiles.is_admin = true for your email), then reload this page."
          : missing
            ? 'Save failed: the admin update function is not installed. Run admin_rpc.sql in the Supabase SQL editor, then try again.'
            : `Save failed: ${msg}`
      )
    }
    setSavingId(null)
  }
  const toggleBlock = (userId: string, blocked: boolean) => patchProfile(userId, { is_blocked: !blocked })
  const setTier = (userId: string, plan: string) => {
    const oneYearAhead = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    return patchProfile(userId, { plan, plan_status: 'active', plan_expires_at: oneYearAhead })
  }
  const activateAccess = (userId: string, days = 365) => {
    const expires = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()
    return patchProfile(userId, { plan_status: 'active', plan_expires_at: expires })
  }
  async function resetQuota(userId: string) {
    if (!confirm('Reset this user\'s quota now? Their credit usage restarts from zero immediately.')) return
    await patchProfile(userId, { credits_reset_at: new Date().toISOString() })
  }
  function saveCredits(userId: string, value: string) {
    const n = parseInt(value, 10)
    if (Number.isNaN(n) || n < 0) return
    patchProfile(userId, { credits: n })
  }

  const [adminMsg, setAdminMsg] = useState<Record<string, string>>({})
  const [sendingMsgId, setSendingMsgId] = useState<string | null>(null)

  async function sendAdminMessage(targetUserId: string) {
    const text = (adminMsg[targetUserId] || '').trim()
    if (!text) return
    setSendingMsgId(targetUserId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const adminId = session?.user?.id
      if (!adminId) throw new Error('You must be signed in as admin.')

      if (targetUserId === adminId) {
        setActionError("Notice: You are messaging your own admin account. To test user inbox & notification delivery, please select another member's account from the list.")
        setTimeout(() => setActionError(null), 6000)
        setSendingMsgId(null)
        return
      }

      // 1. Try atomic server-side RPC first (bypasses any client RLS anomalies)
      let convId: string | null = null
      const { data: rpcCid, error: rpcErr } = await supabase.rpc('ebexta_admin_send_message', {
        p_user_id: targetUserId,
        p_body: text,
      })

      if (!rpcErr && rpcCid) {
        convId = rpcCid as string
      } else {
        // Fallback: direct conversation lookup/creation + message insert
        const a = adminId < targetUserId ? adminId : targetUserId
        const b = adminId < targetUserId ? targetUserId : adminId

        let { data: conv } = await supabase
          .from('conversations')
          .select('id')
          .eq('user_a', a)
          .eq('user_b', b)
          .maybeSingle()

        convId = conv?.id
        if (!convId) {
          // Try ketag_start_conversation or ebexta_start_conversation
          let { data: newCid } = await supabase.rpc('ebexta_start_conversation', { other_user: targetUserId })
          if (!newCid) {
            const res = await supabase.rpc('ketag_start_conversation', { other_user: targetUserId })
            newCid = res.data
          }
          if (newCid) {
            convId = newCid as string
          } else {
            const { data: insConv, error: insErr } = await supabase
              .from('conversations')
              .insert({ user_a: a, user_b: b, last_message: text, last_message_at: new Date().toISOString() })
              .select('id')
              .single()
            if (insErr) throw insErr
            convId = insConv.id
          }
        }

        // Insert message into messages table
        const { error: msgErr } = await supabase.from('messages').insert({
          conversation_id: convId,
          sender_id: adminId,
          body: text,
        })
        if (msgErr) throw msgErr

        // Update conversation touch
        await supabase.from('conversations').update({
          last_message: text,
          last_message_at: new Date().toISOString()
        }).eq('id', convId)
      }

      // Notify open tabs
      window.dispatchEvent(new CustomEvent('ebexta:new_message', { detail: { targetUserId, convId } }))

      setAdminMsg(s => ({ ...s, [targetUserId]: '' }))
      setActionOk('✓ Message sent directly to user inbox & notification center.')
      setTimeout(() => setActionOk(null), 3500)
    } catch (err: any) {
      setActionError(`Failed to send message: ${err.message}`)
      setTimeout(() => setActionError(null), 4000)
    } finally {
      setSendingMsgId(null)
    }
  }

  // Permanently delete a user + ALL their data + login.
  async function confirmDeleteUser() {
    if (!deleteTarget) return
    const targetId = deleteTarget.id
    setDeleting(true)
    setActionError(null)
    setActionOk(null)
    const err = await adminDeleteUser(targetId)
    setDeleting(false)
    if (err) {
      setActionError(
        /forbidden|not an admin/i.test(err)
          ? "Delete rejected: your account isn't an authorized admin. Run careers_and_admin_fixes.sql in Supabase."
          : /could not find|function|schema cache/i.test(err)
            ? 'Delete function not installed. Run careers_and_admin_fixes.sql in Supabase SQL editor.'
            : `Delete failed: ${err}`
      )
      return
    }
    setProfiles(prev => prev.filter(p => p.id !== targetId))
    if (expanded === targetId) setExpanded(null)
    setDeleteTarget(null)
    setActionOk('User and all associated data were permanently deleted from the database.')
    setTimeout(() => setActionOk(null), 4000)
    void load()
  }

  const load = useCallback(async () => {
    const [profilesRes, scansRes, leadsRes, reqsRes, savedRes, intentsRes, apiRes, logsRes] = await Promise.all([
      supabase.from('profiles').select('*').order('created_at', { ascending: false }),
      supabase.from('scans').select('user_id, created_at'),
      supabase.from('leads').select('user_id'),
      supabase.from('verification_requests').select('user_id'),
      supabase.from('saved_leads').select('user_id, saved_at'),
      supabase.from('declared_intents').select('user_id'),
      supabase.from('api_usage').select('user_id, calls, tokens_used, created_at, action'),
      supabase.from('system_logs').select('user_id, created_at').order('created_at', { ascending: false }).limit(1000),
    ])

    if (profilesRes.error) {
      setActionError(`Database error loading profiles: ${profilesRes.error.message}`)
    }

    const agg: Record<string, Counts> = {}
    const last: Record<string, string> = {}
    const bump = (uid: string | null, key: keyof Counts, n = 1) => {
      if (!uid) return
      agg[uid] = agg[uid] ?? { ...ZERO }
      agg[uid][key] += n
    }
    const touch = (uid: string | null, ts: string | null) => {
      if (!uid || !ts) return
      if (!last[uid] || ts > last[uid]) last[uid] = ts
    }

    ;(scansRes.data ?? []).forEach(r => { bump(r.user_id, 'scans'); touch(r.user_id, r.created_at) })
    ;(leadsRes.data ?? []).forEach(r => bump(r.user_id, 'leads'))
    ;(reqsRes.data ?? []).forEach(r => bump(r.user_id, 'requests'))
    ;(savedRes.data ?? []).forEach(r => { bump(r.user_id, 'saved'); touch(r.user_id, r.saved_at) })
    ;(intentsRes.data ?? []).forEach(r => bump(r.user_id, 'intents'))
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const monthAgg: Record<string, { calls: number; tokens: number; grounded: number }> = {}
    ;(apiRes.data ?? []).forEach(r => {
      bump(r.user_id, 'apiCalls', r.calls ?? 1)
      bump(r.user_id, 'tokens', r.tokens_used ?? 0)
      touch(r.user_id, r.created_at)
      // This-month usage per user → cost + remaining credits.
      if (r.user_id && r.created_at >= monthStart.toISOString()) {
        monthAgg[r.user_id] = monthAgg[r.user_id] ?? { calls: 0, tokens: 0, grounded: 0 }
        monthAgg[r.user_id].calls += r.calls ?? 1
        monthAgg[r.user_id].tokens += r.tokens_used ?? 0
        if (GROUNDED_ACTIONS.has((r as { action?: string }).action ?? '')) monthAgg[r.user_id].grounded += r.calls ?? 1
      }
    })
    ;(logsRes.data ?? []).forEach(r => touch(r.user_id, r.created_at))

    setProfiles((profilesRes.data ?? []) as Profile[])
    setCounts(agg)
    setMonthUse(monthAgg)
    setLastActive(last)
    setLoading(false)
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function toggleDrilldown(userId: string) {
    if (expanded === userId) { setExpanded(null); setDrill(null); return }
    setExpanded(userId)
    setDrill(null)
    setDrillLoading(true)
    const [scansRes, leadsRes, reqsRes, savedRes, intentsRes] = await Promise.all([
      supabase.from('scans').select('id, status, mode, created_at, filters').eq('user_id', userId).order('created_at', { ascending: false }).limit(15),
      supabase.from('leads').select('id, company_name, intent_score, verification_status, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      supabase.from('verification_requests').select('id, company_name, contact_name, status, requested_at').eq('user_id', userId).order('requested_at', { ascending: false }).limit(20),
      supabase.from('saved_leads').select('id, lead_snapshot, saved_at').eq('user_id', userId).order('saved_at', { ascending: false }).limit(20),
      supabase.from('declared_intents').select('id, requirement, mode, expires_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10),
    ])
    setDrill({
      scans: (scansRes.data ?? []) as DrilldownData['scans'],
      leads: leadsRes.data ?? [],
      requests: reqsRes.data ?? [],
      saved: (savedRes.data ?? []) as DrilldownData['saved'],
      intents: intentsRes.data ?? [],
    })
    setDrillLoading(false)
  }

  if (loading) return <Loading label="Loading users…" />

  const completeCount = profiles.filter(p => getProfileStatus(p).isComplete).length
  const incompleteCount = profiles.length - completeCount

  const displayedProfiles = profiles.filter(p => {
    if (profileFilter === 'all') return true
    const st = getProfileStatus(p)
    if (profileFilter === 'complete') return st.isComplete
    if (profileFilter === 'incomplete') return !st.isComplete
    return true
  })

  return (
    <div>
      <PageHeader
        icon="group"
        title="Users"
        subtitle={`${profiles.length} registered profile${profiles.length !== 1 ? 's' : ''}: click a row for the full activity drilldown.`}
      />

      {actionError && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold flex items-start gap-2"
          style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', color: '#DC2626' }}>
          <span className="material-symbols-outlined text-[18px]">error</span>
          <span>{actionError}</span>
        </div>
      )}
      {actionOk && (
        <div className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold flex items-center gap-2"
          style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.3)', color: 'var(--success)' }}>
          <span className="material-symbols-outlined text-[18px]">check_circle</span>
          <span>{actionOk}</span>
        </div>
      )}

      {/* Filter Tabs — Profile Completion status */}
      <div className="flex gap-2 mb-4">
        {[
          { key: 'all', label: `All Users (${profiles.length})` },
          { key: 'complete', label: `Profile Complete (${completeCount})`, tone: 'success' },
          { key: 'incomplete', label: `Incomplete Details (${incompleteCount})`, tone: 'warning' },
        ].map(t => {
          const isCur = profileFilter === t.key
          return (
            <button
              key={t.key}
              onClick={() => setProfileFilter(t.key as typeof profileFilter)}
              className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold transition-all"
              style={{
                background: isCur ? 'var(--accent-subtle)' : 'var(--bg-surface)',
                border: isCur ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
                color: isCur ? (t.tone === 'success' ? 'var(--success)' : t.tone === 'warning' ? 'var(--warning)' : 'var(--accent-interactive)') : 'var(--text-muted)',
              }}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      <Card>
        {displayedProfiles.length === 0 ? (
          <EmptyState title="No users match this filter" hint="Try selecting a different filter above." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Company</Th>
                  <Th>Company Profile</Th>
                  <Th>Email</Th>
                  <Th>Mode</Th>
                  <Th>Mission / Offering</Th>
                  <Th>Plan</Th>
                  <Th>Credit Limit / mo</Th>
                  <Th>Scans</Th>
                  <Th>Leads</Th>
                  <Th>Saved</Th>
                  <Th>API</Th>
                  <Th>Created</Th>
                  <Th>Last Active</Th>
                </tr>
              </thead>
              <tbody>
                {displayedProfiles.map(p => {
                  const c = counts[p.id] ?? ZERO
                  const isOpen = expanded === p.id
                  const pStatus = getProfileStatus(p)
                  return (
                    <Fragment key={p.id}>
                      <tr
                        onClick={() => toggleDrilldown(p.id)}
                        className="cursor-pointer transition-colors"
                        style={{ background: isOpen ? 'var(--accent-subtle)' : 'transparent' }}
                      >
                        <Td>
                          <div className="flex flex-col">
                            <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                              {p.name || (p as any).full_name || p.company_name || 'User'}
                            </span>
                            {p.company_name && (p.name || (p as any).full_name) && (
                              <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                                {p.company_name}
                              </span>
                            )}
                          </div>
                          {p.is_blocked && (
                            <span className="mt-1 px-1.5 py-0.5 rounded text-[9px] font-bold inline-block"
                              style={{ background: 'rgba(220,38,38,0.12)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>BLOCKED</span>
                          )}
                        </Td>
                        <Td>
                          {pStatus.isComplete ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.05em] inline-flex items-center gap-1"
                              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.35)', color: 'var(--success)' }}>
                              <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                              Complete
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-[0.05em] inline-flex items-center gap-1"
                              style={{ background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)' }}
                              title={`Missing: ${pStatus.missing.join(', ')}`}>
                              <span className="material-symbols-outlined text-[12px]">warning</span>
                              Incomplete ({pStatus.missing.length} missing)
                            </span>
                          )}
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-mono text-[12px]" style={{ color: 'var(--text-primary)' }}>
                              {p.email || p.sender_email || '—'}
                            </span>
                            {p.sender_email && p.email && p.sender_email.toLowerCase() !== p.email.toLowerCase() && (
                              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded w-fit"
                                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                                title="Outreach sender email used in pitches">
                                Outreach: {p.sender_email}
                              </span>
                            )}
                          </div>
                        </Td>
                        <Td><Pill label={(p.mode ?? 'seeker').toUpperCase()} tone={p.mode === 'provider' ? 'indigo' : 'neutral'} /></Td>
                        <Td>
                          <span className="text-[11px]" title={p.mission ?? undefined}>
                            {(p.mission ?? '—').slice(0, 48)}{(p.mission ?? '').length > 48 ? '…' : ''}
                          </span>
                        </Td>
                        <Td>
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] font-bold">{p.plan ?? 'starter'}</span>
                              <span
                                className="text-[9px] font-bold px-1.5 py-0.2 rounded uppercase"
                                style={p.plan_status === 'active'
                                  ? { background: 'rgba(16,185,129,0.12)', color: 'var(--success)' }
                                  : { background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}
                              >
                                {String(p.plan_status || 'none')}
                              </span>
                            </div>
                            {p.credits != null && <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{p.credits}cr</span>}
                          </div>
                        </Td>
                        <Td>
                          <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                            <input
                              type="number"
                              min={0}
                              defaultValue={p.credit_limit ?? 1000}
                              onChange={e => setEditLimit(s => ({ ...s, [p.id]: e.target.value }))}
                              className="w-16 px-1.5 py-0.5 rounded text-[11px] outline-none"
                              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                            />
                            <button
                              onClick={() => saveCreditLimit(p.id, editLimit[p.id] ?? String(p.credit_limit ?? 1000))}
                              disabled={savingId === p.id}
                              className="px-2 py-0.5 rounded text-[10px] font-bold"
                              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}
                            >
                              {savingId === p.id ? '…' : 'Set'}
                            </button>
                          </div>
                        </Td>
                        <Td mono>{c.scans}</Td>
                        <Td mono>{c.leads}</Td>
                        <Td mono>{c.saved}</Td>
                        <Td mono>{c.apiCalls}</Td>
                        <Td>{fmtDate(p.created_at)}</Td>
                        <Td>
                          <span className="text-[11px]">{lastActive[p.id] ? timeAgoLabel(lastActive[p.id]) : '—'}</span>
                        </Td>
                      </tr>

                      {isOpen && (
                        <tr>
                          <td colSpan={12} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <div className="px-4 py-4" style={{ background: 'var(--bg-elevated)' }}>
                              {drillLoading || !drill ? (
                                <p className="text-[12px] py-4 text-center" style={{ color: 'var(--text-muted)' }}>Loading drilldown…</p>
                              ) : (
                                <div className="space-y-4">
                                  {/* Account controls — block / reset / tier / credits */}
                                  <div className="p-3 rounded-xl flex flex-wrap items-end gap-4"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-1" style={{ color: 'var(--text-muted)' }}>Tier / Plan</p>
                                      <select
                                        value={(p.plan ?? 'starter')}
                                        onChange={e => setTier(p.id, e.target.value)}
                                        className="px-2 py-1.5 rounded-lg text-[12px] outline-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                      >
                                        {['starter', 'seeker', 'provider', 'enterprise'].map(pl => <option key={pl} value={pl}>{pl}</option>)}
                                      </select>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-1" style={{ color: 'var(--text-muted)' }} title="Display-only legacy balance. To extend a user's tokens, use the ‘Credit Limit / mo’ column — that is what the app actually enforces.">Credits balance <span style={{ textTransform: 'none', fontWeight: 400 }}>(display only)</span></p>
                                      <div className="flex items-center gap-1">
                                        <input type="number" min={0} defaultValue={p.credits ?? 0}
                                          onChange={e => setEditLimit(s => ({ ...s, [`cr_${p.id}`]: e.target.value }))}
                                          className="w-20 px-2 py-1.5 rounded-lg text-[12px] outline-none"
                                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                                        <button onClick={() => saveCredits(p.id, editLimit[`cr_${p.id}`] ?? String(p.credits ?? 0))}
                                          className="px-2 py-1 rounded text-[10px] font-bold"
                                          style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>Set</button>
                                      </div>
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-1" style={{ color: 'var(--text-muted)' }}>Account Access Status</p>
                                      <div className="flex items-center gap-2">
                                        <span className="text-[11px] font-bold px-2 py-1 rounded uppercase"
                                          style={p.plan_status === 'active'
                                            ? { background: 'rgba(16,185,129,0.15)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }
                                            : { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)', border: '1px solid rgba(245,158,11,0.3)' }}>
                                          {String(p.plan_status || 'NONE')}
                                        </span>
                                        <button
                                          onClick={() => activateAccess(p.id)}
                                          disabled={savingId === p.id}
                                          className="px-2.5 py-1 rounded text-[10px] font-bold flex items-center gap-1 transition-all hover:scale-[1.02]"
                                          style={{ background: 'var(--success)', color: '#fff' }}
                                          title="Activate account / grant 1 year full access"
                                        >
                                          <span className="material-symbols-outlined text-[13px]">key</span>
                                          {p.plan_status === 'active' ? 'Extend +1 Year' : 'Unlock & Activate (1yr)'}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-auto">
                                      <button onClick={() => resetQuota(p.id)} disabled={savingId === p.id}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                                        style={{ background: 'rgba(99,102,241,0.1)', color: '#4338CA', border: '1px solid rgba(99,102,241,0.25)' }}>
                                        Reset quota
                                      </button>
                                      <button onClick={() => toggleBlock(p.id, p.is_blocked === true)} disabled={savingId === p.id}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
                                        style={p.is_blocked
                                          ? { background: 'rgba(16,185,129,0.12)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.3)' }
                                          : { background: 'rgba(220,38,38,0.1)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.25)' }}>
                                        {p.is_blocked ? 'Unblock' : 'Block'}
                                      </button>
                                      <button
                                        onClick={e => {
                                          e.stopPropagation()
                                          setDeleteTarget(p)
                                        }}
                                        disabled={savingId === p.id}
                                        className="px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                                        style={{ background: 'var(--critical)', color: '#fff' }}
                                      >
                                        Delete user
                                      </button>
                                    </div>
                                  </div>

                                  {/* Admin Direct Message to User */}
                                  <div className="p-3.5 rounded-xl space-y-2"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <span className="material-symbols-outlined text-[17px]" style={{ color: 'var(--accent-interactive)' }}>mail</span>
                                        <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--text-primary)' }}>
                                          Send Direct Message to {p.company_name || p.sender_email || 'User'}
                                        </span>
                                      </div>
                                      <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                        Appears directly in user's Notification Center & Inbox
                                      </span>
                                    </div>
                                    <div className="flex gap-2">
                                      <input
                                        type="text"
                                        placeholder={`Message to ${p.company_name || p.sender_email || 'user'} (e.g. Plan activated, profile details update requested)…`}
                                        value={adminMsg[p.id] || ''}
                                        onChange={e => setAdminMsg(s => ({ ...s, [p.id]: e.target.value }))}
                                        onKeyDown={e => { if (e.key === 'Enter') void sendAdminMessage(p.id) }}
                                        className="flex-1 px-3 py-2 rounded-lg text-[12px] outline-none"
                                        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                                      />
                                      <button
                                        onClick={() => sendAdminMessage(p.id)}
                                        disabled={sendingMsgId === p.id || !adminMsg[p.id]?.trim()}
                                        className="px-4 py-2 rounded-lg text-[12px] font-bold flex items-center gap-1.5 transition-all hover:scale-[1.02] disabled:opacity-50"
                                        style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
                                      >
                                        <span className="material-symbols-outlined text-[15px]">send</span>
                                        <span>{sendingMsgId === p.id ? 'Sending…' : 'Send'}</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Spend, credits & onboarding details */}
                                  {(() => {
                                    const mu = monthUse[p.id] ?? { calls: 0, tokens: 0, grounded: 0 }
                                    // Real cost ≈ token cost + grounding OVERAGE (past the free daily tier).
                                    const costInr = ((mu.tokens / 1_000_000) * EST_USD_PER_1M_TOKENS + Math.max(0, mu.grounded - GROUNDING_FREE_PER_DAY) * GROUNDING_USD_PER_CALL) * USD_TO_INR
                                    const limit = p.credit_limit ?? 1000
                                    const remaining = Math.max(0, limit - mu.calls)
                                    const stat = (label: string, val: string) => (
                                      <div className="px-3 py-2 rounded-lg" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                        <p className="text-[9px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>{label}</p>
                                        <p className="text-[13px] font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{val}</p>
                                      </div>
                                    )
                                    return (
                                      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                                        {stat('Est. API cost (mo)', `₹${costInr.toFixed(2)}`)}
                                        {stat('Total paid (₹)', `₹${(paidByUser[p.id] ?? 0).toLocaleString('en-IN')}`)}
                                        {stat('Credits used (mo)', `${mu.calls}`)}
                                        {stat('Credits remaining', `${remaining} / ${limit}`)}
                                        {stat('Credits balance', `${p.credits ?? 0}`)}
                                        {stat('Plan', `${p.plan ?? 'starter'}`)}
                                      </div>
                                    )
                                  })()}

                                  {/* Onboarding profile details */}
                                  <div className="p-3.5 rounded-xl space-y-2"
                                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                                    <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-2 mb-2">
                                      <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-secondary)] flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-[15px] text-[var(--accent-interactive)]">admin_panel_settings</span>
                                        User Profile &amp; Verified Business Details
                                      </span>
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          const newName = prompt(`Enter new verified Company Name for user (${p.email || p.sender_email || p.id}):`, p.company_name || '')
                                          if (newName !== null && newName.trim()) {
                                            await patchProfile(p.id, { company_name: newName.trim() })
                                          }
                                        }}
                                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-[var(--accent)] text-[var(--bg-elevated)] hover:opacity-90 transition-all flex items-center gap-1 cursor-pointer"
                                      >
                                        <span className="material-symbols-outlined text-[13px]">edit</span>
                                        Edit Official Company Name
                                      </button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
                                      {([
                                        ['Member Name', p.name || (p as any).full_name || '—'],
                                        ['Verified Company', p.company_name || '—'],
                                        ['Account Email', p.email || p.sender_email || '—'],
                                        ['Outreach Email', p.sender_email || 'Same as account'],
                                        ['Website', (p.website as string) ?? '—'],
                                        ['Mode', (p.mode ?? 'seeker')],
                                        ['Mission / Offering', p.mission],
                                      ] as Array<[string, string | null | undefined]>).map(([label, val]) => (
                                        <div key={label} className="flex gap-2 text-[12px]">
                                          <span className="w-32 shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{val || '—'}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Company Profile 11 Fields Breakdown */}
                                  {(() => {
                                    const cpStatus = getProfileStatus(p)
                                    const cp = (p.company_profile && typeof p.company_profile === 'object') ? (p.company_profile as Record<string, any>) : {}
                                    return (
                                      <div className="p-3.5 rounded-xl space-y-2.5"
                                        style={{
                                          background: 'var(--bg-surface)',
                                          border: cpStatus.status === 'complete' ? '1px solid rgba(16,185,129,0.3)' : '1px solid rgba(245,158,11,0.3)'
                                        }}>
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center gap-2">
                                            <span className="text-[11px] font-bold uppercase tracking-[0.07em]" style={{ color: 'var(--text-primary)' }}>
                                              Company Details Profile ({cpStatus.filledCount}/{cpStatus.totalCount} Fields Filled)
                                            </span>
                                            <Pill
                                              label={cpStatus.status === 'complete' ? 'COMPLETE' : 'INCOMPLETE'}
                                              tone={cpStatus.status === 'complete' ? 'green' : 'amber'}
                                            />
                                          </div>
                                          {cpStatus.updatedAt && (
                                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                                              Last updated: {fmtDate(cpStatus.updatedAt)} ({cpStatus.daysSinceUpdate}d ago)
                                            </span>
                                          )}
                                        </div>

                                        {/* Grid of 11 fields */}
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-[11px]">
                                          {CP_FIELDS_LABELS.map(([key, label]) => {
                                            const val = cp[key]
                                            const isFilled = val !== undefined && val !== null && String(val).trim().length > 0
                                            return (
                                              <div key={key} className="p-2 rounded-lg" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                  <span className="font-semibold truncate text-[10px]" style={{ color: 'var(--text-muted)' }}>{label}</span>
                                                  <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded"
                                                    style={isFilled
                                                      ? { background: 'rgba(16,185,129,0.15)', color: 'var(--success)' }
                                                      : { background: 'rgba(245,158,11,0.15)', color: 'var(--warning)' }}>
                                                    {isFilled ? 'FILLED' : 'MISSING'}
                                                  </span>
                                                </div>
                                                <p className="text-[11px] line-clamp-2" style={{ color: isFilled ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                                                  {isFilled ? String(val) : '— Not provided by user'}
                                                </p>
                                              </div>
                                            )
                                          })}
                                        </div>
                                      </div>
                                    )
                                  })()}

                                  {/* Activity chips */}
                                  <div className="flex gap-2 flex-wrap">
                                    {([
                                      ['Scans', c.scans], ['Leads', c.leads], ['Saved', c.saved],
                                      ['Verif. requests', c.requests], ['Intents', c.intents],
                                      ['API calls', c.apiCalls], ['Tokens', c.tokens.toLocaleString()],
                                    ] as Array<[string, number | string]>).map(([label, v]) => (
                                      <span key={label} className="px-2.5 py-1 rounded-lg text-[11px] font-bold"
                                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                                        {label}: <span className="font-mono" style={{ color: 'var(--text-primary)' }}>{v}</span>
                                      </span>
                                    ))}
                                  </div>

                                  {/* Scans with filters used */}
                                  <div>
                                    <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--text-muted)' }}>
                                      Scans: with the filters they used ({drill.scans.length})
                                    </p>
                                    {drill.scans.length === 0
                                      ? <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>No scans yet</p>
                                      : drill.scans.slice(0, 8).map(s => (
                                        <div key={s.id} className="flex items-center gap-2 py-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                          <span className="w-20 shrink-0">{fmtDate(s.created_at)}</span>
                                          <Pill label={(s.mode ?? '—').toUpperCase()} tone={s.mode === 'provider' ? 'indigo' : 'neutral'} />
                                          <span className="truncate flex-1" style={{ color: 'var(--text-muted)' }}>{filtersSummary(s.filters)}</span>
                                          <Pill label={s.status ?? '—'} tone={s.status === 'complete' ? 'green' : 'neutral'} />
                                        </div>
                                      ))}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                    {/* Leads */}
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--text-muted)' }}>
                                        Leads ({drill.leads.length})
                                      </p>
                                      {drill.leads.length === 0
                                        ? <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>None</p>
                                        : drill.leads.slice(0, 8).map(l => (
                                          <div key={l.id} className="flex items-center justify-between py-1 gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                            <span className="truncate">{l.company_name ?? '—'}</span>
                                            <Pill
                                              label={l.verification_status === 'VERIFIED' ? 'VER' : l.verification_status === 'PARTIALLY_VERIFIED' ? 'PART' : 'REV'}
                                              tone={verificationTone(l.verification_status)}
                                            />
                                          </div>
                                        ))}
                                    </div>
                                    {/* Saved leads */}
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--text-muted)' }}>
                                        Saved Leads ({drill.saved.length})
                                      </p>
                                      {drill.saved.length === 0
                                        ? <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>None</p>
                                        : drill.saved.slice(0, 8).map(sv => (
                                          <div key={sv.id} className="flex items-center justify-between py-1 gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                            <span className="truncate">{sv.lead_snapshot?.company_name ?? '—'}</span>
                                            <span style={{ color: 'var(--text-muted)' }}>{fmtDate(sv.saved_at)}</span>
                                          </div>
                                        ))}
                                    </div>
                                    {/* Requests + intents */}
                                    <div>
                                      <p className="text-[10px] font-bold uppercase tracking-[0.07em] mb-2" style={{ color: 'var(--text-muted)' }}>
                                        Verif. Requests ({drill.requests.length}) · Intents ({drill.intents.length})
                                      </p>
                                      {drill.requests.slice(0, 4).map(r => (
                                        <div key={r.id} className="flex items-center justify-between py-1 gap-2 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                          <span className="truncate">{r.company_name ?? '—'} · {r.contact_name ?? '—'}</span>
                                          <Pill label={r.status ?? '—'} tone={r.status === 'delivered' ? 'green' : r.status === 'could_not_verify' ? 'amber' : 'neutral'} />
                                        </div>
                                      ))}
                                      {drill.intents.slice(0, 4).map(it => (
                                        <div key={it.id} className="py-1 text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                                          <span className="material-symbols-outlined text-[11px] mr-1" style={{ color: 'var(--accent-interactive)' }}>ads_click</span>
                                          {it.requirement.slice(0, 50)}{it.requirement.length > 50 ? '…' : ''}
                                        </div>
                                      ))}
                                      {drill.requests.length === 0 && drill.intents.length === 0 && (
                                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>None</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {deleteTarget && (
        <DeleteUserModal
          user={deleteTarget}
          onClose={() => { if (!deleting) setDeleteTarget(null) }}
          onConfirm={confirmDeleteUser}
          deleting={deleting}
        />
      )}
    </div>
  )
}

function DeleteUserModal({
  user,
  onClose,
  onConfirm,
  deleting,
}: {
  user: Profile
  onClose: () => void
  onConfirm: () => void
  deleting: boolean
}) {
  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget && !deleting) onClose() }}
    >
      <div
        className="w-full max-w-[500px] rounded-2xl p-6 shadow-2xl space-y-5"
        style={{
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-primary)',
        }}
      >
        {/* Header with warning icon */}
        <div className="flex items-start gap-3">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--critical)', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            <span className="material-symbols-outlined text-[24px]">delete_forever</span>
          </div>
          <div>
            <h3 className="text-[17px] font-bold tracking-tight" style={{ color: 'var(--text-primary)' }}>
              Delete User Permanently?
            </h3>
            <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
              This action is destructive and irreversible.
            </p>
          </div>
        </div>

        {/* User preview card */}
        <div
          className="p-3.5 rounded-xl space-y-1.5 text-[12px]"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Name / User:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{user.name || (user as any).full_name || '—'}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Company:</span>
            <strong style={{ color: 'var(--text-primary)' }}>{user.company_name || '—'}</strong>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Account Email:</span>
            <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{user.email || user.sender_email || '—'}</span>
          </div>
          {user.sender_email && user.email && user.sender_email.toLowerCase() !== user.email.toLowerCase() && (
            <div className="flex justify-between">
              <span style={{ color: 'var(--text-muted)' }}>Outreach Email:</span>
              <span className="font-mono" style={{ color: 'var(--text-secondary)' }}>{user.sender_email}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>Plan / Tier:</span>
            <span className="font-semibold uppercase text-[11px]">{user.plan || 'starter'}</span>
          </div>
          <div className="flex justify-between">
            <span style={{ color: 'var(--text-muted)' }}>User ID:</span>
            <span className="font-mono text-[10px] opacity-70">{user.id}</span>
          </div>
        </div>

        {/* Warning text */}
        <div
          className="p-3 rounded-xl text-[12px] leading-relaxed"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'var(--critical)',
          }}
        >
          All data belonging to this user will be wiped from the database: leads, scans, saved leads, verification requests, declared intents, messages, and login account.
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            disabled={deleting}
            onClick={onClose}
            className="px-4 h-9 rounded-xl text-[12px] font-medium transition-colors hover:text-[var(--text-primary)] disabled:opacity-50"
            style={{ color: 'var(--text-muted)' }}
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={deleting}
            onClick={onConfirm}
            className="px-5 h-9 rounded-xl text-[12px] font-bold inline-flex items-center gap-2 transition-all hover:opacity-90 active:scale-95 disabled:opacity-50"
            style={{ background: 'var(--critical)', color: '#fff' }}
          >
            {deleting ? (
              <>
                <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" />
                Deleting User…
              </>
            ) : (
              <>
                Permanently Delete
                <span className="material-symbols-outlined text-[16px]">delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
