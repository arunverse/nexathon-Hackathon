/**
 * ReviewModal — let a user rate their EBEXTA experience (1–5 stars) and leave
 * a short note. One review per user; reopening shows their existing review so
 * they can edit it. Everything lands in public.reviews and shows up in the
 * admin console.
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchMyReview, submitReview } from '../lib/reviews'

export function ReviewModal({ userId, defaultName, defaultCompany, onClose }: {
  userId: string
  defaultName?: string
  defaultCompany?: string
  onClose: () => void
}) {
  const [rating, setRating] = useState(0)
  const [hover, setHover] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [name, setName] = useState(defaultName ?? '')
  const [company, setCompany] = useState(defaultCompany ?? '')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)

  // Prefill from an existing review, if any.
  useEffect(() => {
    let alive = true
    fetchMyReview(userId).then(r => {
      if (!alive) return
      if (r) {
        setRating(r.rating); setTitle(r.title ?? ''); setBody(r.body ?? '')
        if (r.display_name) setName(r.display_name)
        if (r.company) setCompany(r.company)
      }
      setLoaded(true)
    })
    return () => { alive = false }
  }, [userId])

  async function save() {
    if (rating < 1) { setErr('Please pick a star rating.'); return }
    setBusy(true); setErr(null)
    const { error } = await submitReview({ userId, rating, title, body, displayName: name, company })
    setBusy(false)
    if (error) { setErr(error.includes('reviews') || error.includes('relation') ? 'Reviews aren’t set up yet: run supabase/reviews.sql.' : error); return }
    setDone(true)
    setTimeout(onClose, 1100)
  }

  const label = ['', 'Poor', 'Fair', 'Good', 'Great', 'Excellent'][hover || rating] || ''
  const inputStyle = { background: 'var(--bg-base)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' } as const

  return createPortal(
    <div className="fixed inset-0 z-[320] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="w-full max-w-[460px] rounded-2xl p-6"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-lg)' }}>

        {done ? (
          <div className="py-8 text-center">
            <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ background: 'var(--accent-subtle)' }}>
              <span className="material-symbols-outlined text-[28px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>favorite</span>
            </div>
            <p className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Thank you!</p>
            <p className="text-[13px] mt-1" style={{ color: 'var(--text-muted)' }}>Your review helps us make EBEXTA better.</p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Rate your experience</h2>
              <button onClick={onClose} className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'var(--border-subtle)' }}>
                <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>close</span>
              </button>
            </div>
            <p className="text-[12px] mb-4" style={{ color: 'var(--text-muted)' }}>How has EBEXTA been for you? Your feedback goes straight to our team.</p>

            {/* Stars */}
            <div className="flex items-center gap-1.5 mb-1">
              {[1, 2, 3, 4, 5].map(n => {
                const active = n <= (hover || rating)
                return (
                  <button key={n} type="button"
                    onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)}
                    onClick={() => setRating(n)}
                    className="transition-transform" style={{ transform: active ? 'scale(1.05)' : 'scale(1)' }}>
                    <span className="material-symbols-outlined text-[32px]"
                      style={{ color: active ? 'var(--warning)' : 'var(--border-strong)', fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                  </button>
                )
              })}
              {label && <span className="text-[13px] font-semibold ml-2" style={{ color: 'var(--warning)' }}>{label}</span>}
            </div>
            <div className="h-4" />

            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={80}
              placeholder="Sum it up (optional)"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] font-semibold outline-none mb-2.5" style={inputStyle} />
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={4} maxLength={800}
              placeholder="What worked well? What could be better?"
              className="w-full px-3 py-2.5 rounded-xl text-[13px] outline-none resize-none mb-2.5" style={inputStyle} />

            <div className="flex gap-2.5 mb-4">
              <input value={name} onChange={e => setName(e.target.value)} maxLength={60}
                placeholder="Your name (optional)"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
              <input value={company} onChange={e => setCompany(e.target.value)} maxLength={60}
                placeholder="Company (optional)"
                className="flex-1 min-w-0 px-3 py-2.5 rounded-xl text-[13px] outline-none" style={inputStyle} />
            </div>

            {err && <p className="text-[12px] font-medium mb-3" style={{ color: 'var(--critical, #DC2626)' }}>{err}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2.5 rounded-xl text-[13px] font-semibold"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>Cancel</button>
              <button onClick={save} disabled={busy || !loaded}
                className="px-5 py-2.5 rounded-xl text-[13px] font-bold flex items-center gap-2"
                style={{ background: 'var(--accent)', color: 'var(--bg-elevated)', opacity: busy || !loaded ? 0.6 : 1 }}>
                <span className="material-symbols-outlined text-[16px]">{busy ? 'hourglass_empty' : 'send'}</span>
                {busy ? 'Saving…' : 'Submit review'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
