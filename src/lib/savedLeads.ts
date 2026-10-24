/**
 * Saved leads — bookmark leads into saved_leads (full JSON snapshot, keyed to
 * the logged-in account). Whatever a user saves under their email shows up on
 * any device they log into.
 */

import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'
import type { ScannedLead } from './scanEngine'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Module-level cache so a grid of 10 cards makes ONE query, not ten
let savedIdsCache: Set<string> | null = null
let inflight: Promise<Set<string>> | null = null

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  return data.session?.user?.id ?? null
}

export async function getSavedLeadIds(force = false): Promise<Set<string>> {
  if (savedIdsCache && !force) return savedIdsCache
  if (inflight && !force) return inflight
  inflight = (async () => {
    const userId = await currentUserId()
    if (!userId) return new Set<string>()
    const { data } = await supabase
      .from('saved_leads')
      .select('lead_id')
      .eq('user_id', userId)
    savedIdsCache = new Set((data ?? []).map(r => r.lead_id as string).filter(Boolean))
    return savedIdsCache
  })()
  return inflight
}

/** Toggle save state. Returns the NEW state (true = saved), or null on error. */
export async function toggleSaveLead(lead: ScannedLead): Promise<boolean | null> {
  const userId = await currentUserId()
  if (!userId) return null
  if (!UUID_RE.test(lead.id)) return null   // demo/local ids can't be persisted

  const ids = await getSavedLeadIds()
  if (ids.has(lead.id)) {
    const { error } = await supabase
      .from('saved_leads')
      .delete()
      .eq('user_id', userId)
      .eq('lead_id', lead.id)
    if (error) { console.error('[EBEXTA] unsave failed:', error.message); return null }
    ids.delete(lead.id)
    return false
  }

  const { error } = await supabase.from('saved_leads').insert({
    user_id: userId,
    lead_id: lead.id,
    lead_snapshot: lead,
  })
  if (error) {
    console.error('[EBEXTA] save failed:', error.message, '— run supabase/upgrade_v2.sql?')
    return null
  }
  ids.add(lead.id)
  return true
}

export interface SavedLeadRow {
  id: string
  lead_id: string | null
  lead_snapshot: ScannedLead
  saved_at: string
}

export async function fetchSavedLeads(): Promise<SavedLeadRow[]> {
  const userId = await currentUserId()
  if (!userId) return []
  const { data, error } = await supabase
    .from('saved_leads')
    .select('*')
    .eq('user_id', userId)
    .order('saved_at', { ascending: false })
  if (error) console.error('[EBEXTA] fetch saved failed:', error.message)
  return (data ?? []) as SavedLeadRow[]
}

/** Find a saved snapshot by lead id (LeadDetail fallback source). */
export async function findSavedSnapshot(leadId: string): Promise<ScannedLead | null> {
  const userId = await currentUserId()
  if (!userId || !UUID_RE.test(leadId)) return null
  const { data } = await supabase
    .from('saved_leads')
    .select('lead_snapshot')
    .eq('user_id', userId)
    .eq('lead_id', leadId)
    .maybeSingle()
  return (data?.lead_snapshot as ScannedLead) ?? null
}

/** Hook for a bookmark button on a lead card. */
export function useSavedLead(lead: ScannedLead) {
  const [saved, setSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    getSavedLeadIds().then(ids => { if (alive) setSaved(ids.has(lead.id)) })
    return () => { alive = false }
  }, [lead.id])

  const toggle = useCallback(async () => {
    if (busy) return
    setBusy(true)
    const next = await toggleSaveLead(lead)
    if (next !== null) setSaved(next)
    setBusy(false)
  }, [lead, busy])

  return { saved, busy, toggle }
}
