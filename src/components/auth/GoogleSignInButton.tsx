import { useEffect, useRef, useState } from 'react'
import { GOOGLE_CLIENT_ID, waitForGoogleScript } from '../../lib/googleAuth'

interface GoogleSignInButtonProps {
  onSuccess: (credential: string) => Promise<void> | void
  onError: (errorMessage: string) => void
  text?: 'continue_with' | 'signin_with' | 'signup_with'
  disabled?: boolean
  className?: string
}

export function GoogleSignInButton({
  onSuccess,
  onError,
  text = 'continue_with',
  disabled = false,
  className = '',
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [loading, setLoading] = useState(false)

  // Use ref to keep latest callback without re-initializing GIS
  const onSuccessRef = useRef(onSuccess)
  onSuccessRef.current = onSuccess
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError

  useEffect(() => {
    let active = true

    async function setupGIS() {
      try {
        await waitForGoogleScript()
        if (!active || !containerRef.current || !window.google?.accounts?.id) return

        // Initialize Google Identity Services
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: async (response) => {
            if (!response.credential) {
              onErrorRef.current('Google authentication did not return a valid credential')
              return
            }
            try {
              setLoading(true)
              await onSuccessRef.current(response.credential)
            } catch (err: unknown) {
              const msg = err instanceof Error ? err.message : 'Google sign in failed'
              onErrorRef.current(msg)
            } finally {
              if (active) setLoading(false)
            }
          },
          auto_select: false,
          cancel_on_tap_outside: true,
        })

        // Clear container and render official button
        containerRef.current.innerHTML = ''
        const containerWidth = containerRef.current.offsetWidth || 372

        window.google.accounts.id.renderButton(containerRef.current, {
          type: 'standard',
          shape: 'rectangular',
          theme: 'outline',
          text,
          size: 'large',
          logo_alignment: 'left',
          width: containerWidth > 400 ? 400 : Math.max(containerWidth, 240),
        })

        setIsLoaded(true)
      } catch (err: unknown) {
        if (!active) return
        const msg = err instanceof Error ? err.message : 'Failed to load Google Sign-In'
        onErrorRef.current(msg)
      }
    }

    setupGIS()

    return () => {
      active = false
    }
  }, [text])

  return (
    <div className={`w-full flex justify-center relative ${className}`}>
      {/* Container where Google's official iframe button is mounted */}
      <div
        ref={containerRef}
        className={`w-full flex justify-center min-h-[48px] ${disabled || loading ? 'pointer-events-none opacity-60' : ''}`}
      />

      {/* Loading / Fallback placeholder before GIS iframe finishes rendering */}
      {!isLoaded && (
        <div className="absolute inset-0 w-full h-12 flex items-center justify-center gap-3 px-4 rounded-lg border border-outline-variant bg-surface text-[14px] font-medium text-on-surface">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
              fill="#4285F4"
            />
            <path
              d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
              fill="#34A853"
            />
            <path
              d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
              fill="#FBBC05"
            />
            <path
              d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
              fill="#EA4335"
            />
          </svg>
          <span className="text-on-surface text-[14px]">Loading Google Sign In…</span>
        </div>
      )}

      {/* Verification in-progress indicator */}
      {loading && (
        <div className="absolute inset-0 bg-surface/80 backdrop-blur-[1px] rounded-lg flex items-center justify-center gap-2 z-20">
          <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          <span className="text-[13px] text-on-surface font-medium">Verifying Google account…</span>
        </div>
      )}
    </div>
  )
}
