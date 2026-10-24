/**
 * EBEXTA AI Orchestrator
 * Glues Context Engine, Intent Router, Function Layer, and LLM together.
 * Strictly adheres to the priority order:
 * Level 0–4 Deterministic Logic & Database FIRST → Level 5–6 LLM Reasoning ONLY when required.
 */

import { supabase } from '../supabase'
import { callGeminiProxy } from '../geminiProxy'
import { classifyIntent } from './intentRouter'
import {
  findCompanies,
  findDecisionMakers,
  getScoreExplanation,
  calculateBuyingMoment,
  getPipelineSummary,
  escalateToExpert,
} from './functionRegistry'
import type {
  AIMessage,
  ConversationContext,
  StructuredCard,
  ActionPrompt,
} from './types'

export interface ProcessResult {
  message: AIMessage
  suggestedPrompts: ActionPrompt[]
}

export async function processUserMessage(
  userQuery: string,
  context: ConversationContext,
  user: { id: string; email?: string | null },
  conversationId: string,
  history: AIMessage[] = [],
): Promise<ProcessResult> {
  const query = userQuery.trim()

  // 1. Level 0: Classify intent deterministically
  const parsed = classifyIntent(query, context)
  console.log(`[EBEXTA AI] Intent: ${parsed.intent} (Confidence: ${parsed.confidence})`)

  let card: StructuredCard | undefined
  let textResponse = ''
  const suggestedPrompts: ActionPrompt[] = []

  // 2. Route according to intent
  switch (parsed.intent) {
    case 'DISCOVER_COMPANIES': {
      card = await findCompanies(parsed.parameters)
      textResponse = card.subtitle ?? `Found accounts matching your query.`
      suggestedPrompts.push(
        { id: 'p_outreach', label: 'Draft outreach for top matches', intent: 'GENERATE_OUTREACH' },
        { id: 'p_signals', label: 'Check recent signals on these', intent: 'ANALYZE_SIGNALS' },
      )
      break
    }

    case 'DISCOVER_DECISION_MAKERS': {
      card = await findDecisionMakers(parsed.parameters)
      textResponse = card.subtitle ?? `Here are the identified stakeholders.`
      suggestedPrompts.push(
        { id: 'p_outreach', label: 'Write personalized email', intent: 'GENERATE_OUTREACH' },
        { id: 'p_verify', label: 'Request human verification', intent: 'VERIFY_RECORD' },
      )
      break
    }

    case 'SCORE_EXPLANATION': {
      card = await getScoreExplanation(parsed.parameters.entityId, context)
      textResponse = card.subtitle ?? `Here is the verified scoring breakdown.`
      suggestedPrompts.push(
        { id: 'p_buying_moment', label: 'What is the Buying Moment?', intent: 'CALCULATE_BUYING_MOMENT' },
        { id: 'p_outreach', label: 'Prepare tailored pitch', intent: 'GENERATE_OUTREACH' },
      )
      break
    }

    case 'ANALYZE_SIGNALS':
    case 'CALCULATE_BUYING_MOMENT': {
      card = await calculateBuyingMoment(parsed.parameters.entityId, context)
      textResponse = card.subtitle ?? `Calculated Buying Moment based on verified signals.`
      suggestedPrompts.push(
        { id: 'p_outreach', label: 'Reach out before window closes', intent: 'GENERATE_OUTREACH' },
      )
      break
    }

    case 'PIPELINE_ANALYSIS':
    case 'BOTTLENECK_DETECTION':
    case 'CONVERSION_ANALYSIS':
    case 'ANOMALY_DETECTION': {
      card = await getPipelineSummary()
      textResponse = card.subtitle ?? `Here is the current pipeline telemetry.`
      suggestedPrompts.push(
        { id: 'p_stalled', label: 'Show stalled accounts', intent: 'PIPELINE_ANALYSIS' },
        { id: 'p_uncontacted', label: 'Find high-fit leads not contacted', intent: 'DISCOVER_COMPANIES' },
      )
      break
    }

    case 'TALK_TO_EXPERT': {
      const transcript = history.map(h => ({ from: h.sender, text: h.content }))
      transcript.push({ from: 'user', text: query })
      card = await escalateToExpert(user, context, query, transcript)
      textResponse = `I've opened an expert request for you. Our team will review the full context and reach out directly.`
      break
    }

    case 'GENERATE_OUTREACH': {
      // Outreach generation: Level 5/6 (uses templates & Gemini)
      const targetCompany = context.entityName || parsed.parameters.companyName || 'Target Account'
      try {
        const prompt = `You are Alex Chen, senior B2B enterprise strategist at EBEXTA.
Draft a concise, high-converting 3-paragraph cold outreach email to ${targetCompany}.
Page Context: ${context.pageName}
Lead Data: ${JSON.stringify(context.entityData ?? {})}
Keep it under 120 words. Focus on specific ROI, avoid generic buzzwords like "synergy" or "touch base".`

        const res = await callGeminiProxy(prompt, { action: 'email', model: 'gemini-flash-lite-latest' })
        textResponse = res.text.trim()
        card = {
          type: 'OUTREACH_PREVIEW',
          title: `Draft Outreach: ${targetCompany}`,
          subtitle: 'Generated from company signals & deal strategy.',
          confidence: 'HIGH',
          data: { email: textResponse, recipient: targetCompany },
          recommendedAction: {
            id: 'action_confirm_send',
            label: 'Review & Send via Inbox',
            intent: 'GENERAL_HELP',
            params: { navigate: '/dashboard/inbox' },
          },
        }
      } catch {
        textResponse = `Subject: Scaling with EBEXTA Verified Intelligence\n\nHi ${context.entityName ?? 'Team'},\n\nNoticed your recent expansion in ${context.entityData?.location ?? 'the market'}. We help companies at your stage accelerate pipeline with verified high-intent accounts.\n\nOpen to a brief 10-minute briefing this Thursday?`
        card = {
          type: 'OUTREACH_PREVIEW',
          title: `Draft Outreach: ${targetCompany}`,
          subtitle: 'Standard enterprise template (offline mode).',
          confidence: 'MEDIUM',
          data: { email: textResponse, recipient: targetCompany },
        }
      }
      break
    }

    case 'GENERAL_HELP':
    default: {
      // General question: synthesis with Gemini Flash Lite
      try {
        const sysContext = `You are EBEXTA AI, the native revenue intelligence layer of EBEXTA.
Active Page: ${context.pageName} (Path: ${context.pathname})
User Mode: ${context.userMode}
Active Record: ${context.entityName ?? 'None'}
Answer concisely, factually, and authoritatively. If you lack verified evidence, state: "I don't have enough verified information to determine that."`

        const prompt = `${sysContext}\n\nUser Question: ${query}`
        const res = await callGeminiProxy(prompt, { action: 'enrich', model: 'gemini-flash-lite-latest' })
        textResponse = res.text.trim()
      } catch {
        textResponse = `EBEXTA AI is ready to help you discover accounts, analyze buying signals, explain match scores, and optimize pipeline conversions. How can I assist your revenue operations today?`
      }

      suggestedPrompts.push(
        { id: 'p_find', label: 'Find high-fit SaaS companies', intent: 'DISCOVER_COMPANIES' },
        { id: 'p_pipe', label: 'Analyze our pipeline health', intent: 'PIPELINE_ANALYSIS' },
        { id: 'p_expert', label: 'Talk to an EBEXTA Expert', intent: 'TALK_TO_EXPERT' },
      )
      break
    }
  }

  const assistantMessage: AIMessage = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    conversationId,
    sender: 'assistant',
    content: textResponse,
    intent: parsed.intent,
    confidence: parsed.confidence,
    card,
    createdAt: new Date().toISOString(),
  }

  // 3. Persist to Supabase non-blockingly (with fallback to localStorage)
  void persistMessage(assistantMessage, user.id)

  return {
    message: assistantMessage,
    suggestedPrompts,
  }
}

async function persistMessage(msg: AIMessage, userId: string) {
  try {
    await supabase.from('ai_messages').insert({
      conversation_id: msg.conversationId,
      user_id: userId,
      sender: msg.sender,
      content: msg.content,
      intent: msg.intent,
      confidence: msg.confidence,
      response_type: msg.card ? msg.card.type : 'TEXT',
      structured_data: msg.card ?? null,
    })
  } catch {
    // If ai_messages table is not yet migrated, save into local storage ledger
    try {
      const key = `ebexta_ai_conv_${msg.conversationId}`
      const existing = JSON.parse(localStorage.getItem(key) || '[]')
      existing.push(msg)
      localStorage.setItem(key, JSON.stringify(existing.slice(-50)))
    } catch {
      // Non-fatal
    }
  }
}
