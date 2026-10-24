/**
 * Toasts — small, non-blocking confirmations so no action ever feels silent.
 * Success uses the normal accent; only genuine errors use the critical accent.
 *
 * Usage:  const toast = useToast();  toast('Lead saved');  toast('Failed', 'error')
 */
import { createContext, useCallback, useContext, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

type ToastType = 'success' | 'error' | 'info'
interface ToastItem { id: number; message: string; type: ToastType }

const ToastCtx = createContext<(message: string, type?: ToastType) => void>(() => {})
export function useToast() { return useContext(ToastCtx) }

const ICON: Record<ToastType, string> = { success: 'check_circle', error: 'error', info: 'info' }

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])

  const toast = useCallback((message: string, type: ToastType = 'success') => {
    const id = Date.now() + Math.random()
    setItems(x => [...x, { id, message, type }])
    window.setTimeout(() => setItems(x => x.filter(i => i.id !== id)), 3400)
  }, [])

  const color = (t: ToastType) =>
    t === 'error' ? 'var(--critical, #DC2626)' : t === 'info' ? 'var(--text-secondary)' : 'var(--accent-interactive)'

  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {createPortal(
        <div className="fixed z-[400] bottom-24 right-5 flex flex-col gap-2 pointer-events-none" style={{ maxWidth: 'min(360px, calc(100vw - 40px))' }}>
          {items.map(t => (
            <div key={t.id}
              className="pointer-events-auto flex items-center gap-2.5 px-4 py-3 rounded-xl animate-[toastIn_0.22s_ease]"
              style={{
                background: 'var(--bg-elevated)',
                border: `1px solid ${t.type === 'error' ? 'var(--critical, #DC2626)' : 'var(--border-subtle)'}`,
                boxShadow: 'var(--shadow-lg)',
              }}>
              <span className="material-symbols-outlined text-[19px] shrink-0" style={{ color: color(t.type), fontVariationSettings: "'FILL' 1" }}>
                {ICON[t.type]}
              </span>
              <span className="text-[13px] font-medium leading-snug" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
                {t.message}
              </span>
            </div>
          ))}
          <style>{`@keyframes toastIn{from{opacity:0;transform:translateY(8px) scale(0.98)}to{opacity:1;transform:none}}`}</style>
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  )
}
