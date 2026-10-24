/**
 * EBEXTA subscription tiers — single source of truth for the landing page
 * and /choose-plan. Plans are activated by the EBEXTA admin team after onboarding.
 * Prices are monthly INR; yearly applies a 15% discount.
 */
export const YEARLY_DISCOUNT = 0.15

export interface Plan {
  key: 'starter' | 'growth' | 'pro' | 'enterprise'
  name: string
  priceMonthly: number | null   // null = custom (enterprise)
  originalPriceMonthly?: number // for strike-through regular price
  earlyBirdNote?: string
  tagline: string
  features: string[]
  popular?: boolean
  custom?: boolean
}

export const PLANS: Plan[] = [
  {
    key: 'starter',
    name: 'Starter',
    priceMonthly: 3999,
    tagline: 'For individual founders & consultants starting with verified lead discovery.',
    features: [
      '1 user seat',
      '500 credits / month',
      'Unified credit pool (spend flexibly across core features)',
      'Verified company & contact search',
      'Basic business signals & intent indicators',
      'Standard CSV data export',
    ],
  },
  {
    key: 'growth',
    name: 'Growth',
    priceMonthly: 19999,
    tagline: 'For active founders & sales teams running continuous lead discovery.',
    features: [
      '3 user seats',
      '2,500 credits / month',
      'Unified credit pool (spend flexibly across all 7 features)',
      'Full access to Declared Intent Marketplace',
      'Deep Research, Dossier & Pitch PDF export',
      'Priority contact verification',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    priceMonthly: 29999,
    originalPriceMonthly: 39999,
    earlyBirdNote: 'Limited Launching Offer — Regular Price ₹39,999 after price hike!',
    tagline: 'For agencies, growth desks & high-volume lead generation desks.',
    features: [
      '10 user seats',
      '7,500 credits / month',
      'Unified credit pool (spend flexibly across all 7 features)',
      'Signal Watch automated tracking',
      'Priority verification analyst queue',
      'Bulk CSV & JSON data exports',
    ],
    popular: true,
  },
  {
    key: 'enterprise',
    name: 'Enterprise / Custom',
    priceMonthly: null,
    tagline: 'Bespoke AI lead network with native CRM integrations & custom workflows.',
    features: [
      'Bespoke seat allocation & 25,000+ credits / month',
      'Native CRM Integrations (Salesforce, HubSpot, Zoho & Custom Webhooks)',
      'Dedicated verification analyst & custom SLA',
      'Custom API endpoints & real-time webhook push',
      'Invite-only verified enterprise network access',
    ],
    custom: true,
  },
]

export const inr = (n: number) => `₹${n.toLocaleString('en-IN')}`

/** Effective displayed monthly price for a billing cycle. */
export function monthlyPrice(p: Plan, billing: 'monthly' | 'yearly'): number | null {
  if (p.priceMonthly == null) return null
  return billing === 'yearly' ? Math.round(p.priceMonthly * (1 - YEARLY_DISCOUNT)) : p.priceMonthly
}
