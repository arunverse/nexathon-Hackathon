/**
 * /admin/api — API & Cost Tracking, fed by the api_usage table.
 * Free-tier meters: flash-lite 1,000 calls/day, flash 250 calls/day.
 * Cost figure is a rough paid-tier ESTIMATE, clearly labelled.
 */

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, KpiCard, Th, Td } from './shared'
import { startOfTodayIso, daysAgoIso } from './adminUtils'
import { AdminCreditConsole } from './AdminCreditConsole'

interface UsageRow {
  action: string | null
  model: string | null
  tokens_used: number | null
  calls: number | null
  created_at: string
}

// Paid-tier daily safety caps — must match DAILY_MODEL_CAP in the gemini Edge Function.
const FLASH_LITE_DAILY_LIMIT = 5000
const FLASH_DAILY_LIMIT = 5000

// Real Gemini blended token prices (USD / 1M tokens), assuming ~30% input /
// 70% output — 2.5-Flash output is expensive ($2.50/1M), which is what the old
// flat $0.25 badly under-counted. Tune these to match your Cloud bill.
const TOKEN_USD_PER_1M: Record<string, number> = {
  'gemini-flash-latest': 1.85,
  'gemini-3.8-flash': 1.85,
  'gemini-3.7-flash': 1.85,
  'gemini-flash-lite-latest': 0.31,
  'gemini-3.5-flash-lite': 0.31,
}
const DEFAULT_TOKEN_USD_PER_1M = 0.6
const tokenRate = (model: string | null) => TOKEN_USD_PER_1M[model ?? ''] ?? DEFAULT_TOKEN_USD_PER_1M
// Approximate USD→INR conversion for cost display (update as needed).
const USD_TO_INR = 84
// Grounding (Google Search) is $35/1000 requests, BUT the paid tier includes a
// large free daily allowance — so for normal volume it's usually ~₹0. Only the
// overage past the free daily quota is billed. Tune GROUNDING_FREE_PER_DAY.
const GROUNDING_USD_PER_CALL = 0.035
const GROUNDING_FREE_PER_DAY = 1500
const GROUNDED_ACTIONS = new Set(['discovery', 'enrich', 'scan'])

function meterColor(pctUsed: number): string {
  if (pctUsed > 90) return '#DC2626'
  if (pctUsed > 70) return 'var(--warning)'
  return 'var(--success)'
}

