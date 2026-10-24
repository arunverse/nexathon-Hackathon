/**
 * /dashboard/saved — leads the user bookmarked, keyed to their email account
 * (auth.uid). Snapshots persist even after the scan cache clears, on any device.
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { LeadCard } from '../../components/LeadCard'
import { fetchSavedLeads, toggleSaveLead, getSavedLeadIds, type SavedLeadRow } from '../../lib/savedLeads'

export default function SavedLeads() {
  const navigate = useNavigate()
  const [rows, setRows] = useState<SavedLeadRow[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    await getSavedLeadIds(true)   // refresh the shared cache
    const data = await fetchSavedLeads()
    setRows(data)
    setLoading(false)
  }, [])

  // Fetch-on-mount; setState happens after await inside load (no sync cascade)
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load() }, [load])

  async function handleUnsave(row: SavedLeadRow) {
    await toggleSaveLead(row.lead_snapshot)
    setRows(prev => prev.filter(r => r.id !== row.id))
  }

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg-base)' }}>
      <Sidebar />

      <main className="flex-1 ml-0 md:ml-[240px] p-4 md:p-8 pt-16 md:pt-8 min-w-0">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-7"
        >
          <div className="flex items-center gap-3 mb-1">
            <span className="material-symbols-outlined text-[22px]"
              style={{ color: 'var(--accent)', fontVariationSettings: "'FILL' 1" }}>
              bookmark
            </span>
            <h1 className="text-[26px] font-bold tracking-[-0.03em]"
              style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
              Saved Leads
            </h1>
            {rows.length > 0 && (
              <span className="text-[13px] font-mono" style={{ color: 'var(--text-muted)' }}>{rows.length}</span>
            )}
          </div>
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Saved to your account: available whenever you log in with this email, on any device.
          </p>
        </motion.div>

        {loading ? (
          <div className="flex flex-col items-center gap-4 mt-20">
            <div className="w-9 h-9 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
            <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading saved leads…</p>
          </div>
        ) : rows.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center text-center py-24 px-8"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
              <span className="material-symbols-outlined text-[30px]" style={{ color: 'var(--accent)' }}>bookmark_border</span>
            </div>
            <p className="text-[18px] font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
              No saved leads yet
            </p>
            <p className="text-[13px] max-w-sm leading-relaxed mb-5" style={{ color: 'var(--text-muted)' }}>
              Leads you save appear here, safe and tied to your account. Tap the bookmark icon on any lead card.
            </p>
            <button onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-[14px] font-bold"
              style={{ background: 'var(--accent)', color: 'var(--bg-elevated)' }}>
              <span className="material-symbols-outlined text-[18px]">hub</span>
              Browse Leads
            </button>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 max-w-6xl">
            {rows.map((row, i) => (
              <div key={row.id} className="relative">
                <LeadCard lead={row.lead_snapshot} index={i} />
                {/* Unsave overlay button */}
                <button
                  onClick={e => { e.stopPropagation(); handleUnsave(row) }}
                  title="Remove from Saved"
                  className="absolute top-3 right-3 z-20 px-2.5 py-1 rounded-lg text-[10px] font-bold flex items-center gap-1 transition-all"
                  style={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    color: 'var(--text-muted)',
                    boxShadow: 'var(--shadow-md)',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.color = '#DC2626'; e.currentTarget.style.borderColor = 'rgba(220,38,38,0.3)' }}
                  onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border-subtle)' }}
                >
                  <span className="material-symbols-outlined text-[13px]">bookmark_remove</span>
                  Unsave
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
