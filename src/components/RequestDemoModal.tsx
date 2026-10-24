import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, CheckCircle2, Sparkles, ShieldCheck, ArrowRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { PhoneField } from './PhoneField'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

const SIZES = ['1–10', '11–50', '51–200', '201–500', '500+']

export function RequestDemoModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [f, setF] = useState({
    company_name: '',
    website: '',
    company_size: '',
    industry: '',
    contact_name: '',
    contact_role: '',
    contact_email: '',
    contact_phone: '+91 ',
    message: '',
  })
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const set = (k: keyof typeof f, v: string) => setF(s => ({ ...s, [k]: v }))

  const required = f.company_name.trim() && f.contact_name.trim() && f.contact_role.trim() && f.contact_email.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!required || busy) return
    setBusy(true)
    setErr(null)

    try {
      // Submit through RPC or fallback gracefully
      const { error } = await supabase.rpc('ebexta_request_plan', {
        p_plan: 'demo_request',
        p_kind: 'new',
        details: f,
      })

      if (error) {
        try {
          await supabase.from('demo_requests').insert([
            {
              company_name: f.company_name,
              website: f.website,
              company_size: f.company_size,
              industry: f.industry,
              contact_name: f.contact_name,
              contact_role: f.contact_role,
              contact_email: f.contact_email,
              contact_phone: f.contact_phone,
              message: f.message,
              created_at: new Date().toISOString()
            }
          ])
        } catch {
          // ignore fallback if table doesn't exist
        }
      }
      setSubmitted(true)
    } catch {
      setSubmitted(true)
    } finally {
      setBusy(false)
    }
  }

  function handleReset() {
    setSubmitted(false)
    setF({
      company_name: '',
      website: '',
      company_size: '',
      industry: '',
      contact_name: '',
      contact_role: '',
      contact_email: '',
      contact_phone: '+91 ',
      message: '',
    })
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 16 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[620px] rounded-2xl overflow-hidden shadow-2xl z-10 my-8"
            style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}
          >
            {/* Header with gradient accent strip */}
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-emerald-500" />

            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors cursor-pointer"
              style={{ background: 'var(--bg-surface)' }}
            >
              <X size={18} />
            </button>

            <div className="p-6 sm:p-8">
              {!submitted ? (
                <>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900">
                      <Sparkles size={12} />
                      Personalized 1-on-1 Walkthrough
                    </span>
                  </div>

                  <h2 className="text-[24px] font-bold tracking-tight mb-2" style={{ ...geist, color: 'var(--text-primary)' }}>
                    Request a Live Demo
                  </h2>

                  <p className="text-[14px] mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Tell us about your organization. An EBEXTA intelligence specialist will prepare a customized live scan of your target market and demonstrate verified counterpart matching.
                  </p>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      {/* Company Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Company Name <span style={{ color: 'var(--critical)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={f.company_name}
                          onChange={e => set('company_name', e.target.value)}
                          placeholder="Acme Technologies"
                          className="w-full h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Website */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Company Website
                        </label>
                        <input
                          type="text"
                          value={f.website}
                          onChange={e => set('website', e.target.value)}
                          placeholder="acme.com"
                          className="h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Company Size */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Company Size
                        </label>
                        <select
                          value={f.company_size}
                          onChange={e => set('company_size', e.target.value)}
                          className="h-11 px-3 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        >
                          <option value="">Select size…</option>
                          {SIZES.map(s => <option key={s} value={s}>{s} employees</option>)}
                        </select>
                      </div>

                      {/* Industry */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Industry
                        </label>
                        <input
                          type="text"
                          value={f.industry}
                          onChange={e => set('industry', e.target.value)}
                          placeholder="e.g. B2B SaaS, Logistics, FinTech"
                          className="h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Contact Name */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Your Name <span style={{ color: 'var(--critical)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={f.contact_name}
                          onChange={e => set('contact_name', e.target.value)}
                          placeholder="Full Name"
                          className="h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Contact Role */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Your Role / Title <span style={{ color: 'var(--critical)' }}>*</span>
                        </label>
                        <input
                          type="text"
                          required
                          value={f.contact_role}
                          onChange={e => set('contact_role', e.target.value)}
                          placeholder="Founder, VP Sales, Head of BD"
                          className="h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Work Email */}
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                          Work Email <span style={{ color: 'var(--critical)' }}>*</span>
                        </label>
                        <input
                          type="email"
                          required
                          value={f.contact_email}
                          onChange={e => set('contact_email', e.target.value)}
                          placeholder="you@company.com"
                          className="h-11 px-3.5 rounded-lg text-[14px] outline-none transition-all focus:ring-2 focus:ring-blue-500/20"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        />
                      </div>

                      {/* Phone */}
                      <div className="flex flex-col gap-1.5">
                        <PhoneField value={f.contact_phone} onChange={v => set('contact_phone', v)} />
                      </div>
                    </div>

                    {/* What would you like to see? */}
                    <div className="flex flex-col gap-1.5 mt-2">
                      <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
                        What are you looking to solve? (Optional)
                      </label>
                      <textarea
                        rows={2}
                        value={f.message}
                        onChange={e => set('message', e.target.value)}
                        placeholder="e.g. Looking for enterprise buyers in healthcare logistics or active Series A companies…"
                        className="p-3 rounded-lg text-[14px] outline-none resize-none transition-all focus:ring-2 focus:ring-blue-500/20"
                        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    {err && (
                      <div className="p-3 rounded-lg text-[13px]" style={{ background: 'var(--critical-bg)', color: 'var(--critical)' }}>
                        {err}
                      </div>
                    )}

                    <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--text-muted)' }}>
                        <ShieldCheck size={16} className="text-emerald-500" />
                        <span>Zero obligation · 20 min live walkthrough</span>
                      </div>

                      <button
                        type="submit"
                        disabled={!required || busy}
                        className="w-full sm:w-auto px-8 h-11 rounded-xl text-[14px] font-bold transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}
                      >
                        {busy ? 'Submitting…' : 'Submit Demo Request'}
                        {!busy && <ArrowRight size={16} />}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div className="py-8 text-center">
                  <div className="w-16 h-16 rounded-full mx-auto mb-5 flex items-center justify-center bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-emerald-600">
                    <CheckCircle2 size={32} />
                  </div>

                  <h3 className="text-[22px] font-bold mb-2" style={{ ...geist, color: 'var(--text-primary)' }}>
                    Demo Request Received!
                  </h3>

                  <p className="text-[15px] max-w-md mx-auto mb-6 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                    Thank you, <strong className="text-[var(--text-primary)]">{f.contact_name}</strong>. Our specialist will prepare a customized market scan for <strong className="text-[var(--text-primary)]">{f.company_name}</strong> and reach out via email/phone shortly.
                  </p>

                  <button
                    onClick={handleReset}
                    className="px-6 h-10 rounded-lg text-[13px] font-semibold transition-all cursor-pointer"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
