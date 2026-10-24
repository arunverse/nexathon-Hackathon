import { useState } from 'react'
import { Button } from '../ui/Button'
import { ProfileMenu } from './ProfileMenu'
import { NotificationCenter } from '../NotificationCenter'

interface TopBarProps {
  title: string
  scanLabel?: string
  scanValue?: string
  actions?: React.ReactNode
}

export function TopBar({ title, scanLabel = 'Active Scan:', scanValue = 'Quantum-Matched 1,402', actions }: TopBarProps) {
  const [spinning, setSpinning] = useState(false)

  function handleRefresh() {
    setSpinning(true)
    setTimeout(() => setSpinning(false), 1000)
  }

  return (
    <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 bg-surface border-b border-outline-variant flex justify-between items-center px-6 z-40">
      <div className="flex items-center gap-10">
        <h2
          className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface"
          style={{ fontFamily: 'Geist, Inter, sans-serif' }}
        >
          {title}
        </h2>
        <div className="flex items-center gap-4 bg-surface-container-lowest px-4 py-1 border border-outline-variant rounded-full">
          <span className="text-[11px] font-bold leading-[1.2] tracking-[0.06em] text-on-surface-variant uppercase">
            {scanLabel}
          </span>
          <span
            className="text-[13px] font-medium text-primary"
            style={{ fontFamily: 'JetBrains Mono, monospace' }}
          >
            {scanValue}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {actions ?? (
          <>
            <Button variant="surface" icon="download">Export CSV</Button>
            <Button
              variant="primary"
              onClick={handleRefresh}
              icon="refresh"
              className={spinning ? '[&_.material-symbols-outlined]:animate-spin' : ''}
            >
              Refresh Scan
            </Button>
          </>
        )}
        <div className="h-6 w-px bg-outline-variant mx-2" />
        <div className="flex items-center gap-2">
          <NotificationCenter />
          {/* Profile button — dropdown with Settings + Admin Login */}
          <ProfileMenu />
        </div>
      </div>
    </header>
  )
}
