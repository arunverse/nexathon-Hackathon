import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { acceptPendingInvites } from '../lib/teams'
import { verifyGoogleTokenOnBackend } from '../lib/googleAuth'
import { isAuthorizedAdminEmail, verifyAdminAccess } from '../lib/adminAuth'

interface AuthContextType {
  session: Session | null
  user: User | null
  loading: boolean
  /** True only when the signed-in user's profiles.is_admin = true (S2/S10). */
  isAdmin: boolean
  /** True once the admin check has completed (avoids redirect flicker). */
  adminChecked: boolean
  signInWithGoogle: () => Promise<void>
  signInWithGoogleCredential: (
    credential: string,
    options?: { mode?: string; plan?: string }
  ) => Promise<{ isNewUser?: boolean }>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

async function createProfileIfNotExists(
  userId: string,
  email: string,
  meta?: { name?: string; avatar_url?: string; google_sub?: string }
) {
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle()
    if (!data) {
      const newRow: Record<string, unknown> = {
        id: userId,
        sender_email: email,
        email: email,
        mode: 'seeker',
        plan: 'starter',
        plan_status: 'none',
        credits: 0,
        credit_limit: 0,
        is_admin: isAuthorizedAdminEmail(email),
      }
      if (meta?.name) newRow.name = meta.name
      if (meta?.avatar_url) newRow.profile_image_url = meta.avatar_url
      if (meta?.google_sub) {
        newRow.google_sub = meta.google_sub
        newRow.email_verified = true
        newRow.authentication_provider = 'google'
        newRow.last_login_at = new Date().toISOString()
      }
      await supabase.from('profiles').insert(newRow)
    }
  } catch {
    // Non-fatal — backend verification and DB triggers handle profile persistence
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [user, setUser] = useState<User | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [adminChecked, setAdminChecked] = useState(false)

  // Admin status requires dual verification:
  // 1. Email must be an explicitly authorized EBEXTA administrator (isAuthorizedAdminEmail)
  // 2. profiles.is_admin must be true in Supabase.
  // This guarantees that no arbitrary registered email can ever access admin routes.
  async function refreshAdmin(u: User | null) {
    if (!u) { setIsAdmin(false); setAdminChecked(true); return }
    if (!isAuthorizedAdminEmail(u.email)) {
      setIsAdmin(false)
      setAdminChecked(true)
      // Self-heal: ensure non-admin profile cannot hold is_admin: true or EBEXTA Admin name in database
      void (async () => {
        try {
          const { data } = await supabase.from('profiles').select('is_admin, company_name').eq('id', u.id).maybeSingle()
          const updates: Record<string, unknown> = {}
          if (data?.is_admin === true) updates.is_admin = false
          if (data?.company_name === 'EBEXTA Admin') updates.company_name = null
          if (Object.keys(updates).length > 0) {
            await supabase.from('profiles').update(updates).eq('id', u.id)
          }
        } catch {
          // ignore
        }
      })()
      return
    }

    try {
      const { data } = await supabase.from('profiles').select('is_admin').eq('id', u.id).maybeSingle()
      setIsAdmin(verifyAdminAccess(u, data?.is_admin === true))
    } catch {
      setIsAdmin(false)
    } finally {
      setAdminChecked(true)
    }
  }

  useEffect(() => {
    // Tracks the signed-in identity so we can ignore pure token refreshes.
    let lastUserId: string | null = null

    // Load existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      lastUserId = session?.user?.id ?? null
      // A missing profile row breaks plan requests, onboarding and every
      // foreign key that points at the user — always ensure it exists.
      if (session?.user) {
        void createProfileIfNotExists(session.user.id, session.user.email ?? '')
      }
      void refreshAdmin(session?.user ?? null)
    })

    // Watch for auth changes
    // Supabase fires TOKEN_REFRESHED / SIGNED_IN again whenever the tab regains
    // focus. Re-running the admin check on every one of those flips
    // adminChecked=false, which makes AdminRoute swap the whole screen for a
    // spinner — destroying any open modal or half-filled form. So only re-check
    // when the IDENTITY actually changes (login, logout, different user).
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const nextUser = session?.user ?? null
        const nextId = nextUser?.id ?? null
        setSession(session)
        setUser(nextUser)
        // Ensure the profile row exists on EVERY auth event (idempotent, and a
        // missing row breaks plan requests / onboarding via foreign keys).
        if (nextUser) {
          void createProfileIfNotExists(nextUser.id, nextUser.email ?? '')
        }
        if (nextId === lastUserId) return   // same user — token refresh only
        lastUserId = nextId
        setAdminChecked(false)
        void refreshAdmin(nextUser)
        // A pending team invite for this email becomes a real membership the
        // first time they sign in. No-op when there's nothing pending.
        if (nextUser) {
          void acceptPendingInvites().catch(() => { /* non-fatal */ })
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signInWithGoogleCredential = async (
    credential: string,
    options?: { mode?: string; plan?: string }
  ): Promise<{ isNewUser?: boolean }> => {
    const res = await verifyGoogleTokenOnBackend(credential, options)
    if (!res.session?.access_token || !res.session?.refresh_token) {
      throw new Error('Authentication failed: missing session tokens')
    }

    const { error: setSessionErr } = await supabase.auth.setSession({
      access_token: res.session.access_token,
      refresh_token: res.session.refresh_token,
    })

    if (setSessionErr) throw setSessionErr

    // Update state immediately
    const nextUser = res.user as unknown as User
    setSession(res.session as unknown as Session)
    setUser(nextUser)

    // Ensure profile reflects verified Google identity
    if (nextUser?.id) {
      const meta = nextUser.user_metadata || {}
      await createProfileIfNotExists(nextUser.id, nextUser.email ?? '', {
        name: (meta.full_name || meta.name) as string | undefined,
        avatar_url: (meta.avatar_url || meta.picture) as string | undefined,
        google_sub: (meta.google_sub || meta.sub) as string | undefined,
      })
    }

    void refreshAdmin(nextUser)
    return { isNewUser: res.isNewUser }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) throw error
  }

  const signInWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }

  const signUpWithEmail = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/onboarding` },
    })
    if (error) throw error
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    // Privacy: wipe any EBEXTA data cached on this device (email, cached leads
    // with contact info, drafts) so nothing PII-bearing survives logout.
    try {
      Object.keys(localStorage)
        .filter(k => k.startsWith('ebexta_'))
        .forEach(k => localStorage.removeItem(k))
    } catch { /* ignore */ }
  }

  return (
    <AuthContext.Provider
      value={{
        session: session ?? null,
        user,
        loading: session === undefined,
        isAdmin,
        adminChecked,
        signInWithGoogle,
        signInWithGoogleCredential,
        signInWithEmail,
        signUpWithEmail,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
