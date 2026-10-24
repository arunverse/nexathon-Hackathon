/**
 * OutreachComposer — pick a tone, add your own keywords, generate a message,
 * then send it on the chosen channel:
 *   • WhatsApp — opens WhatsApp to the verified number with the text pre-filled.
 *   • LinkedIn — copies the message and opens the profile (LinkedIn can't pre-fill).
 *   • Email    — hands the generated subject/body back via onUseEmail.
 */
import { useState } from 'react'
import { createPortal } from 'react-dom'
import {
  generateOutreachMessage,
  generateLinkedInDrafts,
  whatsappLink,
  OUTREACH_TONES,
  type OutreachChannel,
  type LinkedInDrafts,
} from '../lib/outreach'
import { logInteractionForCompany } from '../lib/companyMemory'
import { checkCredits, consumeCredit } from '../lib/credits'
import { linkedInPersonSearch, openExternal, resolveSafeUrl, isLikelyFakeLinkedIn } from '../lib/urlUtils'

interface LeadLike {
  company_name?: string; industry?: string; location?: string
  match_reason?: string[]; requirement_theme?: string; intent_flags?: string[]
}

export function OutreachComposer({
  lead, channel, phone, linkedinUrl, contactName, onClose, onUseEmail,
}: {
  lead: LeadLike
  channel: OutreachChannel
  phone?: string | null
  linkedinUrl?: string | null
  contactName?: string | null
  onClose: () => void
  onUseEmail?: (subject: string, body: string) => void
}) {
  const [tone, setTone] = useState<string>(OUTREACH_TONES[0])
  const [keywords, setKeywords] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ subject: string; body: string } | null>(null)
  const [linkedinDrafts, setLinkedinDrafts] = useState<LinkedInDrafts | null>(null)
  const [activeTab, setActiveTab] = useState<'connectionNote' | 'directMessage' | 'followUp'>('connectionNote')
  const [copied, setCopied] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const senderCompany = (() => {
    try { return (JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}').companyName as string) || '' } catch { return '' }
  })()

  const channelLabel = channel === 'whatsapp' ? 'WhatsApp' : channel === 'linkedin' ? 'LinkedIn' : 'Email'
  const channelIcon = channel === 'whatsapp' ? 'chat' : channel === 'linkedin' ? 'manage_search' : 'mail'

  async function generate() {
    const gate = await checkCredits('ai_generation')
    if (!gate.allowed) {
      setErr(gate.reason || 'Credit limit reached.')
      return
    }

    setBusy(true); setErr(null); setCopied(false)
    try {
      if (channel === 'linkedin') {
        const drafts = await generateLinkedInDrafts(lead, {
          tone,
          keywords: keywords.trim(),
          senderCompany,
          contactName: contactName ?? undefined,
        })
        setLinkedinDrafts(drafts)
        setMsg({ subject: '', body: drafts[activeTab] })
      } else {
        const r = await generateOutreachMessage(lead, {
          channel,
          tone,
          keywords: keywords.trim(),
          senderCompany,
          contactName: contactName ?? undefined,
        })
        setMsg(r)
      }
      await consumeCredit('ai_generation', { channel, company_name: lead.company_name })
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not generate the message. Please try again.')
    } finally { setBusy(false) }
  }

  function handleTabChange(tab: 'connectionNote' | 'directMessage' | 'followUp') {
    setActiveTab(tab)
    if (linkedinDrafts) {
      setMsg({ subject: '', body: linkedinDrafts[tab] })
      setCopied(false)
    }
  }

  /** Record the touch in Company Memory. Only fires on SEND, never on generate —
   *  a drafted-but-unsent message isn't an interaction. */
  function recordInteraction() {
    const company = lead.company_name
    if (!msg || !company) return
    const type = channel === 'email' ? 'email_sent' : channel === 'whatsapp' ? 'call' : 'note'
    const noteType = channel === 'linkedin'
      ? `LinkedIn ${activeTab === 'connectionNote' ? 'Connection Request' : activeTab === 'directMessage' ? 'Direct Message' : 'Follow-up'}`
      : `${channelLabel}: ${msg.subject || 'message sent'}`

    void logInteractionForCompany({ company_name: company }, {
      interactionType: type,
      subject: noteType,
      bodyPreview: msg.body,
      contactName: contactName ?? null,
    })
  }

  function send() {
    if (!msg) return
    recordInteraction()
    if (channel === 'whatsapp' && phone) {
      window.open(whatsappLink(phone, msg.body), '_blank', 'noopener,noreferrer')
      onClose()
    } else if (channel === 'linkedin') {
      try { void navigator.clipboard?.writeText(msg.body) } catch { /* ignore */ }
      setCopied(true)

      // When reaching out to a specified person, prioritize linkedInPersonSearch so the user
      // always lands on the real, verified search results for that person on LinkedIn instead of a 404.
      const personSearch = contactName?.trim()
        ? linkedInPersonSearch(contactName.trim(), lead.company_name ?? '', '')
        : null

      const fallbackQuery = [contactName, lead.company_name].filter(Boolean).join(' ')
      let targetUrl: string | null = null

      if (linkedinUrl && !isLikelyFakeLinkedIn(linkedinUrl) && linkedinUrl.includes('linkedin.com/search/')) {
        targetUrl = resolveSafeUrl(linkedinUrl, fallbackQuery)
      } else if (personSearch) {
        targetUrl = personSearch
      } else if (linkedinUrl) {
        targetUrl = resolveSafeUrl(linkedinUrl, fallbackQuery)
      } else {
        targetUrl = linkedInPersonSearch(contactName ?? '', lead.company_name ?? '', '')
      }

      if (targetUrl) {
        openExternal(targetUrl)
      }
    } else if (channel === 'email') {
      onUseEmail?.(msg.subject, msg.body); onClose()
    }
  }

  const inputStyle = { background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const
  const currentBodyLen = msg?.body?.length ?? 0
  const isOverCharLimit = channel === 'linkedin' && activeTab === 'connectionNote' && currentBodyLen > 300

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[540px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 custom-scrollbar"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>

        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>{channelIcon}</span>
            <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              {channelLabel} outreach — {lead.company_name}
            </h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--border-subtle)' }}>
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
          </button>
        </div>
        <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>
          Tailored intelligence outreach for {contactName ? <strong>{contactName}</strong> : 'decision-maker'} at {lead.company_name}.
        </p>

        {/* Tone */}
        <label className="block text-[11px] font-bold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>Tone</label>
        <div className="flex flex-wrap gap-1.5 mb-4">
          {OUTREACH_TONES.map(t => {
            const on = tone === t
            return (
              <button key={t} onClick={() => setTone(t)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-semibold transition-all"
                style={on
                  ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent-interactive)' }
                  : { background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                {t}
              </button>
            )
          })}
        </div>

        {/* Keywords */}
        <label className="block text-[11px] font-bold uppercase tracking-[0.06em] mb-2" style={{ color: 'var(--text-muted)' }}>
          Specific talking points or offer highlights (optional)
        </label>
        <textarea value={keywords} onChange={e => setKeywords(e.target.value)} rows={2}
          placeholder="e.g. mention rapid deployment, reference recent funding round, offer 14-day evaluation"
          className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none mb-4" style={inputStyle} />

        {err && <p className="text-[12px] font-medium mb-3" style={{ color: 'var(--critical)' }}>{err}</p>}

        {/* LinkedIn Multi-Draft Tab Selectors */}
        {channel === 'linkedin' && linkedinDrafts && (
          <div className="mb-3 space-y-2">
            <div className="flex rounded-xl p-1 gap-1" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
              <button
                type="button"
                onClick={() => handleTabChange('connectionNote')}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all text-center"
                style={activeTab === 'connectionNote'
                  ? { background: 'var(--bg-elevated)', color: 'var(--accent-interactive)', boxShadow: 'var(--shadow-sm)' }
                  : { color: 'var(--text-muted)' }}
              >
                Connection Note (≤300 chars)
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('directMessage')}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all text-center"
                style={activeTab === 'directMessage'
                  ? { background: 'var(--bg-elevated)', color: 'var(--accent-interactive)', boxShadow: 'var(--shadow-sm)' }
                  : { color: 'var(--text-muted)' }}
              >
                InMail / Direct Message
              </button>
              <button
                type="button"
                onClick={() => handleTabChange('followUp')}
                className="flex-1 py-1.5 px-2 rounded-lg text-[11px] font-semibold transition-all text-center"
                style={activeTab === 'followUp'
                  ? { background: 'var(--bg-elevated)', color: 'var(--accent-interactive)', boxShadow: 'var(--shadow-sm)' }
                  : { color: 'var(--text-muted)' }}
              >
                Follow-Up Touch
              </button>
            </div>

            {linkedinDrafts.contextRationale && (
              <div className="p-2.5 rounded-xl text-[11.5px] flex items-start gap-2"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <span className="material-symbols-outlined text-[15px] shrink-0" style={{ color: 'var(--accent-interactive)' }}>lightbulb</span>
                <span><strong>Outreach Hook:</strong> {linkedinDrafts.contextRationale}</span>
              </div>
            )}
          </div>
        )}

        {/* Generated message text area */}
        {msg && (
          <div className="mb-4">
            {msg.subject && channel === 'email' && (
              <input value={msg.subject} onChange={e => setMsg(m => m ? { ...m, subject: e.target.value } : m)}
                className="w-full px-3 py-2 rounded-xl text-[13px] font-semibold outline-none mb-2" style={inputStyle} />
            )}
            <textarea value={msg.body} onChange={e => setMsg(m => m ? { ...m, body: e.target.value } : m)} rows={channel === 'linkedin' && activeTab === 'connectionNote' ? 4 : 6}
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none" style={inputStyle} />

            <div className="flex items-center justify-between mt-1.5 text-[11px]">
              {channel === 'linkedin' && (
                <span style={{ color: copied ? 'var(--success)' : 'var(--text-muted)' }}>
                  {copied ? '✓ Copied to clipboard — paste into LinkedIn.' : 'Copies text and opens LinkedIn profile to paste.'}
                </span>
              )}
              {channel === 'linkedin' && activeTab === 'connectionNote' && (
                <span className={`font-mono font-semibold ml-auto ${isOverCharLimit ? 'text-red-500 font-bold' : 'text-[var(--text-muted)]'}`}>
                  {currentBodyLen} / 300 chars {isOverCharLimit ? '(exceeds limit)' : '✓'}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <button onClick={generate} disabled={busy}
            className="px-4 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 cursor-pointer"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-strong)', color: 'var(--text-primary)' }}>
            <span className="material-symbols-outlined text-[16px]">{busy ? 'hourglass_empty' : 'auto_awesome'}</span>
            {busy ? 'Writing…' : msg ? 'Regenerate' : 'Generate drafts'}
          </button>
          {msg && (
            <button onClick={send}
              className="px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2 cursor-pointer"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
              <span className="material-symbols-outlined text-[16px]">{channelIcon}</span>
              {channel === 'whatsapp' ? 'Open WhatsApp' : channel === 'linkedin' ? 'Copy & open LinkedIn' : 'Use in editor'}
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
