/**
 * EBEXTA Assist — a zero-cost, in-app support bot.
 * No AI/API calls: it answers from a canned knowledge base by keyword matching.
 * When it can't help (or the user asks for a human), it raises a support ticket
 * that lands in the admin console.
 */
import { supabase } from './supabase'

export interface BotEntry { id: string; label: string; keywords: string[]; answer: string }

// ── Canned knowledge base — plain-language answers to the common questions ──
export const KB: BotEntry[] = [
  {
    id: 'scan', label: 'How scans work',
    keywords: ['scan', 'search', 'find leads', 'how does it work', 'generate leads', 'discover'],
    answer: 'Pick your mode (Seeker or Provider), then hit “New Scan”. EBEXTA searches live sources, scores each company on Buying Intent, Service Match and Trust & Confidence, verifies the links, and returns your matched companies in a few minutes. You only ever see the opposite side — never competitors.',
  },
  {
    id: 'verify', label: 'What “Verified” means',
    keywords: ['verify', 'verified', 'verification', 'genuine', 'real email', 'decision maker', 'stakeholder'],
    answer: 'Each opportunity shows how much we could confirm. “Verified by EBEXTA” means our team cross-referenced the contact against authentic public registries and business directories. Use “Verify by EBEXTA” on any opportunity to request verified decision-maker details.',
  },
  {
    id: 'modes', label: 'Seeker vs Provider',
    keywords: ['seeker', 'provider', 'mode', 'switch', 'bilateral'],
    answer: 'Seeker = you need a service, so EBEXTA shows you providers. Provider = you offer a service, so EBEXTA shows you seekers (clients). Switch modes anytime from the sidebar — your leads flip to match.',
  },
  {
    id: 'product', label: 'Targeting a product',
    keywords: ['product', 'service targeting', 'ideal buyer', 'icp', 'mural', 'specific product'],
    answer: 'In onboarding (or Settings → “What you’re taking to market”) you can target a specific product. EBEXTA analyses it, works out its ideal buyer, and aims scans at those companies instead of your generic profile.',
  },
  {
    id: 'saved', label: 'Saved leads',
    keywords: ['save', 'saved', 'bookmark', 'lost leads', 'gone', 'disappear'],
    answer: 'Tap the bookmark on any lead to save it — saved leads are tied to your account and appear under “Saved” on any device. Your generated leads are also stored to your account, so refreshing or logging out won’t lose them.',
  },
  {
    id: 'outreach', label: 'Email & outreach',
    keywords: ['email', 'outreach', 'message', 'whatsapp', 'linkedin', 'pitch', 'generate email'],
    answer: 'Open a lead and use “Generate Email”, or from a verified contact you can reach out on WhatsApp/LinkedIn. Pick a tone, add your own points, and EBEXTA drafts a message tailored to that company.',
  },
  {
    id: 'plan', label: 'Plans & credits',
    keywords: ['plan', 'credit', 'credits', 'billing', 'upgrade', 'renew', 'payment', 'price', 'cost'],
    answer: 'Your plan and remaining credits are shown on the dashboard and under “Renew”. Each lead served uses a credit. If something looks off with your credits or plan, raise a ticket and the team will sort it out.',
  },
  {
    id: 'privacy', label: 'Data & privacy',
    keywords: ['privacy', 'data', 'secure', 'security', 'delete account', 'gdpr', 'personal data'],
    answer: 'Your data is owner-scoped and private to your account. You can delete your account and all its data anytime from Settings → Delete account. See our Privacy Policy for the full detail.',
  },
]

const CONTACT_INTENT = ['contact', 'human', 'team', 'agent', 'support', 'ticket', 'talk to', 'speak', 'raise', 'complaint', 'help me', 'call me', 'not working', 'issue', 'problem', 'bug', 'refund'];

/** Best canned answer for a user message, or null if nothing matches. */
export function botReply(text: string): BotEntry | null {
  const t = text.toLowerCase()
  let best: { entry: BotEntry; score: number } | null = null
  for (const entry of KB) {
    let score = 0
    for (const k of entry.keywords) if (t.includes(k)) score += k.split(' ').length
    if (score > 0 && (!best || score > best.score)) best = { entry, score }
  }
  return best?.entry ?? null
}

/** Does the message look like a request to reach a human / raise a ticket? */
export function wantsHuman(text: string): boolean {
  const t = text.toLowerCase()
  return CONTACT_INTENT.some(k => t.includes(k))
}

export interface TicketInput {
  userId: string
  email?: string | null
  subject?: string
  message: string
  transcript?: { from: 'bot' | 'user'; text: string }[]
}

export async function createTicket(input: TicketInput): Promise<{ error: string | null }> {
  const { error } = await supabase.from('support_tickets').insert({
    user_id: input.userId,
    email: input.email ?? null,
    subject: (input.subject || input.message).slice(0, 140),
    message: input.message.slice(0, 4000),
    source: 'bot',
    status: 'open',
    transcript: input.transcript ?? null,
  })
  return { error: error?.message ?? null }
}
