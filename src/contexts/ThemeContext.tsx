import { useEffect, type ReactNode } from 'react'

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    try {
      const saved = localStorage.getItem('ebexta_theme') as 'light' | 'dark' | null
      if (saved === 'dark') {
        document.documentElement.classList.add('dark')
        document.documentElement.classList.remove('light')
      } else if (saved === 'light') {
        document.documentElement.classList.add('light')
        document.documentElement.classList.remove('dark')
      }
    } catch { /* noop */ }
  }, [])

  return children
}
