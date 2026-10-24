/**
 * Outreach message generation — one place that builds a channel-appropriate
 * message (WhatsApp / LinkedIn / Email) from a lead, a chosen tone, and the
 * user's own keywords. Routes through the secure AI proxy (callGemini).
 */
import { callGemini } from './gemini'
import { safeParseJSON } from './safeJson'

export const OUTREACH_TONES = [
  'Warm & friendly',
  'Direct & concise',
  'Formal & professional',
  'Consultative',
  'Bold & confident',
] as const
export type OutreachTone = typeof OUTREACH_TONES[number]
export type OutreachChannel = 'whatsapp' | 'linkedin' | 'email'

interface LeadLike {
  company_name?: string; industry?: string; location?: string
  match_reason?: string[]; requirement_theme?: string; intent_flags?: string[]
}

export interface OutreachInput {
  channel: OutreachChannel
  tone: string
  keywords?: string
  senderCompany?: string
  senderName?: string
  contactName?: string
}

export interface OutreachResult { subject: string; body: string }

export interface LinkedInDrafts {
  connectionNote: string // strictly <= 300 chars
  directMessage: string
  followUp: string
  contextRationale: string
}

const CHANNEL_RULE: Record<OutreachChannel, string> = {
  whatsapp:
    'Write a SHORT WhatsApp message: 2–4 sentences, warm and human, first-name friendly, ' +
    'NO subject line, NO email signature, NO "Dear". Open with a specific hook about THEIR ' +
    'company, then a soft ask for a quick chat. At most one emoji, only if the tone is friendly.',
  linkedin:
    'Write a SHORT LinkedIn connection request note: STRICT LIMIT: under 300 characters total. ' +
    'Professional, personalized reason to connect, no subject, no signature.',
  email:
    'Write a concise cold outreach EMAIL: a compelling subject line and a short body ' +
    '(max 3 short paragraphs) ending in a clear, soft call to action. No fluff.',
}

export function buildFallbackLinkedInDrafts(
  lead: LeadLike,
  opts: Omit<OutreachInput, 'channel'>
): LinkedInDrafts {
  const firstName = (opts.contactName || 'there').trim().split(/\s+/)[0]
  const company = lead.company_name || 'your team'
  const sector = lead.industry || 'B2B'
  const hook = (lead.match_reason?.[0] || lead.requirement_theme || 'scaling operations').slice(0, 90)
  const senderCompany = opts.senderCompany ? `at ${opts.senderCompany}` : ''

  // Connection Note: Hard <= 300 characters
  let note = `Hi ${firstName}, saw ${company}'s focus on ${hook}. We help ${sector} leaders ${senderCompany} accelerate pipeline. Would love to connect and share notes!`
  if (note.length > 300) {
    note = `Hi ${firstName}, impressed by ${company}'s work in ${sector}. We help teams with ${lead.requirement_theme || 'similar growth'}. Would love to connect!`
  }
  if (note.length > 300) {
    note = note.slice(0, 297).replace(/\s+\S*$/, '') + '...'
  }

  const directMessage = `Hi ${firstName},\n\nHope your week is going well. I've been following ${company}'s progress in ${sector}, especially around ${hook}.\n\nWe work with teams at a similar stage to streamline B2B growth and buyer intent discovery. Would you be open to a brief 10-minute exchange next week?\n\nBest,\n${opts.senderName || 'EBEXTA team'}`

  const followUp = `Hi ${firstName}, following up on my note from last week. I know your calendar is packed at ${company} — happy to send over a concise 2-page brief on how peer companies in ${sector} approach this. No pressure at all!`

  const contextRationale = `Rooted in ${company}'s ${sector} footprint and ${lead.requirement_theme || 'active expansion signals'}.`

  return { connectionNote: note, directMessage, followUp, contextRationale }
}

