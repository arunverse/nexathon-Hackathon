/**
 * Settings → Dismissed companies.
 *
 * Dismissal is permanent by design, which makes it dangerous without a way
 * back. This is that way back.
 */

import { useState, useEffect, useCallback } from 'react'
import { fetchDismissedRows, undismissCompany, type DismissedRow } from '../lib/dismissal'

const geist = { fontFamily: 'Geist, Inter, sans-serif' } as const

export function DismissedList() {
  const [rows, setRows] = useState<DismissedRow[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  const load = useCallback(async () => {
    setRows(await fetchDismissedRows())
    setLoading(false)
  }, [])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load() }, [load])

  async function restore(name: string) {
    setBusy(name)
    await undismissCompany(name)
    setBusy(null)
    void load()
  }

  // Hidden entirely until the user has dismissed something — an empty section
  // in Settings is just noise.
  if (loading || rows.length === 0) return null

  return (
    <section className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-[20px]"
          style={{ color: 'var(--text-muted)' }}>do_not_disturb_on</span>
        <h2 className="text-[20px] font-semibold text-on-surface" style={geist}>Dismissed companies</h2>
        <span className="text-[12px]" style={{ color: 'var(--text-muted)' }}>{rows.length}</span>
      </div>
      <p className="text-[13px] mb-5" style={{ color: 'var(--text-muted)' }}>
        These never appear in any scan. Restore one and it becomes eligible again.
      </p>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        {rows.map((r, i) => (
          <div key={r.id} className="flex items-center gap-3 px-3.5 py-2.5"
            style={{
              background: 'var(--bg-elevated)',
              borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
            }}>
            <div className="min-w-0 flex-1">
              <p className="text-[13px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {r.company_name}
              </p>
              <p className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
                {r.reason ?? 'No reason given'} · {new Date(r.dismissed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <button
              onClick={() => restore(r.company_name)}
              disabled={busy === r.company_name}
              className="ghost-btn px-3 py-1.5 rounded-lg text-[12px] font-semibold shrink-0 disabled:opacity-50"
            >
              {busy === r.company_name ? 'Restoring…' : 'Restore'}
            </button>
          </div>
        ))}
      </div>
    </section>
  )
}
