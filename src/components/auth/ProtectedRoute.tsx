import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'

/**
 * Login is COMPULSORY (Supabase email auth).
 * No session → redirect to /login. While the session is loading, show a spinner
 * instead of flashing protected content.
 */
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div
          className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // Send them to login, remembering where they were headed so they return here.
  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />

  return <>{children}</>
}
