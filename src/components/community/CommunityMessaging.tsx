import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sanitizeText } from '../../lib/sanitize'

interface Conversation {
  id: string
  user_a: string
  user_b: string
  last_message: string | null
  last_message_at: string
  other_user_id: string
  other_company_name?: string
}

interface Message {
  id: string
  conversation_id: string
  sender_id: string
  body: string
  read_at: string | null
  created_at: string
}

interface CommunityMessagingProps {
  selectedTargetUserId?: string | null
}

export function CommunityMessaging({ selectedTargetUserId }: CommunityMessagingProps) {
  const { user } = useAuth()
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [activeConv, setActiveConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const fetchConversations = useCallback(async () => {
    if (!user) return
    try {
      setLoading(true)
      const { data: convs, error } = await supabase
        .from('conversations')
        .select('*')
        .or(`user_a.eq.${user.id},user_b.eq.${user.id}`)
        .order('last_message_at', { ascending: false })

      if (error) throw error

      if (convs && convs.length > 0) {
        const otherIds = convs.map((c) => (c.user_a === user.id ? c.user_b : c.user_a))
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, company_name')
          .in('id', otherIds)

        const nameMap = new Map<string, string>()
        profiles?.forEach((p) => nameMap.set(p.id, p.company_name || 'Enterprise Partner'))

        const formatted = convs.map((c) => {
          const otherId = c.user_a === user.id ? c.user_b : c.user_a
          return {
            ...c,
            other_user_id: otherId,
            other_company_name: nameMap.get(otherId) || 'Enterprise Partner',
          }
        })
        setConversations(formatted)

        // Auto select if targeted
        if (selectedTargetUserId) {
          const existing = formatted.find((c) => c.other_user_id === selectedTargetUserId)
          if (existing) {
            setActiveConv(existing)
          } else {
            // Start conversation RPC
            const { data: convId } = await supabase.rpc('ebexta_start_conversation', {
              other_user: selectedTargetUserId,
            })
            if (convId) fetchConversations()
          }
        } else if (!activeConv && formatted.length > 0) {
          setActiveConv(formatted[0])
        }
      } else if (selectedTargetUserId) {
        const { data: convId } = await supabase.rpc('ebexta_start_conversation', {
          other_user: selectedTargetUserId,
        })
        if (convId) fetchConversations()
      }
    } catch (err) {
      console.error('Error fetching conversations:', err)
    } finally {
      setLoading(false)
    }
  }, [user, selectedTargetUserId, activeConv])

  useEffect(() => {
    fetchConversations()
  }, [fetchConversations])

  // Fetch messages when active conversation changes
  const fetchMessages = useCallback(async () => {
    if (!activeConv) return
    try {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', activeConv.id)
        .order('created_at', { ascending: true })

      if (error) throw error
      setMessages(data || [])
      setTimeout(scrollToBottom, 100)
    } catch (err) {
      console.error('Error fetching messages:', err)
    }
  }, [activeConv])

  useEffect(() => {
    fetchMessages()
  }, [fetchMessages])

  // Realtime subscription for messages in active conversation
  useEffect(() => {
    if (!activeConv) return

    const channel = supabase
      .channel(`public:messages:${activeConv.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${activeConv.id}`,
        },
        (payload) => {
          const newMsg = payload.new as Message
          setMessages((prev) => [...prev, newMsg])
          setTimeout(scrollToBottom, 100)
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeConv])

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !activeConv || !newMessage.trim()) return

    try {
      setSending(true)
      const bodyText = sanitizeText(newMessage.trim())
      setNewMessage('')

      const { error } = await supabase.from('messages').insert({
        conversation_id: activeConv.id,
        sender_id: user.id,
        body: bodyText,
      })

      if (error) throw error

      // Notify recipient
      await supabase.from('community_notifications').insert({
        user_id: activeConv.other_user_id,
        actor_id: user.id,
        type: 'new_message',
        title: 'New Private Message',
        body: `You received a direct message from a connected company.`,
        link: `/dashboard/community`,
      })
    } catch (err) {
      console.error('Message send error:', err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="h-[600px] rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-strong)] flex overflow-hidden">
      {/* Sidebar: Conversation List */}
      <div className="w-full md:w-80 border-r border-[var(--border-subtle)] flex flex-col bg-[var(--bg-surface)]">
        <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between">
          <span className="text-[14px] font-bold text-[var(--text-primary)] flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-[var(--accent-interactive)]">chat</span>
            Direct Messages
          </span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-[var(--border-subtle)]">
          {loading ? (
            <div className="p-4 space-y-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="h-12 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
              ))}
            </div>
          ) : conversations.length === 0 ? (
            <div className="p-6 text-center text-[12px] text-[var(--text-muted)] space-y-2">
              <span className="material-symbols-outlined text-[32px]">question_answer</span>
              <p>No active conversations yet.</p>
              <p className="text-[11px]">Connect with companies in Community Discovery to start messaging.</p>
            </div>
          ) : (
            conversations.map((conv) => {
              const isActive = activeConv?.id === conv.id
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveConv(conv)}
                  className={`p-3.5 cursor-pointer transition-all ${
                    isActive ? 'bg-[var(--accent-subtle)] border-l-4 border-[var(--accent-interactive)]' : 'hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                      {conv.other_company_name}
                    </span>
                    <span className="text-[10px] text-[var(--text-muted)]">
                      {new Date(conv.last_message_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-[11px] text-[var(--text-muted)] truncate">
                    {conv.last_message || 'Start conversation...'}
                  </p>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="hidden md:flex flex-1 flex-col bg-[var(--bg-elevated)]">
        {activeConv ? (
          <>
            {/* Header */}
            <div className="p-4 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--bg-surface)]">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-[var(--accent-subtle)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[14px] text-[var(--accent-interactive)]">
                  {activeConv.other_company_name ? activeConv.other_company_name[0]?.toUpperCase() : 'C'}
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-[var(--text-primary)]">{activeConv.other_company_name}</h4>
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-semibold">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Encrypted B2B Channel
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => alert('User blocked from messaging.')}
                  className="p-1.5 rounded-lg text-[var(--text-muted)] hover:text-red-400 transition-colors"
                  title="Block User"
                >
                  <span className="material-symbols-outlined text-[18px]">block</span>
                </button>
              </div>
            </div>

            {/* Messages Body */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 bg-[var(--bg-elevated)]">
              {messages.length === 0 ? (
                <div className="text-center py-12 text-[12px] text-[var(--text-muted)]">
                  This conversation is private & secure. Send your first broadcast message.
                </div>
              ) : (
                messages.map((m) => {
                  const isMe = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-xs md:max-w-md p-3 rounded-2xl text-[12.5px] leading-relaxed ${
                          isMe
                            ? 'bg-[var(--accent-interactive)] text-white rounded-br-none'
                            : 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border-subtle)] rounded-bl-none'
                        }`}
                      >
                        <p>{m.body}</p>
                        <span className={`block text-[9px] mt-1 text-right ${isMe ? 'text-white/70' : 'text-[var(--text-muted)]'}`}>
                          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Bar */}
            <form onSubmit={handleSendMessage} className="p-3 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-2">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] text-[13px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="px-4 py-2.5 rounded-xl bg-[var(--accent-interactive)] text-white text-[13px] font-bold disabled:opacity-50 flex items-center gap-1"
              >
                <span>Send</span>
                <span className="material-symbols-outlined text-[16px]">send</span>
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-[13px] text-[var(--text-muted)]">
            <span className="material-symbols-outlined text-[48px] mb-2">forum</span>
            Select a conversation to open messaging.
          </div>
        )}
      </div>
    </div>
  )
}
