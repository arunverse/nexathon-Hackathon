/**
 * EBEXTA Admin instrumentation — api_usage + system_logs writers.
 *
 * RULE: logging must NEVER break the app. Every function here is
 * try/catch-wrapped and fire-and-forget safe (`void logApiUsage(...)`).
 *
 * Tables: see supabase/admin_migration.sql (run it first).
 */

import { supabase } from './supabase'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Only pass real UUIDs to uuid columns ('guest' etc. → null). */
function safeUuid(id: string | null | undefined): string | null {
  return id && UUID_RE.test(id) ? id : null
}

/** Resolve the current user's id when the caller doesn't have one handy. */
async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession()
    return data.session?.user?.id ?? null
  } catch {
    return null
  }
}

export type ApiAction = 'discovery' | 'enrich' | 'email' | 'proposal' | 'scan'
export type SystemEventType = 'scan' | 'error' | 'login' | 'verification' | 'export' | 'admin_action'

/**
 * Audit log for administrative actions (compliance). Attributed to the acting
 * admin's own user_id (system_logs INSERT is self-scoped), so the row records
 * WHO did WHAT to WHICH target and WHEN. Fire-and-forget, never blocks the UI.
 */
export async function logAdminAction(action: string, opts: {
  targetType?: string
  targetId?: string
  detail?: Record<string, unknown>
} = {}): Promise<void> {
  await logSystemEvent({
    eventType: 'admin_action',
    message: action,
    metadata: {
      target_type: opts.targetType ?? null,
      target_id: opts.targetId ?? null,
      at: new Date().toISOString(),
      ...(opts.detail ?? {}),
    },
  })
}

export async function logApiUsage(opts: {
  userId?: string | null
  action: ApiAction
  model?: string
  tokensUsed?: number
  calls?: number
}): Promise<void> {
  try {
    const userId = opts.userId !== undefined ? safeUuid(opts.userId) : await currentUserId()
    await supabase.from('api_usage').insert({
      user_id: userId,
      action: opts.action,
      model: opts.model ?? 'gemini-flash-lite-latest',
      tokens_used: opts.tokensUsed ?? 0,
      calls: opts.calls ?? 1,
    })
  } catch (err) {
    console.warn('[EBEXTA] api_usage log failed (non-fatal):', err)
  }
}

export async function logSystemEvent(opts: {
  userId?: string | null
  eventType: SystemEventType
  message: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  try {
    const userId = opts.userId !== undefined ? safeUuid(opts.userId) : await currentUserId()
    await supabase.from('system_logs').insert({
      user_id: userId,
      event_type: opts.eventType,
      message: opts.message,
      metadata: opts.metadata ?? null,
    })
  } catch (err) {
    console.warn('[EBEXTA] system_logs log failed (non-fatal):', err)
  }
}
