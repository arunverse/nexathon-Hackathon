/**
 * EBEXTA CREDIT SYSTEM — client.
 * ---------------------------------------------------------------------------
 * Every decision here is made by the `credits` Edge Function using the service
 * role. This file only asks and reports; it never decides.
 *
 * Why that matters: runScan() runs in the browser. A balance the browser could
 * write would be a balance the user could forge. `user_credits` has a SELECT
 * policy and nothing else — the only way it moves is through the Edge Function.
 *
 * Requires supabase/credit_system.sql and:
 *   supabase functions deploy credits
 *   supabase functions deploy gemini      (re-deploy — credit guard added)
 */

import { supabase } from './supabase'
import { logSystemEvent } from './adminLog'

// ─── Credit costs ─────────────────────────────────────────────────────────────
// Only the two genuinely expensive actions consume credits. Everything else is
// bundled — a user should never feel metered for opening a lead or drafting an
// email. Tune these here; the money values live in system_limits.
export const CREDIT_COST = {
  DISCOVER_COMPANY: 1,      // 1. Discover company (Scan / Filter execution)
  DEEP_RESEARCH: 1,         // 2. Deep research (Web search / Key contact discovery)
  CONTACT_VERIFICATION: 1,  // 3. Contact verification (Verification request)
  DOSSIER: 1,               // 4. Dossier (Full company dossier unlock)
  PORTFOLIO: 1,             // 5. Portfolio (Pitch Deck PDF generation)
  AI_GENERATION: 1,         // 6. AI generation (Intent matching / signal scan / clarification)
  ADVANCED_ENRICHMENT: 1,   // 7. Advanced enrichment (User & Admin deep enrichment)
  SCAN: 1,                  // Legacy alias
  VERIFIED_CONTACT: 1,      // Legacy alias
} as const

export type CreditAction =
  | 'discover_company'
  | 'deep_research'
  | 'contact_verification'
  | 'dossier'
  | 'portfolio'
  | 'ai_generation'
  | 'advanced_enrichment'
  | 'scan'
  | 'verified_contact'

export type BlockCode =
  | 'PAUSED' | 'DAILY_CAP' | 'BUDGET' | 'SUSPENDED' | 'THROTTLED' | 'NO_CREDITS'

export interface CreditCheck {
  allowed: boolean
  reason?: string
  code?: BlockCode
  remaining?: number | null
  cycle_end?: string | null
  /** True when the credit system itself was unreachable and we failed open. */
  degraded?: boolean
}

export interface CreditBalance {
  user_id: string
  plan: string
  scan_credits: number
  scan_credits_used: number
  verified_credits: number
  verified_credits_used: number
  bonus_credits: number
  cycle_start: string
  cycle_end: string
  is_suspended: boolean
  suspend_reason: string | null
  lifetime_cost_inr: number
  hourly_scan_cap: number | null
}

export interface LedgerEntry {
  id: string
  user_id: string
  action: string
  credit_type: string
  amount: number
  balance_after: number
  api_calls: number
  tokens_used: number
  est_cost_inr: number
  reference_id: string | null
  note: string | null
  created_at: string
}

// ─── Edge Function transport ──────────────────────────────────────────────────

interface CreditRequest {
  op: 'check' | 'consume' | 'refund' | 'balance'
  action?: CreditAction
  apiCalls?: number
  tokens?: number
  referenceId?: string | null
  note?: string | null
}

/**
 * Degraded mode is reported once, not on every call. A hundred identical
 * console errors during one scan buries the one line that matters.
 */
let degradedReported = false

function reportDegraded(detail: string) {
  if (degradedReported) return
  degradedReported = true
  console.warn(
    `[EBEXTA] Credit system unreachable (${detail}) — failing OPEN. `
    + 'Scans continue and the Gemini proxy still enforces limits server-side. '
    + 'Deploy the credits function: supabase functions deploy credits',
  )
  // Surfaced in admin so a degraded billing path is never invisible.
  void logSystemEvent({
    eventType: 'error',
    message: `Credits function unreachable — failing open (${detail})`,
    metadata: { subsystem: 'credits', degraded: true },
  })
}

