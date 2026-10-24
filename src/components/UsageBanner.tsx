/**
 * Usage notification banner — shows the user how many of their plan's credits
 * they've used this billing period, warns as they approach the limit, and turns
 * into a hard "recharge" prompt when they hit it. The real enforcement is
 * server-side in the gemini Edge Function; this is the friendly heads-up.
 */
import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { currentPeriodStart } from '../lib/billingPeriod'

export function UsageBanner() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [used, setUsed] = useState<number | null>(null)
  const [limit, setLimit] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!user) return
    const { data: prof } = await supabase
      .from('profiles').select('credit_limit, credits_reset_at').eq('id', user.id).maybeSingle()
    const lim = (prof?.credit_limit ?? null) as number | null
    // Count usage in the current monthly period (resets on the plan anniversary).
    const since = currentPeriodStart((prof?.credits_reset_at as string | null) ?? null)
    const { count } = await supabase
      .from('api_usage').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).gte('created_at', since.toISOString())
    setLimit(lim); setUsed(count ?? 0)
  }, [user])

  useEffect(() => {
    if (!user) return
    void load()
    // Keep the figure fresh so an admin changing the limit shows up here without
    // a manual reload: refetch on tab focus, on visibility change, and every 30s.
    const onFocus = () => void load()
    const onVis = () => { if (document.visibilityState === 'visible') void load() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    const iv = setInterval(() => void load(), 30_000)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
      clearInterval(iv)
    }
  }, [user, load])

  if (limit == null || used == null) return null
  const pct = Math.min(100, Math.round((used / Math.max(1, limit)) * 100))
  if (pct < 60) return null // don't nag below 60%

  const over = used >= limit
  const remaining = Math.max(0, limit - used)
  const tone = over
    ? { bg: 'rgba(220,38,38,0.06)', border: 'rgba(220,38,38,0.3)', color: '#DC2626', icon: 'block' }
    : { bg: 'rgba(245,158,11,0.06)', border: 'rgba(245,158,11,0.3)', color: 'var(--warning)', icon: 'warning' }

  return (
    <div className="mb-5 px-4 py-3 rounded-xl flex items-center gap-3"
      style={{ background: tone.bg, border: `1px solid ${tone.border}` }}>
      <span className="material-symbols-outlined text-[20px]" style={{ color: tone.color }}>{tone.icon}</span>
      <div className="flex-1">
        <p className="text-[13px] font-semibold" style={{ color: tone.color }}>
          {over
            ? `You've used all ${limit} of your plan's credits this period.`
            : `Heads up: ${used} of ${limit} credits used (${pct}%). ${remaining} left this period.`}
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
          {over
            ? 'New scans and AI actions are paused until you upgrade or top up.'
            : 'A full scan uses several credits: top up or upgrade before you run out.'}
        </p>
      </div>
      <button
        onClick={() => navigate('/dashboard/renew')}
        className="px-4 py-2 rounded-lg text-[12px] font-bold shrink-0"
        style={{ background: tone.color, color: '#fff' }}
      >
        {over ? 'Recharge / Upgrade' : 'Top up'}
      </button>
    </div>
  )
}
