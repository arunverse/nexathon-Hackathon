import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { isAuthorizedAdminEmail } from '../lib/adminAuth'
import { PLANS, monthlyPrice, inr, type Plan } from '../lib/plans'
import { PlanRequestForm } from '../components/PlanRequestForm'
import { MailCheck, CheckCircle2, Circle, Check, BadgeCheck, ArrowLeft } from 'lucide-react'
import { EbextaLogo } from '../components/common/EbextaLogo'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }
const EASE = [0.16, 1, 0.3, 1] as [number, number, number, number]

export default function ChoosePlan() {
  const navigate = useNavigate()
  const { user, signOut } = useAuth()
  const [params] = useSearchParams()
  const preset = (params.get('plan') as Plan['key']) || 'growth'
  const [selected, setSelected] = useState<Plan['key']>(PLANS.some(p => p.key === preset) ? preset : 'growth')
  const [stage, setStage] = useState<'pick' | 'form' | 'done' | 'pending'>('pick')
  const [loading, setLoading] = useState(true)

  // If the user already has a pending request, show the pending screen — and
  // keep WATCHING. The moment the admin activates the plan, the user is moved
  // straight to the welcome/congrats page. Without this poll they'd sit on
  // "Request received" until they signed out and back in.
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setInterval> | null = null

    async function check(first: boolean) {
      if (!user) { if (first) setLoading(false); return }
      const { data } = await supabase
        .from('profiles')
        .select('plan_status, plan_expires_at, is_admin, plan, company_name, onboarded')
        .eq('id', user.id)
        .maybeSingle()
      if (!alive) return

      // Authorized admins bypass plan gate immediately
      if (isAuthorizedAdminEmail(user.email) && data?.is_admin === true) {
        if (timer) clearInterval(timer)
        navigate('/admin', { replace: true })
        return
      }

      const status = data?.plan_status ?? 'none'
      const notExpired = !data?.plan_expires_at || new Date(data.plan_expires_at) > new Date()
      if ((status === 'active' || status === 'trial') && notExpired) {
        if (timer) clearInterval(timer)
        const target = data?.onboarded || data?.company_name ? '/dashboard/seeker' : '/welcome'
        navigate(target, { replace: true })
        return
      }
      if (status === 'pending') setStage('pending')
      if (first) setLoading(false)
    }

    void check(true)
    // Poll while the user waits, and re-check instantly when they refocus the tab.
    timer = setInterval(() => void check(false), 10000)
    const onFocus = () => void check(false)
    window.addEventListener('focus', onFocus)

    return () => {
      alive = false
      if (timer) clearInterval(timer)
      window.removeEventListener('focus', onFocus)
    }
  }, [user, navigate])

  const plan = PLANS.find(p => p.key === selected)!

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg-base)' }}>
        <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
      </div>
    )
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)', color: 'var(--text-primary)' }}>
      {/* header */}
      <div className="h-16 flex items-center" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="max-w-[1120px] mx-auto w-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
            <EbextaLogo variant="horizontal" size={28} priority />
          </div>
          <button onClick={() => { signOut(); navigate('/') }} className="ghost-btn text-[13px] font-semibold px-4 h-9 rounded-lg">Sign out</button>
        </div>
      </div>

      <div className="max-w-[1120px] mx-auto px-6 py-12">
        {/* ── Pending / done confirmation ── */}
        {(stage === 'pending' || stage === 'done') && (
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="max-w-[560px] mx-auto text-center rounded-2xl p-10"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="w-16 h-16 rounded-2xl mx-auto mb-5 flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
              <MailCheck className="w-8 h-8" style={{ color: 'var(--accent-interactive)' }} />
            </div>
            <h1 className="text-[26px] font-bold mb-2" style={geist}>Plan Request Submitted</h1>
            <p className="text-[14px] mb-4" style={{ color: 'var(--text-secondary)' }}>
              Thanks! The EBEXTA team will review your account and activate your plan. As soon as admin approves, your full dashboard access will unlock.
            </p>
            <div className="inline-flex items-center gap-2 text-[12px] font-semibold mb-6 px-3 py-1.5 rounded-full"
              style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
              <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: 'var(--accent-interactive)' }} />
              Watching for activation: this page opens automatically
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={async () => {
                  if (!user) return
                  const { data } = await supabase
                    .from('profiles')
                    .select('plan_status, plan_expires_at, onboarded, company_name')
                    .eq('id', user.id)
                    .maybeSingle()
                  const notExpired = !data?.plan_expires_at || new Date(data.plan_expires_at) > new Date()
                  if ((data?.plan_status === 'active' || data?.plan_status === 'trial') && notExpired) {
                    const target = data?.onboarded || data?.company_name ? '/dashboard/seeker' : '/welcome'
                    navigate(target, { replace: true })
                  }
                }}
                className="px-6 h-11 rounded-lg text-[14px] font-semibold flex items-center gap-2"
                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
              >
                <span className="material-symbols-outlined text-[18px]">refresh</span>
                Check Status Now
              </button>
              <button onClick={() => navigate('/')} className="ghost-btn text-[14px] font-semibold px-6 h-11 rounded-lg">Back to home</button>
            </div>
            <p className="text-[11px] mt-4" style={{ color: 'var(--text-muted)' }}>
              Your existing account data, scans, and leads remain safely preserved in our database.
            </p>
          </motion.div>
        )}

        {/* ── Pick a plan ── */}
        {stage === 'pick' && (
          <>
            <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: EASE }} className="text-center mb-10">
              <h1 className="text-[32px] font-bold" style={geist}>Choose your plan</h1>
              <p className="text-[14px] mt-2" style={{ color: 'var(--text-secondary)' }}>
                EBEXTA is activated by our team, one-to-one. Pick a plan, share a few details, and we'll set you up.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-[1280px] mx-auto justify-center mb-10 items-stretch">
              {PLANS.map(p => {
                const price = monthlyPrice(p, 'monthly')
                const isSel = selected === p.key
                return (
                  <button key={p.key} onClick={() => setSelected(p.key)}
                    className={`text-left rounded-2xl flex flex-col relative transition-all ${p.popular ? 'p-7 lg:p-8 z-10 md:scale-[1.02]' : 'p-6 sm:p-7'}`}
                    style={isSel
                      ? { background: p.popular ? 'var(--navy)' : 'var(--bg-elevated)', color: p.popular ? '#F5F3EF' : 'var(--text-primary)', border: '2px solid var(--accent-interactive)', boxShadow: 'var(--shadow-lg)' }
                      : { background: p.popular ? 'var(--navy)' : 'var(--bg-surface)', color: p.popular ? '#F5F3EF' : 'var(--text-primary)', border: p.popular ? '2px solid var(--accent-interactive)' : '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-sm)' }}>
                    {p.popular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 text-[9px] font-extrabold tracking-[0.06em] px-2.5 py-0.5 rounded-full shadow-sm text-white bg-[var(--accent-interactive)] flex items-center gap-1 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[11px] leading-none">rocket_launch</span>
                        <span>LAUNCHING OFFER · MOST POPULAR</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[13px] font-bold tracking-[0.08em] uppercase" style={{ color: p.popular ? 'var(--steel)' : 'var(--text-muted)' }}>{p.name}</p>
                      {isSel ? <CheckCircle2 className="w-5 h-5 shrink-0" style={{ color: p.popular ? 'var(--accent-interactive)' : 'var(--accent)' }} /> : <Circle className="w-5 h-5 shrink-0" style={{ color: p.popular ? 'rgba(255,255,255,0.4)' : 'var(--border-strong)' }} />}
                    </div>
                    <div className="mb-4 min-h-[48px] flex flex-col justify-end">
                      {price == null ? <span className="text-[34px] font-bold" style={geist}>Custom</span> : (
                        <div>
                          {p.originalPriceMonthly && (
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[14px] font-medium line-through opacity-60">{inr(p.originalPriceMonthly)}</span>
                              <span className="text-[11px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider" style={{ background: p.popular ? 'rgba(255,255,255,0.12)' : 'var(--accent-subtle)', color: p.popular ? '#FFFFFF' : 'var(--accent-interactive)' }}>
                                Save {inr(p.originalPriceMonthly - price)}/mo
                              </span>
                            </div>
                          )}
                          <div className="flex items-baseline gap-1.5">
                            <span className="text-[38px] font-extrabold leading-none" style={geist}>{inr(price)}</span>
                            <span className="text-[13px] font-medium" style={{ color: p.popular ? 'var(--steel)' : 'var(--text-muted)' }}>/mo</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <p className="text-[13px] mb-5 leading-relaxed" style={{ color: p.popular ? 'rgba(245,243,239,0.85)' : 'var(--text-secondary)' }}>{p.tagline}</p>
                    <ul className="space-y-2.5 mb-6">
                      {p.features.slice(0, 5).map(feat => (
                        <li key={feat} className="flex items-start gap-2 text-[12.5px] leading-snug" style={{ color: p.popular ? 'rgba(245,243,239,0.95)' : 'var(--text-primary)' }}>
                          <Check className="w-4 h-4 mt-0.5 shrink-0" style={{ color: p.popular ? 'var(--steel)' : 'var(--accent-interactive)' }} />{feat}
                        </li>
                      ))}
                    </ul>
                    {/* Guarantee — on every pricing card, never buried in the FAQ */}
                    <div className="mt-auto pt-4 border-t border-white/10">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-bold" style={{ color: 'var(--success)' }}>
                        <BadgeCheck className="w-3.5 h-3.5" fill="currentColor" stroke="white" />
                        Every verified contact: multi-source cross-checked & verified
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="max-w-[520px] mx-auto text-center">
              <button onClick={() => setStage('form')} className="premium-btn h-12 px-10 rounded-lg text-[15px]">
                Continue with {plan.name} →
              </button>
              <p className="text-center text-[13px] mt-5" style={{ color: 'var(--text-secondary)' }}>
                Not sure yet?{' '}
                <button onClick={() => navigate('/home')} className="font-semibold" style={{ color: 'var(--accent-interactive)' }}>Watch the demo</button>
              </p>
            </div>
          </>
        )}

        {/* ── Details form ── */}
        {stage === 'form' && (
          <div className="max-w-[640px] mx-auto">
            <button onClick={() => setStage('pick')} className="text-[13px] font-semibold mb-4 inline-flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <ArrowLeft className="w-4 h-4" /> Back to plans
            </button>
            <PlanRequestForm
              plan={selected}
              kind="new"
              prefill={{ contact_name: user?.email?.split('@')[0] }}
              onSubmitted={() => setStage('done')}
            />
          </div>
        )}
      </div>
    </div>
  )
}
