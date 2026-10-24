import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { resolveSenderProfile } from '../../lib/senderProfile'
import { EbextaLogo } from '../common/EbextaLogo'
import { ModeSwitchModal } from '../ModeSwitchModal'
import { CreditMeter } from '../CreditMeter'
import { CompanyProfileModal } from '../community/CompanyProfileModal'

const navItems = [
  { icon: 'hub',          label: 'Leads',             path: '/dashboard' },
  { icon: 'groups',       label: 'Community',         path: '/dashboard/community' },
  { icon: 'corporate_fare', label: 'Companies',       path: '/dashboard/companies' },
  { icon: 'query_stats',  label: 'Stats',              path: '/dashboard/stats' },
  { icon: 'bookmark',     label: 'Saved',              path: '/dashboard/saved' },
  { icon: 'verified_user',label: 'Verified Contacts',  path: '/dashboard/verified' },
  { icon: 'autorenew',    label: 'Renew',              path: '/dashboard/renew' },
  { icon: 'settings',     label: 'Settings',           path: '/dashboard/settings' },
]

export function Sidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [mode, setMode]         = useState<'seeker' | 'provider'>('seeker')
  const [toast, setToast]       = useState<string | null>(null)
  const [switchTarget, setSwitchTarget] = useState<'seeker' | 'provider' | null>(null)
  const initialName = resolveSenderProfile(null).companyName
  const [companyName, setCompanyName]       = useState(initialName)
  const [unread, setUnread]                 = useState(0)
  const [open, setOpen]                     = useState(false)   // mobile drawer
  const [showAccountMenu, setShowAccountMenu] = useState(false)
  const [showPreviewModal, setShowPreviewModal] = useState(false)

  // Close the mobile drawer whenever the route changes.
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Live unread message count for the Inbox badge (notifies until opened).
  const [userName, setUserName] = useState('')
  const [userAvatar, setUserAvatar] = useState('')

  useEffect(() => {
    if (!user) return
    let alive = true
    const fetchUnread = () => supabase.rpc('ebexta_unread_count').then(({ data }) => { if (alive) setUnread((data as number) ?? 0) })
    fetchUnread()
    const iv = setInterval(fetchUnread, 20000)
    return () => { alive = false; clearInterval(iv) }
  }, [user, location.pathname])

  useEffect(() => {
    if (!user) return

    const loadProfile = () => {
      try {
        const localAvatar = localStorage.getItem('ebexta_user_avatar')
        const localName = localStorage.getItem('ebexta_user_name')
        setUserAvatar(localAvatar || '')
        setUserName(localName || '')
      } catch { /* ignore */ }

      let filterMode: 'seeker' | 'provider' | null = null
      try {
        const f = JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}')
        if (f?.mode === 'seeker' || f?.mode === 'provider') filterMode = f.mode
      } catch { /* ignore */ }
      supabase
        .from('profiles')
        .select('mode, company_name, full_name, name, profile_image_url, avatar_url, logo_url')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const resolved = (data?.mode as 'seeker' | 'provider' | undefined) ?? filterMode ?? 'seeker'
          setMode(resolved)
          const name = resolveSenderProfile({ company_name: data?.company_name, sender_email: user.email }).companyName
          setCompanyName(name)
          const uName = data?.full_name || data?.name || user.user_metadata?.full_name || user.user_metadata?.name || ''
          if (uName) setUserName(uName)
          const uAvatar = data?.profile_image_url || data?.avatar_url || data?.logo_url || ''
          if (uAvatar) setUserAvatar(uAvatar)
        })
    }

    loadProfile()

    window.addEventListener('ebexta_profile_updated', loadProfile)
    window.addEventListener('ebexta_mode_changed', loadProfile)
    window.addEventListener('storage', loadProfile)
    return () => {
      window.removeEventListener('ebexta_profile_updated', loadProfile)
      window.removeEventListener('ebexta_mode_changed', loadProfile)
      window.removeEventListener('storage', loadProfile)
    }
  }, [user])

  // Mode switch opens the questionnaire — EBEXTA asks the main default questions
  // for the new mode before generating fresh, opposite-side-matched leads.
  function handleToggleMode() {
    const next: 'seeker' | 'provider' = mode === 'seeker' ? 'provider' : 'seeker'
    setSwitchTarget(next)
  }

  function handleSwitchConfirmed() {
    if (!switchTarget) return
    setMode(switchTarget)
    setToast(`Switched to ${switchTarget === 'seeker' ? 'Seeker' : 'Provider'} Mode — scanning…`)
    setTimeout(() => setToast(null), 2500)
  }

  return (
    <>
    {/* Mobile hamburger — opens the drawer (hidden on md+) */}
    <button onClick={() => setOpen(true)}
      className="md:hidden fixed top-3 left-3 z-[60] w-10 h-10 rounded-xl flex items-center justify-center"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
      <span className="material-symbols-outlined text-[22px]" style={{ color: 'var(--text-primary)' }}>menu</span>
    </button>
    {/* Mobile overlay */}
    {open && <div className="md:hidden fixed inset-0 z-[55]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />}

    <aside
      data-tour="sidebar"
      className={`fixed left-0 top-0 h-screen w-[240px] flex flex-col z-[58] transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
      style={{
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      {/* ── Logo ── */}
      <div className="px-5 pt-6 pb-4 cursor-pointer" onClick={() => navigate('/dashboard')}>
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3"
        >
          <EbextaLogo variant="horizontal" size={28} priority />
        </motion.div>
      </div>

      {/* ── Mode toggle ── */}
      <div className="px-3.5 mb-4">
        <motion.button
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
          whileTap={{ scale: 0.97 }}
          onClick={handleToggleMode}
          className="w-full px-3 py-2 rounded-xl text-[11px] font-medium flex items-center gap-2.5 cursor-pointer transition-all"
          style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full shrink-0"
            style={{ background: mode === 'provider' ? '#059669' : '#2563EB' }}
          />
          <span className="text-left leading-tight flex-1">
            <span className="block font-bold text-[11px]">Mode: {mode === 'provider' ? 'Provider' : 'Seeker'}</span>
            <span className="block text-[9.5px]" style={{ color: 'var(--text-muted)' }}>
              {mode === 'provider' ? 'Tap to switch to Seeker' : 'Tap to switch to Provider'}
            </span>
          </span>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded shrink-0" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>switch</span>
        </motion.button>
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 mb-3 h-px" style={{ background: 'var(--border-subtle)' }} />

      {/* ── Navigation ── */}
      <nav className="flex-1 px-3 overflow-y-auto no-scrollbar">
        {navItems.map((item, i) => {
          // '/dashboard' must stay exact (everything nests under it); every
          // other item also lights up on its detail routes, e.g.
          // /dashboard/companies/:id keeps "Companies" highlighted.
          const isActive = item.path === '/dashboard'
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(`${item.path}/`)
          return (
            <motion.button
              key={item.path}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1 + i * 0.03, ease: [0.16, 1, 0.3, 1] }}
              whileTap={{ scale: 0.98 }}
              onClick={() => navigate(item.path)}
              data-tour={item.path === '/dashboard/verified' ? 'nav-verified' : undefined}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl mb-1 relative group/nav transition-all duration-150 cursor-pointer"
              style={{
                background: isActive ? 'var(--bg-elevated)' : 'transparent',
                border: isActive ? '1px solid var(--border-subtle)' : '1px solid transparent',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
              }}
            >
              {/* Hover bg */}
              {!isActive && (
                <div
                  className="absolute inset-0 rounded-xl opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150"
                  style={{ background: 'var(--bg-surface)' }}
                />
              )}

              {/* Icon */}
              <span
                className="material-symbols-outlined text-[19px] relative z-10 transition-all duration-150"
                style={{
                  color: isActive ? 'var(--accent-interactive)' : 'var(--text-muted)',
                  fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                }}
              >
                {item.icon}
              </span>

              {/* Label */}
              <span
                className="text-[13px] relative z-10 transition-colors duration-150"
                style={{
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontFamily: 'Geist, sans-serif',
                }}
              >
                {item.label}
              </span>

              {/* Unread badge (Inbox) */}
              {item.path === '/dashboard/inbox' && unread > 0 && (
                <span className="ml-auto text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center relative z-10"
                  style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>{unread > 9 ? '9+' : unread}</span>
              )}

              {/* Active dot */}
              {isActive && item.path !== '/dashboard/inbox' && (
                <div
                  className="ml-auto w-1.5 h-1.5 rounded-full relative z-10"
                  style={{ background: 'var(--accent-interactive)' }}
                />
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* ── Credit meter ──
          Always visible so the block screen is never a surprise. Renders
          nothing until the credit system is installed. */}
      <div className="px-4 mt-2">
        <CreditMeter />
      </div>

      {/* ── Divider ── */}
      <div className="mx-4 mt-3 mb-3 h-px" style={{ background: 'var(--border-subtle)' }} />

      {/* ── User strip with Account Popover ── */}
      <div className="px-4 pb-5 relative">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowAccountMenu((prev) => !prev)}
            className="flex-1 min-w-0 flex items-center gap-2 px-2.5 py-2 rounded-xl text-left transition-all hover:brightness-110 active:scale-[0.98] cursor-pointer group"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
            }}
            title="Click to view and update your profile or company profile"
          >
            {userAvatar ? (
              <img
                src={userAvatar}
                alt="Avatar"
                className="w-8 h-8 rounded-full object-cover border border-[var(--border-strong)] shrink-0"
              />
            ) : (
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{
                  background: 'var(--accent)',
                  color: 'var(--bg-elevated)',
                }}
              >
                {(userName || companyName || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div
                className="text-[12px] font-bold truncate group-hover:text-[var(--accent-interactive)] transition-colors"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, sans-serif' }}
              >
                {userName || companyName || 'My Account'}
              </div>
              <div
                className="text-[10px] font-bold truncate flex items-center gap-1"
                style={{ color: 'var(--accent-interactive)' }}
              >
                <span className="material-symbols-outlined text-[11px]">verified</span>
                <span>{companyName}</span>
              </div>
            </div>
            <span
              className="material-symbols-outlined text-[18px] text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-transform duration-200"
              style={{ transform: showAccountMenu ? 'rotate(180deg)' : 'rotate(0deg)' }}
            >
              unfold_more
            </span>
          </button>
          <ThemeToggle />
        </div>

        {/* ── Account Popover Drawer ── */}
        <AnimatePresence>
          {showAccountMenu && (
            <>
              {/* Invisible backdrop to dismiss popover on click outside */}
              <div className="fixed inset-0 z-[65]" onClick={() => setShowAccountMenu(false)} />

              <motion.div
                initial={{ opacity: 0, y: 8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.96 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute bottom-16 left-3 right-3 z-[70] p-3 rounded-2xl shadow-2xl space-y-2.5"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-strong)',
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.4)',
                }}
              >
                {/* Account Summary Header */}
                <div className="p-2.5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-2.5">
                  {userAvatar ? (
                    <img
                      src={userAvatar}
                      alt="Avatar"
                      className="w-10 h-10 rounded-full object-cover border border-[var(--border-strong)] shrink-0"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-[14px] bg-[var(--accent)] text-[var(--bg-elevated)] shrink-0">
                      {(userName || companyName || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-bold text-[var(--text-primary)] truncate">
                      {userName || 'Member User'}
                    </div>
                    <div className="text-[10px] text-[var(--text-muted)] truncate">{user?.email || ''}</div>
                    <div className="text-[10px] font-semibold text-[var(--accent-interactive)] flex items-center gap-1 mt-0.5 truncate">
                      <span className="material-symbols-outlined text-[12px]">domain</span>
                      <span className="truncate">{companyName}</span>
                    </div>
                  </div>
                </div>

                {/* Profile & Company Actions */}
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)] px-2 pt-1">
                    My Account Profiles
                  </div>

                  {/* View & Update Personal Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false)
                      navigate('/dashboard/settings#personal-profile')
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium transition-all hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)]">person</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] group-hover:text-[var(--accent-interactive)] transition-colors">
                        Personal Profile
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">Edit photo, name &amp; email</div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform">
                      chevron_right
                    </span>
                  </button>

                  {/* View & Update Company Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false)
                      navigate('/dashboard/settings#company-profile')
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium transition-all hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)]">domain</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] group-hover:text-[var(--accent-interactive)] transition-colors">
                        Company Profile
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">Update mission, funding &amp; scope</div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)] group-hover:translate-x-0.5 transition-transform">
                      chevron_right
                    </span>
                  </button>

                  {/* Preview Live Network Profile */}
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false)
                      setShowPreviewModal(true)
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left font-medium transition-all hover:bg-[var(--accent-subtle)] text-[var(--text-primary)] group cursor-pointer"
                  >
                    <div className="w-7 h-7 rounded-lg bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[16px] text-[var(--accent-interactive)]">visibility</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-bold text-[12px] text-[var(--text-primary)] group-hover:text-[var(--accent-interactive)] transition-colors">
                        Preview Network Profile
                      </div>
                      <div className="text-[10px] text-[var(--text-muted)] truncate">See how members view your company</div>
                    </div>
                    <span className="material-symbols-outlined text-[16px] text-[var(--text-muted)] group-hover:scale-110 transition-transform">
                      open_in_new
                    </span>
                  </button>
                </div>

                <div className="h-px bg-[var(--border-subtle)] my-1" />

                {/* Settings & Sign Out */}
                <div className="space-y-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAccountMenu(false)
                      navigate('/dashboard/settings')
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-[12px] font-medium transition-colors hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px] text-[var(--text-muted)]">settings</span>
                    <span>All Settings</span>
                  </button>

                  <button
                    type="button"
                    onClick={async () => {
                      setShowAccountMenu(false)
                      await supabase.auth.signOut()
                      navigate('/login')
                    }}
                    className="w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-xl text-left text-[12px] font-medium transition-colors hover:bg-[var(--bg-surface)] text-[var(--text-primary)] cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[17px] text-[var(--text-muted)]">logout</span>
                    <span>Sign Out</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>

      {/* Render Company Profile Preview Modal */}
      {showPreviewModal && user && (
        <CompanyProfileModal
          userId={user.id}
          companyName={companyName}
          onClose={() => setShowPreviewModal(false)}
        />
      )}

      {/* ── Toast ── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute bottom-24 left-4 right-4 rounded-xl px-4 py-3 text-[11px] font-bold flex items-center gap-2"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-strong)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)',
            }}
          >
            <span
              className="material-symbols-outlined text-[14px]"
              style={{ color: 'var(--success)', fontVariationSettings: "'FILL' 1" }}
            >
              check_circle
            </span>
            {toast}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mode-switch questionnaire */}
      {switchTarget && (
        <ModeSwitchModal
          newMode={switchTarget}
          onClose={() => setSwitchTarget(null)}
          onConfirmed={handleSwitchConfirmed}
        />
      )}
    </aside>
    </>
  )
}

function ThemeToggle() {
  const [theme, setTheme] = useState<'system' | 'light' | 'dark'>('system')

  useEffect(() => {
    const saved = localStorage.getItem('ebexta_theme') as 'light' | 'dark' | null
    if (saved) {
      setTheme(saved)
      document.documentElement.classList.remove('light', 'dark')
      document.documentElement.classList.add(saved)
    }
  }, [])

  function cycleTheme(e: React.MouseEvent) {
    e.stopPropagation()
    const next = theme === 'system' ? 'dark' : theme === 'dark' ? 'light' : 'system'
    setTheme(next)
    
    document.documentElement.classList.remove('light', 'dark')
    if (next === 'system') {
      localStorage.removeItem('ebexta_theme')
    } else {
      localStorage.setItem('ebexta_theme', next)
      document.documentElement.classList.add(next)
    }
  }

  return (
    <button
      onClick={cycleTheme}
      type="button"
      className="w-8 h-8 rounded-xl flex items-center justify-center transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
      title={`Theme: ${theme}. Click to switch.`}
    >
      <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-secondary)' }}>
        {theme === 'system' ? 'contrast' : theme === 'dark' ? 'dark_mode' : 'light_mode'}
      </span>
    </button>
  )
}
