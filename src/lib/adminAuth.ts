/**
 * Centralized Administrator Authentication & Authorization Gating for EBEXTA.
 *
 * Implements strict defense-in-depth:
 * 1. An account can ONLY have admin privileges if its email address is explicitly
 *    listed in the authorized administrator list (or VITE_ADMIN_EMAILS env).
 * 2. An account must ALSO have `profiles.is_admin = true` in Supabase.
 *
 * This prevents any arbitrary registered user from accessing the admin console,
 * even if their database profile inadvertently defaulted to or had `is_admin = true`.
 */

export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = [
  'arunchinnu2005@gmail.com',
]

/**
 * Checks if an email is an authorized EBEXTA platform administrator.
 */
export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email || typeof email !== 'string') return false
  const clean = email.trim().toLowerCase()
  if (AUTHORIZED_ADMIN_EMAILS.includes(clean)) return true

  // Support runtime environment variable extension if configured
  try {
    const metaEnv = (import.meta as unknown as { env?: Record<string, string> }).env
    const envEmails = (metaEnv?.VITE_ADMIN_EMAILS || '')
      .split(',')
      .map(e => e.trim().toLowerCase())
      .filter(Boolean)
    if (envEmails.includes(clean)) return true
  } catch {
    // Non-fatal if environment variable parsing is unavailable in non-browser context
  }

  return false
}

/**
 * Validates whether a user qualifies for administrator status.
 * Both conditions are strictly mandatory.
 */
export function verifyAdminAccess(
  user: { email?: string | null } | null | undefined,
  isDbAdmin: boolean
): boolean {
  if (!user || !user.email) return false
  if (!isAuthorizedAdminEmail(user.email)) return false
  return isDbAdmin === true
}
