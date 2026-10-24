import { supabase } from '../../lib/supabase'
import { logAdminAction } from '../../lib/adminLog'

/** Delete a career application (admin-only). */
export async function adminDeleteCareerApplication(id: string): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_career_application', { p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted career application', { targetType: 'career_application', targetId: id })
    return null
  }

  // Fallback to direct authorized DELETE protected by RLS
  const { error: delErr } = await supabase.from('career_applications').delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted career application', { targetType: 'career_application', targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}

/** Update career application status and admin notes (admin-only). */
export async function adminUpdateCareerApplication(
  id: string,
  status: string,
  notes?: string
): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_update_career_application', {
    p_id: id,
    p_status: status,
    p_notes: notes ?? null,
  })
  if (!rpcErr) {
    void logAdminAction('Updated career application', { targetType: 'career_application', targetId: id, detail: { status, notes } })
    return null
  }

  // Fallback to direct authorized UPDATE protected by RLS
  const patch: Record<string, unknown> = { application_status: status, updated_at: new Date().toISOString() }
  if (notes !== undefined) patch.admin_notes = notes

  const { error: updateErr } = await supabase.from('career_applications').update(patch).eq('id', id)
  if (!updateErr) {
    void logAdminAction('Updated career application', { targetType: 'career_application', targetId: id, detail: { status, notes } })
    return null
  }

  return rpcErr.message || updateErr.message
}

/** Delete a plan request (admin-only). */
export async function adminDeletePlanRequest(id: string): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_plan_request', { p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted plan request', { targetType: 'plan_request', targetId: id })
    return null
  }

  // Fallback to direct authorized DELETE protected by RLS
  const { error: delErr } = await supabase.from('plan_requests').delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted plan request', { targetType: 'plan_request', targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}

/** Delete a lead (admin-only). */
export async function adminDeleteLead(id: string): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_lead', { p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted lead', { targetType: 'lead', targetId: id })
    return null
  }

  const { error: delErr } = await supabase.from('leads').delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted lead', { targetType: 'lead', targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}

/** Delete a declared intent (admin-only). */
export async function adminDeleteIntent(id: string): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_intent', { p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted intent', { targetType: 'declared_intent', targetId: id })
    return null
  }

  const { error: delErr } = await supabase.from('declared_intents').delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted intent', { targetType: 'declared_intent', targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}

/** Delete a dossier request (admin-only). */
export async function adminDeleteDossierRequest(id: string): Promise<string | null> {
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_dossier_request', { p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted dossier request', { targetType: 'dossier_request', targetId: id })
    return null
  }

  const { error: delErr } = await supabase.from('dossier_requests').delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted dossier request', { targetType: 'dossier_request', targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}

/** Permanently delete a user and ALL of their data + login (admin-only). */
export async function adminDeleteUser(userId: string): Promise<string | null> {
  const { error } = await supabase.rpc('ebexta_admin_delete_user', { target: userId })
  if (!error) {
    void logAdminAction('Deleted user + all data', { targetType: 'user', targetId: userId })
    return null
  }
  return error.message
}

/**
 * Delete a single row in an admin-managed table.
 * Routes to specific handlers where possible, with fallback to RPC / direct delete.
 */
export async function adminDeleteRow(table: string, id: string): Promise<string | null> {
  if (table === 'career_applications') return adminDeleteCareerApplication(id)
  if (table === 'plan_requests') return adminDeletePlanRequest(id)
  if (table === 'leads') return adminDeleteLead(id)
  if (table === 'declared_intents') return adminDeleteIntent(id)
  if (table === 'dossier_requests') return adminDeleteDossierRequest(id)

  // Try RPC fallback
  const { error: rpcErr } = await supabase.rpc('ebexta_admin_delete_row', { p_table: table, p_id: id })
  if (!rpcErr) {
    void logAdminAction('Deleted row', { targetType: table, targetId: id })
    return null
  }

  // Fallback to direct authorized delete
  const { error: delErr } = await supabase.from(table).delete().eq('id', id)
  if (!delErr) {
    void logAdminAction('Deleted row', { targetType: table, targetId: id })
    return null
  }

  return rpcErr.message || delErr.message
}