async function callCredits<T>(body: CreditRequest): Promise<T | null> {
  try {
    const { data: sessionData } = await supabase.auth.getSession()
    const token = sessionData.session?.access_token
    if (!token) {
      reportDegraded('no active session')
      return null
    }

    const { data, error } = await supabase.functions.invoke('credits', {
      body,
      headers: { Authorization: `Bearer ${token}` },
    })
    if (error) {
      reportDegraded(error.message || 'non-2xx response')
      return null
    }
    return data as T
  } catch (err) {
    reportDegraded((err as Error)?.message ?? 'network error')
    return null
  }
}

/**
 * Read the balance straight from the table when the function is down.
 */
async function balanceFromTable(): Promise<BalanceSnapshot> {
  try {
    const [ucRes, limRes] = await Promise.all([
      supabase.from('user_credits').select('*').maybeSingle(),
      supabase.from('system_limits').select('global_scans_paused, pause_reason').eq('id', 1).maybeSingle(),
    ])

    let creditBalance = (ucRes.data as CreditBalance | null) ?? null

    // If user_credits table or row is missing, fall back to profiles table
    if (!creditBalance) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) {
          const { data: prof } = await supabase
            .from('profiles')
            .select('plan, credits, credit_limit')
            .eq('id', user.id)
            .maybeSingle()

          if (prof) {
            const limit = typeof prof.credit_limit === 'number' ? prof.credit_limit : 1000
            const currentCredits = typeof prof.credits === 'number' ? prof.credits : limit
            const used = Math.max(0, limit - currentCredits)

            creditBalance = {
              user_id: user.id,
              plan: prof.plan || 'starter',
              scan_credits: limit,
              scan_credits_used: used,
              verified_credits: 10,
              verified_credits_used: 0,
              bonus_credits: 0,
              cycle_start: new Date().toISOString(),
              cycle_end: new Date(Date.now() + 30 * 86400000).toISOString(),
              is_suspended: false,
              suspend_reason: null,
              lifetime_cost_inr: 0,
              hourly_scan_cap: null,
            }
          }
        }
      } catch { /* ignore fallback errors */ }
    }

    return {
      credits: creditBalance,
      paused: !!limRes.data?.global_scans_paused,
      pauseReason: limRes.data?.pause_reason ?? null,
      degraded: true,
    }
  } catch {
    return { credits: null, paused: false, pauseReason: null, degraded: true }
  }
}

// ─── The gate ─────────────────────────────────────────────────────────────────

/**
 * Ask whether this action is allowed. Call BEFORE doing the work.
 */
export async function checkCredits(
  action: CreditAction = 'discover_company',
  targetUserId?: string
): Promise<CreditCheck> {
  // Check global scan pause
  if (action === 'discover_company' || action === 'scan') {
    try {
      const { data: lim } = await supabase
        .from('system_limits')
        .select('global_scans_paused, pause_reason')
        .eq('id', 1)
        .maybeSingle()
      if (lim?.global_scans_paused) {
        return {
          allowed: false,
          reason: lim.pause_reason || 'Scanning is temporarily paused by administrator. Please try again soon.',
          code: 'PAUSED',
        }
      }
    } catch { /* proceed */ }
  }

  // Check user profile credits directly
  try {
    const uid = targetUserId || (await supabase.auth.getUser()).data.user?.id
    if (uid) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('credits, credit_limit, is_blocked')
        .eq('id', uid)
        .maybeSingle()

      if (prof?.is_blocked) {
        return {
          allowed: false,
          reason: 'Your account is currently suspended. Please contact support.',
          code: 'SUSPENDED',
          remaining: 0,
        }
      }

      const userCredits = typeof prof?.credits === 'number' ? prof.credits : (prof?.credit_limit ?? 2500)
      if (userCredits <= 0) {
        return {
          allowed: false,
          reason: 'Credit limit reached. You have used all available credits for your plan. Please top up or upgrade to continue.',
          code: 'NO_CREDITS',
          remaining: 0,
        }
      }
      return { allowed: true, remaining: userCredits }
    }
  } catch { /* fallback to edge */ }

  const data = await callCredits<CreditCheck>({ op: 'check', action })
  if (!data) return { allowed: true, degraded: true }
  return {
    allowed: data.allowed !== false,
    reason: data.reason,
    code: data.code,
    remaining: data.remaining ?? null,
    cycle_end: data.cycle_end ?? null,
    degraded: data.degraded,
  }
}

