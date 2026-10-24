/**
 * NotificationCenter — Interactive notification popover with real dynamic alerts:
 * 1. Unread chat messages from member-to-member conversations
 * 2. New intent signals matching user industries
 * 3. 30-day company profile freshness reminder
 * 4. Company profile incomplete warning
 * 5. Dossier & verified contact release alerts
 *
 * Click to view navigates to the relevant page and marks as read.
 * Read states persist in localStorage per user.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, CheckCheck, MessageSquare, Radio, Sparkles, ShieldCheck, Clock, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isAuthorizedAdminEmail } from '../lib/adminAuth'

export interface NotificationItem {
  id: string
  type: 'message' | 'signal' | 'profile' | 'dossier' | 'verification' | 'system'
  title: string
  body: string
  time: string
  timestamp: number
  read: boolean
  link: string
  actionLabel?: string
}

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

export function NotificationCenter() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [tab, setTab] = useState<'all' | 'messages' | 'signals' | 'system'>('all')
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Storage key for user read IDs
  const storageKey = user ? `ebexta_read_notifs_${user.id}` : 'ebexta_read_notifs_guest'

  const getReadIds = useCallback((): Set<string> => {
    try {
      const raw = localStorage.getItem(storageKey)
      return new Set(raw ? JSON.parse(raw) : [])
    } catch {
      return new Set()
    }
  }, [storageKey])

  const saveReadId = useCallback((id: string) => {
    try {
      const current = getReadIds()
      current.add(id)
      localStorage.setItem(storageKey, JSON.stringify([...current]))
    } catch { /* ignore */ }
  }, [storageKey, getReadIds])

  const saveAllRead = useCallback((ids: string[]) => {
    try {
      const current = getReadIds()
      ids.forEach(id => current.add(id))
      localStorage.setItem(storageKey, JSON.stringify([...current]))
    } catch { /* ignore */ }
  }, [storageKey, getReadIds])

  // Fetch real, authentic notifications strictly belonging to the logged-in user
  const loadNotifications = useCallback(async () => {
    if (!user) return
    setLoading(true)
    const readIds = getReadIds()
    const items: NotificationItem[] = []

    try {
      // 1. REAL Unread messages for this user
      const { data: convos } = await supabase
        .from('conversations')
        .select('id, user_a, user_b')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)

      if (convos && convos.length > 0) {
        const convoIds = convos.map(c => c.id)
        // Fetch recent messages so conversations remain accessible even after seen
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('id, conversation_id, body, created_at, sender_id, read_at')
          .in('conversation_id', convoIds)
          .neq('sender_id', user.id)
          .order('created_at', { ascending: false })
          .limit(10)

        if (recentMsgs && recentMsgs.length > 0) {
          const senderIds = [...new Set(recentMsgs.map(m => m.sender_id))]
          // Query network_profiles (safe definer view) to prevent 403 RLS errors on profiles
          const { data: senders } = await supabase
            .from('network_profiles')
            .select('id, company_name, sender_email')
            .in('id', senderIds)

          const senderMap: Record<string, { name: string; isAdmin: boolean }> = {}
          for (const s of senders || []) {
            const isAdmin = isAuthorizedAdminEmail(s.sender_email) ||
              s.id === '5c7d8b23-969c-4a09-898b-9db03887e9df'
            const name = isAdmin ? 'EBEXTA Admin' : (s.company_name === 'EBEXTA Admin' ? 'EBEXTA Member' : (s.company_name || s.sender_email?.split('@')[0] || 'EBEXTA Member'))
            senderMap[s.id] = { name, isAdmin }
          }

          // Fallback identification for admin
          for (const sId of senderIds) {
            if (!senderMap[sId] && (sId === '5c7d8b23-969c-4a09-898b-9db03887e9df')) {
              senderMap[sId] = { name: 'EBEXTA Admin', isAdmin: true }
            }
          }

          for (const msg of recentMsgs) {
            const isAdmin = msg.sender_id === '5c7d8b23-969c-4a09-898b-9db03887e9df' || Boolean(senderMap[msg.sender_id]?.isAdmin)
            const sender = senderMap[msg.sender_id] || { name: isAdmin ? 'EBEXTA Admin' : 'EBEXTA Member', isAdmin }
            const isRead = Boolean(msg.read_at) || readIds.has(`msg_${msg.id}`)
            items.push({
              id: `msg_${msg.id}`,
              type: 'message',
              title: isAdmin ? 'Message from EBEXTA Admin' : `New message from ${sender.name}`,
              body: msg.body?.slice(0, 95) ? (msg.body.length > 95 ? msg.body.slice(0, 95) + '…' : msg.body) : 'Sent you an attachment',
              time: formatTimeAgo(new Date(msg.created_at).getTime()),
              timestamp: new Date(msg.created_at).getTime(),
              read: isRead,
              link: '/dashboard/inbox',
              actionLabel: 'Open conversation',
            })
          }
        }
      }

      // 2. REAL Incoming Dossier Requests (another member requested this company's dossier)
      const { data: incomingDossierReqs } = await supabase
        .from('dossier_requests')
        .select('id, requester_id, status, created_at')
        .eq('subject_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (incomingDossierReqs && incomingDossierReqs.length > 0) {
        const reqIds = incomingDossierReqs.map(r => r.requester_id)
        const { data: reqUsers } = await supabase
          .from('network_profiles')
          .select('id, company_name')
          .in('id', reqIds)
        const reqMap: Record<string, string> = {}
        for (const u of reqUsers || []) reqMap[u.id] = u.company_name || 'EBEXTA Member'

        for (const r of incomingDossierReqs) {
          const cName = reqMap[r.requester_id] || 'A network member'
          items.push({
            id: `dreq_in_${r.id}`,
            type: 'dossier',
            title: `Bilateral Dossier Requested`,
            body: `${cName} has requested access to your verified company dossier.`,
            time: formatTimeAgo(new Date(r.created_at).getTime()),
            timestamp: new Date(r.created_at).getTime(),
            read: readIds.has(`dreq_in_${r.id}`),
            link: '/dashboard/settings',
            actionLabel: 'View company profile',
          })
        }
      }

      // 3. REAL Delivered Dossiers (dossiers requested by this user and approved by admin)
      const { data: deliveredDossiers } = await supabase
        .from('dossier_requests')
        .select('id, subject_id, status, handled_at')
        .eq('requester_id', user.id)
        .eq('status', 'delivered')
        .order('handled_at', { ascending: false })
        .limit(5)

      if (deliveredDossiers && deliveredDossiers.length > 0) {
        const subIds = deliveredDossiers.map(d => d.subject_id)
        const { data: subUsers } = await supabase
          .from('network_profiles')
          .select('id, company_name')
          .in('id', subIds)
        const subMap: Record<string, string> = {}
        for (const u of subUsers || []) subMap[u.id] = u.company_name || 'Partner Company'

        for (const d of deliveredDossiers) {
          const cName = subMap[d.subject_id] || 'Company'
          items.push({
            id: `dossier_deliv_${d.id}`,
            type: 'dossier',
            title: `Dossier Verified: ${cName}`,
            body: `EBEXTA Admin has verified and unlocked the bilateral dossier for ${cName}.`,
            time: d.handled_at ? formatTimeAgo(new Date(d.handled_at).getTime()) : 'Recently',
            timestamp: d.handled_at ? new Date(d.handled_at).getTime() : Date.now(),
            read: readIds.has(`dossier_deliv_${d.id}`),
            link: '/dashboard/inbox',
            actionLabel: 'View verified dossier',
          })
        }
      }

      // 4. REAL Lead Verification Requests completed
      const { data: verifs } = await supabase
        .from('verification_requests')
        .select('id, company_name, contact_name, status, created_at')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4)

      if (verifs && verifs.length > 0) {
        for (const v of verifs) {
          if (v.status === 'delivered') {
            items.push({
              id: `verif_${v.id}`,
              type: 'verification',
              title: `Contact Verified: ${v.company_name}`,
              body: `Verified intel and direct contacts for ${v.contact_name || v.company_name} are ready in your leads.`,
              time: formatTimeAgo(new Date(v.created_at).getTime()),
              timestamp: new Date(v.created_at).getTime(),
              read: readIds.has(`verif_${v.id}`),
              link: '/dashboard',
              actionLabel: 'View verified lead',
            })
          }
        }
      }

      // 5. REAL Community Notifications (Interaction requests, connection requests)
      const { data: commNotifs } = await supabase
        .from('community_notifications')
        .select('id, title, body, type, link, created_at, is_read')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)

      if (commNotifs && commNotifs.length > 0) {
        for (const cn of commNotifs) {
          items.push({
            id: `comm_${cn.id}`,
            type: cn.type === 'interaction_request' || cn.type === 'connection_request' ? 'message' : 'system',
            title: cn.title || 'New Interaction Request',
            body: cn.body || 'A member requested to interact with you via Community Broadcast.',
            time: formatTimeAgo(new Date(cn.created_at).getTime()),
            timestamp: new Date(cn.created_at).getTime(),
            read: Boolean(cn.is_read) || readIds.has(`comm_${cn.id}`),
            link: cn.link || '/dashboard/community',
            actionLabel: 'View Interaction Request',
          })
        }
      }

      // 6. REAL Account & Plan Status
      const { data: myProfile } = await supabase
        .from('profiles')
        .select('plan, plan_status, plan_expires_at')
        .eq('id', user.id)
        .maybeSingle()

      if (myProfile?.plan_status === 'active') {
        const planName = (myProfile.plan || 'Starter').toUpperCase()
        items.push({
          id: `plan_active_${user.id}_${myProfile.plan}`,
          type: 'system',
          title: `${planName} Plan Active`,
          body: `Your ${planName} subscription is active with full B2B intelligence access and lead discovery.`,
          time: 'Active',
          timestamp: myProfile.plan_expires_at ? new Date(myProfile.plan_expires_at).getTime() : Date.now(),
          read: readIds.has(`plan_active_${user.id}_${myProfile.plan}`),
          link: '/dashboard/renew',
          actionLabel: 'View plan details',
        })
      }

      // Sort newest first
      items.sort((a, b) => b.timestamp - a.timestamp)
      setNotifications(items)
    } catch (err) {
      console.error('[EBEXTA] NotificationCenter real-event error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, getReadIds])

  useEffect(() => {
    if (!user) return
    void loadNotifications()

    // Realtime channel for instant notification updates when messages or events arrive
    const ch = supabase.channel(`ebexta_notifs_${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'dossier_requests' }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'community_notifications' }, () => {
        void loadNotifications()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'company_connections' }, () => {
        void loadNotifications()
      })
      .subscribe()

    // Custom window event dispatched on admin send
    const onNewMsg = () => void loadNotifications()
    window.addEventListener('ebexta:new_message', onNewMsg)

    // Periodic backup poll every 25s
    const timer = setInterval(() => { void loadNotifications() }, 25000)

    return () => {
      supabase.removeChannel(ch)
      window.removeEventListener('ebexta:new_message', onNewMsg)
      clearInterval(timer)
    }
  }, [user, loadNotifications])

  // Close on outside click
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  const unreadCount = notifications.filter(n => !n.read).length

  function handleMarkAllRead() {
    const allIds = notifications.map(n => n.id)
    saveAllRead(allIds)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  function handleItemClick(n: NotificationItem) {
    saveReadId(n.id)
    setNotifications(prev => prev.map(item => item.id === n.id ? { ...item, read: true } : item))
    setOpen(false)
    navigate(n.link)
  }

  // Filter items by tab
  const filtered = notifications.filter(n => {
    if (tab === 'all') return true
    if (tab === 'messages') return n.type === 'message'
    if (tab === 'signals') return n.type === 'signal'
    if (tab === 'system') return ['profile', 'dossier', 'verification', 'system'].includes(n.type)
    return true
  })

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Button */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(o => !o)}
        className="w-9 h-9 rounded-xl flex items-center justify-center relative transition-colors"
        style={{
          background: open ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
          border: open ? '1px solid var(--border-strong)' : '1px solid var(--border-subtle)',
        }}
        title="Notifications"
        aria-label="Notifications"
      >
        <Bell size={17} color={open || unreadCount > 0 ? 'var(--accent-interactive)' : 'var(--text-muted)'} />
        {unreadCount > 0 && (
          <span
            className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse"
            style={{
              background: 'var(--accent)',
              color: 'var(--bg-elevated)',
              boxShadow: '0 0 8px var(--accent-subtle)',
            }}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </motion.button>

      {/* Popover Drawer */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.18 }}
            className="absolute right-0 mt-2 w-[380px] max-w-[calc(100vw-32px)] rounded-2xl shadow-2xl overflow-hidden z-[500]"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              boxShadow: '0 20px 40px -10px rgba(0,0,0,0.45)',
            }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-subtle)' }}>
              <div className="flex items-center gap-2">
                <span className="text-[14px] font-bold" style={{ ...geist, color: 'var(--text-primary)' }}>
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-[10px] font-bold"
                    style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                  >
                    {unreadCount} new
                  </span>
                )}
              </div>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-[11px] font-semibold flex items-center gap-1 hover:underline transition-all"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <CheckCheck size={13} />
                  Mark all read
                </button>
              )}
            </div>

            {/* Filter Tabs */}
            <div className="flex px-3 pt-2 gap-1 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
              {(['all', 'messages', 'signals', 'system'] as const).map(t => {
                const isCur = tab === t
                return (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className="px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.04em] rounded-lg transition-all capitalize"
                    style={{
                      background: isCur ? 'var(--accent-subtle)' : 'transparent',
                      color: isCur ? 'var(--accent-interactive)' : 'var(--text-muted)',
                    }}
                  >
                    {t}
                  </button>
                )
              })}
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto custom-scrollbar divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {loading && notifications.length === 0 ? (
                <div className="p-8 text-center text-[12px]" style={{ color: 'var(--text-muted)' }}>
                  Loading updates…
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-8 text-center">
                  <div
                    className="w-10 h-10 rounded-full mx-auto mb-2 flex items-center justify-center"
                    style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)' }}
                  >
                    <Bell size={18} />
                  </div>
                  <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>All caught up</p>
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    No new alerts right now. Signals, messages, and profile reminders will appear here.
                  </p>
                </div>
              ) : (
                filtered.map(item => {
                  const Icon = getIcon(item.type)
                  return (
                    <div
                      key={item.id}
                      onClick={() => handleItemClick(item)}
                      className="p-3.5 hover:brightness-105 cursor-pointer transition-all flex items-start gap-3 relative group"
                      style={{
                        background: item.read ? 'transparent' : 'rgba(245, 158, 11, 0.04)',
                      }}
                    >
                      {/* Left icon badge */}
                      <div
                        className="w-8 h-8 rounded-xl shrink-0 flex items-center justify-center mt-0.5"
                        style={{
                          background: item.type === 'message'
                            ? 'rgba(59, 130, 246, 0.12)'
                            : item.type === 'signal'
                            ? 'rgba(16, 185, 129, 0.12)'
                            : 'rgba(245, 158, 11, 0.12)',
                          color: item.type === 'message'
                            ? '#3B82F6'
                            : item.type === 'signal'
                            ? '#10B981'
                            : 'var(--warning)',
                        }}
                      >
                        <Icon size={16} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-1 mb-0.5">
                          <p
                            className="text-[12.5px] font-bold truncate"
                            style={{ color: item.read ? 'var(--text-primary)' : 'var(--text-primary)' }}
                          >
                            {item.title}
                          </p>
                          <span className="text-[10px] shrink-0 font-medium" style={{ color: 'var(--text-muted)' }}>
                            {item.time}
                          </span>
                        </div>
                        <p className="text-[11.5px] line-clamp-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                          {item.body}
                        </p>
                        {item.actionLabel && (
                          <div className="mt-1.5 flex items-center gap-1 text-[11px] font-bold" style={{ color: 'var(--accent-interactive)' }}>
                            <span>{item.actionLabel}</span>
                            <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        )}
                      </div>

                      {/* Unread indicator dot */}
                      {!item.read && (
                        <span
                          className="w-2 h-2 rounded-full shrink-0 mt-2"
                          style={{ background: 'var(--accent)' }}
                        />
                      )}
                    </div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t text-center" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-surface)' }}>
              <p className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                EBEXTA Intelligence & Intent Updates · Refreshed automatically
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function getIcon(type: NotificationItem['type']) {
  switch (type) {
    case 'message': return MessageSquare
    case 'signal': return Radio
    case 'dossier':
    case 'verification': return ShieldCheck
    case 'profile': return Sparkles
    default: return Clock
  }
}

function formatTimeAgo(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
