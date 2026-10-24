/**
 * Settings → Team. Minimal by design (V2's ICP is mostly solo founders):
 * create a team, invite by email, see who's in. Assignment happens on the
 * Company Memory page.
 */
import { useState, useEffect, useCallback } from 'react'
import {
  fetchMyTeam, createTeam, fetchTeamMembers, fetchTeamInvites, inviteByEmail,
  type Team, type TeamMember, type TeamInvite,
} from '../lib/teams'

const geist = { fontFamily: 'Geist, Inter, sans-serif' } as const

export function TeamSettings() {
  const [team, setTeam] = useState<Team | null>(null)
  const [members, setMembers] = useState<TeamMember[]>([])
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [loading, setLoading] = useState(true)
  const [teamName, setTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null)

  const load = useCallback(async () => {
    const t = await fetchMyTeam()
    setTeam(t)
    if (t) {
      const [m, i] = await Promise.all([fetchTeamMembers(t.id), fetchTeamInvites(t.id)])
      setMembers(m)
      setInvites(i)
    }
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  async function handleCreate() {
    if (busy) return
    setBusy(true); setMsg(null)
    const { team: created, error } = await createTeam(teamName)
    setBusy(false)
    if (error || !created) {
      setMsg({ text: error ?? 'Could not create the team', ok: false })
      return
    }
    setTeamName('')
    await load()
  }

  async function handleInvite() {
    if (!team || busy) return
    setBusy(true); setMsg(null)
    const { error } = await inviteByEmail(team.id, inviteEmail)
    setBusy(false)
    if (error) { setMsg({ text: error, ok: false }); return }
    setInviteEmail('')
    setMsg({ text: 'Invite recorded: they join automatically when they sign up with that email.', ok: true })
    setInvites(await fetchTeamInvites(team.id))
  }

  return (
    <section className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent-interactive)' }}>groups</span>
        <h2 className="text-[20px] font-semibold text-on-surface" style={geist}>Team</h2>
      </div>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
        Share companies with the people you work with. Assign a company and set its status
        from that company’s memory page.
      </p>

      {loading ? (
        <div className="h-16 rounded-xl animate-pulse" style={{ background: 'var(--bg-surface)' }} />
      ) : !team ? (
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={teamName}
            onChange={e => setTeamName(e.target.value)}
            placeholder="Team name"
            maxLength={60}
            className="premium-input px-3 py-2 rounded-lg text-[13px] flex-1 min-w-[180px]"
          />
          <button onClick={handleCreate} disabled={busy}
            className="premium-btn px-4 py-2 rounded-lg text-[13px] disabled:opacity-50">
            {busy ? 'Creating…' : 'Create team'}
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold" style={{ color: 'var(--text-primary)' }}>
              {team.team_name || 'My team'}
            </p>
            <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
              {members.length} member{members.length === 1 ? '' : 's'}
            </span>
          </div>

          {/* Members */}
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
            {members.map((m, i) => (
              <div key={m.id} className="flex items-center gap-3 px-3.5 py-2.5"
                style={{
                  background: 'var(--bg-elevated)',
                  borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
                }}>
                <span className="material-symbols-outlined text-[17px]" style={{ color: 'var(--text-muted)' }}>person</span>
                <span className="text-[13px] flex-1 min-w-0 truncate" style={{ color: 'var(--text-primary)' }}>
                  {m.display_name || m.email || `Member ${m.user_id.slice(0, 8)}`}
                </span>
                <span className="text-[10px] font-bold tracking-[0.06em] uppercase px-2 py-0.5 rounded"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--text-secondary)' }}>
                  {m.role}
                </span>
              </div>
            ))}
          </div>

          {/* Invite */}
          <div>
            <p className="label-xs mb-1.5">Invite by email</p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                type="email"
                className="premium-input px-3 py-2 rounded-lg text-[13px] flex-1 min-w-[200px]"
              />
              <button onClick={handleInvite} disabled={busy || !inviteEmail.trim()}
                className="premium-btn px-4 py-2 rounded-lg text-[13px] disabled:opacity-50">
                {busy ? 'Sending…' : 'Invite'}
              </button>
            </div>
          </div>

          {/* Pending invites */}
          {invites.filter(i => !i.accepted).length > 0 && (
            <div>
              <p className="label-xs mb-1.5">Pending</p>
              <div className="flex flex-wrap gap-1.5">
                {invites.filter(i => !i.accepted).map(i => (
                  <span key={i.id} className="px-2.5 py-1 rounded-full text-[11.5px]"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
                    {i.email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {msg && (
        <p className="text-[12px] mt-3" style={{ color: msg.ok ? 'var(--success)' : 'var(--critical)' }}>
          {msg.text}
        </p>
      )}
    </section>
  )
}
