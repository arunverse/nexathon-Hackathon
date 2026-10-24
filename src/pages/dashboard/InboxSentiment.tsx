/**
 * Network Inbox — Instagram-style DMs between EBEXTA users.
 * Conversation list · realtime thread · read receipts (seen) · typing indicator
 * · unread badges · file attachments · click a partner for their tiered dossier.
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { NetworkProfile } from '../../components/NetworkProfile'
import { isAuthorizedAdminEmail } from '../../lib/adminAuth'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

interface Conversation { id: string; user_a: string; user_b: string; last_message: string | null; last_message_at: string }
interface Message { id: string; conversation_id: string; sender_id: string; body: string; created_at: string; read_at: string | null; attachment_url: string | null; attachment_name: string | null; attachment_type: string | null }
interface Partner { id: string; company_name: string | null; website: string | null; mission: string | null; sender_email: string | null; company_profile: Record<string, string> | null }

function timeAgo(iso: string): string {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (m < 1) return 'now'; if (m < 60) return `${m}m`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h`
  return `${Math.floor(h / 24)}d`
}
const domainOf = (url?: string | null) => {
  if (!url) return ''
  return url.replace(/^https?:\/\/(www\.)?/, '').replace(/\/.*$/, '').split('.')[0]
}
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
// The person's name — from their saved profile, else their email handle.
const personOf = (p?: Partner) => {
  const n = p?.company_profile?.your_name?.trim() || p?.company_profile?.contact_name?.trim()
  if (n) return n
  const e = p?.sender_email?.trim()
  return e ? e.split('@')[0] : ''
}
// The COMPANY name — from onboarding, else website domain, else the person's
// email handle, so it's never just a generic "EBEXTA member".
const nameOf = (p?: Partner) => {
  if (isAuthorizedAdminEmail(p?.sender_email) || p?.id === '5c7d8b23-969c-4a09-898b-9db03887e9df') {
    return 'EBEXTA Admin'
  }
  const c = p?.company_name?.trim()
  if (c && c !== 'EBEXTA Admin') return c
  const d = domainOf(p?.website)
  if (d) return cap(d)
  const person = personOf(p)
  if (person) return cap(person)
  const m = p?.mission?.trim()
  if (m) return m.length > 24 ? m.slice(0, 24) + '…' : m
  return 'EBEXTA member'
}
const initial = (p?: Partner) => (nameOf(p)[0] ?? '?').toUpperCase()

export default function InboxSentiment({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth()
  const [params, setParams] = useSearchParams()
  const [convos, setConvos] = useState<Conversation[]>([])
  const [partners, setPartners] = useState<Record<string, Partner>>({})
  const [unread, setUnread] = useState<Record<string, number>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [uploading, setUploading] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const typingChRef = useRef<RealtimeChannel | null>(null)
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastSentTyping = useRef(0)
  const fileRef = useRef<HTMLInputElement>(null)

  const partnerId = useCallback((c?: Conversation) => (!c || !user ? null : c.user_a === user.id ? c.user_b : c.user_a), [user])

  const loadUnread = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('messages').select('conversation_id').is('read_at', null).neq('sender_id', user.id)
    const counts: Record<string, number> = {}
    for (const r of (data as { conversation_id: string }[]) ?? []) counts[r.conversation_id] = (counts[r.conversation_id] ?? 0) + 1
    setUnread(counts)
  }, [user])

  const loadConvos = useCallback(async () => {
    if (!user) return
    const { data } = await supabase.from('conversations').select('*')
      .or(`user_a.eq.${user.id},user_b.eq.${user.id}`).order('last_message_at', { ascending: false })
    const list = (data as Conversation[]) ?? []
    setConvos(list)
    const otherIds = [...new Set(list.map(c => (c.user_a === user.id ? c.user_b : c.user_a)))]
    if (otherIds.length) {
      const { data: profs } = await supabase.from('network_profiles').select('id, company_name, website, mission, sender_email, company_profile').in('id', otherIds)
      const map: Record<string, Partner> = {}
      for (const p of (profs as Partner[]) ?? []) map[p.id] = p
      for (const id of otherIds) {
        if (!map[id] && id === '5c7d8b23-969c-4a09-898b-9db03887e9df') {
          map[id] = { id, company_name: 'EBEXTA Admin', sender_email: 'arunchinnu2005@gmail.com', website: null, mission: null, company_profile: null }
        }
      }
      setPartners(map)
    }
    setLoading(false)
    void loadUnread()
    return list
  }, [user, loadUnread])

  useEffect(() => { void loadConvos() }, [loadConvos])

  // Start a conversation from ?to=<userId> (Connect buttons).
  useEffect(() => {
    const to = params.get('to')
    if (!to || !user) return
    ;(async () => {
      let { data } = await supabase.rpc('ebexta_start_conversation', { other_user: to })
      if (!data) {
        const res = await supabase.rpc('ketag_start_conversation', { other_user: to })
        data = res.data
      }
      if (data) { await loadConvos(); setActiveId(data as string) }
      params.delete('to'); setParams(params, { replace: true })
    })()
  }, [params, user, loadConvos, setParams])

  const markRead = useCallback(async (cid: string) => {
    const { error } = await supabase.rpc('ebexta_mark_read', { p_conversation: cid })
    if (error) {
      const { error: kErr } = await supabase.rpc('ketag_mark_read', { p_conversation: cid })
      if (kErr && user) {
        await supabase.from('messages').update({ read_at: new Date().toISOString() })
          .eq('conversation_id', cid)
          .neq('sender_id', user.id)
          .is('read_at', null)
      }
    }
    setUnread(u => ({ ...u, [cid]: 0 }))
  }, [user])

  // Messages + realtime (INSERT new, UPDATE for read receipts).
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    let alive = true
    supabase.from('messages').select('*').eq('conversation_id', activeId).order('created_at', { ascending: true })
      .then(({ data }) => { if (alive) { setMessages((data as Message[]) ?? []); void markRead(activeId) } })
    const ch = supabase.channel(`conv:${activeId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        payload => {
          const m = payload.new as Message
          setMessages(prev => prev.some(x => x.id === m.id) ? prev : [...prev, m])
          if (user && m.sender_id !== user.id) void markRead(activeId)
        })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${activeId}` },
        payload => { const m = payload.new as Message; setMessages(prev => prev.map(x => (x.id === m.id ? m : x))) })
      .subscribe()
    return () => { alive = false; supabase.removeChannel(ch) }
  }, [activeId, user, markRead])

  // Typing indicator via realtime broadcast (ephemeral, no DB writes).
  useEffect(() => {
    if (!activeId || !user) { setPartnerTyping(false); return }
    const ch = supabase.channel(`typing:${activeId}`, { config: { broadcast: { self: false } } })
    ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if ((payload as { from: string }).from !== user.id) {
        setPartnerTyping(true)
        if (typingTimer.current) clearTimeout(typingTimer.current)
        typingTimer.current = setTimeout(() => setPartnerTyping(false), 2500)
      }
    }).subscribe()
    typingChRef.current = ch
    return () => { supabase.removeChannel(ch); typingChRef.current = null; setPartnerTyping(false) }
  }, [activeId, user])

  function onType(v: string) {
    setText(v)
    const now = Date.now()
    if (user && typingChRef.current && now - lastSentTyping.current > 1200) {
      lastSentTyping.current = now
      typingChRef.current.send({ type: 'broadcast', event: 'typing', payload: { from: user.id } })
    }
  }

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages, partnerTyping])

  async function send(attachment?: { url: string; name: string; type: string }) {
    const body = text.trim()
    if ((!body && !attachment) || !activeId || !user) return
    setText('')
    const { data } = await supabase.from('messages').insert({
      conversation_id: activeId, sender_id: user.id, body: body || (attachment ? attachment.name : ''),
      attachment_url: attachment?.url ?? null, attachment_name: attachment?.name ?? null, attachment_type: attachment?.type ?? null,
    }).select().single()
    if (data) setMessages(prev => prev.some(m => m.id === (data as Message).id) ? prev : [...prev, data as Message])
    void loadConvos()
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !activeId) return
    const reset = () => { if (fileRef.current) fileRef.current.value = '' }

    // Client-side validation (UX + defense in depth). The BUCKET enforces the
    // same limits server-side (storage_hardening.sql) — that is the real gate.
    const MAX_BYTES = 10 * 1024 * 1024 // 10 MB
    const ALLOWED = [
      'image/png', 'image/jpeg', 'image/webp', 'image/gif',
      'application/pdf', 'text/plain', 'text/csv',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    ]
    if (file.size > MAX_BYTES) { alert('File too large: maximum 10 MB.'); reset(); return }
    if (!ALLOWED.includes(file.type)) {
      alert('Unsupported file type. Allowed: images, PDF, text, or Office documents.'); reset(); return
    }

    setUploading(true)
    // Sanitize the filename so it can't inject path separators into the storage key.
    const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-80)
    const path = `${activeId}/${crypto.randomUUID()}-${safeName}`
    const { error } = await supabase.storage
      .from('chat-attachments')
      .upload(path, file, { contentType: file.type, upsert: false })
    setUploading(false)
    reset()
    if (error) return
    await send({ url: path, name: safeName, type: file.type })
  }

  async function openAttachment(path: string) {
    const { data } = await supabase.storage.from('chat-attachments').createSignedUrl(path, 3600)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  const active = convos.find(c => c.id === activeId)
  const activePartner = active ? partners[partnerId(active) ?? ''] : undefined
  const myLastRead = [...messages].reverse().find(m => m.sender_id === user?.id)

  const content = (
    <div className={`flex flex-1 ${embedded ? 'h-[620px] rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] overflow-hidden' : 'h-screen'}`}>
      {/* Conversation list (mobile: hidden once a thread is open) */}
        <aside className={`w-full md:w-[320px] shrink-0 border-r flex-col ${active ? 'hidden md:flex' : 'flex'}`} style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="h-16 flex items-center pl-16 md:pl-5 pr-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
            <h1 className="text-[18px] font-bold" style={geist}>Messages</h1>
          </div>
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {loading ? (
              <p className="p-5 text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading…</p>
            ) : convos.length === 0 ? (
              <div className="p-6 text-center">
                <span className="material-symbols-outlined text-[34px]" style={{ color: 'var(--border-strong)' }}>forum</span>
                <p className="text-[14px] font-semibold mt-2" style={{ color: 'var(--text-primary)' }}>No conversations yet</p>
                <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>Connect from a matching intent in Signals or Intent to start chatting.</p>
              </div>
            ) : convos.map(c => {
              const p = partners[partnerId(c) ?? '']
              const on = c.id === activeId
              const n = on ? 0 : (unread[c.id] ?? 0)
              return (
                <button key={c.id} onClick={() => setActiveId(c.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: on ? 'var(--accent-subtle)' : 'transparent', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div className="w-11 h-11 rounded-full flex items-center justify-center text-[15px] font-bold shrink-0" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{initial(p)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {nameOf(p)}
                        {personOf(p) && personOf(p).toLowerCase() !== nameOf(p).toLowerCase() && (
                          <span className="font-normal text-[12px]" style={{ color: 'var(--text-muted)' }}> · {personOf(p)}</span>
                        )}
                      </span>
                      <span className="text-[11px] shrink-0" style={{ color: 'var(--text-muted)' }}>{timeAgo(c.last_message_at)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] truncate" style={{ color: n > 0 ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: n > 0 ? 600 : 400 }}>{c.last_message || 'Say hello 👋'}</p>
                      {n > 0 && <span className="text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{n}</span>}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </aside>

        {/* Thread */}
        <section className={`flex-1 flex-col min-w-0 ${active ? 'flex' : 'hidden md:flex'}`}>
          {!active ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-3">
              <span className="material-symbols-outlined text-[44px]" style={{ color: 'var(--border-strong)' }}>chat</span>
              <p className="text-[15px] font-semibold" style={{ color: 'var(--text-primary)' }}>Select a conversation</p>
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Your network chats appear here on any device you log in from.</p>
            </div>
          ) : (
            <>
              <div className="h-16 flex items-center justify-between px-5 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-2">
                  <button onClick={() => setActiveId(null)} className="md:hidden w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                    <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--text-primary)' }}>arrow_back</span>
                  </button>
                <button onClick={() => setShowProfile(true)} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-[14px] font-bold" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{initial(activePartner)}</div>
                  <div className="text-left">
                    <p className="text-[15px] font-bold leading-tight" style={geist}>{nameOf(activePartner)}</p>
                    <p className="text-[11px]" style={{ color: partnerTyping ? 'var(--success)' : 'var(--accent-interactive)' }}>
                      {partnerTyping ? 'typing…' : personOf(activePartner) ? `${personOf(activePartner)} · view dossier →` : 'View company dossier →'}
                    </p>
                  </div>
                </button>
                </div>
                <button onClick={() => setShowProfile(true)} className="ghost-btn h-9 px-4 rounded-lg text-[13px] font-semibold">Profile</button>
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar px-6 py-5 space-y-2.5" style={{ background: 'var(--bg-base)' }}>
                {messages.map(m => {
                  const mine = m.sender_id === user?.id
                  return (
                    <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                      <div className="max-w-[70%] px-4 py-2.5 rounded-2xl text-[14px]"
                        style={mine
                          ? { background: 'var(--accent)', color: 'var(--bg-elevated)', borderBottomRightRadius: 4 }
                          : { background: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)', borderBottomLeftRadius: 4 }}>
                        {m.attachment_url && (
                          <button onClick={() => openAttachment(m.attachment_url!)} className="flex items-center gap-2 mb-1 underline">
                            <span className="material-symbols-outlined text-[18px]">{m.attachment_type?.startsWith('image/') ? 'image' : 'attach_file'}</span>
                            <span className="truncate max-w-[200px]">{m.attachment_name}</span>
                          </button>
                        )}
                        {m.body && m.body !== m.attachment_name && <div>{m.body}</div>}
                        <div className="text-[10px] mt-1 flex items-center gap-1 justify-end" style={{ color: mine ? 'rgba(245,243,239,0.7)' : 'var(--text-muted)' }}>
                          {timeAgo(m.created_at)}
                          {mine && (m.read_at ? <span className="material-symbols-outlined text-[13px]" title="Seen">done_all</span> : <span className="material-symbols-outlined text-[13px]" title="Sent">done</span>)}
                        </div>
                      </div>
                    </div>
                  )
                })}
                {partnerTyping && (
                  <div className="flex justify-start">
                    <div className="px-4 py-3 rounded-2xl" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                      <span className="flex gap-1">
                        {[0, 1, 2].map(i => <span key={i} className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--text-muted)', animationDelay: `${i * 150}ms` }} />)}
                      </span>
                    </div>
                  </div>
                )}
                {!partnerTyping && myLastRead?.read_at && (
                  <p className="text-[10px] text-right pr-1" style={{ color: 'var(--text-muted)' }}>Seen</p>
                )}
                <div ref={endRef} />
              </div>

              <div className="p-4 border-t flex items-center gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
                <input ref={fileRef} type="file" className="hidden" onChange={onFile} />
                <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-10 h-10 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }} title="Attach">
                  <span className="material-symbols-outlined text-[20px]">{uploading ? 'hourglass_top' : 'attach_file'}</span>
                </button>
                <input value={text} onChange={e => onType(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send() }}
                  placeholder="Write a message…"
                  className="flex-1 h-11 px-4 rounded-full text-[14px] outline-none" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
                <button onClick={() => send()} disabled={!text.trim()} className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-40" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              </div>
            </>
          )}
        </section>
    </div>
  )

  if (embedded) return content

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="ml-0 md:ml-[240px] flex-1 min-h-screen flex">
        {content}
      </main>

      {showProfile && active && (
        <NetworkProfile userId={partnerId(active)!} onClose={() => setShowProfile(false)} />
      )}
    </div>
  )
}
