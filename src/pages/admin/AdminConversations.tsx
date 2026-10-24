/**
 * /admin/conversations — read-only monitor of member↔member inbox chats.
 * conversations / messages already carry is_admin() read policies, so the admin
 * can review any thread. Pick a conversation on the left, read it on the right.
 */
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card } from './shared'
import { timeAgoLabel } from './adminUtils'

interface Conversation { id: string; user_a: string; user_b: string; last_message: string | null; last_message_at: string | null }
interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string }

export default function AdminConversations() {
  const [convos, setConvos] = useState<Conversation[]>([])
  const [names, setNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [msgs, setMsgs] = useState<Message[]>([])
  const [msgLoading, setMsgLoading] = useState(false)

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase.from('conversations').select('*').order('last_message_at', { ascending: false }).limit(200)
      if (error) setLoadError(`${error.message} — admin read needs is_admin() (chat_and_signals.sql).`)
      const list = (data ?? []) as Conversation[]
      setConvos(list)
      const ids = Array.from(new Set(list.flatMap(c => [c.user_a, c.user_b])))
      if (ids.length) {
        const { data: profs } = await supabase.from('profiles').select('id, company_name, sender_email').in('id', ids)
        const map: Record<string, string> = {}
        for (const p of (profs ?? []) as { id: string; company_name: string | null; sender_email: string | null }[]) {
          map[p.id] = p.company_name || p.sender_email || p.id.slice(0, 8)
        }
        setNames(map)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function openConvo(id: string) {
    setActiveId(id); setMsgLoading(true)
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', id).order('created_at', { ascending: true }).limit(500)
    setMsgs((data ?? []) as Message[]); setMsgLoading(false)
  }

  const nameOf = (uid: string) => names[uid] || uid.slice(0, 8)

  if (loading) return <Loading label="Loading conversations…" />

  return (
    <div>
      <PageHeader icon="forum" title="Inbox Monitor"
        subtitle={`${convos.length} conversation${convos.length !== 1 ? 's' : ''} across members: read-only oversight.`} />

      {loadError && (
        <div className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}>{loadError}</div>
      )}

      {convos.length === 0 ? (
        <Card><EmptyState title="No conversations yet" hint="Member-to-member chats will appear here." /></Card>
      ) : (
        <div className="grid md:grid-cols-[300px_1fr] gap-4">
          {/* list */}
          <Card>
            <div className="max-h-[70vh] overflow-y-auto divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
              {convos.map(c => (
                <button key={c.id} onClick={() => openConvo(c.id)}
                  className="w-full text-left px-4 py-3 transition-colors"
                  style={{ background: activeId === c.id ? 'var(--accent-subtle)' : 'transparent' }}>
                  <p className="text-[12.5px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{nameOf(c.user_a)} ↔ {nameOf(c.user_b)}</p>
                  <p className="text-[11.5px] truncate mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.last_message || 'No messages yet'}</p>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.last_message_at ? timeAgoLabel(c.last_message_at) : ''}</p>
                </button>
              ))}
            </div>
          </Card>

          {/* thread */}
          <Card>
            <div className="p-4 max-h-[70vh] overflow-y-auto">
              {!activeId ? (
                <EmptyState title="Pick a conversation" hint="Select a thread on the left to read it." />
              ) : msgLoading ? (
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading…</p>
              ) : msgs.length === 0 ? (
                <EmptyState title="No messages" hint="This conversation has no messages yet." />
              ) : (
                <div className="space-y-2.5">
                  {msgs.map(m => (
                    <div key={m.id}>
                      <p className="text-[10px] mb-0.5" style={{ color: 'var(--text-muted)' }}>{nameOf(m.sender_id)} · {timeAgoLabel(m.created_at)}</p>
                      <div className="inline-block px-3 py-2 rounded-xl text-[12.5px] break-words"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', maxWidth: '90%' }}>
                        {m.body}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}
