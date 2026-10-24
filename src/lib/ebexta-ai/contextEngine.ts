/**
 * EBEXTA AI Context Engine
 * Automatically senses what the user is looking at in EBEXTA so the user
 * doesn't need to repeat context like "at this company" or "for this lead".
 */

import { supabase } from '../supabase'
import type { ConversationContext } from './types'

export async function resolveCurrentContext(
  pathname: string,
  userProfile?: { mode?: 'seeker' | 'provider'; plan?: string; credits?: number } | null,
): Promise<ConversationContext> {
  const ctx: ConversationContext = {
    pathname,
    pageName: getPageFriendlyName(pathname),
    userMode: userProfile?.mode ?? 'seeker',
    plan: userProfile?.plan ?? 'starter',
    credits: userProfile?.credits ?? 0,
  }

  // 1. Check if user is on a Lead Detail page: /dashboard/lead/:id
  const leadMatch = pathname.match(/\/dashboard\/lead\/([a-zA-Z0-9_-]+)/)
  if (leadMatch) {
    const leadId = leadMatch[1]
    ctx.entityType = 'lead'
    ctx.entityId = leadId
    try {
      const { data } = await supabase
        .from('leads')
        .select('id, company_name, industry, location, intent_score, match_score, confidence_score, funding_stage, employee_count, website, recent_signals, intent_flags, score_breakdown')
        .eq('id', leadId)
        .maybeSingle()
      if (data) {
        ctx.entityName = data.company_name
        ctx.entityData = data
      }
    } catch {
      // Non-fatal if DB is slow
    }
    return ctx
  }

  // 2. Check if user is on a Company Memory page: /dashboard/companies/:id
  const compMatch = pathname.match(/\/dashboard\/companies\/([a-zA-Z0-9_-]+)/)
  if (compMatch) {
    const compId = compMatch[1]
    ctx.entityType = 'company'
    ctx.entityId = compId
    try {
      const { data } = await supabase
        .from('company_memory')
        .select('*')
        .eq('id', compId)
        .maybeSingle()
      if (data) {
        ctx.entityName = data.company_name
        ctx.entityData = data
      }
    } catch {
      // Non-fatal
    }
    return ctx
  }

  return ctx
}

function getPageFriendlyName(pathname: string): string {
  if (pathname === '/dashboard') return 'Intelligence Hub (Leads)'
  if (pathname.startsWith('/dashboard/lead/')) return 'Lead Intelligence Dossier'
  if (pathname.startsWith('/dashboard/companies')) return 'Company Memory (CRM)'
  if (pathname === '/dashboard/roi') return 'Pipeline & Revenue Funnel (RevOps)'
  if (pathname === '/dashboard/signals') return 'Signal Watch & Buying Triggers'
  if (pathname === '/dashboard/intent') return 'Declared Intent Board'
  if (pathname === '/dashboard/verified') return 'Verified Decision Makers'
  if (pathname === '/dashboard/inbox') return 'Outreach Inbox & Sentiment'
  if (pathname === '/dashboard/usage') return 'Credits & API Ledger'
  if (pathname.startsWith('/admin')) return 'EBEXTA Admin Console'
  return 'EBEXTA Platform'
}
