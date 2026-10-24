/**
 * /admin/reviews — every review users have left, newest first.
 * Shows the average rating, star distribution, and lets the admin hide /
 * un-hide a review. Backed by public.reviews (see supabase/reviews.sql).
 */
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card } from './shared'
import { timeAgoLabel } from './adminUtils'
import { logAdminAction } from '../../lib/adminLog'
import type { Review } from '../../lib/reviews'

function Stars({ n, size = 15 }: { n: number; size?: number }) {
  return (
    <span className="inline-flex items-center">
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className="material-symbols-outlined" style={{
          fontSize: size,
          color: i <= n ? 'var(--warning)' : 'var(--border-strong)',
          fontVariationSettings: i <= n ? "'FILL' 1" : "'FILL' 0",
        }}>star</span>
      ))}
    </span>
  )
}

export default function AdminReviews() {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load() {
    const { data, error } = await supabase
      .from('reviews').select('*').order('created_at', { ascending: false }).limit(500)
    if (error) setLoadError(`${error.message} — did you run supabase/reviews.sql?`)
    setReviews((data ?? []) as Review[])
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const stats = useMemo(() => {
    const shown = reviews.filter(r => r.status !== 'hidden')
    const avg = shown.length ? shown.reduce((s, r) => s + r.rating, 0) / shown.length : 0
    const dist = [5, 4, 3, 2, 1].map(star => ({ star, count: shown.filter(r => r.rating === star).length }))
    return { avg, total: shown.length, dist }
  }, [reviews])

  async function toggleHidden(r: Review) {
    setBusyId(r.id)
    const next = r.status === 'hidden' ? 'published' : 'hidden'
    const { error } = await supabase.from('reviews').update({ status: next }).eq('id', r.id)
    if (!error) {
      setReviews(rs => rs.map(x => x.id === r.id ? { ...x, status: next } : x))
      void logAdminAction(next === 'hidden' ? 'Hid review' : 'Un-hid review', { targetType: 'review', targetId: r.id })
    }
    setBusyId(null)
  }

  if (loading) return <Loading label="Loading reviews…" />

  return (
    <div>
      <PageHeader icon="reviews" title="Reviews"
        subtitle={`${reviews.length} review${reviews.length !== 1 ? 's' : ''} from users.`} />

      {loadError && (
        <div className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}>
          {loadError}
        </div>
      )}

      {/* Summary */}
      {reviews.length > 0 && (
        <div className="grid sm:grid-cols-[200px_1fr] gap-4 mb-6">
          <Card>
            <div className="p-4 text-center">
              <div className="text-[40px] font-bold leading-none" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, sans-serif' }}>
                {stats.avg.toFixed(1)}
              </div>
              <div className="mt-1.5"><Stars n={Math.round(stats.avg)} size={18} /></div>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--text-muted)' }}>{stats.total} published</p>
            </div>
          </Card>
          <Card>
            <div className="p-4 space-y-1.5">
              {stats.dist.map(d => {
                const pct = stats.total ? (d.count / stats.total) * 100 : 0
                return (
                  <div key={d.star} className="flex items-center gap-2.5">
                    <span className="text-[11px] w-8 shrink-0" style={{ color: 'var(--text-muted)' }}>{d.star}★</span>
                    <div className="flex-1 h-2 rounded-full" style={{ background: 'var(--border-subtle)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, background: 'var(--warning)' }} />
                    </div>
                    <span className="text-[11px] w-6 text-right shrink-0" style={{ color: 'var(--text-muted)' }}>{d.count}</span>
                  </div>
                )
              })}
            </div>
          </Card>
        </div>
      )}

      {/* List */}
      {reviews.length === 0 ? (
        <Card><EmptyState title="No reviews yet" hint="They'll appear here once users start rating EBEXTA." /></Card>
      ) : (
        <div className="space-y-3">
          {reviews.map(r => {
            const hidden = r.status === 'hidden'
            return (
              <Card key={r.id}>
                <div className="p-4" style={{ opacity: hidden ? 0.55 : 1 }}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Stars n={r.rating} />
                        {r.title && <span className="text-[13.5px] font-bold break-words" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, sans-serif' }}>{r.title}</span>}
                        {hidden && <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'rgba(220,38,38,0.12)', color: '#DC2626' }}>Hidden</span>}
                      </div>
                      {r.body && <p className="text-[13px] mt-1.5 break-words" style={{ color: 'var(--text-secondary)' }}>{r.body}</p>}
                      <p className="text-[11px] mt-2" style={{ color: 'var(--text-muted)' }}>
                        {r.display_name || 'Anonymous'}{r.company ? ` · ${r.company}` : ''} · {timeAgoLabel(r.created_at)}
                      </p>
                    </div>
                    <button onClick={() => toggleHidden(r)} disabled={busyId === r.id}
                      className="shrink-0 flex items-center gap-1.5 text-[11.5px] font-semibold px-3 py-1.5 rounded-xl transition-all"
                      style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined text-[15px]">{hidden ? 'visibility' : 'visibility_off'}</span>
                      {hidden ? 'Show' : 'Hide'}
                    </button>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
