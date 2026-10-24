/**
 * ProfileMenu — self-contained profile button + dropdown.
 * Drop <ProfileMenu /> into any page header (all dashboard pages use it).
 *
 * Dropdown: company name + email → Settings → (Admin Console, only if the
 * signed-in user is a real Supabase admin) → Sign out.
 *
 * Admin access is gated ENTIRELY by profiles.is_admin (see AuthContext). There
 * are no hardcoded credentials, and the "Admin Console" entry only appears for
 * real admins. The /admin routes and RLS enforce this independently.
 */

import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { User, Settings, ShieldCheck, LogOut } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { resolveSenderProfile } from '../../lib/senderProfile'

export function ProfileMenu() {
  const navigate = useNavigate()
  const { user, isAdmin, signOut } = useAuth()
  const [open, setOpen] = useState(false)
  // Seed from onboarding (localStorage) so the real name shows even if the
  // Supabase profile read is empty/blocked.
  const [companyName, setCompanyName] = useState(() => resolveSenderProfile(null).companyName)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!user) return
    supabase
      .from('profiles')
      .select('company_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setCompanyName(resolveSenderProfile({ company_name: data?.company_name, sender_email: user.email }).companyName)
      })
  }, [user])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function onDocClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDocClick)
    return () => document.removeEventListener('mousedown', onDocClick)
  }, [open])

  async function handleSignOut() {
    setOpen(false)
    await signOut()
    navigate('/')
  }

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile icon button */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Profile"
        className="w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          border: `1px solid ${open ? 'var(--accent)' : 'var(--border-subtle)'}`,
          background: open ? 'var(--accent-subtle)' : 'var(--bg-elevated)',
        }}
      >
        <User size={16} style={{ color: open ? 'var(--accent)' : 'var(--text-muted)' }} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[240px] rounded-xl overflow-hidden z-[150]"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            boxShadow: 'var(--shadow-lg)',
          }}
        >
          {/* Identity */}
          <div className="px-4 py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <p className="text-[13px] font-bold truncate" style={{ color: 'var(--text-primary)' }}>
              {companyName}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'var(--text-muted)' }}>
              {user?.email ?? 'Not signed in'}
            </p>
          </div>

          {/* Settings */}
          <button
            onClick={() => { setOpen(false); navigate('/dashboard/settings') }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium transition-colors text-left"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <Settings size={14} style={{ color: 'var(--text-muted)' }} />
            Settings
          </button>

          {/* Admin Console — only for real admins (profiles.is_admin = true) */}
          {isAdmin && (
            <button
              onClick={() => { setOpen(false); navigate('/admin') }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium transition-colors text-left"
              style={{ color: 'var(--warning)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,158,11,0.08)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
            >
              <ShieldCheck size={14} />
              Admin Console
            </button>
          )}

          {/* Divider */}
          <div className="h-px mx-3" style={{ background: 'var(--border-subtle)' }} />

          {/* Sign out */}
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-[12.5px] font-medium transition-colors text-left"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-subtle)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
          >
            <LogOut size={14} style={{ color: 'var(--text-muted)' }} />
            Sign out
          </button>
        </div>
      )}
    </div>
  )
}
