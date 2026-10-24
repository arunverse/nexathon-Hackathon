import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DataOriginBadge } from './CompanyFeed'

interface CompanyProfileModalProps {
  userId: string
  companyName?: string
  onClose: () => void
  onOpenMessage?: (targetUserId: string) => void
}

interface FullCompanyProfile {
  id: string
  company_name: string | null
  sender_email: string | null
  mission: string | null
  mode: string | null
  website: string | null
  logo_url?: string | null
  profile_image_url?: string | null
  avatar_url?: string | null
  company_logo?: string | null
  company_profile: {
    future_scope?: string
    financial_funding?: string
    strategic_needs?: string
    major_projects?: string
    employees?: string
    revenue?: string
    stage?: string
    location?: string
    recent_signals?: string[]
    key_contacts?: Array<{ name: string; title: string; email?: string }>
    industry?: string
    services?: string[]
  } | null
  created_at: string
  is_claimed?: boolean
}

export function CompanyProfileModal({ userId, companyName, onClose, onOpenMessage }: CompanyProfileModalProps) {
  const { user } = useAuth()
  const [profile, setProfile] = useState<FullCompanyProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'signals' | 'intent' | 'posts'>('overview')

  // Connection/Follow Status
  const [connectionStatus, setConnectionStatus] = useState<'none' | 'pending' | 'accepted'>('none')
  const [isFollowing, setIsFollowing] = useState(false)
  const [followersCount, setFollowersCount] = useState(0)

  // Posts by this company
  const [companyPosts, setCompanyPosts] = useState<any[]>([])

  const fetchProfileDetails = useCallback(async () => {
    try {
      setLoading(true)

      // 1. Fetch Profile
      const { data: profData } = await supabase
        .from('profiles')
        .select('id, company_name, sender_email, mission, mode, website, company_profile, created_at, logo_url, profile_image_url, avatar_url')
        .eq('id', userId)
        .maybeSingle()

      if (profData) {
        setProfile({ ...profData, is_claimed: true })
      } else {
        // Fallback for public unclaimed company profile
        setProfile({
          id: userId,
          company_name: companyName || 'Enterprise Partner',
          sender_email: null,
          mission: 'Scraped Public Business Intelligence Profile.',
          mode: 'seeker',
          website: null,
          company_profile: {
            industry: 'Technology & Enterprise Solutions',
            employees: '50-200 employees',
            location: 'India / Regional Offices',
            recent_signals: ['Hiring active AI Engineers', 'Expanding Enterprise SaaS Suite'],
          },
          created_at: new Date().toISOString(),
          is_claimed: false,
        })
      }

      // 2. Fetch Connection Status
      if (user) {
        const { data: conn } = await supabase
          .from('company_connections')
          .select('status')
          .or(`and(requester_id.eq.${user.id},receiver_id.eq.${userId}),and(requester_id.eq.${userId},receiver_id.eq.${user.id})`)
          .maybeSingle()

        if (conn) setConnectionStatus(conn.status as any)

        // 3. Fetch Follow Status
        const { data: follow } = await supabase
          .from('company_follows')
          .select('id')
          .eq('follower_id', user.id)
          .eq('target_user_id', userId)
          .maybeSingle()

        setIsFollowing(!!follow)
      }

      // 4. Followers Count
      const { count } = await supabase
        .from('company_follows')
        .select('id', { count: 'exact', head: true })
        .eq('target_user_id', userId)

      setFollowersCount(count || 0)

      // 5. Posts
      const { data: posts } = await supabase
        .from('community_posts')
        .select('*')
        .eq('user_id', userId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })

      setCompanyPosts(posts || [])
    } catch (err) {
      console.error('Error fetching company profile:', err)
    } finally {
      setLoading(false)
    }
  }, [userId, companyName, user])

  useEffect(() => {
    fetchProfileDetails()
  }, [fetchProfileDetails])

  async function handleToggleFollow() {
    if (!user) return
    try {
      if (isFollowing) {
        await supabase
          .from('company_follows')
          .delete()
          .eq('follower_id', user.id)
          .eq('target_user_id', userId)

        setIsFollowing(false)
        setFollowersCount((prev) => Math.max(0, prev - 1))
      } else {
        await supabase.from('company_follows').insert({
          follower_id: user.id,
          target_user_id: userId,
        })

        setIsFollowing(true)
        setFollowersCount((prev) => prev + 1)
      }
    } catch (err) {
      console.error('Follow toggle error:', err)
    }
  }

  async function handleSendConnectionRequest() {
    if (!user || user.id === userId) return
    try {
      await supabase.from('company_connections').insert({
        requester_id: user.id,
        receiver_id: userId,
        status: 'pending',
      })

      setConnectionStatus('pending')

      const { data: prof } = await supabase
        .from('profiles')
        .select('company_name, full_name')
        .eq('id', user.id)
        .maybeSingle()

      const senderName = prof?.company_name?.trim() || prof?.full_name?.trim() || 'A network member'

      await supabase.from('community_notifications').insert({
        user_id: userId,
        actor_id: user.id,
        type: 'interaction_request',
        title: 'New Interaction Request',
        body: `${senderName} requested to interact with you via Community Broadcast.`,
        link: `/dashboard/community`,
      })
    } catch (err) {
      console.error('Interaction request error:', err)
    }
  }

  const cp = profile?.company_profile || {}
  const companyLogo = profile?.avatar_url || profile?.profile_image_url || profile?.logo_url || profile?.company_logo || null

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-md overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-3xl rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] shadow-2xl overflow-hidden my-auto max-h-[92vh] flex flex-col"
      >
        {/* Top Header & Identity Area (Non-scrolling so avatar is never clipped) */}
        <div className="relative shrink-0">
          {/* Cover Banner */}
          <div className="h-28 sm:h-32 bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 relative p-3 sm:p-4 flex items-start justify-between border-b border-[var(--border-subtle)]">
            <div className="flex items-center gap-2 pt-1">
              {profile?.is_claimed ? (
                <DataOriginBadge origin="company_provided" />
              ) : (
                <DataOriginBadge origin="public_data" />
              )}
            </div>

            <button
              onClick={onClose}
              className="p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors z-20"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>

          {/* Profile Identity Bar */}
          <div className="px-4 sm:px-6 pb-2 relative space-y-3">
            {/* Avatar Overlay & Action Buttons Row */}
            <div className="-mt-10 sm:-mt-12 flex flex-wrap items-end justify-between gap-3">
              {companyLogo ? (
                <img
                  src={companyLogo}
                  alt="Company Logo"
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl object-cover border-4 border-[var(--bg-elevated)] shadow-xl bg-[var(--bg-surface)] shrink-0 z-10"
                />
              ) : (
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-[var(--bg-elevated)] border-4 border-[var(--bg-elevated)] shadow-xl flex items-center justify-center font-bold text-[28px] sm:text-[32px] text-[var(--accent-interactive)] bg-gradient-to-br from-[var(--bg-surface)] to-[var(--bg-elevated)] shrink-0 z-10">
                  {profile?.company_name ? profile.company_name[0]?.toUpperCase() : 'C'}
                </div>
              )}

              {/* Action Buttons */}
              {user && user.id !== userId && (
                <div className="flex items-center gap-2 pt-2">
                  <button
                    onClick={handleToggleFollow}
                    className={`px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-[12px] font-bold transition-all ${
                      isFollowing
                        ? 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-strong)]'
                        : 'bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)]'
                    }`}
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </button>

                  {connectionStatus === 'accepted' ? (
                    <button
                      onClick={() => onOpenMessage && onOpenMessage(userId)}
                      className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 transition-all flex items-center gap-1.5"
                    >
                      <span className="material-symbols-outlined text-[15px] sm:text-[16px]">chat</span>
                      Interacting
                    </button>
                  ) : connectionStatus === 'pending' ? (
                    <button disabled className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-[12px] font-bold bg-[var(--bg-surface)] text-[var(--text-muted)] border border-[var(--border-subtle)] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] sm:text-[16px] text-amber-400">hourglass_top</span>
                      Pending
                    </button>
                  ) : (
                    <button
                      onClick={handleSendConnectionRequest}
                      className="px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-xl text-[11px] sm:text-[12px] font-bold bg-[var(--accent)] text-[var(--bg-elevated)] hover:opacity-90 transition-all flex items-center gap-1.5 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[15px] sm:text-[16px]">forum</span>
                      Interact
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Company Title & Metadata */}
            <div className="pt-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[20px] sm:text-[24px] font-bold text-[var(--text-primary)] leading-tight">
                  {profile?.company_name || 'Enterprise Company'}
                </h2>
                <span className="material-symbols-outlined text-[20px] sm:text-[24px] text-[var(--accent-interactive)] shrink-0" title="Verified">
                  verified
                </span>
              </div>
              <p className="text-[12px] sm:text-[13px] font-medium text-[var(--text-secondary)] mt-1">
                {cp.industry || 'Technology & Business Intelligence'} • {cp.location || 'India'}
              </p>
            </div>
          </div>
        </div>

        {/* Scrollable Content Body */}
        <div className="px-4 sm:px-6 pb-6 relative space-y-4 overflow-y-auto min-h-0 flex-1 no-scrollbar pt-2">

          {/* Quick Stats Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 pt-1 text-center text-[12px]">
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-w-0">
              <span className="block text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold truncate">Followers</span>
              <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] truncate block">{followersCount}</span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-w-0">
              <span className="block text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold truncate">Company Size</span>
              <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] truncate block">{cp.employees || '50-100'}</span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-w-0">
              <span className="block text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold truncate">Stage</span>
              <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] truncate block">{cp.stage || 'Growth'}</span>
            </div>
            <div className="p-2 sm:p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] min-w-0">
              <span className="block text-[9px] sm:text-[10px] text-[var(--text-muted)] uppercase tracking-wider font-semibold truncate">Broadcasts</span>
              <span className="text-[13px] sm:text-[14px] font-bold text-[var(--text-primary)] truncate block">{companyPosts.length}</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <div className="flex border-b border-[var(--border-subtle)] gap-4 sm:gap-6 text-[12px] sm:text-[13px] font-semibold pt-1 overflow-x-auto no-scrollbar whitespace-nowrap">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-2 transition-colors shrink-0 ${
                activeTab === 'overview'
                  ? 'border-b-2 border-[var(--accent-interactive)] text-[var(--accent-interactive)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Overview &amp; Details
            </button>
            <button
              onClick={() => setActiveTab('signals')}
              className={`pb-2 transition-colors shrink-0 ${
                activeTab === 'signals'
                  ? 'border-b-2 border-[var(--accent-interactive)] text-[var(--accent-interactive)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Intelligence Signals
            </button>
            <button
              onClick={() => setActiveTab('posts')}
              className={`pb-2 transition-colors shrink-0 ${
                activeTab === 'posts'
                  ? 'border-b-2 border-[var(--accent-interactive)] text-[var(--accent-interactive)] font-bold'
                  : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
              }`}
            >
              Broadcasts ({companyPosts.length})
            </button>
          </div>

          {/* Tab Contents */}
          <div className="pt-1 space-y-4">
            {loading ? (
              <div className="h-36 rounded-xl bg-[var(--bg-surface)] animate-pulse" />
            ) : activeTab === 'overview' ? (
              <div className="space-y-3 sm:space-y-4 text-[12px] sm:text-[13px]">
                {/* Mission / Summary */}
                <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
                  <div className="flex items-center justify-between flex-wrap gap-1">
                    <h4 className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)] shrink-0">info</span>
                      <span>Company Mission &amp; Scope</span>
                    </h4>
                  </div>
                  <p className="text-[var(--text-secondary)] leading-relaxed">
                    {profile?.mission || cp.future_scope || 'Enterprise business offering technology solutions, AI integrations, and strategic market expansion services.'}
                  </p>
                </div>

                {/* Major Projects & Funding */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="font-bold text-[var(--text-primary)] text-[12px]">Major Initiatives</span>
                      <DataOriginBadge origin="ebexta_verified" />
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                      {cp.major_projects || 'Scaling cloud architecture, expanding regional B2B client partnerships.'}
                    </p>
                  </div>
                  <div className="p-3.5 sm:p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2 min-w-0">
                    <div className="flex items-center justify-between flex-wrap gap-1.5">
                      <span className="font-bold text-[var(--text-primary)] text-[12px]">Funding &amp; Capital</span>
                      <DataOriginBadge origin="public_data" />
                    </div>
                    <p className="text-[12px] text-[var(--text-secondary)] leading-relaxed">
                      {cp.financial_funding || 'Bootstrapped / Series-A Growth Round.'}
                    </p>
                  </div>
                </div>

                {/* Website Link */}
                {profile?.website && (
                  <div className="p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between flex-wrap gap-2">
                    <span className="text-[12px] text-[var(--text-muted)]">Official Website</span>
                    <a
                      href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[12px] font-bold text-[var(--accent-interactive)] hover:underline flex items-center gap-1"
                    >
                      {profile.website}
                      <span className="material-symbols-outlined text-[14px]">open_in_new</span>
                    </a>
                  </div>
                )}
              </div>
            ) : activeTab === 'signals' ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex-wrap gap-2">
                  <span className="text-[12px] font-bold text-[var(--text-primary)]">Verified Growth Signals</span>
                  <DataOriginBadge origin="ai_generated" />
                </div>
                {cp.recent_signals && cp.recent_signals.length > 0 ? (
                  cp.recent_signals.map((sig, i) => (
                    <div key={i} className="p-3.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12px] text-[var(--text-primary)] flex items-center gap-2">
                      <span className="material-symbols-outlined text-[16px] text-emerald-400 shrink-0">trending_up</span>
                      <span>{sig}</span>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-[12px] text-[var(--text-muted)] bg-[var(--bg-surface)] rounded-xl">
                    No recent public signals detected for this company yet.
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {companyPosts.length === 0 ? (
                  <div className="p-6 text-center text-[12px] text-[var(--text-muted)] bg-[var(--bg-surface)] rounded-xl">
                    This company has not published any broadcasts yet.
                  </div>
                ) : (
                  companyPosts.map((post) => (
                    <div key={post.id} className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                        <span className="font-bold text-[var(--accent-interactive)] uppercase">{post.post_type}</span>
                        <span>{new Date(post.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-[12px] text-[var(--text-primary)]">{post.content}</p>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>,
    document.body
  )
}
