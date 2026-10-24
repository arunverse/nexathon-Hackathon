import { supabase } from './supabase'
import type { Lead, FeedbackType } from '../types'

export async function submitLeadFeedback(
  userId: string,
  lead: Lead,
  feedback: FeedbackType
): Promise<void> {
  try {
    await supabase.from('lead_feedback').insert({
      user_id: userId,
      lead_id: lead.id,
      feedback,
      intent_flags: lead.intent_flags,
      intent_score: lead.intent_score,
      match_score: lead.match_score,
    })
  } catch {
    // Non-fatal — feedback is best-effort
  }
}

export async function getUserScoringWeights(userId: string): Promise<Record<string, number>> {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('scoring_weights')
      .eq('id', userId)
      .single()
    return (data?.scoring_weights as Record<string, number>) ?? defaultWeights()
  } catch {
    return defaultWeights()
  }
}

export function defaultWeights(): Record<string, number> {
  return {
    RECENT_HIRING_SALES: 15,
    RECENT_FUNDING: 20,
    TECH_GAP_DETECTED: 10,
    HIGH_WEBSITE_TRAFFIC: 5,
    POSITIVE_NEWS: 10,
    LAYOFF_SIGNAL: -20,
    NEGATIVE_NEWS: -30,
    BANKRUPTCY_RISK: -50,
  }
}
