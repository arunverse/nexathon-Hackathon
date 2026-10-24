// ─── Auth / Profiles ─────────────────────────────────────────────────────────

export type UserMode = 'seeker' | 'provider'
export type UserPlan = 'starter' | 'growth' | 'pro' | 'enterprise'

export interface Profile {
  id: string
  company_name: string
  sender_email: string
  mission: string
  mode: UserMode
  plan: UserPlan
  credits: number
  scoring_weights?: Record<string, number>
  created_at: string
}

// ─── Scan ─────────────────────────────────────────────────────────────────────

export interface ScanFilters {
  industry?: string
  min_employees?: number
  max_employees?: number
  min_revenue?: string
  stages?: string[]
  country?: string
  region?: string
  tech_hubs?: string[]
}

export interface Scan {
  id: string
  user_id: string
  filters: ScanFilters
  status: 'running' | 'completed' | 'failed'
  lead_count?: number
  created_at: string
}

// ─── Leads ────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'VERIFIED' | 'PARTIALLY_VERIFIED' | 'MANUAL_REVIEW_NEEDED'

export type IntentFlag =
  | 'RECENT_HIRING_SALES'
  | 'RECENT_FUNDING'
  | 'TECH_GAP_DETECTED'
  | 'HIGH_WEBSITE_TRAFFIC'
  | 'POSITIVE_NEWS'
  | 'LAYOFF_SIGNAL'
  | 'NEGATIVE_NEWS'
  | 'BANKRUPTCY_RISK'

export interface Stakeholder {
  name: string
  title: string
  linkedin_url?: string
  email?: string
  priority: number
}

export interface Lead {
  id: string
  scan_id: string
  user_id: string
  company_name: string
  industry: string
  location: string
  employee_count: number
  funding_stage: string
  annual_revenue: string
  website: string
  company_description?: string
  tech_stack?: string[]
  intent_score: number
  match_score: number
  confidence_score: number
  verification_status: VerificationStatus
  intent_flags: IntentFlag[]
  validation_errors: string[]
  stakeholders: Stakeholder[]
  evidence_source_url: string
  linkedin_url?: string
  email?: string
  recent_news?: string
  strongly_recommended?: boolean
  trust_score?: number
  created_at: string
}

// ─── Declared Intents ─────────────────────────────────────────────────────────

export interface DeclaredIntent {
  id: string
  user_id: string
  requirement: string
  mode: UserMode
  industry_tags: string[]
  budget_range?: string
  duration: 30 | 60 | 90
  expires_at: string
  created_at: string
}

// ─── Outreach ─────────────────────────────────────────────────────────────────

export type SentimentType = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE'

export interface Outreach {
  id: string
  lead_id: string
  user_id: string
  email_subject: string
  email_body: string
  strategy?: string
  sentiment?: SentimentType
  created_at: string
}

// ─── Email generation ─────────────────────────────────────────────────────────

export interface GeneratedEmail {
  subject: string
  p1: string
  p2: string
  p3: string
  p4: string
  messagingNote: string
}

// ─── Feedback ─────────────────────────────────────────────────────────────────

export type FeedbackType = 'positive' | 'negative'

export interface LeadFeedback {
  user_id: string
  lead_id: string
  feedback: FeedbackType
  intent_flags: IntentFlag[]
  intent_score: number
  match_score: number
}
