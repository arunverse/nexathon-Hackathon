/**
 * EBEXTA AI Intent Router
 * Level 0 Deterministic Classifier & Parameter Extractor.
 * Zero-cost, instantaneous regex/pattern/grammar classification.
 * Executes BEFORE any LLM reasoning.
 */

import type { IntentType, ParsedIntent, ConversationContext } from './types'

export function classifyIntent(query: string, context?: ConversationContext): ParsedIntent {
  const q = query.trim().toLowerCase()
  const params: Record<string, any> = {}

  // 1. TALK TO EXPERT / ESCALATION
  if (
    /talk to (an? )?(?:ebexta )?expert|speak (with|to) (an? )?(?:ebexta )?expert|human agent|need an? (?:ebexta )?expert|contact (support|team)|raise (a )?ticket|complain|wrong data|escalat/i.test(q)
  ) {
    return {
      intent: 'TALK_TO_EXPERT',
      confidence: 'HIGH',
      parameters: { reason: query },
      rawQuery: query,
      reasoning: 'User explicitly requested human/expert escalation or flagged a data grievance.',
    }
  }

  // 2. REVOPS: PIPELINE & CONVERSION ANALYSIS
  if (
    /pipeline|conversion|dropoff|bottleneck|stalled (deals?|opps?|opportunities)|why did.*(pipeline|revenue|sales).*(drop|fall|decrease)|forecast/i.test(q)
  ) {
    let subType: IntentType = 'PIPELINE_ANALYSIS'
    if (/bottleneck|stuck|stalled/i.test(q)) subType = 'BOTTLENECK_DETECTION'
    if (/conversion|convert/i.test(q)) subType = 'CONVERSION_ANALYSIS'
    if (/drop|fall|anomaly|unusual/i.test(q)) subType = 'ANOMALY_DETECTION'

    return {
      intent: subType,
      confidence: 'HIGH',
      parameters: {},
      rawQuery: query,
      reasoning: 'Deterministic match for Revenue Operations analytics.',
    }
  }

  // 3. SCORE EXPLANATION / "WHY IS THIS SCORED X"
  if (
    /why is (this|the) (lead|account|company|deal) (scored|important|priority|high priority)|explain (the )?score|score breakdown|why.*score \d+/i.test(q) ||
    (context?.entityId && /^why\??$/i.test(q))
  ) {
    const scoreMatch = q.match(/score(?:d)?\s+(\d+)/)
    if (scoreMatch) params.targetScore = parseInt(scoreMatch[1], 10)
    if (context?.entityId) params.entityId = context.entityId

    return {
      intent: 'SCORE_EXPLANATION',
      confidence: 'HIGH',
      parameters: params,
      rawQuery: query,
      reasoning: 'Matched inquiry regarding scoring rationale and weights.',
    }
  }

  // 4. SIGNALS & BUYING MOMENT
  if (
    /what signals|buying moment|recent signals|signals are we seeing|funding signal|hiring signal|expansion signal/i.test(q)
  ) {
    if (context?.entityId) params.entityId = context.entityId
    return {
      intent: 'ANALYZE_SIGNALS',
      confidence: 'HIGH',
      parameters: params,
      rawQuery: query,
      reasoning: 'Intent matches signal analysis or buying moment computation.',
    }
  }

  // 5. ENGAGE: PREPARE OUTREACH / EMAIL GENERATION
  if (
    /prepare outreach|write (an? )?email|draft (an? )?email|generate email|outreach for|write a pitch|contact (them|this company|these accounts)/i.test(q)
  ) {
    if (context?.entityId) params.entityId = context.entityId
    return {
      intent: 'GENERATE_OUTREACH',
      confidence: 'HIGH',
      parameters: params,
      rawQuery: query,
      reasoning: 'Direct request to generate personalized outreach or communication.',
    }
  }

  // 6. CRM: ACTIONS (CREATE TASK, UPDATE STAGE, LOG ACTIVITY)
  if (/create (a )?task|assign to|schedule|follow up on/i.test(q)) {
    const taskMatch = q.match(/create (a )?task (?:for|to) (.+)/i)
    if (taskMatch) params.taskTitle = taskMatch[2]
    return {
      intent: 'CREATE_TASK',
      confidence: 'HIGH',
      parameters: params,
      rawQuery: query,
      reasoning: 'CRM action detected for task management.',
    }
  }

  // 7. DISCOVER: FIND COMPANIES / DECISION MAKERS / SEARCH
  if (
    /find|search|show|get|list|look for/i.test(q) &&
    /compan(y|ies)|accounts?|leads?|startups?|decision makers?|founders?|ctos?|vps?/i.test(q)
  ) {
    // Check if searching specifically for decision makers
    if (/decision makers?|founders?|executives?|contacts?|vps?|leads? at/i.test(q)) {
      return {
        intent: 'DISCOVER_DECISION_MAKERS',
        confidence: 'HIGH',
        parameters: extractDiscoverParameters(q),
        rawQuery: query,
        reasoning: 'Request to identify decision makers or stakeholders.',
      }
    }

    // Extract industry, location, and employee count filters deterministically
    const extracted = extractDiscoverParameters(q)
    return {
      intent: 'DISCOVER_COMPANIES',
      confidence: 'HIGH',
      parameters: extracted,
      rawQuery: query,
      reasoning: 'Deterministic extraction of company search parameters.',
    }
  }

  // 8. VERIFY: VERIFICATION / REVEAL
  if (/verify|verification|check domain|validate email/i.test(q)) {
    return {
      intent: 'VERIFY_RECORD',
      confidence: 'HIGH',
      parameters: { entityId: context?.entityId },
      rawQuery: query,
      reasoning: 'Direct verification lookup request.',
    }
  }

  // 9. CONTEXTUAL FOLLOW-UP
  if (context?.entityId && /who (is|are) the (contact|stakeholder|founder|ceo)/i.test(q)) {
    return {
      intent: 'DISCOVER_DECISION_MAKERS',
      confidence: 'HIGH',
      parameters: { entityId: context.entityId },
      rawQuery: query,
      reasoning: 'Contextual resolution for active entity stakeholders.',
    }
  }

  // Default fallback to General Help or LLM Reasoning
  return {
    intent: 'GENERAL_HELP',
    confidence: 'LOW',
    parameters: {},
    rawQuery: query,
    reasoning: 'No strict deterministic rule matched; routing to intelligent reasoning.',
  }
}

