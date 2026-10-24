/**
 * EBEXTA AI Types & Data Contracts
 * Defines the core interfaces for Intent Routing, Context Engine,
 * Function Layer, and Structured Response Cards.
 */

export type IntentType =
  // DISCOVER
  | 'DISCOVER_COMPANIES'
  | 'DISCOVER_DECISION_MAKERS'
  | 'DISCOVER_BY_ICP'
  | 'DISCOVER_SIMILAR'
  // VERIFY
  | 'VERIFY_RECORD'
  | 'VERIFY_MATRIX'
  // SIGNALS
  | 'ANALYZE_SIGNALS'
  | 'CALCULATE_BUYING_MOMENT'
  // ENGAGE
  | 'GENERATE_OUTREACH'
  | 'SUGGEST_NEXT_ACTION'
  // CRM
  | 'ACCOUNT_ANALYSIS'
  | 'SCORE_EXPLANATION'
  | 'CREATE_TASK'
  | 'UPDATE_STAGE'
  | 'LOG_ACTIVITY'
  // REVOPS
  | 'PIPELINE_ANALYSIS'
  | 'BOTTLENECK_DETECTION'
  | 'CONVERSION_ANALYSIS'
  | 'ANOMALY_DETECTION'
  // WORKFLOW
  | 'GENERATE_WORKFLOW'
  // EXPERT
  | 'TALK_TO_EXPERT'
  // GENERAL
  | 'GENERAL_HELP'
  | 'UNKNOWN'

export type ConfidenceLevel = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ParsedIntent {
  intent: IntentType
  confidence: ConfidenceLevel
  parameters: Record<string, any>
  rawQuery: string
  reasoning?: string
}

export type CardType =
  | 'COMPANY_LIST'
  | 'SCORE_BREAKDOWN'
  | 'PIPELINE_METRICS'
  | 'ACTION_CONFIRMATION'
  | 'EXPERT_ESCALATION'
  | 'WORKFLOW_PREVIEW'
  | 'OUTREACH_PREVIEW'
  | 'TEXT'

export interface ActionPrompt {
  id: string
  label: string
  intent: IntentType
  params?: Record<string, any>
  tone?: 'primary' | 'secondary' | 'warning'
}

export interface StructuredCard {
  type: CardType
  title: string
  subtitle?: string
  confidence?: ConfidenceLevel
  facts?: Array<{ label: string; value: string | number; impact?: 'positive' | 'negative' | 'neutral' }>
  data?: any
  recommendedAction?: ActionPrompt
  secondaryActions?: ActionPrompt[]
}

export interface ConversationContext {
  pathname: string
  pageName: string
  entityType?: 'lead' | 'company' | 'deal' | 'user'
  entityId?: string
  entityName?: string
  entityData?: any
  selectedIds?: string[]
  userMode?: 'seeker' | 'provider'
  plan?: string
  credits?: number
}

export interface AIMessage {
  id: string
  conversationId: string
  sender: 'user' | 'assistant' | 'system'
  content: string
  intent?: IntentType
  confidence?: ConfidenceLevel
  card?: StructuredCard
  toolCalls?: Array<{ name: string; args: any; resultSummary?: string }>
  createdAt: string
}

export interface AIConversation {
  id: string
  title: string
  contextPage?: string
  contextEntityId?: string
  createdAt: string
  updatedAt: string
  messages: AIMessage[]
}