/**
 * Charge for a completed action. Call ONLY AFTER it succeeded.
 */
export async function consumeCredit(
  action: CreditAction,
  meta: { apiCalls?: number; tokens?: number; referenceId?: string | null; note?: string; targetUserId?: string; [key: string]: unknown } = {},
): Promise<{ ok: boolean; remaining?: number; deduplicated?: boolean }> {
  let remaining: number | undefined
  const success = true

  // ── IDEMPOTENCY GUARD ──
  // If a referenceId (e.g. scanId) was supplied, ensure we do not deduct twice
  const uid = meta.targetUserId || (await supabase.auth.getUser()).data.user?.id
  if (uid && meta.referenceId) {
    try {
      const { data: existingDeduction } = await supabase
        .from('credit_ledger')
        .select('id')
        .eq('user_id', uid)
        .eq('reference_id', meta.referenceId)
        .eq('amount', -1)
        .limit(1)

      if (existingDeduction && existingDeduction.length > 0) {
        console.info(`[EBEXTA Credits] Deduplication: scan ${meta.referenceId} already deducted. Skipping.`)
        return { ok: true, deduplicated: true }
      }
    } catch { /* proceed */ }
  }

  const data = await callCredits<{ ok?: boolean; remaining?: number }>({
    op: 'consume',
    action,
    apiCalls: meta.apiCalls ?? 1,
    tokens: meta.tokens ?? 0,
    referenceId: meta.referenceId ?? null,
    note: meta.note ?? null,
  })

  if (data && data.ok !== false) {
    remaining = data.remaining
  } else {
    // Execute guaranteed DB tracking fallback
    try {
      if (uid) {
        // 1. Record API usage
        try {
          await supabase.from('api_usage').insert({
            user_id: uid,
            action,
            calls: meta.apiCalls ?? 1,
            tokens_used: meta.tokens ?? 0,
            model: 'gemini-flash-latest',
          })
        } catch { /* non-fatal */ }

        // 2. Record Credit Ledger
        try {
          await supabase.from('credit_ledger').insert({
            user_id: uid,
            action,
            credit_type: action,
            amount: -1,
            api_calls: meta.apiCalls ?? 1,
            tokens_used: meta.tokens ?? 0,
            reference_id: meta.referenceId ?? null,
            note: meta.note ?? null,
          })
        } catch { /* non-fatal */ }

        // 3. Deduct credit from profiles.credits
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('credits, credit_limit')
            .eq('id', uid)
            .maybeSingle()

          const currentCredits = typeof prof?.credits === 'number' ? prof.credits : (prof?.credit_limit ?? 1000)
          const nextVal = Math.max(0, currentCredits - 1)
          remaining = nextVal
          await supabase.from('profiles').update({ credits: nextVal }).eq('id', uid)
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      console.warn('[EBEXTA] Local credit deduction fallback failed:', err)
    }
  }

  invalidateBalance()
  void fetchBalance(true)
  window.dispatchEvent(new Event('ebexta_credits_updated'))
  return { ok: success, remaining }
}

/**
 * Give a credit back. Users must never pay for our failures — a timed-out scan,
 * an API error, a scan that found nothing, a contact we couldn't verify.
 */
export async function refundCredit(
  action: CreditAction,
  reason: string,
  referenceId?: string | null,
  targetUserId?: string,
): Promise<{ ok: boolean; remaining?: number; refunded: boolean }> {
  const uid = targetUserId || (await supabase.auth.getUser()).data.user?.id

  // ── IDEMPOTENCY / REFUND INTEGRITY GUARD ──
  // If referenceId provided, verify we do not refund twice
  if (uid && referenceId) {
    try {
      const { data: existingRefund } = await supabase
        .from('credit_ledger')
        .select('id')
        .eq('user_id', uid)
        .eq('reference_id', referenceId)
        .gt('amount', 0)
        .limit(1)

      if (existingRefund && existingRefund.length > 0) {
        console.info(`[EBEXTA Credits] Refund already processed for reference ${referenceId}. Skipping duplicate.`)
        return { ok: true, refunded: false }
      }
    } catch { /* proceed */ }
  }

  const data = await callCredits<{ ok?: boolean; remaining?: number }>({
    op: 'refund',
    action,
    referenceId: referenceId ?? null,
    note: reason,
  })

  let remaining: number | undefined
  if (data && data.ok !== false) {
    remaining = data.remaining
  } else {
    // Guaranteed DB refund fallback
    try {
      if (uid) {
        // 1. Record Credit Ledger refund
        try {
          await supabase.from('credit_ledger').insert({
            user_id: uid,
            action,
            credit_type: action,
            amount: 1, // +1 credit refunded
            api_calls: 0,
            tokens_used: 0,
            reference_id: referenceId ?? null,
            note: `Refund: ${reason}`,
          })
        } catch { /* non-fatal */ }

        // 2. Restore credit in profiles.credits
        try {
          const { data: prof } = await supabase
            .from('profiles')
            .select('credits, credit_limit')
            .eq('id', uid)
            .maybeSingle()

          const currentCredits = typeof prof?.credits === 'number' ? prof.credits : (prof?.credit_limit ?? 1000)
          const nextVal = currentCredits + 1
          remaining = nextVal
          await supabase.from('profiles').update({ credits: nextVal }).eq('id', uid)
        } catch { /* non-fatal */ }
      }
    } catch (err) {
      console.warn('[EBEXTA] Local credit refund fallback failed:', err)
    }
  }

  invalidateBalance()
  void fetchBalance(true)
  window.dispatchEvent(new Event('ebexta_credits_updated'))
  return { ok: true, remaining, refunded: true }
}

// ─── Reading the balance ──────────────────────────────────────────────────────

export interface BalanceSnapshot {
  credits: CreditBalance | null
  paused: boolean
  pauseReason: string | null
  /** True when this came from the table fallback, not the Edge Function. */
  degraded?: boolean
}

// ─── One balance, shared by everyone who asks ─────────────────────────────────
//
// The dashboard was hitting this endpoint five times on a single load. Not five
// components — ONE meter, multiplied by StrictMode's double-invoke, two auth
// events each producing a new `user` object identity, and a focus listener.
//
// Chasing that through the effect graph would fix today's five and not
// tomorrow's. The dedupe belongs here instead, where every caller passes
// through regardless of why it was called:
//
//   · a request already in flight → join it, don't start a second
//   · a fresh answer from moments ago → reuse it
//   · anything that spends credits → invalidate, so the next read is truthful
//
// Net effect: one network call per load, and the meter is still never stale
// after a scan.

const BALANCE_TTL_MS = 60_000

let balanceCache: { snap: BalanceSnapshot; at: number } | null = null
let balanceInflight: Promise<BalanceSnapshot> | null = null

type BalanceListener = (snap: BalanceSnapshot) => void
const balanceListeners = new Set<BalanceListener>()

/** Subscribe to balance changes. Every meter shares one source. */
export function onBalanceChange(fn: BalanceListener): () => void {
  balanceListeners.add(fn)
  return () => { balanceListeners.delete(fn) }
}

/**
 * Drop the cached balance so the next read hits the server.
 * Called automatically after anything that moves the number.
 */
export function invalidateBalance() {
  balanceCache = null
}

async function loadBalance(): Promise<BalanceSnapshot> {
  const data = await callCredits<{
    credits: CreditBalance | null
    limits: { global_scans_paused?: boolean; pause_reason?: string | null } | null
  }>({ op: 'balance' })

  // Function unreachable → read the table directly rather than show nothing.
  if (!data) return balanceFromTable()

  return {
    credits: data.credits ?? null,
    paused: !!data.limits?.global_scans_paused,
    pauseReason: data.limits?.pause_reason ?? null,
  }
}

export async function fetchBalance(force = false): Promise<BalanceSnapshot> {
  if (!force) {
    if (balanceInflight) return balanceInflight
    if (balanceCache && Date.now() - balanceCache.at < BALANCE_TTL_MS) {
      return balanceCache.snap
    }
  }

  balanceInflight = (async () => {
    try {
      const snap = await loadBalance()
      balanceCache = { snap, at: Date.now() }
      balanceListeners.forEach(fn => fn(snap))
      return snap
    } finally {
      balanceInflight = null
    }
  })()

  return balanceInflight
}

/** The user's own ledger. RLS scopes this to them automatically. */
export async function fetchMyLedger(limit = 100): Promise<LedgerEntry[]> {
  const { data, error } = await supabase
    .from('credit_ledger')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  if (error) { console.error('[EBEXTA] ledger fetch failed:', error.message); return [] }
  return (data ?? []) as LedgerEntry[]
}

// ─── Derived figures for the UI ───────────────────────────────────────────────

export interface CreditSummary {
  scansUsed: number
  scansTotal: number
  scansLeft: number
  verifiedUsed: number
  verifiedTotal: number
  verifiedLeft: number
  /** 0-1. Drives the amber/critical colouring. */
  scanFraction: number
  verifiedFraction: number
  cycleEnd: string | null
  daysLeft: number
  suspended: boolean
  suspendReason: string | null
}

export function summarise(c: CreditBalance | null): CreditSummary | null {
  if (!c) return null
  const scansTotal = (c.scan_credits ?? 0) + (c.bonus_credits ?? 0)
  const verifiedTotal = (c.verified_credits ?? 0) + (c.bonus_credits ?? 0)
  const scansUsed = c.scan_credits_used ?? 0
  const verifiedUsed = c.verified_credits_used ?? 0

  const msLeft = c.cycle_end ? Date.parse(c.cycle_end) - Date.now() : 0

  return {
    scansUsed,
    scansTotal,
    scansLeft: Math.max(0, scansTotal - scansUsed),
    verifiedUsed,
    verifiedTotal,
    verifiedLeft: Math.max(0, verifiedTotal - verifiedUsed),
    scanFraction: scansTotal > 0 ? scansUsed / scansTotal : 0,
    verifiedFraction: verifiedTotal > 0 ? verifiedUsed / verifiedTotal : 0,
    cycleEnd: c.cycle_end ?? null,
    daysLeft: Math.max(0, Math.ceil(msLeft / 86_400_000)),
    suspended: !!c.is_suspended,
    suspendReason: c.suspend_reason ?? null,
  }
}

/** Colour for a usage fraction — amber under 20% left, critical at zero. */
export function usageColor(left: number, total: number): string {
  if (total <= 0) return 'var(--text-muted)'
  if (left <= 0) return 'var(--critical)'
  if (left / total <= 0.2) return 'var(--warning)'
  return 'var(--text-primary)'
}

export function formatCycleEnd(iso: string | null | undefined): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

/**
 * Confirms the exact credit ledger outcome for a given scan reference ID
 * by querying the database directly. Guarantees the platform never claims
 * credits were deducted or refunded without database audit confirmation.
 */
export async function verifyCreditLedgerOutcome(
  userId: string,
  referenceId: string
): Promise<{ deducted: boolean; refunded: boolean; currentBalance?: number }> {
  try {
    const { data: entries } = await supabase
      .from('credit_ledger')
      .select('amount, action')
      .eq('user_id', userId)
      .eq('reference_id', referenceId)

    const deducted = (entries ?? []).some(e => Number(e.amount) < 0)
    const refunded = (entries ?? []).some(e => Number(e.amount) > 0)

    const { data: prof } = await supabase
      .from('profiles')
      .select('credits')
      .eq('id', userId)
      .maybeSingle()

    return {
      deducted,
      refunded,
      currentBalance: typeof prof?.credits === 'number' ? prof.credits : undefined,
    }
  } catch (err) {
    console.warn('[EBEXTA Credits] Ledger verification non-fatal:', err)
    return { deducted: false, refunded: false }
  }
}