export async function generateLinkedInDrafts(
  lead: LeadLike,
  opts: Omit<OutreachInput, 'channel'>
): Promise<LinkedInDrafts> {
  const reasons = (lead.match_reason ?? []).filter(Boolean).join('; ') || lead.requirement_theme || ''
  const signals = (lead.intent_flags ?? []).join(', ')

  const prompt = `You are ${opts.senderName || 'a growth partner'} from ${opts.senderCompany || 'our team'}, writing LinkedIn outreach to ${opts.contactName || 'the decision maker'} at ${lead.company_name ?? 'the target company'} (${lead.industry ?? ''}${lead.location ? ', ' + lead.location : ''}).
Why matched: ${reasons || 'strong market opportunity'}.
Intent signals: ${signals || 'active growth'}.
Desired tone: ${opts.tone}.
${opts.keywords ? `Key talking points: ${opts.keywords}.` : ''}

Generate 3 LinkedIn outreach drafts and a 1-sentence contextual rationale:
1. "connectionNote": A personalized connection request invitation note. ABSOLUTE HARD REQUIREMENT: Total characters MUST NOT exceed 295 characters (including all spaces, greeting, and punctuation). LinkedIn enforces a 300 char maximum.
2. "directMessage": A concise InMail or 1st-degree direct message (1-2 short paragraphs with a soft CTA).
3. "followUp": A polite follow-up message 4-5 days later if no initial reply.
4. "contextRationale": 1 clear sentence explaining why this outreach hook resonates with their situation.

Return ONLY strict JSON with keys: "connectionNote", "directMessage", "followUp", "contextRationale". No markdown, no backticks.`

  try {
    const text = await callGemini(prompt, { action: 'email' })
    const parsed = safeParseJSON<LinkedInDrafts>(text)
    if (parsed && parsed.connectionNote && parsed.directMessage) {
      let conn = parsed.connectionNote.trim()
      if (conn.length > 300) {
        conn = conn.slice(0, 297).replace(/\s+\S*$/, '') + '...'
      }
      return {
        connectionNote: conn,
        directMessage: parsed.directMessage.trim(),
        followUp: parsed.followUp?.trim() || `Hi ${opts.contactName ? opts.contactName.split(' ')[0] : 'there'}, quick follow-up to see if exploring this makes sense for ${lead.company_name ?? 'your team'}.`,
        contextRationale: parsed.contextRationale?.trim() || `Rooted in ${lead.company_name}'s signals in ${lead.industry || 'the sector'}.`,
      }
    }
  } catch (err) {
    console.warn('[EBEXTA] LinkedIn drafts generation fallback:', err)
  }

  return buildFallbackLinkedInDrafts(lead, opts)
}

export async function generateOutreachMessage(lead: LeadLike, opts: OutreachInput): Promise<OutreachResult> {
  if (opts.channel === 'linkedin') {
    const drafts = await generateLinkedInDrafts(lead, opts)
    return { subject: '', body: drafts.connectionNote }
  }

  const reasons = (lead.match_reason ?? []).filter(Boolean).join('; ') || lead.requirement_theme || ''
  const signals = (lead.intent_flags ?? []).join(', ')

  const prompt = `You are ${opts.senderName || 'a founder'} from ${opts.senderCompany || 'our company'}, writing outreach to ${opts.contactName || 'the decision maker'} at ${lead.company_name ?? 'the company'} (${lead.industry ?? ''}${lead.location ? ', ' + lead.location : ''}).
Why they're a great fit: ${reasons || 'strong strategic match'}.
Buying signals detected: ${signals || 'active growth'}.
Desired tone: ${opts.tone}.
${opts.keywords ? `You MUST naturally weave in these points / keywords: ${opts.keywords}.` : ''}
${CHANNEL_RULE[opts.channel]}
Be specific to THEIR company — never generic. Do not invent facts about them.
Return ONLY strict JSON: {"subject": "<subject or empty string>", "body": "<the message>"}. No markdown, no backticks.`

  const text = await callGemini(prompt, { action: 'email' })

  // If the JSON is unrecoverable, the prose the model wrote is still a usable
  // draft — better than an error where a message should be.
  const fallbackBody = text.replace(/^```(?:json)?\s*/m, '').replace(/\s*```\s*$/m, '').trim()
  const obj = safeParseJSON<{ subject?: string; body?: string }>(text)
  if (obj) {
    return { subject: String(obj.subject ?? ''), body: String(obj.body ?? fallbackBody) }
  }
  return { subject: '', body: fallbackBody }
}

/** WhatsApp deep link — needs digits only, with the message pre-filled. */
export function whatsappLink(phone: string, text: string): string {
  const digits = (phone || '').replace(/[^\d]/g, '')
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}
