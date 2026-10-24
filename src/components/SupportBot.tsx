/**
 * SupportBot ("EBEXTA Assist") — a zero-cost in-app helper mounted app-wide.
 * Answers from a canned knowledge base (no AI calls); escalates to a support
 * ticket (→ admin console) whenever it can't help or the user asks for a human.
 * Self-gates: only renders for signed-in users on app pages (not public/admin).
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { KB, botReply, wantsHuman, createTicket, type BotEntry } from '../lib/supportBot'

type Msg = { from: 'bot' | 'user'; text: string; offerTicket?: boolean }

const GREETING = 'Hi! I’m EBEXTA Assist 👋 Ask me anything, or tap a topic below. If you need a person, I can pass it to the team.'

const PUBLIC = new Set(['/', '/home', '/login', '/signup', '/terms', '/privacy', '/refund', '/choose-plan', '/welcome'])

export function SupportBot() {
  const { user } = useAuth()
  const loc = useLocation()
  const [open, setOpen] = useState(false)
  const [msgs, setMsgs] = useState<Msg[]>([{ from: 'bot', text: GREETING }])
  const [input, setInput] = useState('')
  const [ticket, setTicket] = useState<{ subject: string; message: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => { scrollRef.current?.scrollTo({ top: 9e9, behavior: 'smooth' }) }, [msgs, ticket, open])

  // Gate: signed-in app pages only.
  const hidden = !user || PUBLIC.has(loc.pathname) || loc.pathname.startsWith('/onboarding') || loc.pathname.startsWith('/admin')
  if (hidden) return null

  function push(m: Msg) { setMsgs(x => [...x, m]) }

  function answerFor(text: string) {
    if (wantsHuman(text)) {
      push({ from: 'bot', text: 'Sure — I can pass this to the team. Add a couple of details and I’ll raise a ticket.', offerTicket: true })
      return
    }
    const hit = botReply(text)
    if (hit) push({ from: 'bot', text: hit.answer, offerTicket: true })
    else push({ from: 'bot', text: 'I’m not totally sure on that one. Want me to send it to the team as a ticket?', offerTicket: true })
  }

  function send(text: string) {
    const t = text.trim()
    if (!t) return
    push({ from: 'user', text: t })
    setInput('')
    setTimeout(() => answerFor(t), 220) // tiny delay feels conversational
  }

  function pickTopic(entry: BotEntry) {
    push({ from: 'user', text: entry.label })
    setTimeout(() => push({ from: 'bot', text: entry.answer, offerTicket: true }), 200)
  }

  function openTicket() {
    const lastUser = [...msgs].reverse().find(m => m.from === 'user')?.text ?? ''
    setTicket({ subject: '', message: lastUser })
  }

  async function submitTicket() {
    if (!ticket || !user || !ticket.message.trim()) return
    setBusy(true)
    const { error } = await createTicket({
      userId: user.id, email: user.email, subject: ticket.subject, message: ticket.message,
      transcript: msgs.map(m => ({ from: m.from, text: m.text })),
    })
    setBusy(false)
    setTicket(null)
    push({ from: 'bot', text: error
      ? (error.includes('support_tickets') || error.includes('relation') ? 'Couldn’t raise the ticket — support isn’t set up yet (run support_tickets.sql).' : 'Something went wrong raising the ticket. Please try again.')
      : '✅ Done — your ticket is with the team. They’ll follow up by email. Anything else?' })
  }

  const inputStyle = { background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const

  return createPortal(
    <div className="fixed z-[300] bottom-6 right-6 flex flex-col items-end" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
      {open && (
        <div className="mb-3 w-[min(360px,calc(100vw-32px))] rounded-2xl overflow-hidden flex flex-col animate-[toastIn_0.2s_ease]"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', boxShadow: 'var(--shadow-lg)', height: 'min(520px, 70vh)' }}>
          {/* header */}
          <div className="flex items-center justify-between px-4 py-3" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[20px]" style={{ fontVariationSettings: "'FILL' 1" }}>support_agent</span>
              <div>
                <p className="text-[13px] font-bold leading-none">EBEXTA Assist</p>
                <p className="text-[10px] opacity-80 mt-0.5">Instant answers · human backup</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: 'rgba(255,255,255,0.2)' }}>
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>

          {/* messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2.5">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.from === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className="max-w-[85%] px-3 py-2 rounded-2xl text-[12.5px] leading-snug break-words"
                  style={m.from === 'user'
                    ? { background: 'var(--accent)', color: 'var(--bg-elevated)', borderBottomRightRadius: 4 }
                    : { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)', borderBottomLeftRadius: 4 }}>
                  {m.text}
                  {m.offerTicket && m.from === 'bot' && (
                    <button onClick={openTicket} className="block mt-2 text-[11.5px] font-bold" style={{ color: 'var(--accent-interactive)' }}>
                      → Talk to the team
                    </button>
                  )}
                </div>
              </div>
            ))}

            {/* quick topics after the greeting */}
            {msgs.length === 1 && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {KB.map(e => (
                  <button key={e.id} onClick={() => pickTopic(e)}
                    className="px-2.5 py-1.5 rounded-xl text-[11.5px] font-semibold"
                    style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                    {e.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ticket form OR input */}
          {ticket ? (
            <div className="p-3 space-y-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <p className="text-[11px] font-bold uppercase tracking-[0.06em]" style={{ color: 'var(--text-muted)' }}>Raise a ticket</p>
              <input value={ticket.subject} onChange={e => setTicket(t => t && { ...t, subject: e.target.value })} placeholder="Subject (optional)"
                className="w-full px-3 py-2 rounded-xl text-[12.5px] outline-none" style={inputStyle} />
              <textarea value={ticket.message} onChange={e => setTicket(t => t && { ...t, message: e.target.value })} rows={3} placeholder="Describe what you need…"
                className="w-full px-3 py-2 rounded-xl text-[12.5px] outline-none resize-none" style={inputStyle} />
              <div className="flex justify-end gap-2">
                <button onClick={() => setTicket(null)} className="px-3 py-1.5 rounded-xl text-[12px] font-semibold" style={{ color: 'var(--text-muted)' }}>Cancel</button>
                <button onClick={submitTicket} disabled={busy || !ticket.message.trim()}
                  className="px-4 py-1.5 rounded-xl text-[12px] font-bold flex items-center gap-1.5" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)', opacity: busy || !ticket.message.trim() ? 0.6 : 1 }}>
                  <span className="material-symbols-outlined text-[15px]">send</span>{busy ? 'Sending…' : 'Send'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-3 flex items-center gap-2" style={{ borderTop: '1px solid var(--border-subtle)' }}>
              <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') send(input) }}
                placeholder="Type your question…" className="flex-1 min-w-0 px-3 py-2 rounded-xl text-[12.5px] outline-none" style={inputStyle} />
              <button onClick={() => send(input)} className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </div>
          )}
        </div>
      )}

      <button onClick={() => setOpen(o => !o)} aria-label="EBEXTA Assist"
        className="w-14 h-14 rounded-full flex items-center justify-center transition-transform hover:scale-105"
        style={{ background: 'var(--accent)', color: 'var(--bg-elevated)', boxShadow: 'var(--shadow-lg)' }}>
        <span className="material-symbols-outlined text-[26px]" style={{ fontVariationSettings: "'FILL' 1" }}>{open ? 'close' : 'support_agent'}</span>
      </button>
    </div>,
    document.body,
  )
}
