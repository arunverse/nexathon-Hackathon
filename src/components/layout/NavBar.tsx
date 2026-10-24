import { Link, useLocation } from 'react-router-dom'
import { cn } from '../../lib/utils'
import { NotificationCenter } from '../NotificationCenter'

const navLinks = [
  { label: 'Dashboard', path: '/dashboard' },
  { label: 'Companies', path: '/dashboard/companies' },
  { label: 'Network', path: '/dashboard/stats' },
  { label: 'Signals', path: '/dashboard/signals' },
]

export function NavBar() {
  const location = useLocation()

  return (
    <header className="w-full top-0 sticky z-50 bg-background border-b border-outline-variant">
      <div className="flex justify-between items-center px-6 h-16 w-full max-w-[1280px] mx-auto">
        <div className="flex items-center gap-10">
          <Link to="/">
            <span
              className="text-[36px] font-bold leading-[1.2] tracking-[-0.04em] text-primary"
              style={{ fontFamily: 'Geist, Inter, sans-serif' }}
            >
              EBEXTA
            </span>
          </Link>
          <nav className="hidden md:flex items-center gap-6">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={cn(
                  'text-[16px] transition-colors duration-200',
                  location.pathname === link.path
                    ? 'text-primary border-b-2 border-primary pb-1'
                    : 'text-on-surface-variant hover:text-primary'
                )}
                style={{ fontFamily: 'Geist, Inter, sans-serif' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <NotificationCenter />
          <Link to="/settings" className="text-on-surface-variant hover:text-primary transition-colors">
            <span className="material-symbols-outlined">settings</span>
          </Link>
          <div className="w-8 h-8 rounded-full border border-outline-variant bg-surface-container-high flex items-center justify-center">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">person</span>
          </div>
        </div>
      </div>
    </header>
  )
}