function Meter({ label, used, limit }: { label: string; used: number; limit: number }) {
  const pct = Math.min(100, Math.round((used / limit) * 100))
  const color = meterColor(pct)
  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>{label}</span>
        <span className="text-[11px] font-mono" style={{ color }}>
          {used.toLocaleString()} / {limit.toLocaleString()} ({pct}%)
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function AdminApi() {
  const [rows, setRows] = useState<UsageRow[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  // Admin-set monthly budget (₹) — used to show an estimated "balance remaining".
  // Real spend/balance lives only in Google Cloud Console → Billing.
  const [budgetInr, setBudgetInr] = useState<number>(() => {
    const v = Number(localStorage.getItem('ebexta_admin_budget_inr'))
    return Number.isFinite(v) && v > 0 ? v : 1000
  })
  function saveBudget(v: string) {
    const n = Number(v)
    if (Number.isFinite(n) && n >= 0) { setBudgetInr(n); localStorage.setItem('ebexta_admin_budget_inr', String(n)) }
  }

  useEffect(() => {
    async function load() {
      const { data, error } = await supabase
        .from('api_usage')
        .select('action, model, tokens_used, calls, created_at')
        .gte('created_at', daysAgoIso(31))
        .order('created_at', { ascending: false })
        .limit(5000)
      if (error) setLoadError(`${error.message} — did you run supabase/admin_migration.sql?`)
      setRows((data ?? []) as UsageRow[])
      setLoading(false)
    }
    load()
  }, [])

  if (loading) return <Loading label="Loading API usage…" />

  const today = startOfTodayIso()
  const week = daysAgoIso(7)
  const month = daysAgoIso(30)

  const calls = (r: UsageRow) => r.calls ?? 1
  const inRange = (r: UsageRow, since: string) => r.created_at >= since

  const sumCalls = (since: string, pred?: (r: UsageRow) => boolean) =>
    rows.filter(r => inRange(r, since) && (!pred || pred(r))).reduce((s, r) => s + calls(r), 0)
  const sumTokens = (since: string) =>
    rows.filter(r => inRange(r, since)).reduce((s, r) => s + (r.tokens_used ?? 0), 0)

  // By action (today / week / month)
  const actions = ['discovery', 'enrich', 'email', 'proposal']
  const actionStats = actions.map(a => ({
    action: a,
    today: sumCalls(today, r => r.action === a),
    week: sumCalls(week, r => r.action === a),
    month: sumCalls(month, r => r.action === a),
  }))

  // By model
  const modelTotals: Record<string, { calls: number; tokens: number }> = {}
  rows.forEach(r => {
    const m = r.model ?? 'unknown'
    modelTotals[m] = modelTotals[m] ?? { calls: 0, tokens: 0 }
    modelTotals[m].calls += calls(r)
    modelTotals[m].tokens += r.tokens_used ?? 0
  })

  // Free-tier meters (today, by model family)
  const isLite = (m: string | null) => (m ?? '').includes('flash-lite')
  const liteToday = sumCalls(today, r => isLite(r.model))
  const flashToday = sumCalls(today, r => !isLite(r.model))

  // 14-day daily chart
  const chartData: Array<{ day: string; calls: number }> = []
  for (let i = 13; i >= 0; i--) {
    const dayStart = new Date()
    dayStart.setHours(0, 0, 0, 0)
    dayStart.setDate(dayStart.getDate() - i)
    const dayEnd = new Date(dayStart)
    dayEnd.setDate(dayEnd.getDate() + 1)
    const label = dayStart.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    const count = rows
      .filter(r => r.created_at >= dayStart.toISOString() && r.created_at < dayEnd.toISOString())
      .reduce((s, r) => s + calls(r), 0)
    chartData.push({ day: label, calls: count })
  }

  const tokensMonth = sumTokens(month)
  // Token cost computed PER MODEL (2.5-Flash costs far more than Flash-Lite).
  const tokensByModel = (since: string) => {
    const m: Record<string, number> = {}
    rows.filter(r => inRange(r, since)).forEach(r => { const k = r.model ?? 'unknown'; m[k] = (m[k] ?? 0) + (r.tokens_used ?? 0) })
    return m
  }
  const tokenCostUsd = (since: string) =>
    Object.entries(tokensByModel(since)).reduce((s, [k, t]) => s + (t / 1_000_000) * tokenRate(k), 0)

  // Grounded calls, and the portion that's actually billed (past the free daily quota).
  const groundedMonth = sumCalls(month, r => GROUNDED_ACTIONS.has(r.action ?? ''))
  const groundedToday = sumCalls(today, r => GROUNDED_ACTIONS.has(r.action ?? ''))
  const groundingBillableMonth = Math.max(0, groundedMonth - GROUNDING_FREE_PER_DAY)
  const groundingBillableToday = Math.max(0, groundedToday - GROUNDING_FREE_PER_DAY)

  const tokenCostUsdMonth = tokenCostUsd(month)
  const groundingCostUsdMonth = groundingBillableMonth * GROUNDING_USD_PER_CALL
  const estCostUsd = tokenCostUsdMonth + groundingCostUsdMonth
  const estCostInr = estCostUsd * USD_TO_INR
  const estCostTodayInr = (tokenCostUsd(today) + groundingBillableToday * GROUNDING_USD_PER_CALL) * USD_TO_INR

  return (
    <div>
      <PageHeader
        icon="monitoring"
        title="API & Cost Tracking"
        subtitle="Live EBEXTA Engine usage from api_usage: the two-pass scan uses ~9 calls per scan."
      />

      {/* Credit & cost console — balances, budgets, per-user costs and the
          emergency brake. Renders nothing until credit_system.sql is run. */}
      <AdminCreditConsole />

      {loadError && (
        <div
          className="mb-5 px-4 py-3 rounded-xl text-[12px] font-medium"
          style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.25)', color: '#DC2626' }}
        >
          {loadError}
        </div>
      )}

      {/* Engine & Token Telemetry */}
      <div className="mt-12 pt-8 border-t border-[var(--border-subtle)]">
        <div className="mb-5">
          <h2 className="text-[15px] font-bold" style={{ color: 'var(--text-primary)' }}>Engine & Token Telemetry</h2>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--text-muted)' }}>Raw EBEXTA Neural Engine execution metrics and token consumption ledger</p>
        </div>

        {/* Call + token KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-4">
          <KpiCard label="Calls Today" value={sumCalls(today)} />
          <KpiCard label="Calls This Month" value={sumCalls(month)} />
          <KpiCard label="Grounded (search) calls · mo" value={groundedMonth} sub={`${GROUNDING_FREE_PER_DAY.toLocaleString()}/day free`} />
          <KpiCard label="Tokens This Month" value={tokensMonth.toLocaleString()} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
          <KpiCard label="Est. Cost Today (₹)" value={`₹${estCostTodayInr.toFixed(2)}`} sub="ESTIMATE: paid tier" />
          <KpiCard label="Est. Cost This Month (₹)" value={`₹${estCostInr.toFixed(2)}`} sub={`≈ $${estCostUsd.toFixed(3)} · 30 days`} />
          <KpiCard label="↳ Tokens" value={`₹${(tokenCostUsdMonth * USD_TO_INR).toFixed(2)}`} sub={`${tokensMonth.toLocaleString()} tokens (per-model)`} />
          <KpiCard label="↳ Grounding (past free)" value={`₹${(groundingCostUsdMonth * USD_TO_INR).toFixed(2)}`} sub={groundingBillableMonth > 0 ? `${groundingBillableMonth} billed` : 'within free tier'} color={groundingBillableMonth > 0 ? 'var(--warning)' : undefined} />
        </div>
      </div>

      {/* Monthly budget & estimated balance */}
      <Card className="mb-6 p-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-[13px] font-bold" style={{ color: 'var(--text-primary)' }}>Monthly Budget & Estimated Balance</p>
            <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
              Estimate from tracked tokens. Real spend/balance:{' '}
              <a href="https://console.cloud.google.com/billing" target="_blank" rel="noopener noreferrer"
                className="underline" style={{ color: 'var(--accent-interactive)' }}>Google Cloud Console → Billing ↗</a>
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Budget ₹</span>
            <input
              type="number" min={0} defaultValue={budgetInr}
              onChange={e => saveBudget(e.target.value)}
              className="w-24 px-2 py-1 rounded-lg text-[12px] outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-3">
          <KpiCard label="Budget (₹)" value={`₹${budgetInr.toLocaleString('en-IN')}`} />
          <KpiCard label="Est. Spent This Month (₹)" value={`₹${estCostInr.toFixed(2)}`} />
          <KpiCard
            label="Est. Balance Left (₹)"
            value={`₹${Math.max(0, budgetInr - estCostInr).toFixed(2)}`}
            sub={`${Math.min(100, Math.round((estCostInr / Math.max(1, budgetInr)) * 100))}% of budget used`}
          />
        </div>
      </Card>

      {/* Daily usage meters (paid-tier safety cap) */}
      <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Daily Usage: Today (cap 5,000 / model)</h2>
      <Card className="mb-6 py-1">
        <Meter label="EBEXTA Lite (fast)" used={liteToday} limit={FLASH_LITE_DAILY_LIMIT} />
        <div className="h-px mx-4" style={{ background: 'var(--border-subtle)' }} />
        <Meter label="EBEXTA Pro (deep)" used={flashToday} limit={FLASH_DAILY_LIMIT} />
      </Card>

      {/* 14-day chart */}
      <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Calls Per Day: Last 14 Days</h2>
      <Card className="mb-6 p-4">
        {rows.length === 0 ? (
          <EmptyState title="No API usage yet" hint="Run a scan: every EBEXTA Engine call is tracked here." />
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(128,128,150,0.15)" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 10,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="calls" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Breakdown tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div>
          <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>By Action</h2>
          <Card>
            <table className="w-full border-collapse">
              <thead>
                <tr><Th>Action</Th><Th>Today</Th><Th>Week</Th><Th>Month</Th></tr>
              </thead>
              <tbody>
                {actionStats.map(s => (
                  <tr key={s.action}>
                    <Td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{s.action}</span></Td>
                    <Td mono>{s.today}</Td>
                    <Td mono>{s.week}</Td>
                    <Td mono>{s.month}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
        <div>
          <h2 className="text-[15px] font-bold mb-3" style={{ color: 'var(--text-primary)' }}>By Model (30 days)</h2>
          <Card>
            {Object.keys(modelTotals).length === 0 ? (
              <EmptyState title="No data yet" />
            ) : (
              <table className="w-full border-collapse">
                <thead>
                  <tr><Th>Model</Th><Th>Calls</Th><Th>Tokens</Th></tr>
                </thead>
                <tbody>
                  {Object.entries(modelTotals).map(([model, t]) => (
                    <tr key={model}>
                      <Td><span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{model}</span></Td>
                      <Td mono>{t.calls}</Td>
                      <Td mono>{t.tokens.toLocaleString()}</Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}
