/**
 * #8 TEAM — the Company Memory half: assign to a teammate, set a status,
 * and keep internal notes the team can read. Team creation/invites live in
 * Settings → Team.
 */
import { useState, useEffect } from 'react'
import { MemorySection, EmptyNote, Pill } from './MemoryShared'
import {
  fetchMyTeam, fetchTeamMembers, fetchAssignment, assignMemory, setAssignmentStatus,
  ASSIGNMENT_STATUSES,
  type TeamMember, type LeadAssignment, type AssignmentStatus,
} from '../../lib/teams'

function memberLabel(m: TeamMember): string {
  return m.display_name || m.email || `Member ${m.user_id.slice(0, 8)}`
}

export function TeamPanel({
  memoryId, notes, onSaveNotes,
}: {
  memoryId: string
  notes: string | null
  onSaveNotes: (text: string) => Promise<void>
}) {
  const [members, setMembers] = useState<TeamMember[]>([])
  const [assignment, setAssignment] = useState<LeadAssignment | null>(null)
  const [hasTeam, setHasTeam] = useState<boolean | null>(null)
  const [draft, setDraft] = useState(notes ?? '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [justSaved, setJustSaved] = useState(false)
  const [busy, setBusy] = useState(false)

  // Re-sync the textarea when the parent loads/replaces the notes. Adjusting
  // state during render (React's documented pattern) instead of in an effect —
  // no cascading re-render.
  const [lastNotes, setLastNotes] = useState(notes)
  if (notes !== lastNotes) {
    setLastNotes(notes)
    setDraft(notes ?? '')
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const team = await fetchMyTeam()
      if (!alive) return
      setHasTeam(!!team)
      if (team) {
        const [m, a] = await Promise.all([fetchTeamMembers(team.id), fetchAssignment(memoryId)])
        if (!alive) return
        setMembers(m)
        setAssignment(a)
      } else {
        setAssignment(await fetchAssignment(memoryId))
      }
    })()
    return () => { alive = false }
  }, [memoryId])

  async function handleAssign(userId: string) {
    if (!userId || busy) return
    setBusy(true)
    await assignMemory(memoryId, userId)
    setAssignment(await fetchAssignment(memoryId))
    setBusy(false)
  }

  async function handleStatus(status: AssignmentStatus) {
    if (!assignment || busy) return
    setBusy(true)
    await setAssignmentStatus(assignment.id, status)
    setAssignment({ ...assignment, status })
    setBusy(false)
  }

  async function saveNotes() {
    setSavingNotes(true)
    await onSaveNotes(draft)
    setSavingNotes(false)
    setJustSaved(true)
    setTimeout(() => setJustSaved(false), 3000)
  }

  const assignedMember = assignment
    ? members.find(m => m.user_id === assignment.assigned_to)
    : null

  return (
    <MemorySection
      id="team"
      icon="groups"
      title="Team & Notes"
      subtitle="Ownership, status and shared context"
    >
      <div className="space-y-4">
        {/* ── Assignment ── */}
        <div>
          <p className="label-xs mb-2">Assignment</p>

          {hasTeam === false ? (
            <EmptyNote>
              No team yet. Create one in Settings → Team to assign companies to people.
            </EmptyNote>
          ) : (
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={assignment?.assigned_to ?? ''}
                onChange={e => handleAssign(e.target.value)}
                disabled={busy || members.length === 0}
                className="premium-input px-3 py-1.5 rounded-lg text-[12.5px] disabled:opacity-50"
              >
                <option value="">Assign to…</option>
                {members.map(m => (
                  <option key={m.user_id} value={m.user_id}>{memberLabel(m)}</option>
                ))}
              </select>

              {assignment && (
                <>
                  <Pill tone="accent">
                    Assigned to {assignedMember ? memberLabel(assignedMember) : 'a teammate'}
                  </Pill>
                  <select
                    value={assignment.status}
                    onChange={e => handleStatus(e.target.value as AssignmentStatus)}
                    disabled={busy}
                    className="premium-input px-3 py-1.5 rounded-lg text-[12.5px] disabled:opacity-50"
                  >
                    {ASSIGNMENT_STATUSES.map(s => (
                      <option key={s.key} value={s.key}>{s.label}</option>
                    ))}
                  </select>
                </>
              )}
            </div>
          )}
        </div>

        {/* ── Internal notes ── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="label-xs">Internal notes</p>
            {justSaved && (
              <span className="text-[11px]" style={{ color: 'var(--success)' }}>Saved</span>
            )}
          </div>
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            placeholder="Context your team should know — who you spoke to, what they said, what to avoid."
            rows={4}
            className="premium-input w-full px-3 py-2.5 rounded-lg text-[13px] resize-y"
          />
          <button
            onClick={saveNotes}
            disabled={savingNotes || draft === (notes ?? '')}
            className="premium-btn mt-2 px-3 py-1.5 rounded-lg text-[12px] disabled:opacity-50"
          >
            {savingNotes ? 'Saving…' : 'Save notes'}
          </button>
        </div>
      </div>
    </MemorySection>
  )
}
