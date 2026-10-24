import { supabase } from './supabase'
import { callGemini } from './gemini'
import { logInteractionForCompany } from './companyMemory'
import type { ScannedLead } from './scanEngine'
import { safeParseJSON } from './safeJson'

/** Optional strategy angle carried over from Company Memory → "Use in outreach". */
export interface StrategyHint {
  opening_line?: string
  pitch_first?: string
  why_now?: string
}

export interface GeneratedEmail {
  subject: string
  p1: string
  p2: string
  p3: string
  p4: string
  messagingNote: string
  winningAngle: string
}

export async function generateEmail(
  lead: ScannedLead,
  userProfile: { id?: string; company_name?: string; mission?: string; sender_email?: string },
  strategy?: StrategyHint | null,
): Promise<GeneratedEmail> {
  const primaryStakeholder = (lead.stakeholders ?? [])[0]
  const senderCompany = (userProfile.company_name || '').trim() || 'our company'
  const senderMission = (userProfile.mission || '').trim() || 'B2B services'

  // When the user clicked "Use in outreach" on the Company Memory deal strategy,
  // that angle steers this email instead of being re-derived from scratch.
  const strategyBlock = strategy && (strategy.opening_line || strategy.pitch_first || strategy.why_now)
    ? `
STRATEGY TO FOLLOW (from this company's deal strategy — honour it):
${strategy.opening_line ? `- Open with this angle: "${strategy.opening_line}"` : ''}
${strategy.pitch_first ? `- Lead with: ${strategy.pitch_first}` : ''}
${strategy.why_now ? `- Why now: ${strategy.why_now}` : ''}
`
    : ''

  const prompt = `You are Alex Chen, a world-class B2B sales strategist who has closed $50M+ in enterprise deals. You write emails that get 25%+ reply rates because they are specific, human, and never sound like AI wrote them.

Write a cold outreach email from ${senderCompany} to ${lead.company_name}.

WHAT YOU KNOW ABOUT THEM:
- Recent activity: ${lead.recent_signals?.[0] ?? lead.intent_flags?.[0] ?? 'growing company'}
- Stage: ${lead.funding_stage}
- Location: ${lead.location}
- Industry: ${lead.industry}
- Size: ${lead.employee_count} employees
- Primary contact: ${primaryStakeholder?.name ?? 'Decision Maker'}, ${primaryStakeholder?.title ?? 'Executive'}
- All signals: ${(lead.recent_signals ?? []).join('; ')}

WHAT WE OFFER:
${senderMission}
${strategyBlock}
STRICT RULES:
1. Paragraph 1 (2 sentences max): Open with ONE specific observation about their recent activity. Never start with "I" or "We". Never say "I came across your company". Reference something real and specific from their signals.
2. Paragraph 2 (3 sentences max): Identify ONE specific pain point companies at their exact stage (${lead.funding_stage}) face. Be precise. No generic "challenges in today's market" fluff.
3. Paragraph 3 (2 sentences max): One specific way we solve exactly that pain. Include a real number or outcome if possible.
4. Paragraph 4 (1-2 sentences): Soft CTA. Specific ask. Specific timeframe. Never say "synergy", "leverage", "circle back", "touch base", "reach out", or "hope this finds you well".

Subject line: Specific, under 8 words, no clickbait, no questions, no emojis.
messagingNote: One specific sentence about how this person (${primaryStakeholder?.title ?? 'executive'}) at a ${lead.funding_stage} company prefers to be communicated with.

Return ONLY valid JSON — no markdown, no backticks:
{
  "subject": "...",
  "p1": "...",
  "p2": "...",
  "p3": "...",
  "p4": "...",
  "messagingNote": "...",
  "winningAngle": "one sentence: the strongest reason to reach out to this specific company right now"
}`

  // Speed: use the fast lite model first (it handles this prompt well); the
  // retry path in callGemini still escalates to flash if lite is overloaded.
  // api_usage is logged server-side by the proxy (avoids double count).
  const text = await callGemini(prompt, { preferFlash: false, action: 'email' })

  const parsed = safeParseJSON<GeneratedEmail>(text)
  if (!parsed) {
    throw new Error('EBEXTA returned invalid data for email generation')
  }

  // Save to outreach table (non-blocking)
  if (userProfile.id && lead.id) {
    supabase.from('outreach').insert({
      lead_id: lead.id,
      user_id: userProfile.id,
      email_subject: parsed.subject,
      email_body: [parsed.p1, parsed.p2, parsed.p3, parsed.p4].join('\n\n'),
      strategy: { messagingNote: parsed.messagingNote, winningAngle: parsed.winningAngle },
    }).then(() => { /* fire-and-forget */ })
  }

  // Mirror into Company Memory: an interaction row + a VERIFIED timeline event.
  // Fire-and-forget — a memory write must never fail an email generation.
  void logInteractionForCompany(lead, {
    interactionType: 'email_sent',
    subject: parsed.subject,
    bodyPreview: parsed.p1,
    contactName: primaryStakeholder?.name ?? null,
  })

  return parsed
}
