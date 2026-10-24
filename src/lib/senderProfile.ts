/**
 * Sender (Company A) profile resolver.
 *
 * The user's company name is captured in onboarding and stored in
 * localStorage (`ebexta_scan_filters`) and, when Supabase is reachable, in the
 * `profiles` table. Documents and emails must ALWAYS show the real company
 * name the user entered — never "Your Company" / "our company". This helper
 * merges a (possibly empty) Supabase profile with the onboarding fallback so
 * the name is present everywhere.
 */

import { isAuthorizedAdminEmail } from './adminAuth'

export interface SenderProfile {
  companyName: string
  mission: string
  email: string
  website: string
}

interface OnboardingFilters {
  companyName?: string
  senderEmail?: string
  mission?: string
  website?: string
  companyWebsite?: string
}

function readOnboarding(): OnboardingFilters {
  try {
    return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') as OnboardingFilters
  } catch {
    return {}
  }
}

/**
 * Resolve the sender profile. Pass whatever came back from the Supabase
 * `profiles` row (any field may be empty/null) and this fills the gaps from
 * the onboarding data the user actually typed.
 */
export function resolveSenderProfile(dbProfile?: {
  company_name?: string | null
  mission?: string | null
  sender_email?: string | null
  website?: string | null
} | null): SenderProfile {
  const ob = readOnboarding()
  const email = (dbProfile?.sender_email?.trim() || '').trim()
  let rawCompanyName = (dbProfile?.company_name?.trim() || ob.companyName?.trim() || '').trim()
  
  // Guard: if company_name is 'EBEXTA Admin' but email is not an authorized administrator,
  // do not let regular members display the administrative brand name.
  if (rawCompanyName === 'EBEXTA Admin' && !isAuthorizedAdminEmail(email)) {
    rawCompanyName = (ob.companyName?.trim() === 'EBEXTA Admin' ? '' : ob.companyName?.trim()) || ''
  }

  const companyName = rawCompanyName || 'Your Company'
  const mission = (dbProfile?.mission?.trim() || ob.mission?.trim() || '').trim()
  // Email comes ONLY from the DB profile / auth session — never from localStorage
  // (we don't persist the user's email on the device; see the privacy audit).
  const website =
    (dbProfile?.website?.trim() || ob.companyWebsite?.trim() || ob.website?.trim() || '').trim()
  return { companyName, mission, email, website }
}

