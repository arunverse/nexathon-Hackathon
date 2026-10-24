import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'

interface NotificationItem {
  id: string
  user_id: string
  actor_id: string | null
  type: string
  title: string
  body: string
  link: string | null
  read: boolean
  created_at: string
}

export function CommunityNotifications() {
  const { user } = useAuth()
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchNotifications = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const { data, error } = await supabase
        .from('community_notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(30)

      if (error) throw error
      setNotifications(data || [])
    } catch (err) {
      console.error('Error fetching notifications:', err)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchNotifications()
  }, [fetchNotifications])

  async function handleMarkAllAsRead() {
    if (!user) return
    try {
      await supabase
        .from('community_notifications')
        .update({ read: true })
        .eq('user_id', user.id)

      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch (err) {
      console.error('Error marking notifications read:', err)
    }
  }

  async function handleAcceptConnection(notification: NotificationItem) {
    if (!user || !notification.actor_id) return
    try {
      // Update connection status
      await supabase
        .from('company_connections')
        .update({ status: 'accepted' })
        .or(`and(requester_id.eq.${notification.actor_id},receiver_id.eq.${user.id}),and(requester_id.eq.${user.id},receiver_id.eq.${notification.actor_id})`)

      // Mark notification read
      await supabase
        .from('community_notifications')
        .update({ read: true })
        .eq('id', notification.id)

      alert('Connection accepted! You can now exchange direct messages.')
      fetchNotifications()
    } catch (err) {
      console.error('Accept connection error:', err)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--accent-interactive)]">notifications</span>
          <h3 className="text-[16px] font-bold text-[var(--text-primary)]">Community Notifications</h3>
        </div>

        <button
          onClick={handleMarkAllAsRead}
          className="text-[12px] font-semibold text-[var(--accent-interactive)] hover:underline"
        >
          Mark all as read
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-20 rounded-2xl bg-[var(--bg-elevated)] animate-pulse" />
          ))}
        </div>
      ) : notifications.length === 0 ? (
        <div className="p-12 text-center rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
          <span className="material-symbols-outlined text-[36px] text-[var(--text-muted)]">notifications_off</span>
          <p className="text-[13px] font-bold text-[var(--text-primary)]">No notifications yet</p>
          <p className="text-[12px] text-[var(--text-muted)]">You are up to date on all community activity.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`p-4 rounded-2xl border transition-all ${
                !n.read
                  ? 'bg-[var(--accent-subtle)] border-[var(--border-strong)]'
                  : 'bg-[var(--bg-elevated)] border-[var(--border-subtle)]'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-[var(--text-primary)]">{n.title}</span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-[var(--accent-interactive)] shrink-0" />
                    )}
                  </div>
                  <p className="text-[12px] text-[var(--text-secondary)]">{n.body}</p>
                  <span className="text-[10px] text-[var(--text-muted)] block pt-1">
                    {new Date(n.created_at).toLocaleString()}
                  </span>
                </div>

                {n.type === 'connection_request' && !n.read && (
                  <button
                    onClick={() => handleAcceptConnection(n)}
                    className="px-3 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-interactive)] text-white hover:opacity-90 shrink-0"
                  >
                    Accept
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
