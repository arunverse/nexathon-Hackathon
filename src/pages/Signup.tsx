import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { EbextaLogo } from '../components/common/EbextaLogo'
import { GoogleSignInButton } from '../components/auth/GoogleSignInButton'

export default function Signup() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const planQ = params.get('plan')
  const nextChoosePlan = `/choose-plan${planQ ? `?plan=${encodeURIComponent(planQ)}` : ''}`
  const { signUpWithEmail, signInWithGoogleCredential } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    // Explicit, recorded consent — required before an account can be created.
    if (!consent) { setError('Please agree to the Terms of Service and Privacy Policy to continue.'); return }
    setLoading(true)
    try {
      await signUpWithEmail(email, password)
      navigate(nextChoosePlan)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  async function handleGoogleSuccess(credential: string) {
    setError('')
    if (!consent) {
      setError('Please agree to the Terms of Service and Privacy Policy to continue.')
      return
    }
    try {
      const result = await signInWithGoogleCredential(credential, { plan: planQ || 'starter' })
      if (result?.isNewUser) {
        navigate(nextChoosePlan)
      } else {
        navigate('/dashboard')
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Google sign in failed')
    }
  }

  return (
    <div className="min-h-screen bg-surface-container-lowest flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 flex-col justify-between p-12 lg:p-16 bg-surface border-r border-outline-variant relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-secondary/5 blur-[80px] rounded-full pointer-events-none" />
        
        {/* Top Brand Logo */}
        <div className="relative z-10">
          <EbextaLogo variant="horizontal" size={44} priority />
        </div>

        {/* Core Value Proposition & Highlights */}
        <div className="relative z-10 my-auto py-10 max-w-lg">
          <h1 className="text-[34px] lg:text-[40px] font-extrabold text-on-surface leading-[1.2] tracking-tight mb-5" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
            More leads don't mean more opportunities.
          </h1>

          <p className="text-[16px] lg:text-[17px] text-on-surface-variant leading-relaxed mb-8">
            The advantage comes from knowing which companies matter, why they matter, and when.
          </p>

          {/* Action Pillars */}
          <div className="flex items-center gap-2.5 flex-wrap mb-10">
            {['Discover', 'Understand', 'Connect'].map((step, idx) => (
              <div key={step} className="flex items-center gap-2.5">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-surface-container border border-outline-variant/60 shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  <span className="text-[13px] font-bold text-on-surface">{step}</span>
                </div>
                {idx < 2 && <span className="text-on-surface-variant/40 text-[14px] font-bold">·</span>}
              </div>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-primary/10 text-primary text-[13px] font-bold tracking-[0.04em]">
            <span className="material-symbols-outlined text-[16px]">verified</span>
            <span>EBEXTA — Built for Business.</span>
          </div>
        </div>

        {/* Footer */}
        <div className="relative z-10 flex items-center justify-between text-[11px] text-on-surface-variant opacity-60">
          <span>© 2026 EBEXTA Intelligence Network</span>
          <span>Verified &amp; Encrypted</span>
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[420px]">
          {/* Mobile brand header */}
          <div className="lg:hidden mb-6">
            <EbextaLogo variant="horizontal" size={32} priority />
          </div>
          <div className="mb-8">
            <h1 className="text-[28px] font-bold text-on-surface tracking-tight">Create your EBEXTA account</h1>
            <p className="text-on-surface-variant text-[14px] mt-1">Discover verified B2B matches</p>
          </div>

          {error && (
            <div className="mb-5 px-4 py-3 rounded-lg bg-error-container border border-error/30 text-on-error-container text-[13px]">
              {error}
            </div>
          )}

          <div className="mb-5">
            <GoogleSignInButton
              text="continue_with"
              onSuccess={handleGoogleSuccess}
              onError={(msg) => setError(msg)}
              disabled={loading}
            />
          </div>

          <div className="flex items-center gap-4 mb-5">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-[11px] text-on-surface-variant">or</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <form onSubmit={handleSignup} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@company.com" autoComplete="email"
                className="h-12 px-4 rounded-lg bg-surface border border-outline-variant text-on-surface text-[14px] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required placeholder="Min. 8 characters" autoComplete="new-password"
                className="h-12 px-4 rounded-lg bg-surface border border-outline-variant text-on-surface text-[14px] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required placeholder="Re-enter password" autoComplete="new-password"
                className="h-12 px-4 rounded-lg bg-surface border border-outline-variant text-on-surface text-[14px] placeholder:text-on-surface-variant/40 focus:outline-none focus:border-primary transition-colors" />
            </div>
            {/* Explicit consent — required, must be actively ticked */}
            <label className="flex items-start gap-2.5 mt-1 cursor-pointer select-none">
              <input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)}
                className="mt-0.5 w-4 h-4 shrink-0 accent-[color:var(--accent,#1D2636)] cursor-pointer" />
              <span className="text-[12px] text-on-surface-variant leading-snug">
                I agree to EBEXTA's{' '}
                <Link to="/terms" target="_blank" className="text-primary hover:underline font-medium">Terms of Service</Link>{', '}
                <Link to="/privacy" target="_blank" className="text-primary hover:underline font-medium">Privacy Policy</Link>{', and '}
                <Link to="/refund" target="_blank" className="text-primary hover:underline font-medium">Refund Policy</Link>.
              </span>
            </label>
            <button type="submit" disabled={loading || !consent}
              className="h-12 rounded-lg bg-primary text-on-primary font-semibold text-[14px] hover:bg-primary/90 transition-colors disabled:opacity-50 mt-1">
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-[13px] text-on-surface-variant mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
