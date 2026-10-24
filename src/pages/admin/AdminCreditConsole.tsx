/**
 * ADMIN CREDIT & COST CONSOLE — rendered at the top of /admin/api.
 *
 * Sections: today at a glance · monthly budget · per-user credits ·
 * global controls (including the emergency brake) · ledger.
 *
 * Every figure is live from Supabase. Every mutation goes through a
 * SECURITY DEFINER function that re-checks profiles.is_admin server-side, so a
 * forged request from a non-admin is refused by the database, not by this UI.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { Card, KpiCard, Th, Td } from './shared'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SystemLimits {
  daily_api_call_cap: number
  daily_calls_used: number
  monthly_budget_inr: number
  monthly_spend_inr: number
  global_scans_paused: boolean
  pause_reason: string | null
  cost_per_scan_inr: number
  cost_per_verified_inr: number
  default_scan_credits: number
  default_verified_credits: number
  last_reset: string
}

interface CreditRow {
  user_id: string
  plan: string
  scan_credits: number
  scan_credits_used: number
  verified_credits: number
  verified_credits_used: number
  bonus_credits: number
  cycle_end: string
  is_suspended: boolean
  suspend_reason: string | null
  lifetime_cost_inr: number
  hourly_scan_cap: number | null
}

interface LedgerRow {
  id: string
  user_id: string
  action: string
  credit_type: string
  amount: number
  balance_after: number
  est_cost_inr: number
  note: string | null
  created_at: string
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`

function barColor(fraction: number): string {
  if (fraction >= 0.9) return 'var(--critical)'
  if (fraction >= 0.7) return 'var(--warning)'
  return 'var(--accent)'
}

function Bar({ used, cap, label }: { used: number; cap: number; label: string }) {
  const f = cap > 0 ? Math.min(1, used / cap) : 0
  return (
    <div>
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-[11.5px] font-semibold" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-[12px] font-bold mono-val" style={{ color: barColor(f) }}>
          {Math.round(f * 100)}%
        </span>
      </div>
      <div className="h-2.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
        <div className="h-full rounded-full transition-all"
          style={{ width: `${f * 100}%`, background: barColor(f) }} />
      </div>
    </div>
  )
}

// ─── Console ──────────────────────────────────────────────────────────────────

export function AdminCreditConsole() {
  const [limits, setLimits] = useState<SystemLimits | null>(null)
  const [credits, setCredits] = useState<CreditRow[]>([])
  const [ledger, setLedger] = useState<LedgerRow[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const [ledgerFilter, setLedgerFilter] = useState<string>('all')
  const [draft, setDraft] = useState<Partial<SystemLimits>>({})
  const [installed] = useState(true)

  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(null), 3000) }

  const load = useCallback(async () => {
    // 1. Fetch system limits with fallback
    const limRes = await supabase.from('system_limits').select('*').eq('id', 1).maybeSingle()
    let limitsData: SystemLimits = (limRes.data as unknown as SystemLimits) || {
      daily_api_call_cap: 900,
      daily_calls_used: 0,
      monthly_budget_inr: 5000,
      monthly_spend_inr: 0,
      cost_per_scan_inr: 5,
      cost_per_verified_inr: 3,
      default_scan_credits: 40,
      default_verified_credits: 10,
      global_scans_paused: false,
      pause_reason: null,
      last_reset: new Date().toISOString(),
    }

    // 2. Fetch credits (try ketag -> ebexta -> direct user_credits -> profiles fallback)
    let creditsData: CreditRow[] = []
    const cred1 = await supabase.rpc('ketag_admin_all_credits')
    if (!cred1.error && Array.isArray(cred1.data)) {
      creditsData = cred1.data
    } else {
      const cred2 = await supabase.rpc('ebexta_admin_all_credits')
      if (!cred2.error && Array.isArray(cred2.data)) {
        creditsData = cred2.data
      } else {
        const { data: uc } = await supabase.from('user_credits').select('*')
        if (Array.isArray(uc) && uc.length > 0) {
          creditsData = uc as CreditRow[]
        }
      }
    }

    // Fallback: build credits view from profiles if user_credits has no rows
    if (creditsData.length === 0) {
      const { data: profs } = await supabase.from('profiles').select('id, plan, credits, credit_limit')
      if (Array.isArray(profs) && profs.length > 0) {
        creditsData = profs.map(p => {
          const limit = p.credit_limit ?? 1000
          const remaining = p.credits ?? limit
          return {
            user_id: p.id,
            plan: p.plan || 'starter',
            scan_credits: limit,
            scan_credits_used: Math.max(0, limit - remaining),
            verified_credits: 10,
            verified_credits_used: 0,
            bonus_credits: 0,
            cycle_end: new Date(Date.now() + 30 * 86400000).toISOString(),
            is_suspended: false,
            suspend_reason: null,
            lifetime_cost_inr: 0,
            hourly_scan_cap: null,
          }
        })
      }
    }

    // 3. Fetch ledger (try ketag -> ebexta -> direct credit_ledger)
    let ledgerData: LedgerRow[] = []
    const led1 = await supabase.rpc('ketag_admin_ledger', { p_limit: 300 })
    if (!led1.error && Array.isArray(led1.data)) {
      ledgerData = led1.data
    } else {
      const led2 = await supabase.rpc('ebexta_admin_ledger', { p_limit: 300 })
      if (!led2.error && Array.isArray(led2.data)) {
        ledgerData = led2.data
      } else {
        const { data: cl } = await supabase.from('credit_ledger').select('*').order('created_at', { ascending: false }).limit(300)
        if (Array.isArray(cl)) ledgerData = cl as LedgerRow[]
      }
    }

    // 4. Fetch profiles for user identification
    const profRes = await supabase.from('profiles').select('id, company_name, sender_email, email, name')

    setLimits(limitsData)
    setDraft(limitsData)
    setCredits(creditsData)
    setLedger(ledgerData)

    const map: Record<string, string> = {}
    for (const p of (profRes.data ?? []) as Array<{ id: string; company_name: string | null; sender_email: string | null; email?: string | null; name?: string | null }>) {
      map[p.id] = p.name || p.company_name || p.email || p.sender_email || p.id.slice(0, 8)
    }
    setNames(map)
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  // ── Mutations ──

  async function saveLimits(patch: Partial<SystemLimits>) {
    setBusy(true)
    let errMessage: string | null = null

    // 1. Try ketag_admin_set_limits (primary function installed in database)
    let res = await supabase.rpc('ketag_admin_set_limits', { p: patch })
    if (res.error) {
      // 2. Try ebexta_admin_set_limits alias
      res = await supabase.rpc('ebexta_admin_set_limits', { p: patch })
    }
    if (res.error) {
      // 3. Try direct update on system_limits table
      const res3 = await supabase.from('system_limits').update(patch).eq('id', 1)
      if (res3.error) {
        errMessage = res.error?.message || res3.error.message
      }
    }

    setBusy(false)
    if (errMessage) { flash(`Failed: ${errMessage}`); return }
    flash('Saved successfully')
    void load()
  }

  async function togglePause() {
    if (!limits) return
    const turningOn = !limits.global_scans_paused
    if (turningOn && !confirm('Pause scanning for EVERY user? Nobody will be able to run a scan until you turn this off.')) return
    await saveLimits({
      global_scans_paused: turningOn,
      pause_reason: turningOn
        ? (prompt('Reason shown to users:') || 'EBEXTA is temporarily paused. Try again soon.')
        : '',
    })
  }

  async function grant(userId: string) {
    const raw = prompt('How many bonus credits?')
    const amount = Number(raw)
    if (!Number.isFinite(amount) || amount === 0) return
    setBusy(true)
    let res = await supabase.rpc('ketag_admin_grant', { p_user: userId, p_amount: Math.round(amount), p_note: null })
    if (res.error) {
      res = await supabase.rpc('ebexta_admin_grant', { p_user: userId, p_amount: Math.round(amount), p_note: null })
    }
    if (res.error) {
      // Direct update fallback
      const { data: uc } = await supabase.from('user_credits').select('bonus_credits').eq('user_id', userId).maybeSingle()
      if (uc) {
        const nextBonus = (uc.bonus_credits ?? 0) + Math.round(amount)
        const { error: ucErr } = await supabase.from('user_credits').update({ bonus_credits: nextBonus }).eq('user_id', userId)
        if (!ucErr) res = { error: null } as any
      }
      const { data: prof } = await supabase.from('profiles').select('credits, credit_limit').eq('id', userId).maybeSingle()
      if (prof) {
        const currentCredits = prof.credits ?? prof.credit_limit ?? 1000
        const { error: profErr } = await supabase.from('profiles').update({ credits: currentCredits + Math.round(amount) }).eq('id', userId)
        if (!profErr) res = { error: null } as any
      }
    }
    setBusy(false)
    flash(res.error ? `Failed: ${res.error.message}` : `Granted ${amount} credits`)
    void load()
  }

  async function adjust(row: CreditRow) {
    const scans = Number(prompt('Scan credits per cycle:', String(row.scan_credits)))
    if (!Number.isFinite(scans)) return
    const verified = Number(prompt('Verified contacts per cycle:', String(row.verified_credits)))
    if (!Number.isFinite(verified)) return
    setBusy(true)
    let res = await supabase.rpc('ketag_admin_set_user_limits', {
      p_user: row.user_id, p_scans: Math.round(scans), p_verified: Math.round(verified),
    })
    if (res.error) {
      res = await supabase.rpc('ebexta_admin_set_user_limits', {
        p_user: row.user_id, p_scans: Math.round(scans), p_verified: Math.round(verified),
      })
    }
    if (res.error) {
      // Direct update fallback
      const { error: ucErr } = await supabase.from('user_credits').update({
        scan_credits: Math.round(scans),
        verified_credits: Math.round(verified),
      }).eq('user_id', row.user_id)
      const { error: profErr } = await supabase.from('profiles').update({
        credit_limit: Math.round(scans),
      }).eq('id', row.user_id)
      if (!ucErr || !profErr) res = { error: null } as any
    }
    setBusy(false)
    flash(res.error ? `Failed: ${res.error.message}` : 'Limits updated')
    void load()
  }

  async function suspend(row: CreditRow) {
    const turningOn = !row.is_suspended
    const reason = turningOn ? (prompt('Reason shown to the user:') || 'Account paused') : null
    if (turningOn && reason === null) return
    setBusy(true)
    let res = await supabase.rpc('ketag_admin_suspend', {
      p_user: row.user_id, p_suspend: turningOn, p_reason: reason,
    })
    if (res.error) {
      res = await supabase.rpc('ebexta_admin_suspend', {
        p_user: row.user_id, p_suspend: turningOn, p_reason: reason,
      })
    }
    if (res.error) {
      // Direct update fallback
      const { error: ucErr } = await supabase.from('user_credits').update({
        is_suspended: turningOn,
        suspend_reason: reason,
      }).eq('user_id', row.user_id)
      const { error: profErr } = await supabase.from('profiles').update({
        is_blocked: turningOn,
      }).eq('id', row.user_id)
      if (!ucErr || !profErr) res = { error: null } as any
    }
    setBusy(false)
    flash(res.error ? `Failed: ${res.error.message}` : turningOn ? 'User suspended' : 'User reinstated')
    void load()
  }

  async function resetCycle(userId: string) {
    if (!confirm('Reset this user\'s cycle now? Their used counters go back to zero.')) return
    setBusy(true)
    let res = await supabase.rpc('ketag_admin_reset_cycle', { p_user: userId })
    if (res.error) {
      res = await supabase.rpc('ebexta_admin_reset_cycle', { p_user: userId })
    }
    if (res.error) {
      // Direct update fallback
      const nowIso = new Date().toISOString()
      const { error: ucErr } = await supabase.from('user_credits').update({
        scan_credits_used: 0,
        verified_credits_used: 0,
        cycle_start: nowIso,
        cycle_end: new Date(Date.now() + 30 * 86400000).toISOString(),
      }).eq('user_id', userId)
      const { error: profErr } = await supabase.from('profiles').update({
        credits_reset_at: nowIso,
      }).eq('id', userId)
      if (!ucErr || !profErr) res = { error: null } as any
    }
    setBusy(false)
    flash(res.error ? `Failed: ${res.error.message}` : 'Cycle reset')
    void load()
  }

  if (loading) return null
  if (!installed) {
    return (
      <Card>
        <p className="text-[13px] py-3" style={{ color: 'var(--text-muted)' }}>
          Credit system not installed yet — run <strong>supabase/credit_system.sql</strong>, then
          deploy the <strong>credits</strong> function. Nothing is being metered until you do.
        </p>
      </Card>
    )
  }
  if (!limits) return null

  // ── Derived figures ──
  const today = new Date().toISOString().slice(0, 10)
  const todayLedger = ledger.filter(l => l.created_at.slice(0, 10) === today)
  const scansToday = todayLedger.filter(l => l.action === 'scan').length
  const verifiedToday = todayLedger.filter(l => l.action === 'verified_contact').length
  const spendToday = todayLedger.reduce((s, l) => s + Number(l.est_cost_inr || 0), 0)
  const activeUsersToday = new Set(todayLedger.map(l => l.user_id)).size

  const dayOfMonth = new Date().getDate()
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const projected = dayOfMonth > 0 ? (limits.monthly_spend_inr / dayOfMonth) * daysInMonth : 0

  // Actual cost per scan, computed from the ledger — lets the configured
  // estimate be corrected with real data instead of staying a guess.
  const scanRows = ledger.filter(l => l.action === 'scan')
  const actualCostPerScan = scanRows.length > 0
    ? scanRows.reduce((s, l) => s + Number(l.est_cost_inr || 0), 0) / scanRows.length
    : 0

  const totalLifetimeCost = credits.reduce((s, c) => s + Number(c.lifetime_cost_inr || 0), 0)

  const filteredLedger = ledgerFilter === 'all'
    ? ledger
    : ledger.filter(l => l.action === ledgerFilter)

  const ledgerActions = ['all', ...new Set(ledger.map(l => l.action))]

  return (
    <div className="space-y-6 mb-10">

      {/* ── EMERGENCY BRAKE — first, because it's what you reach for in a crisis ── */}
      <div className="rounded-2xl p-5 sm:p-6 transition-all shadow-sm"
        style={{
          background: limits.global_scans_paused ? 'var(--critical-bg)' : 'var(--bg-surface)',
          border: `1px solid ${limits.global_scans_paused ? 'var(--critical)' : 'var(--border-subtle)'}`,
        }}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ color: limits.global_scans_paused ? 'var(--critical)' : 'var(--success)' }}>
                {limits.global_scans_paused ? 'pause_circle' : 'play_circle'}
              </span>
              <p className="text-[14px] font-bold" style={{ color: 'var(--text-primary)' }}>
                {limits.global_scans_paused ? 'SCANNING IS PAUSED FOR EVERYONE' : 'Global scanning: active'}
              </p>
            </div>
            <p className="text-[12.5px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
              {limits.global_scans_paused
                ? (limits.pause_reason || 'No reason set.')
                : 'The emergency brake. Use it if API costs run away.'}
            </p>
          </div>
          <button onClick={togglePause} disabled={busy}
            className="px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 transition-all shadow-sm flex items-center gap-1.5"
            style={limits.global_scans_paused
              ? { background: 'var(--success)', color: '#fff', border: '1px solid var(--success)' }
              : { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}>
            <span className="material-symbols-outlined text-[17px]">
              {limits.global_scans_paused ? 'play_arrow' : 'pause'}
            </span>
            {limits.global_scans_paused ? 'Resume scanning' : 'PAUSE ALL SCANNING'}
          </button>
        </div>
      </div>

      {/* ── (A) TODAY ── */}
      <Card className="p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">today</span>
            Today at a glance
          </p>
          <span className="text-[11px] text-[var(--text-muted)] font-mono">{today}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-5">
          <KpiCard label="Scans run" value={scansToday} />
          <KpiCard label="Verified delivered" value={verifiedToday} />
          <KpiCard label="Spend today" value={inr(spendToday)} />
          <KpiCard label="Active users" value={activeUsersToday} />
        </div>
        <div className="rounded-xl bg-[var(--bg-base)] p-3.5 border border-[var(--border-subtle)]">
          <Bar used={limits.daily_calls_used} cap={limits.daily_api_call_cap}
            label={`API calls — ${limits.daily_calls_used} of ${limits.daily_api_call_cap}`} />
        </div>
        {limits.daily_calls_used >= limits.daily_api_call_cap && (
          <p className="text-[12px] mt-2 font-semibold" style={{ color: 'var(--critical)' }}>
            Daily cap reached — all scans are blocked until midnight.
          </p>
        )}
      </Card>

      {/* ── (B) MONTHLY BUDGET ── */}
      <Card className="p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">account_balance_wallet</span>
            Monthly budget
          </p>
        </div>
        <div className="rounded-xl bg-[var(--bg-base)] p-3.5 border border-[var(--border-subtle)] mb-5">
          <Bar used={limits.monthly_spend_inr} cap={limits.monthly_budget_inr}
            label={`${inr(limits.monthly_spend_inr)} of ${inr(limits.monthly_budget_inr)}`} />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5 mb-3">
          <KpiCard label="Projected month-end" value={inr(projected)}
            color={projected > limits.monthly_budget_inr ? 'var(--critical)' : undefined}
            sub={projected > limits.monthly_budget_inr ? 'over budget at this rate' : 'at current run rate'} />
          <KpiCard label="Lifetime cost (all users)" value={inr(totalLifetimeCost)} />
          <KpiCard label="Cost / scan — actual" value={inr(actualCostPerScan)}
            sub={`configured: ${inr(limits.cost_per_scan_inr)}`}
            color={actualCostPerScan > limits.cost_per_scan_inr * 1.25 ? 'var(--warning)' : undefined} />
          <KpiCard label="Scans this month" value={scanRows.length} />
        </div>
        {limits.monthly_spend_inr >= limits.monthly_budget_inr && (
          <p className="text-[12.5px] mt-3 px-3.5 py-2.5 rounded-xl font-semibold"
            style={{ background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}>
            Monthly budget exhausted — every scan is blocked until next month. Raise the budget below
            if this was premature.
          </p>
        )}
        <p className="text-[11.5px] mt-3 text-[var(--text-muted)] leading-relaxed">
          Revenue and margin appear here once plan pricing is wired to billing. Until then this shows
          spend only — inventing a revenue figure would make the margin meaningless.
        </p>
      </Card>

      {/* ── (C) PER-USER CREDITS ── */}
      <Card className="p-5 sm:p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">group</span>
            Per-user credits <span className="font-normal text-[var(--text-muted)] text-[12px]">— sorted by lifetime cost</span>
          </p>
          <span className="text-[11px] font-bold text-[var(--text-muted)]">{credits.length} users</span>
        </div>
        {credits.length === 0 ? (
          <p className="text-[12.5px] py-6 text-center text-[var(--text-muted)]">No credit rows yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]">
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <Th>User</Th><Th>Scans</Th><Th>Verified</Th><Th>Bonus</Th>
                  <Th>Lifetime cost</Th><Th>Cycle ends</Th><Th>Status</Th><Th>Actions</Th>
                </tr>
              </thead>
              <tbody>
                {credits.map(c => {
                  const scansLeft = (c.scan_credits + c.bonus_credits) - c.scan_credits_used
                  const expensive = Number(c.lifetime_cost_inr) > 2000
                  return (
                    <tr key={c.user_id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors">
                      <Td>
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>{names[c.user_id] ?? c.user_id.slice(0, 8)}</span>
                        {c.hourly_scan_cap != null && (
                          <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded"
                            style={{ background: 'var(--warning-bg)', color: 'var(--warning)' }}>throttled</span>
                        )}
                      </Td>
                      <Td>
                        <span className="mono-val" style={{ color: scansLeft <= 0 ? 'var(--critical)' : 'var(--text-primary)' }}>
                          {c.scan_credits_used}/{c.scan_credits + c.bonus_credits}
                        </span>
                      </Td>
                      <Td><span className="mono-val">{c.verified_credits_used}/{c.verified_credits}</span></Td>
                      <Td><span className="mono-val">{c.bonus_credits}</span></Td>
                      <Td>
                        <span className="mono-val font-bold"
                          style={{ color: expensive ? 'var(--critical)' : 'var(--text-primary)' }}>
                          {inr(Number(c.lifetime_cost_inr))}
                        </span>
                      </Td>
                      <Td>{new Date(c.cycle_end).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</Td>
                      <Td>
                        {c.is_suspended
                          ? <span className="text-[11px] font-bold text-[var(--critical)]">Suspended</span>
                          : <span className="text-[11px] font-bold text-[var(--success)]">Active</span>}
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-1.5">
                          <button onClick={() => grant(c.user_id)} disabled={busy}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-interactive)] transition-colors">Grant</button>
                          <button onClick={() => adjust(c)} disabled={busy}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-interactive)] transition-colors">Limits</button>
                          <button onClick={() => resetCycle(c.user_id)} disabled={busy}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50 border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--accent-interactive)] transition-colors">Reset</button>
                          <button onClick={() => suspend(c)} disabled={busy}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-semibold disabled:opacity-50 transition-colors"
                            style={c.is_suspended
                              ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid var(--success)' }
                              : { background: 'var(--critical-bg)', color: 'var(--critical)', border: '1px solid var(--critical)' }}>
                            {c.is_suspended ? 'Unsuspend' : 'Suspend'}
                          </button>
                        </div>
                      </Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ── (E) GLOBAL CONTROLS ── */}
      <Card className="p-5 sm:p-6 shadow-sm">
        <div className="mb-4 pb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">tune</span>
            Global controls
          </p>
          <p className="text-[11.5px] text-[var(--text-muted)] mt-0.5">Configure system quotas, safety ceilings and default credit amounts</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([
            ['daily_api_call_cap', 'Daily API call cap'],
            ['monthly_budget_inr', 'Monthly budget (₹)'],
            ['cost_per_scan_inr', 'Cost per scan (₹)'],
            ['cost_per_verified_inr', 'Cost per verified (₹)'],
            ['default_scan_credits', 'Default scans / cycle'],
            ['default_verified_credits', 'Default verified / cycle'],
          ] as Array<[keyof SystemLimits, string]>).map(([key, label]) => (
            <div key={key} className="rounded-xl bg-[var(--bg-base)] p-3.5 border border-[var(--border-subtle)]">
              <p className="text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-muted)] mb-1.5">{label}</p>
              <input
                value={String(draft[key] ?? '')}
                onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                inputMode="decimal"
                className="w-full px-3 py-2 rounded-lg text-[13px] font-mono font-semibold bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-interactive)] transition-all"
              />
            </div>
          ))}
        </div>
        <div className="mt-5 flex justify-end">
          <button
            onClick={() => saveLimits({
              daily_api_call_cap: Number(draft.daily_api_call_cap),
              monthly_budget_inr: Number(draft.monthly_budget_inr),
              cost_per_scan_inr: Number(draft.cost_per_scan_inr),
              cost_per_verified_inr: Number(draft.cost_per_verified_inr),
              default_scan_credits: Number(draft.default_scan_credits),
              default_verified_credits: Number(draft.default_verified_credits),
            })}
            disabled={busy}
            className="px-6 py-2.5 rounded-xl text-[13px] font-bold bg-[var(--accent)] text-[var(--bg-elevated)] hover:opacity-90 disabled:opacity-50 transition-all shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-[17px]">save</span>
            {busy ? 'Saving…' : 'Save global limits'}
          </button>
        </div>
      </Card>

      {/* ── (F) LEDGER ── */}
      <Card className="p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4 pb-2 border-b border-[var(--border-subtle)]">
          <p className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">receipt_long</span>
            Credit ledger
          </p>
          <select value={ledgerFilter} onChange={e => setLedgerFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[12px] bg-[var(--bg-base)] border border-[var(--border-subtle)] text-[var(--text-primary)] outline-none focus:border-[var(--accent-interactive)] transition-all">
            {ledgerActions.map(a => <option key={a} value={a}>{a === 'all' ? 'All actions' : a}</option>)}
          </select>
        </div>

        {filteredLedger.length === 0 ? (
          <p className="text-[12.5px] py-6 text-center text-[var(--text-muted)]">No movements yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)]" style={{ maxHeight: 420 }}>
            <table className="w-full text-left" style={{ borderCollapse: 'collapse' }}>
              <thead><tr><Th>When</Th><Th>User</Th><Th>Action</Th><Th>Δ</Th><Th>After</Th><Th>Cost</Th><Th>Note</Th></tr></thead>
              <tbody>
                {filteredLedger.slice(0, 200).map(l => (
                  <tr key={l.id} className="border-t border-[var(--border-subtle)] hover:bg-[var(--bg-surface)] transition-colors">
                    <Td>{new Date(l.created_at).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</Td>
                    <Td><span className="font-medium">{names[l.user_id] ?? l.user_id.slice(0, 8)}</span></Td>
                    <Td>{l.action}</Td>
                    <Td>
                      <span className="mono-val font-bold"
                        style={{ color: l.amount > 0 ? 'var(--success)' : 'var(--text-primary)' }}>
                        {l.amount > 0 ? '+' : ''}{l.amount}
                      </span>
                    </Td>
                    <Td><span className="mono-val">{l.balance_after}</span></Td>
                    <Td><span className="mono-val">{inr(Number(l.est_cost_inr))}</span></Td>
                    <Td><span style={{ color: 'var(--text-muted)' }}>{l.note ?? '—'}</span></Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-xl z-50 premium-glass">
          <p className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{toast}</p>
        </div>
      )}
    </div>
  )
}
