/**
 * #8 TEAM WORKSPACE — minimal.
 *
 * V2's audience is mostly solo founders/CEOs, so this deliberately stops at:
 * create a team, invite by email, list members, assign a company, set a status.
 * No mentions, no notifications, no granular permissions — premature for the
 * current ICP.
 *
 * Requires supabase/v2_intelligence.sql.
 */

import { supabase } from './supabase'
import { currentUserId } from './companyMemory'

export interface Team {
  id: string
  owner_id: string
  team_name: string | null
  created_at: string
}

export interface TeamMember {
  id: string
  team_id: string
  user_id: string
  role: 'owner' | 'admin' | 'member'
  joined_at: string
  /** Resolved from profiles for display — may be missing. */
  display_name?: string | null
  email?: string | null
}

export interface TeamInvite {
  id: string
  team_id: string
  email: string
  role: string
  accepted: boolean
  created_at: string
}

export type AssignmentStatus =
  | 'assigned' | 'working' | 'meeting_scheduled' | 'proposal_sent' | 'closed'

export const ASSIGNMENT_STATUSES: Array<{ key: AssignmentStatus; label: string }> = [
  { key: 'assigned',          label: 'Assigned' },
  { key: 'working',           label: 'Working' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled' },
  { key: 'proposal_sent',     label: 'Proposal sent' },
  { key: 'closed',            label: 'Closed' },
]

export interface LeadAssignment {
  id: string
  memory_id: string
  assigned_to: string | null
  assigned_by: string | null
  status: AssignmentStatus
  note: string | null
  created_at: string
}

// ─── Team ─────────────────────────────────────────────────────────────────────

/** The team this user owns, or the first they belong to. Null if none yet. */
export async function fetchMyTeam(): Promise<Team | null> {
  const userId = await currentUserId()
  if (!userId) return null

  const { data: owned } = await supabase
    .from('teams')
    .select('*')
    .eq('owner_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (owned) return owned as Team

  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .limit(1)
    .maybeSingle()
  if (!membership) return null

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', (membership as { team_id: string }).team_id)
    .maybeSingle()
  return (team as Team | null) ?? null
}

export async function createTeam(name: string): Promise<{ team: Team | null; error: string | null }> {
  const userId = await currentUserId()
  if (!userId) return { team: null, error: 'Not signed in' }

  const { data, error } = await supabase
    .from('teams')
    .insert({ owner_id: userId, team_name: name.trim() || 'My team' })
    .select()
    .single()
  if (error) return { team: null, error: error.message }

  // The owner is a member too, so assignment dropdowns always have someone.
  await supabase.from('team_members').insert({
    team_id: (data as Team).id,
    user_id: userId,
    role: 'owner',
  })
  return { team: data as Team, error: null }
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMember[]> {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .eq('team_id', teamId)
    .order('joined_at', { ascending: true })
  if (error) { console.error('[EBEXTA] team members fetch failed:', error.message); return [] }

  const rows = (data ?? []) as TeamMember[]
  if (rows.length === 0) return rows

  // Best-effort display names. RLS may hide other users' profiles — that's fine,
  // we fall back to a shortened id rather than showing nothing.
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, company_name, sender_email')
    .in('id', rows.map(r => r.user_id))

  const byId = new Map(
    ((profiles ?? []) as Array<{ id: string; company_name: string | null; sender_email: string | null }>)
      .map(p => [p.id, p])
  )

  return rows.map(r => {
    const p = byId.get(r.user_id)
    return {
      ...r,
      display_name: p?.company_name ?? null,
      email: p?.sender_email ?? null,
    }
  })
}

export async function fetchTeamInvites(teamId: string): Promise<TeamInvite[]> {
  const { data } = await supabase
    .from('team_invites')
    .select('*')
    .eq('team_id', teamId)
    .order('created_at', { ascending: false })
  return (data ?? []) as TeamInvite[]
}

/**
 * Invite by email. This records the invite; the team_members row is created
 * when that email signs up (see acceptPendingInvites, called after login).
 */
export async function inviteByEmail(
  teamId: string, email: string,
): Promise<{ error: string | null }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Not signed in' }
  const clean = email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(clean)) return { error: 'That doesn’t look like an email address' }

  const { error } = await supabase.from('team_invites').insert({
    team_id: teamId, email: clean, invited_by: userId, role: 'member',
  })
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return { error: 'Already invited' }
    return { error: error.message }
  }
  return { error: null }
}

/**
 * Turn any pending invite for the signed-in user's email into a membership.
 * Safe to call on every login — it's a no-op when there's nothing pending.
 */
export async function acceptPendingInvites(): Promise<number> {
  const { data: session } = await supabase.auth.getSession()
  const user = session.session?.user
  if (!user?.email) return 0

  const { data: invites } = await supabase
    .from('team_invites')
    .select('id, team_id')
    .eq('email', user.email.toLowerCase())
    .eq('accepted', false)

  const list = (invites ?? []) as Array<{ id: string; team_id: string }>
  let joined = 0
  for (const inv of list) {
    const { error } = await supabase.from('team_members').insert({
      team_id: inv.team_id, user_id: user.id, role: 'member',
    })
    if (!error) {
      await supabase.from('team_invites').update({ accepted: true }).eq('id', inv.id)
      joined++
    }
  }
  return joined
}

// ─── Assignments ──────────────────────────────────────────────────────────────

export async function fetchAssignment(memoryId: string): Promise<LeadAssignment | null> {
  const { data } = await supabase
    .from('lead_assignments')
    .select('*')
    .eq('memory_id', memoryId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return (data as LeadAssignment | null) ?? null
}

export async function assignMemory(
  memoryId: string, assignedTo: string, note?: string,
): Promise<{ error: string | null }> {
  const userId = await currentUserId()
  if (!userId) return { error: 'Not signed in' }
  const { error } = await supabase.from('lead_assignments').insert({
    memory_id: memoryId,
    assigned_to: assignedTo,
    assigned_by: userId,
    status: 'assigned',
    note: note ?? null,
  })
  return { error: error?.message ?? null }
}

export async function setAssignmentStatus(
  assignmentId: string, status: AssignmentStatus,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('lead_assignments')
    .update({ status })
    .eq('id', assignmentId)
  return { error: error?.message ?? null }
}
