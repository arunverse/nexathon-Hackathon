import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { PLANS } from '../lib/plans'
import { PhoneField } from './PhoneField'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+']

/**
 * Company + personal details form for a plan request (new signup or renewal).
 * Submits via the ebexta_request_plan RPC — no payment. The EBEXTA admin is
 * notified and activates the plan after a session.
 */
export function PlanRequestForm({
  plan, kind, onSubmitted, prefill,
}: {
  plan: string
  kind: 'new' | 'renew'
  onSubmitted: () => void
  prefill?: Partial<Record<'company_name' | 'website' | 'contact_name', string>>
}) {
  const [f, setF] = useState({
    company_name: prefill?.company_name ?? '',
    website: prefill?.website ?? '',
    company_size: '',
    industry: '',
    contact_name: prefill?.contact_name ?? '',
    contact_role: '',
    contact_phone: '+91 ',
    message: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))
  const planName = PLANS.find(p => p.key === plan)?.name ?? plan

  const required = f.company_name.trim() && f.contact_name.trim() && f.contact_role.trim()

  async function submit() {
    if (!required || busy) return
    setBusy(true); setErr(null)
    const { error } = await supabase.rpc('ebexta_request_plan', {
      p_plan: plan, p_kind: kind, details: f,
    })
    setBusy(false)
    if (error) {
      setErr(/could not find|schema cache|function/i.test(error.message)
        ? 'Setup needed: run plan_requests.sql in Supabase, then try again.'
        : error.message)
      return
    }
    onSubmitted()
  }

  const field = (label: string, k: keyof typeof f, opts?: { required?: boolean; placeholder?: string; type?: string }) => (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}{opts?.required && <span style={{ color: 'var(--critical)' }}> *</span>}
      </label>
      <input
        type={opts?.type ?? 'text'}
        value={f[k]}
        onChange={e => set(k, e.target.value)}
        placeholder={opts?.placeholder}
        className="h-11 px-3.5 rounded-lg text-[14px] outline-none"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
      />
    </div>
  )

  return (
    <div className="rounded-2xl p-6" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
      <div className="mb-5">
        <h3 className="text-[18px] font-bold" style={geist}>
          {kind === 'renew' ? 'Request a renewal / more credits' : `Request the ${planName} plan`}
        </h3>
        <p className="text-[13px] mt-1" style={{ color: 'var(--text-secondary)' }}>
          Tell us about you and your company. The EBEXTA team will reach out to set up a short session and activate your access.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {field('Company name', 'company_name', { required: true, placeholder: 'Acme Pvt Ltd' })}
        {field('Website', 'website', { placeholder: 'acme.com' })}
        <div className="flex flex-col gap-1.5">
          <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>Company size</label>
          <select value={f.company_size} onChange={e => set('company_size', e.target.value)}
            className="h-11 px-3 rounded-lg text-[14px] outline-none" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}>
            <option value="">Select…</option>
            {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
          </select>
        </div>
        {field('Industry', 'industry', { placeholder: 'B2B SaaS' })}
        {field('Your name', 'contact_name', { required: true, placeholder: 'Full name' })}
        {field('Your role', 'contact_role', { required: true, placeholder: 'e.g. Founder, Head of Sales' })}
        <PhoneField value={f.contact_phone} onChange={v => set('contact_phone', v)} />
      </div>

      <div className="flex flex-col gap-1.5 mt-4">
        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>Anything else? (optional)</label>
        <textarea value={f.message} onChange={e => set('message', e.target.value)} rows={3}
          placeholder="What are you hoping EBEXTA helps you with?"
          className="px-3.5 py-2.5 rounded-lg text-[14px] outline-none resize-none"
          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }} />
      </div>

      {err && <p className="text-[12px] mt-3" style={{ color: 'var(--critical)' }}>{err}</p>}

      <button onClick={submit} disabled={!required || busy}
        className="premium-btn w-full h-12 rounded-lg text-[15px] mt-5 disabled:opacity-50">
        {busy ? 'Submitting…' : 'Submit request'}
      </button>
      <p className="text-[11px] text-center mt-3" style={{ color: 'var(--text-muted)' }}>
        No payment now · Our team activates your plan after a quick session
      </p>
    </div>
  )
}
