/**
 * /admin/logs — full system_logs table, newest first.
 * Filter by event_type, free-text search, errors highlighted.
 */

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, Th, Td, Pill } from './shared'
import { timeAgoLabel } from './adminUtils'

interface SystemLog {
  id: string
  user_id: string | null
  event_type: string | null
  message: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const EVENT_TYPES = ['all', 'scan', 'error', 'login', 'verification', 'export'] as const
type EventFilter = typeof EVENT_TYPES[number]

const EVENT_TONE: Record<string, 'green' | 'amber' | 'red' | 'indigo' | 'neutral'> = {
  scan: 'indigo',
  error: 'red',
  login: 'amber',
  verification: 'green',
  export: 'neutral',
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [filter, setFilter] = useState<EventFilter>('all')
  const [search, setSearch] = useState('')

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500)
      if (error) setLoadError(`${error.message} — did you run supabase/admin_migration.sql?`)
      setLogs((data ?? []) as SystemLog[])
      setLoading(false)
    }
    load()
  }, [])

  const filtered = useMemo(() => {
    let out = logs
    if (filter !== 'all') out = out.filter(l => l.event_type === filter)
    const q = search.trim().toLowerCase()
    if (q) {
      out = out.filter(l =>
        (l.message ?? '').toLowerCase().includes(q) ||
        (l.event_type ?? '').toLowerCase().includes(q) ||
        JSON.stringify(l.metadata ?? {}).toLowerCase().includes(q)
      )
    }
    return out
  }, [logs, filter, search])

  if (loading) return <Loading label="Loading system logs…" />

  return (
    <div>
      <PageHeader
        icon="receipt_long"
        title="System Logs"
        subtitle={`${logs.length} event${logs.length !== 1 ? 's' : ''} (latest 500): errors highlighted.`}
      />

      {loadError && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}
        >
          {loadError}
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center gap-3 mb-5 flex-wrap">
        <div className="flex gap-1.5">
          {EVENT_TYPES.map(t => {
            const isActive = filter === t
            return (
              <button
                key={t}
                onClick={() => setFilter(t)}
                className="px-3 py-1.5 rounded-xl text-[12px] font-bold transition-all capitalize"
                style={{
                  background: isActive ? 'rgba(245,158,11,0.12)' : 'rgba(255,255,255,0.03)',
                  color: isActive ? 'var(--warning)' : 'var(--text-muted)',
                  border: isActive ? '1px solid rgba(245,158,11,0.25)' : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                {t}
              </button>
            )
          })}
        </div>
        <input
          type="text"
          placeholder="Search logs…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 min-w-[200px] max-w-[320px] px-3 py-2 rounded-xl text-[12px] outline-none"
          style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            color: 'var(--text-primary)',
          }}
        />
      </div>

      <Card>
        {filtered.length === 0 ? (
          <EmptyState
            title={logs.length === 0 ? 'No logs yet' : 'No matching logs'}
            hint={logs.length === 0 ? 'Run a scan: events will appear here.' : 'Try a different filter or search.'}
          />
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Message</Th>
                <Th>Metadata</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(log => {
                const isError = log.event_type === 'error'
                return (
                  <tr
                    key={log.id}
                    style={{ background: isError ? 'rgba(220,38,38,0.05)' : 'transparent' }}
                  >
                    <Td>
                      <Pill label={log.event_type ?? 'event'} tone={EVENT_TONE[log.event_type ?? ''] ?? 'neutral'} />
                    </Td>
                    <Td>
                      <span style={{ color: isError ? '#DC2626' : 'var(--text-secondary)', fontWeight: isError ? 600 : 400 }}>
                        {log.message ?? '—'}
                      </span>
                    </Td>
                    <Td mono>
                      <span className="text-[10.5px]" style={{ color: 'var(--text-muted)' }}>
                        {log.metadata ? JSON.stringify(log.metadata).slice(0, 80) : '—'}
                      </span>
                    </Td>
                    <Td>
                      <span className="whitespace-nowrap">{timeAgoLabel(log.created_at)}</span>
                    </Td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  )
}