/**
 * Deterministically parses common B2B search parameters without an LLM.
 * Example: "find SaaS companies in Bangalore with 100-500 employees"
 */
function extractDiscoverParameters(q: string): Record<string, any> {
  const params: Record<string, any> = {}

  // Industry detection
  const industries = ['saas', 'fintech', 'healthtech', 'edtech', 'ai', 'logistics', 'ecommerce', 'b2b', 'enterprise', 'security', 'cybersecurity', 'cloud', 'biotech', 'manufacturing']
  for (const ind of industries) {
    if (new RegExp(`\\b${ind}\\b`, 'i').test(q)) {
      params.industry = ind
      break
    }
  }

  // Location detection
  const locations = [
    'bangalore', 'bengaluru', 'mumbai', 'delhi', 'san francisco', 'new york',
    'london', 'singapore', 'berlin', 'india', 'usa', 'united states', 'uk', 'europe', 'pune', 'hyderabad', 'chennai'
  ]
  for (const loc of locations) {
    if (new RegExp(`\\b${loc}\\b`, 'i').test(q)) {
      params.location = loc.charAt(0).toUpperCase() + loc.slice(1)
      break
    }
  }

  // Employee count range: e.g. "100-500 employees", "50+ employees", "> 50 employees"
  const empRangeMatch = q.match(/(\d+)\s*(?:-|to)\s*(\d+)\s*employees?/i)
  if (empRangeMatch) {
    params.minEmployees = parseInt(empRangeMatch[1], 10)
    params.maxEmployees = parseInt(empRangeMatch[2], 10)
  } else {
    const empMinMatch = q.match(/(\d+)\+?\s*employees?/i)
    if (empMinMatch) {
      params.minEmployees = parseInt(empMinMatch[1], 10)
    }
  }

  // Count requested: e.g. "find 50 SaaS companies", "top 5"
  const limitMatch = q.match(/\b(?:find|top|show|get)\s+(\d+)\b/i)
  if (limitMatch) {
    params.limit = Math.min(parseInt(limitMatch[1], 10), 50)
  } else {
    params.limit = 5 // clean default
  }

  return params
}
