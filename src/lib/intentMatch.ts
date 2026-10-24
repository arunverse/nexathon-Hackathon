/**
 * Intent relevance scoring for the cross-user signals feed.
 *
 * When a viewer looks at the intents posted by the OPPOSITE side, the ones
 * most relevant to what the viewer offers/needs should rank first. Example:
 * if provider A posts "we build websites for schools" and seeker B needs
 * "a website for our college", A scores high for B and lands at #1.
 *
 * Pure text-overlap heuristic — no API calls, instant, deterministic.
 */

const STOPWORDS = new Set([
  'the', 'and', 'for', 'are', 'with', 'you', 'your', 'our', 'that', 'this',
  'from', 'have', 'has', 'was', 'were', 'will', 'can', 'need', 'needs', 'want',
  'looking', 'seeking', 'offer', 'offering', 'provide', 'providing', 'company',
  'companies', 'business', 'businesses', 'service', 'services', 'solution',
  'solutions', 'help', 'get', 'who', 'what', 'they', 'their', 'them', 'a', 'an',
])

function tokens(text: string): string[] {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []).filter(w => !STOPWORDS.has(w))
}

export interface ScorableIntent {
  requirement: string
  industry_tags?: string[] | null
  poster_mission?: string | null
}

/**
 * Returns an intent-match score 0–100 for how relevant `intent` is to the
 * viewer's own mission/offering. Higher = surface higher in the feed.
 */
export function intentRelevanceScore(viewerMission: string, intent: ScorableIntent): number {
  const viewer = new Set(tokens(viewerMission))
  if (viewer.size === 0) return 0

  const intentText = [
    intent.requirement ?? '',
    (intent.industry_tags ?? []).join(' '),
    intent.poster_mission ?? '',
  ].join(' ')
  const intentTokens = new Set(tokens(intentText))
  if (intentTokens.size === 0) return 0

  let overlap = 0
  for (const w of intentTokens) if (viewer.has(w)) overlap++

  // Normalise against the smaller vocabulary so short-but-precise matches still
  // score well. Cap the denominator so a huge viewer mission can't dilute it.
  const denom = Math.max(3, Math.min(viewer.size, 14))
  return Math.min(100, Math.round((overlap / denom) * 100))
}

/** Sort a list of intents by relevance to the viewer, highest first. */
export function rankIntents<T extends ScorableIntent>(viewerMission: string, intents: T[]): Array<T & { intent_score: number }> {
  return intents
    .map(i => ({ ...i, intent_score: intentRelevanceScore(viewerMission, i) }))
    .sort((a, b) => b.intent_score - a.intent_score)
}
