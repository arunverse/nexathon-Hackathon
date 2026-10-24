/**
 * /admin/intents — all declared_intents across users.
 * Match count = leads whose industry matches any of the intent's tags.
 */

import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, KpiCard, Th, Td, Pill } from './shared'
import { fmtDate } from './adminUtils'
import { adminDeleteRow } from './adminActions'

interface Intent {
  id: string
  user_id: string | null
  requirement: string
  mode: string | null
  industry_tags: string[] | null
  budget_range: string | null
  expires_at: string | null
  created_at: string
}

export default function AdminIntents() {
  const [intents, setIntents] = useState<Intent[]>([])
  const [userMap, setUserMap] = useState<Record<string, string>>({})
  const [leadIndustries, setLeadIndustries] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  // Snapshot of "now" taken once at mount — keeps render pure (lint: react-hooks/purity)
  const [now] = useState(() => Date.now())

  useEffect(() => {
    async function load() {
      const [intentsRes, profilesRes, leadsRes] = await Promise.all([
        supabase.from('declared_intents').select('*').order('created_at', { ascending: false }),
        supabase.from('profiles').select('id, company_name, sender_email'),
        supabase.from('leads').select('industry'),
      ])
      const map: Record<string, string> = {}
      ;(profilesRes.data ?? []).forEach(p => {
        map[p.id] = p.company_name ?? p.sender_email ?? p.id.slice(0, 8)
      })
      setUserMap(map)
      setIntents((intentsRes.data ?? []) as Intent[])
      setLeadIndustries((leadsRes.data ?? []).map(l => (l.industry ?? '').toLowerCase()))
      setLoading(false)
    }
    load()
  }, [])

  async function removeIntent(id: string) {
    if (!confirm('Delete this declared intent permanently?')) return
    const err = await adminDeleteRow('declared_intents', id)
    if (err) { alert(err); return }
    setIntents(prev => prev.filter(x => x.id !== id))
  }

  if (loading) return <Loading label="Loading declared intents…" />

  const isActive = (i: Intent) => !!i.expires_at && new Date(i.expires_at).getTime() > now
  const active = intents.filter(isActive).length

  // Matches surfaced: leads whose industry contains any of the intent's tags
  function matchCount(intent: Intent): number {
    const tags = (intent.industry_tags ?? []).map(t => t.toLowerCase()).filter(Boolean)
    if (tags.length === 0) return 0
    return leadIndustries.filter(ind => tags.some(tag => ind.includes(tag))).length
  }

  return (
    <div>
      <PageHeader
        icon="ads_click"
        title="Intents Monitor"
        subtitle="All declared intents across users — the reverse-matching marketplace."
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <KpiCard label="Total Intents" value={intents.length} />
        <KpiCard label="Active" value={active} color="var(--success)" />
        <KpiCard label="Expired" value={intents.length - active} color={intents.length - active > 0 ? 'var(--warning)' : undefined} />
      </div>

      <Card>
        {intents.length === 0 ? (
          <EmptyState title="No declared intents yet" hint="They appear here when users post requirements on the Intent board." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <Th>Requirement</Th>
                  <Th>Mode</Th>
                  <Th>User</Th>
                  <Th>Tags</Th>
                  <Th>Matches</Th>
                  <Th>Expires</Th>
                  <Th>Status</Th>
                  <Th> </Th>
                </tr>
              </thead>
              <tbody>
                {intents.map(i => (
                  <tr key={i.id}>
                    <Td>
                      <span className="font-medium" style={{ color: 'var(--text-primary)' }}>
                        {i.requirement.length > 90 ? i.requirement.slice(0, 90) + '…' : i.requirement}
                      </span>
                    </Td>
                    <Td>
                      <Pill label={(i.mode ?? '—').toUpperCase()} tone={i.mode === 'provider' ? 'indigo' : 'neutral'} />
                    </Td>
                    <Td>{i.user_id ? (userMap[i.user_id] ?? i.user_id.slice(0, 8)) : '—'}</Td>
                    <Td>
                      <span className="text-[11px]">{(i.industry_tags ?? []).join(', ') || '—'}</span>
                    </Td>
                    <Td mono>{matchCount(i)}</Td>
                    <Td>{fmtDate(i.expires_at)}</Td>
                    <Td>
                      <Pill label={isActive(i) ? 'ACTIVE' : 'EXPIRED'} tone={isActive(i) ? 'green' : 'neutral'} />
                    </Td>
                    <Td>
                      <button onClick={() => removeIntent(i.id)} title="Delete" className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'var(--critical-bg)', color: 'var(--critical)' }}>
                        <span className="material-symbols-outlined text-[16px]">delete</span>
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
