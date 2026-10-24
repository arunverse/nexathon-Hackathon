import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { CompanyFeed } from './CompanyFeed'
import { sanitizeText } from '../../lib/sanitize'

interface Group {
  id: string
  name: string
  description: string | null
  logo_url: string | null
  cover_url: string | null
  is_private: boolean
  creator_id: string
  members_count: number
  created_at: string
  user_status?: 'approved' | 'pending' | 'none'
}

interface CommunityGroupsProps {
  onOpenCompanyProfile: (userId: string) => void
}

const PRESET_GROUPS = [
  { name: 'Indian SaaS Companies', desc: 'Network of SaaS founders, product builders & executive leadership across India.', private: false },
  { name: 'AI & Automation Businesses', desc: 'Enterprise teams deploying production LLMs, automated agents, and neural workflows.', private: false },
  { name: 'Bengaluru Startup Network', desc: 'Founders & tech executives operating out of the Bengaluru innovation ecosystem.', private: false },
  { name: 'Hospitality Technology', desc: 'B2B vendors, hotel tech providers & SaaS solutions for hospitality & dining.', private: false },
]

export function CommunityGroups({ onOpenCompanyProfile }: CommunityGroupsProps) {
  const { user } = useAuth()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [activeGroup, setActiveGroup] = useState<Group | null>(null)

  // Create Group Modal
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [isPrivate, setIsPrivate] = useState(false)
  const [creating, setCreating] = useState(false)

  const fetchGroups = useCallback(async () => {
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('community_groups')
        .select('*')
        .order('members_count', { ascending: false })

      if (error) throw error

      if (user && data && data.length > 0) {
        const groupIds = data.map((g) => g.id)
        const { data: memberStatuses } = await supabase
          .from('community_group_members')
          .select('group_id, status')
          .eq('user_id', user.id)
          .in('group_id', groupIds)

        const statusMap = new Map<string, 'approved' | 'pending'>()
        memberStatuses?.forEach((m) => statusMap.set(m.group_id, m.status as any))

        const formatted = data.map((g) => ({
          ...g,
          user_status: statusMap.get(g.id) || 'none',
        }))
        setGroups(formatted)
      } else {
        setGroups(data || [])
      }
    } catch (err) {
      console.error('Error fetching community groups:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchGroups()
  }, [fetchGroups])

  async function handleCreateGroup(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !name.trim()) return

    try {
      setCreating(true)
      const { data, error } = await supabase
        .from('community_groups')
        .insert({
          name: sanitizeText(name),
          description: desc.trim() ? sanitizeText(desc) : null,
          is_private: isPrivate,
          creator_id: user.id,
          members_count: 1,
        })
        .select()
        .single()

      if (error) throw error

      // Add owner as admin member
      await supabase.from('community_group_members').insert({
        group_id: data.id,
        user_id: user.id,
        role: 'admin',
        status: 'approved',
      })

      setName('')
      setDesc('')
      setIsPrivate(false)
      setShowCreateModal(false)
      fetchGroups()
    } catch (err) {
      console.error('Group creation error:', err)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoinGroup(group: Group) {
    if (!user) return
    try {
      const { data: status } = await supabase.rpc('ebexta_join_group', { p_group_id: group.id })

      setGroups((prev) =>
        prev.map((g) => (g.id === group.id ? { ...g, user_status: status as any } : g))
      )
    } catch (err) {
      console.error('Join group error:', err)
    }
  }

  if (activeGroup) {
    return (
      <div className="space-y-6">
        {/* Back Button */}
        <button
          onClick={() => setActiveGroup(null)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[12px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">arrow_back</span>
          Back to All Groups
        </button>

        {/* Group Header Banner */}
        <div className="p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[22px] text-[var(--accent-interactive)]">
                {activeGroup.name[0]?.toUpperCase()}
              </div>
              <div>
                <h2 className="text-[18px] font-bold text-[var(--text-primary)]">{activeGroup.name}</h2>
                <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
                  {activeGroup.is_private ? 'Private Group' : 'Public Group'} • {activeGroup.members_count} Members
                </p>
              </div>
            </div>

            {activeGroup.user_status === 'approved' ? (
              <span className="px-3 py-1.5 rounded-xl bg-emerald-950/40 text-emerald-400 border border-emerald-800/50 text-[12px] font-bold">
                Member
              </span>
            ) : (
              <button
                onClick={() => handleJoinGroup(activeGroup)}
                className="px-4 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90"
              >
                Join Group
              </button>
            )}
          </div>

          {activeGroup.description && (
            <p className="text-[13px] text-[var(--text-secondary)] leading-relaxed border-t border-[var(--border-subtle)] pt-3">
              {activeGroup.description}
            </p>
          )}
        </div>

        {/* Group Posts Feed */}
        <CompanyFeed onOpenCompanyProfile={onOpenCompanyProfile} groupId={activeGroup.id} />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <div>
          <h3 className="text-[16px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[20px] text-[var(--accent-interactive)]">groups</span>
            Business & Industry Groups
          </h3>
          <p className="text-[12px] text-[var(--text-muted)] mt-0.5">
            Connect with specialized business circles, regional tech hubs, and sector communities.
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[13px] font-bold bg-[var(--accent)] text-[var(--bg-elevated)] hover:opacity-90 transition-all cursor-pointer"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          Create Group
        </button>
      </div>

      {/* Preset Recommendations */}
      {groups.length === 0 && !loading && (
        <div className="p-4 rounded-2xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] space-y-3">
          <span className="text-[12px] font-bold text-[var(--accent-interactive)] uppercase tracking-wider">
            Suggested Community Groups
          </span>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {PRESET_GROUPS.map((preset, idx) => (
              <div key={idx} className="p-4 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
                <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{preset.name}</h4>
                <p className="text-[12px] text-[var(--text-secondary)]">{preset.desc}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Groups Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-36 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => (
            <motion.div
              key={group.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all flex flex-col justify-between space-y-4"
            >
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[18px] text-[var(--accent-interactive)] shrink-0">
                    {group.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <h4
                      onClick={() => setActiveGroup(group)}
                      className="text-[15px] font-bold text-[var(--text-primary)] hover:text-[var(--accent-interactive)] transition-colors cursor-pointer"
                    >
                      {group.name}
                    </h4>
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {group.is_private ? 'Private Group' : 'Public Network'} • {group.members_count} Members
                    </p>
                  </div>
                </div>

                <p className="text-[12px] text-[var(--text-secondary)] line-clamp-2">
                  {group.description || 'Specialized B2B community for industry peers and corporate partners.'}
                </p>
              </div>

              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between">
                {group.user_status === 'approved' ? (
                  <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">check_circle</span> Joined
                  </span>
                ) : group.user_status === 'pending' ? (
                  <span className="text-[11px] font-bold text-amber-400">Request Pending</span>
                ) : (
                  <button
                    onClick={() => handleJoinGroup(group)}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] hover:opacity-90"
                  >
                    Join Circle
                  </button>
                )}

                <button
                  onClick={() => setActiveGroup(group)}
                  className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] border border-[var(--border-subtle)] flex items-center gap-1"
                >
                  Enter Group
                  <span className="material-symbols-outlined text-[14px]">chevron_right</span>
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <form
            onSubmit={handleCreateGroup}
            className="w-full max-w-md p-6 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] space-y-4"
          >
            <h3 className="text-[16px] font-bold text-[var(--text-primary)] flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px] text-[var(--accent-interactive)]">group_add</span>
              Create Business Group
            </h3>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Group Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Indian SaaS Founders"
                className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">Description</label>
              <textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                placeholder="Describe group purpose, target audience and guidelines..."
                className="w-full p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none resize-none"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="privCheck"
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                className="w-4 h-4 rounded text-[var(--accent-interactive)]"
              />
              <label htmlFor="privCheck" className="text-[12px] text-[var(--text-secondary)] cursor-pointer">
                Private Group (requires admin approval to join)
              </label>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 rounded-xl text-[12px] text-[var(--text-secondary)]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating || !name.trim()}
                className="px-5 py-2 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 disabled:opacity-50"
              >
                Create Group
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
