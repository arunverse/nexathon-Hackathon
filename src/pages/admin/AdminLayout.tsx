/**
 * EBEXTA Admin Console layout — own left sidebar, ADMIN MODE banner, logout.
 * All /admin/* pages render inside this via <Outlet/>.
 *
 * Protected by AdminRoute, which gates on profiles.is_admin (read via
 * AuthContext.refreshAdmin). The DEV-ONLY open RLS policies from
 * supabase/admin_migration.sql were dropped and replaced with per-user +
 * is_admin()-aware policies in supabase/production_hardening.sql — run that
 * migration if this project hasn't had it applied yet.
 */

import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AdminBanner } from '../../components/auth/AdminRoute'
import { supabase } from '../../lib/supabase'
import { EbextaLogo } from '../../components/common/EbextaLogo'

const ADMIN_NAV = [
  { icon: 'dashboard', label: 'Overview', path: '/admin' },
  { icon: 'work', label: 'Careers / Applications', path: '/admin/careers', badgeKey: 'careers' },
  { icon: 'assignment', label: 'Plan Requests', path: '/admin/requests', badgeKey: 'requests' },
  { icon: 'menu_book', label: 'Dossier Requests', path: '/admin/dossiers', badgeKey: 'dossiers' },
  { icon: 'fact_check', label: 'Verification Queue', path: '/admin/queue' },
  { icon: 'group', label: 'Users', path: '/admin/users' },
  { icon: 'travel_explore', label: 'Leads Monitor', path: '/admin/leads' },
  { icon: 'biotech', label: 'Accuracy Monitor', path: '/admin/accuracy' },
  { icon: 'workspace_premium', label: 'Verified Leads', path: '/admin/verified-leads' },
  { icon: 'monitoring', label: 'API & Cost Tracking', path: '/admin/api' },
  { icon: 'ads_click', label: 'Intents Monitor', path: '/admin/intents' },
  { icon: 'support_agent', label: 'Support Tickets', path: '/admin/support' },
  { icon: 'forum', label: 'Inbox Monitor', path: '/admin/conversations' },
  { icon: 'reviews', label: 'Reviews', path: '/admin/reviews' },
  { icon: 'rule', label: 'Requirement Rules', path: '/admin/rules' },
  { icon: 'receipt_long', label: 'System Logs', path: '/admin/logs' },
]

export default function AdminLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const [pendingReqs, setPendingReqs] = useState(0)
  const [pendingDossiers, setPendingDossiers] = useState(0)
  const [pendingCareers, setPendingCareers] = useState(0)
  const [open, setOpen] = useState(false)   // mobile drawer

  // Close the drawer whenever the route changes.
  useEffect(() => { setOpen(false) }, [location.pathname])

  // Notify the admin of new plan + dossier + career requests awaiting action.
  useEffect(() => {
    let alive = true
    async function count() {
      try {
        const [{ count: pr }, { count: dr }, { count: cr }] = await Promise.all([
          supabase.from('plan_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('dossier_requests').select('*', { count: 'exact', head: true }).in('status', ['pending', 'researching']),
          supabase.from('career_applications').select('*', { count: 'exact', head: true }).eq('application_status', 'New'),
        ])
        if (alive) {
          setPendingReqs(pr ?? 0)
          setPendingDossiers(dr ?? 0)
          setPendingCareers(cr ?? 0)
        }
      } catch {
        // Non-fatal if tables are still deploying
      }
    }
    count()
    const iv = setInterval(count, 30_000)
    return () => { alive = false; clearInterval(iv) }
  }, [location.pathname])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      {/* ADMIN MODE banner — fixed top, includes logout */}
      <AdminBanner />

      {/* Mobile hamburger — opens the admin drawer (hidden on md+) */}
      <button onClick={() => setOpen(true)}
        className="md:hidden fixed top-[45px] left-3 z-[45] w-9 h-9 rounded-lg flex items-center justify-center"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
        <span className="material-symbols-outlined text-[20px]" style={{ color: 'var(--text-primary)' }}>menu</span>
      </button>
      {/* Mobile overlay */}
      {open && <div className="md:hidden fixed inset-0 z-[42]" style={{ background: 'rgba(0,0,0,0.4)' }} onClick={() => setOpen(false)} />}

      {/* Admin sidebar */}
      <aside
        className={`fixed left-0 top-[37px] bottom-0 w-[220px] flex flex-col z-[44] transition-transform duration-300 md:translate-x-0 ${open ? 'translate-x-0' : '-translate-x-full'}`}
        style={{
          background: 'var(--bg-surface)',
          borderRight: '1px solid var(--border-subtle)',
        }}
      >
        <div className="px-5 pt-5 pb-4 cursor-pointer" onClick={() => navigate('/admin')}>
          <div className="flex items-center gap-3">
            <EbextaLogo variant="mark" size={24} priority />
            <div>
              <div
                className="font-bold text-[15px] tracking-tight"
                style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}
              >
                EBEXTA
              </div>
              <div className="text-[9px] font-bold tracking-[0.15em] uppercase" style={{ color: 'var(--warning)' }}>
                Admin Console
              </div>
            </div>
          </div>
        </div>

        <div className="mx-4 mb-3 h-px" style={{ background: 'var(--border-subtle)' }} />

        <nav className="flex-1 px-3 overflow-y-auto no-scrollbar">
          {ADMIN_NAV.map(item => {
            const isActive = location.pathname === item.path
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all text-left"
                style={{
                  background: isActive ? 'rgba(245,158,11,0.1)' : 'transparent',
                  borderLeft: isActive ? '2px solid var(--warning)' : '2px solid transparent',
                }}
              >
                <span
                  className="material-symbols-outlined text-[18px]"
                  style={{
                    color: isActive ? 'var(--warning)' : 'var(--text-muted)',
                    fontVariationSettings: isActive ? "'FILL' 1" : "'FILL' 0",
                  }}
                >
                  {item.icon}
                </span>
                <span
                  className="text-[12.5px] font-medium flex-1"
                  style={{
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    fontFamily: 'Geist, sans-serif',
                  }}
                >
                  {item.label}
                </span>
                {item.badgeKey === 'careers' && pendingCareers > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--accent-interactive)', color: '#fff' }}>{pendingCareers}</span>
                )}
                {item.badgeKey === 'requests' && pendingReqs > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--warning)', color: 'var(--bg-elevated)' }}>{pendingReqs}</span>
                )}
                {item.badgeKey === 'dossiers' && pendingDossiers > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full" style={{ background: 'var(--warning)', color: 'var(--bg-elevated)' }}>{pendingDossiers}</span>
                )}
              </button>
            )
          })}
        </nav>

        <div className="px-5 pb-4">
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-[11.5px] font-medium transition-colors"
            style={{
              color: 'var(--text-muted)',
              border: '1px solid var(--border-subtle)',
              background: 'var(--bg-elevated)',
            }}
          >
            <span className="material-symbols-outlined text-[15px]">arrow_back</span>
            Back to app
          </button>
        </div>
      </aside>

      {/* Content */}
      <main className="ml-0 md:ml-[220px] pt-[60px] pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl w-full overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  )
}
