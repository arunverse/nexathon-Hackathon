/**
 * /admin — Overview. Live KPI cards + recent activity feed.
 * Every number comes from a real Supabase query. No fake data.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, KpiCard, Loading, EmptyState, Card, Pill } from './shared'
import { timeAgoLabel, startOfTodayIso } from './adminUtils'

interface SystemLog {
  id: string
  event_type: string | null
  message: string | null
  created_at: string
}

interface Kpis {
  users: number
  scans: number
  leads: number
  pendingVerifications: number
  overdueVerifications: number
  apiCallsToday: number
  tokensToday: number
}

const EVENT_TONE: Record<string, 'green' | 'amber' | 'red' | 'indigo' | 'neutral'> = {
  scan: 'indigo',
  error: 'red',
  login: 'amber',
  verification: 'green',
  export: 'neutral',
}

export default function AdminOverview() {
  const [kpis, setKpis] = useState<Kpis | null>(null)
  const [logs, setLogs] = useState<SystemLog[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    async function load() {
      try {
        const today = startOfTodayIso()
        const overdueCutoff = new Date(Date.now() - 24 * 3600000).toISOString()

        const [
          usersRes, scansRes, leadsRes, pendingRes, overdueRes, apiTodayRes, logsRes,
        ] = await Promise.all([
          supabase.from('profiles').select('*', { count: 'exact', head: true }),
          supabase.from('scans').select('*', { count: 'exact', head: true }),
          supabase.from('leads').select('*', { count: 'exact', head: true }),
          supabase.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending'),
          supabase.from('verification_requests').select('*', { count: 'exact', head: true })
            .in('status', ['pending', 'in_progress']).lt('requested_at', overdueCutoff),
          supabase.from('api_usage').select('tokens_used, calls').gte('created_at', today),
          supabase.from('system_logs').select('id, event_type, message, created_at')
            .order('created_at', { ascending: false }).limit(20),
        ])

        const firstError = usersRes.error ?? scansRes.error ?? leadsRes.error ?? pendingRes.error
          ?? overdueRes.error ?? apiTodayRes.error ?? logsRes.error
        if (firstError) {
          setLoadError(`${firstError.message} — did you run supabase/admin_migration.sql?`)
        }

        const apiRows = apiTodayRes.data ?? []
        setKpis({
          users: usersRes.count ?? 0,
          scans: scansRes.count ?? 0,
          leads: leadsRes.count ?? 0,
          pendingVerifications: pendingRes.count ?? 0,
          overdueVerifications: overdueRes.count ?? 0,
          apiCallsToday: apiRows.reduce((s, r) => s + (r.calls ?? 1), 0),
          tokensToday: apiRows.reduce((s, r) => s + (r.tokens_used ?? 0), 0),
        })
        setLogs((logsRes.data ?? []) as SystemLog[])
      } catch (err) {
        setLoadError(String((err as Error)?.message ?? err))
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  if (loading) return <Loading label="Loading live metrics…" />

  return (
    <div>
      <PageHeader
        icon="dashboard"
        title="Overview"
        subtitle="Live EBEXTA system metrics: all numbers from real Supabase queries."
      />

      {loadError && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}
        >
          Some queries failed: {loadError}
        </div>
      )}

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiCard label="Total Users" value={kpis?.users ?? 0} />
        <KpiCard label="Total Scans" value={kpis?.scans ?? 0} />
        <KpiCard label="Leads Generated" value={kpis?.leads ?? 0} />
        <KpiCard
          label="Pending Verifications"
          value={kpis?.pendingVerifications ?? 0}
          color={(kpis?.pendingVerifications ?? 0) > 0 ? 'var(--warning)' : undefined}
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-8">
        <KpiCard
          label="Overdue Verifications (>24h)"
          value={kpis?.overdueVerifications ?? 0}
          color={(kpis?.overdueVerifications ?? 0) > 0 ? '#DC2626' : 'var(--success)'}
        />
        <KpiCard label="API Calls Today" value={kpis?.apiCallsToday ?? 0} sub="from api_usage" />
        <KpiCard label="Tokens Used Today" value={(kpis?.tokensToday ?? 0).toLocaleString()} sub="from api_usage" />
      </div>

      {/* Recent activity */}
      <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
        Recent Activity
      </h2>
      <Card>
        {logs.length === 0 ? (
          <EmptyState title="No activity yet" hint="Run a scan: events will appear here." />
        ) : (
          <div>
            {logs.map((log, i) => (
              <div
                key={log.id}
                className="flex items-center gap-3 px-4 py-3"
                style={{ borderBottom: i < logs.length - 1 ? '1px solid var(--border-subtle)' : undefined }}
              >
                <Pill
                  label={log.event_type ?? 'event'}
                  tone={EVENT_TONE[log.event_type ?? ''] ?? 'neutral'}
                />
                <span className="text-[12.5px] flex-1 truncate" style={{ color: 'var(--text-secondary)' }}>
                  {log.message ?? '—'}
                </span>
                <span className="text-[11px] whitespace-nowrap" style={{ color: 'var(--text-muted)' }}>
                  {timeAgoLabel(log.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
