/**
 * TipBanner — a one-time, dismissible hint shown the first time a user opens a
 * major section. Dismissal is remembered in tips_dismissed (per account) and
 * localStorage (per device) so it never repeats. Never blocks the content.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'

export function TipBanner({ id, userId, icon = 'lightbulb', children }: {
  id: string
  userId?: string
  icon?: string
  children: ReactNode
}) {
  const key = `ebexta_tip_${id}`
  const [show, setShow] = useState(false)

  useEffect(() => {
    let alive = true
    try { if (localStorage.getItem(key) === '1') return } catch { /* ignore */ }
    if (userId) {
      supabase.from('profiles').select('tips_dismissed').eq('id', userId).maybeSingle().then(({ data }) => {
        const arr = Array.isArray(data?.tips_dismissed) ? (data!.tips_dismissed as string[]) : []
        if (alive) setShow(!arr.includes(id))
      })
    } else {
      setShow(true)
    }
    return () => { alive = false }
  }, [key, userId, id])

  if (!show) return null

  async function dismiss() {
    setShow(false)
    try { localStorage.setItem(key, '1') } catch { /* ignore */ }
    if (userId) {
      const { data } = await supabase.from('profiles').select('tips_dismissed').eq('id', userId).maybeSingle()
      const arr = Array.isArray(data?.tips_dismissed) ? (data!.tips_dismissed as string[]) : []
      if (!arr.includes(id)) await supabase.from('profiles').update({ tips_dismissed: [...arr, id] }).eq('id', userId)
    }
  }

  return (
    <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl mb-5"
      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', fontFamily: 'Geist, Inter, sans-serif' }}>
      <span className="material-symbols-outlined text-[18px] shrink-0 mt-0.5" style={{ color: 'var(--accent-interactive)' }}>{icon}</span>
      <p className="flex-1 min-w-0 text-[13px] leading-snug" style={{ color: 'var(--text-secondary)' }}>{children}</p>
      <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 w-6 h-6 rounded-full flex items-center justify-center" style={{ background: 'var(--bg-elevated)' }}>
        <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--text-muted)' }}>close</span>
      </button>
    </div>
  )
}
