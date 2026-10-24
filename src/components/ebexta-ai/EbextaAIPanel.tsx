/**
 * EBEXTA AI Panel
 * The native in-app intelligence layer of EBEXTA.
 * Seamlessly docked floating assistant with context awareness,
 * structured cards, and Level 0-4 deterministic routing.
 */

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { resolveCurrentContext } from '../../lib/ebexta-ai/contextEngine'
import { processUserMessage } from '../../lib/ebexta-ai/aiOrchestrator'
import { StructuredCardRenderer } from './StructuredCardRenderer'
import { EbextaLogo } from '../common/EbextaLogo'
import type { AIMessage, ActionPrompt, ConversationContext } from '../../lib/ebexta-ai/types'

const PUBLIC_ROUTES = new Set([
  '/', '/home', '/login', '/signup', '/terms', '/privacy', '/refund', '/dpdp', '/choose-plan', '/welcome',
])

export const EbextaAIPanel: React.FC = () => {
  const { user } = useAuth()
  const loc = useLocation()

  const [isOpen, setIsOpen] = useState(false)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusText, setStatusText] = useState('')
  const [context, setContext] = useState<ConversationContext | null>(null)
  const [conversationId] = useState(() => `conv_${Date.now()}`)
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [suggestedPrompts, setSuggestedPrompts] = useState<ActionPrompt[]>([])

  const scrollRef = useRef<HTMLDivElement>(null)

  // 1. Resolve live context whenever route changes
  useEffect(() => {
    void resolveCurrentContext(loc.pathname).then(ctx => {
      setContext(ctx)
      updateContextPrompts(ctx)
    })
  }, [loc.pathname])

  // 2. Auto-scroll on new message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, loading, isOpen])

  function updateContextPrompts(ctx: ConversationContext) {
    if (ctx.entityType === 'lead') {
      setSuggestedPrompts([
        { id: 'sp1', label: `Why is ${ctx.entityName || 'this lead'} scored?`, intent: 'SCORE_EXPLANATION' },
        { id: 'sp2', label: 'What signals are we seeing?', intent: 'ANALYZE_SIGNALS' },
        { id: 'sp3', label: 'Prepare tailored outreach', intent: 'GENERATE_OUTREACH' },
      ])
    } else if (ctx.pathname === '/dashboard/roi') {
      setSuggestedPrompts([
        { id: 'sp1', label: 'Why did pipeline drop?', intent: 'ANOMALY_DETECTION' },
        { id: 'sp2', label: 'Show stalled opportunities', intent: 'PIPELINE_ANALYSIS' },
        { id: 'sp3', label: 'Calculate funnel conversion', intent: 'CONVERSION_ANALYSIS' },
      ])
    } else {
      setSuggestedPrompts([
        { id: 'sp1', label: 'Find SaaS companies in Bangalore', intent: 'DISCOVER_COMPANIES' },
        { id: 'sp2', label: 'Show pipeline health', intent: 'PIPELINE_ANALYSIS' },
        { id: 'sp3', label: 'Talk to an EBEXTA expert', intent: 'TALK_TO_EXPERT' },
      ])
    }
  }

  // Hide on public and admin pages
  const isHidden = !user || PUBLIC_ROUTES.has(loc.pathname) || loc.pathname.startsWith('/onboarding')
  if (isHidden) return null

  async function handleSend(textToSend?: string) {
    const q = (textToSend ?? input).trim()
    if (!q || loading || !user) return

    setInput('')
    const userMsg: AIMessage = {
      id: `msg_u_${Date.now()}`,
      conversationId,
      sender: 'user',
      content: q,
      createdAt: new Date().toISOString(),
    }

    setMessages(prev => [...prev, userMsg])
    setLoading(true)
    setStatusText('Routing request...')

    try {
      const activeCtx = context ?? await resolveCurrentContext(loc.pathname)
      const res = await processUserMessage(q, activeCtx, { id: user.id, email: user.email }, conversationId, messages)
      setMessages(prev => [...prev, res.message])
      if (res.suggestedPrompts.length > 0) {
        setSuggestedPrompts(res.suggestedPrompts)
      }
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `msg_err_${Date.now()}`,
          conversationId,
          sender: 'assistant',
          content: "EBEXTA AI couldn't complete that request right now.",
          confidence: 'LOW',
          card: {
            type: 'TEXT',
            title: 'Request Failed',
            subtitle: 'Please try again or connect with our human engineering desk.',
            recommendedAction: {
              id: 'act_expert',
              label: 'Talk to an EBEXTA Expert',
              intent: 'TALK_TO_EXPERT',
            },
          },
          createdAt: new Date().toISOString(),
        },
      ])
    } finally {
      setLoading(false)
      setStatusText('')
    }
  }

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[300] flex flex-col items-end" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
      {isOpen && (
        <div
          className="mb-3 flex flex-col overflow-hidden rounded-2xl border border-[var(--border-strong)] bg-[var(--bg-elevated)] shadow-2xl transition-all duration-200"
          style={{
            width: 'min(420px, calc(100vw - 32px))',
            height: 'min(580px, 78vh)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-base)] px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--bg-elevated)] shadow-sm p-1.5">
                <EbextaLogo variant="mark" size={18} priority alt="EBEXTA" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <p className="text-[13px] font-bold text-[var(--text-primary)]">EBEXTA AI</p>
                  <span className="rounded-full bg-[var(--accent-subtle)] px-1.5 py-0.2 text-[9px] font-bold text-[var(--accent-interactive)]">
                    NATIVE
                  </span>
                </div>
                <p className="text-[10.5px] text-[var(--text-muted)] truncate max-w-[200px]">
                  {context?.entityName ? `Focused on ${context.entityName}` : context?.pageName}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setMessages([])}
                title="Clear Chat"
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">restart_alt</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-[var(--text-muted)] hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Context pill bar */}
          <div className="flex items-center justify-between border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] px-3 py-1.5 text-[10.5px]">
            <span className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--success)] animate-pulse" />
              {context?.pageName ?? 'Revenue Platform'}
            </span>
            <span className="text-[var(--text-muted)] font-mono">Zero-LLM First</span>
          </div>

          {/* Messages list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3.5 space-y-3 custom-scrollbar">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-subtle)] text-[var(--accent-interactive)]">
                  <span className="material-symbols-outlined text-[26px]">radar</span>
                </div>
                <h4 className="mt-3 text-[13.5px] font-bold text-[var(--text-primary)]">
                  EBEXTA Intelligence Layer
                </h4>
                <p className="mt-1 text-[11.5px] text-[var(--text-muted)] max-w-[280px] mx-auto leading-relaxed">
                  Ask about verified companies, intent signals, lead scores, outreach, or funnel bottlenecks.
                </p>
              </div>
            )}

            {messages.map(m => (
              <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div
                  className="max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[12px] leading-relaxed shadow-sm break-words"
                  style={
                    m.sender === 'user'
                      ? {
                          background: 'var(--accent)',
                          color: 'var(--bg-elevated)',
                          borderBottomRightRadius: 4,
                        }
                      : {
                          background: 'var(--bg-surface)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-primary)',
                          borderBottomLeftRadius: 4,
                        }
                  }
                >
                  <p className="whitespace-pre-wrap">{m.content}</p>
                  {m.card && (
                    <StructuredCardRenderer
                      card={m.card}
                      onActionClick={actionId => {
                        if (actionId === 'action_prepare_outreach' || actionId === 'action_draft_email') {
                          void handleSend('Prepare outreach for these accounts')
                        } else if (actionId === 'act_expert') {
                          void handleSend('Talk to an expert')
                        } else {
                          void handleSend('Tell me more')
                        }
                      }}
                    />
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-center gap-2 text-[11.5px] text-[var(--text-muted)] py-1">
                <div className="h-2 w-2 rounded-full bg-[var(--accent-interactive)] animate-ping" />
                <span>{statusText || 'Analyzing verified data...'}</span>
              </div>
            )}
          </div>

          {/* Quick Prompts */}
          {suggestedPrompts.length > 0 && !loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-[var(--border-subtle)] bg-[var(--bg-base)] p-2">
              {suggestedPrompts.slice(0, 3).map(p => (
                <button
                  key={p.id}
                  onClick={() => void handleSend(p.label)}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] px-2.5 py-1 text-[11px] font-medium text-[var(--text-secondary)] hover:border-[var(--accent-interactive)] hover:text-[var(--accent-interactive)] transition-all"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}

          {/* Input Area */}
          <div className="flex items-center gap-2 border-t border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-3">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  void handleSend()
                }
              }}
              placeholder={context?.entityName ? `Ask about ${context.entityName}...` : 'Ask EBEXTA AI...'}
              className="flex-1 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-base)] px-3 py-2 text-[12px] text-[var(--text-primary)] outline-none focus:border-[var(--accent-interactive)] transition-colors"
            />
            <button
              onClick={() => void handleSend()}
              disabled={loading || !input.trim()}
              className="flex h-8 w-8 items-center justify-center rounded-xl bg-[var(--accent)] text-[var(--bg-elevated)] transition-opacity disabled:opacity-40"
            >
              <span className="material-symbols-outlined text-[17px]">send</span>
            </button>
          </div>
        </div>
      )}

      {/* Floating Entry Button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        aria-label="EBEXTA Intelligence"
        className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-[var(--accent)] text-[var(--bg-elevated)] shadow-lg transition-transform hover:scale-105"
        style={{ boxShadow: 'var(--shadow-lg)' }}
      >
        {isOpen ? (
          <span className="material-symbols-outlined text-[24px]">close</span>
        ) : (
          <div className="flex items-center justify-center w-full h-full p-3.5">
            <EbextaLogo variant="mark" size={28} priority alt="EBEXTA" className="transition-transform group-hover:scale-110" />
          </div>
        )}
      </button>
    </div>,
    document.body,
  )
}
