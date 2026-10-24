import { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { isAuthorizedAdminEmail } from '../../lib/adminAuth'

// Owner / comp accounts that always have full (Enterprise) access and never see
// the plan gate or the billing page. Add addresses here to grant standing access.
const GRANTED_EMAILS = ['arunchinnu2005@gmail.com']

/**
 * Plan gate — used INSIDE ProtectedRoute (so a session is guaranteed).
 *   'active' / 'trial' (not expired)  → app (or Welcome, if not onboarded yet)
 *   anything else / expired           → /choose-plan
 * A freshly-activated user who hasn't onboarded is sent to /welcome first when
 * they try to reach a dashboard page.
 */
export function PlanGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const location = useLocation()
  const [state, setState] = useState<'loading' | 'ok' | 'gate' | 'welcome'>('loading')

  useEffect(() => {
    let alive = true
    async function check() {
      if (!user) { if (alive) setState('loading'); return }
      const email = user.email?.trim().toLowerCase()
      if (email && GRANTED_EMAILS.includes(email)) { if (alive) setState('ok'); return }
      // Plan check uses columns guaranteed to exist after plan_gate.sql.
      const { data, error } = await supabase
        .from('profiles')
        .select('plan_status, plan_expires_at, is_admin, plan, company_name, onboarded')
        .eq('id', user.id)
        .maybeSingle()
      if (error) { if (alive) setState('gate'); return }

      // Admin accounts ALWAYS bypass the plan gate (requires verified authorized admin email)
      if (isAuthorizedAdminEmail(user.email) && data?.is_admin === true) {
        if (alive) setState('ok')
        return
      }

      const status = (data?.plan_status ?? 'none') as string
      const notExpired = !data?.plan_expires_at || new Date(data.plan_expires_at) > new Date()
      const allowed = (status === 'active' || status === 'trial') && notExpired

      if (!alive) return
      if (!allowed) { setState('gate'); return }

      // Has the user onboarded? A user is "onboarded" if the flag is true OR they
      // already have a company name (existing users whose flag was never set).
      // Graceful if the column doesn't exist yet (onboarding_flag.sql not run).
      const { data: ob, error: obErr } = await supabase
        .from('profiles').select('onboarded, company_name').eq('id', user.id).maybeSingle()
      const hasCompany = !!(ob?.company_name && String(ob.company_name).trim())
      // Local signals that this user already cleared onboarding ON THIS DEVICE, so
      // a REFRESH never sends an existing user back into onboarding/welcome even
      // when the DB flag wasn't set (onboarding_flag.sql not run, or the mark RPC
      // failed). Having any cached scan results counts as "already in the app".
      const locallyOnboarded =
        localStorage.getItem('ebexta_onboarded') === 'true' ||
        !!localStorage.getItem('ebexta_leads_seeker') ||
        !!localStorage.getItem('ebexta_leads_provider')

      // SECURE server-side signal: if the account has ANY scans or leads, they
      // have completed onboarding + their first scan — always send them to the
      // dashboard, regardless of localStorage (fresh browser/device) or whether
      // the `onboarded` flag was ever set. This is owner-scoped under RLS, so it
      // can't be spoofed by clearing browser storage.
      let hasServerActivity = false
      if (!obErr && ob?.onboarded !== true && !hasCompany) {
        const { count: scanCount } = await supabase
          .from('scans').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
        hasServerActivity = (scanCount ?? 0) > 0
        if (!hasServerActivity) {
          const { count: leadCount } = await supabase
            .from('leads').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
          hasServerActivity = (leadCount ?? 0) > 0
        }
      }

      const onboarded = obErr ? true : (ob?.onboarded === true || hasCompany || hasServerActivity || locallyOnboarded)
      if (!alive) return
      // Persist it locally so every future refresh lands straight on the dashboard,
      // and best-effort mark the DB flag so future logins skip the activity check.
      if (onboarded) {
        try { localStorage.setItem('ebexta_onboarded', 'true') } catch { /* ignore */ }
        if (ob?.onboarded !== true) { void supabase.rpc('ebexta_mark_onboarded') }
      }
      // Genuinely new (not onboarded, no company yet) → Welcome first, but only
      // when heading to the dashboard. /welcome + /onboarding stay reachable so
      // there is no redirect loop and onboarded users go straight to the app.
      if (!onboarded && location.pathname.startsWith('/dashboard')) { setState('welcome'); return }
      setState('ok')
    }
    check()
    return () => { alive = false }
  }, [user, location.pathname])

  if (state === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }
  if (state === 'gate') return <Navigate to="/choose-plan" replace />
  if (state === 'welcome') return <Navigate to="/welcome" replace />
  return <>{children}</>
}
