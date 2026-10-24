import type { ReactNode } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { isAuthorizedAdminEmail } from '../../lib/adminAuth'

interface AdminRouteProps {
  children: ReactNode
}

export function AdminBanner() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-6 py-2"
      style={{
        background: 'linear-gradient(90deg, #92400e, #b45309)',
        borderBottom: '1px solid rgba(245,158,11,0.4)',
      }}
    >
      <div className="flex items-center gap-2">
        <span
          className="material-symbols-outlined text-[15px]"
          style={{ color: '#FDE68A', fontVariationSettings: "'FILL' 1" }}
        >
          admin_panel_settings
        </span>
        <span className="text-[12px] font-bold tracking-[0.08em] uppercase" style={{ color: '#FDE68A' }}>
          ADMIN MODE
        </span>
        <span className="text-[11px] ml-2" style={{ color: 'rgba(253,230,138,0.6)' }}>
          Verified via profiles.is_admin
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="text-[11px] font-bold px-3 py-1 rounded-lg transition-all"
        style={{
          background: 'rgba(0,0,0,0.3)',
          color: '#FDE68A',
          border: '1px solid rgba(253,230,138,0.25)',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.5)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,0,0,0.3)' }}
      >
        Logout
      </button>
    </div>
  )
}

export function AdminRoute({ children }: AdminRouteProps) {
  const { user, isAdmin, adminChecked, loading } = useAuth()
  // Wait for the session + admin check before deciding (prevents flicker/false redirect).
  if (loading || (user && !adminChecked)) {
    return (
      <div className="flex items-center justify-center h-screen" style={{ background: 'var(--bg-base)' }}>
        <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }
  if (!user || !isAdmin || !isAuthorizedAdminEmail(user.email)) return <Navigate to="/" replace />
  return <>{children}</>
}
