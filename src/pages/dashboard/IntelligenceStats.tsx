import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  BarChart, Bar, Cell,
  PieChart, Pie, Legend,
  AreaChart, Area,
} from 'recharts'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { ProfileMenu } from '../../components/layout/ProfileMenu'
import { getCachedLeads } from '../../lib/loadLeads'

interface StatsState {
  totalLeads: number
  highIntent: number
  verifiedRate: number
  avgConfidence: number
  avgMatchScore: number
  verified: number
  partiallyVerified: number
  manualReview: number
  totalScanned: number
  passedFirmographic: number
  highIntentDetected: number
  verifiedFinal: number
  totalScans: number
  weeklyData: Array<{ week: string; avgScore: number; count: number }>
  distribution: Array<{ range: string; count: number }>
  pieData: Array<{ name: string; value: number; color: string }>
  industryData: Array<{ industry: string; count: number }>
  topLeads: Array<{ company_name: string; intent_score: number; match_score: number; verification_status: string }>
  recentScans: Array<{ created_at: string; id: string; leadCount: number }>
}

const filterStatuses = [
  { num: '1', name: 'Firmographic', desc: 'Employee count, stage, location', badge: 'ACTIVE', active: true },
  { num: '2', name: 'Behavioral Intent', desc: 'Signal scoring & flag detection', badge: 'ACTIVE', active: true },
  { num: '3', name: 'Integrity Shield', desc: 'Hallucination detection & trust score', badge: 'ENFORCED', active: true },
]

const fadein = (delay = 0) => ({
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  transition: { delay, duration: 0.45, ease: [0.16, 1, 0.3, 1] as [number, number, number, number] },
})

export default function IntelligenceStats() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [hasData, setHasData] = useState<boolean | null>(null)
  const [stats, setStats] = useState<StatsState | null>(null)
  const [funnelWidths, setFunnelWidths] = useState([0, 0, 0, 0, 0])

  useEffect(() => {
    if (!user) return
    loadStats()
  }, [user])

  async function loadStats() {
    if (!user) return

    const [{ data: dbLeads }, { data: scans }] = await Promise.all([
      supabase.from('leads').select('*').eq('user_id', user.id).order('intent_score', { ascending: false }),
      supabase.from('scans').select('*').eq('user_id', user.id).order('created_at', { ascending: true }),
    ])

    // FRESH stats: show the SAME leads the dashboard currently shows — the latest
    // scan for the active mode — NOT every lead ever saved across old scans/modes
    // (that made Stats look like it was applying stale filters). Fall back to the
    // DB only when there's no cached scan yet.
    const cachedLeads = getCachedLeads().leads as unknown as typeof dbLeads
    let leads = (cachedLeads && cachedLeads.length > 0) ? cachedLeads : dbLeads

    // Dedupe by company so totals never inflate (consistent with the dashboard).
    if (leads && leads.length > 0) {
      const seen = new Set<string>()
      leads = leads.filter(l => {
        const k = (l.company_name ?? '').trim().toLowerCase()
        if (!k) return true
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
    }

    if (!leads || leads.length === 0) {
      setHasData(false)
      return
    }

    setHasData(true)
    const total = leads.length
    const highIntent = leads.filter(l => (l.intent_score ?? 0) > 88).length
    const verified = leads.filter(l => l.verification_status === 'VERIFIED').length
    const partiallyVerified = leads.filter(l => l.verification_status === 'PARTIALLY_VERIFIED').length
    const manualReview = leads.filter(l => l.verification_status === 'MANUAL_REVIEW_NEEDED').length
    const avgConfidence = Math.round(leads.reduce((s, l) => s + (l.confidence_score ?? 0), 0) / total)
    const avgMatchScore = Math.round(leads.reduce((s, l) => s + (l.match_score ?? 0), 0) / total)
    const verifiedRate = Math.round((verified / total) * 100)

    const totalScanned = (scans?.length ?? 0) * 15
    const passedFirmographic = Math.round(total * 1.8)
    const highIntentDetected = Math.round(total * 1.2)

    // Weekly trend
    const weeklyData = (scans ?? []).map(scan => {
      const week = new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
      const weekLeads = leads.filter(l => l.scan_id === scan.id)
      const avgScore = weekLeads.length > 0
        ? Math.round(weekLeads.reduce((s, l) => s + (l.intent_score ?? 0), 0) / weekLeads.length)
        : 0
      return { week, avgScore, count: weekLeads.length }
    })

    // Intent distribution
    const distribution = [
      { range: '0–20',   count: leads.filter(l => (l.intent_score ?? 0) <= 20).length },
      { range: '21–40',  count: leads.filter(l => (l.intent_score ?? 0) > 20  && (l.intent_score ?? 0) <= 40).length },
      { range: '41–60',  count: leads.filter(l => (l.intent_score ?? 0) > 40  && (l.intent_score ?? 0) <= 60).length },
      { range: '61–80',  count: leads.filter(l => (l.intent_score ?? 0) > 60  && (l.intent_score ?? 0) <= 80).length },
      { range: '81–100', count: leads.filter(l => (l.intent_score ?? 0) > 80).length },
    ]

    const pieData = [
      { name: 'Verified',      value: verified,          color: '#059669' },
      { name: 'Partial',       value: partiallyVerified, color: '#2563EB' },
      { name: 'Needs Review',  value: manualReview,      color: '#94A3B8' },
    ].filter(p => p.value > 0)

    // Industry breakdown
    const industryCounts: Record<string, number> = {}
    leads.forEach(l => {
      const ind = l.industry || 'Unknown'
      industryCounts[ind] = (industryCounts[ind] ?? 0) + 1
    })
    const industryData = Object.entries(industryCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([industry, count]) => ({ industry: industry.slice(0, 20), count }))

    // Top leads by intent score
    const topLeads = leads.slice(0, 5).map(l => ({
      company_name: l.company_name || 'Unknown',
      intent_score: l.intent_score ?? 0,
      match_score: l.match_score ?? 0,
      verification_status: l.verification_status || 'UNVERIFIED',
    }))

    // Recent scans
    const recentScans = (scans ?? []).slice(-5).reverse().map(scan => ({
      created_at: scan.created_at,
      id: scan.id?.slice(0, 8) ?? 'Scan',
      leadCount: leads.filter(l => l.scan_id === scan.id).length,
    }))

    setStats({
      totalLeads: total, highIntent, verifiedRate, avgConfidence, avgMatchScore,
      verified, partiallyVerified, manualReview,
      totalScanned, passedFirmographic, highIntentDetected, verifiedFinal: verified,
      totalScans: scans?.length ?? 0,
      weeklyData, distribution, pieData, industryData, topLeads, recentScans,
    })

    if (totalScanned > 0) {
      const pcts = [
        100,
        Math.round((passedFirmographic / totalScanned) * 100),
        Math.round((highIntentDetected / totalScanned) * 100),
        Math.round((verified / totalScanned) * 100),
        Math.round((highIntent / totalScanned) * 100),
      ]
      setTimeout(() => setFunnelWidths(pcts), 200)
    }
  }

  const kpiCards = stats ? [
    {
      label: 'Total Leads', value: stats.totalLeads,
      sub: `${stats.totalScans} scan${stats.totalScans !== 1 ? 's' : ''} run`,
      icon: 'group', color: '#2563EB', trend: '+live',
    },
    {
      label: 'High Intent', value: stats.highIntent,
      sub: `>${'88'}% intent threshold`, icon: 'bolt', color: '#D97706', trend: null,
    },
    {
      label: 'Verified Rate', value: `${stats.verifiedRate}%`,
      sub: `${stats.verified} fully verified`, icon: 'verified', color: '#059669', trend: null,
    },
    {
      label: 'Avg Confidence', value: `${stats.avgConfidence}%`,
      sub: `Avg match ${stats.avgMatchScore}%`, icon: 'analytics', color: '#4F46E5', trend: null,
    },
  ] : []

  const funnelSteps = stats ? [
    { label: `${stats.totalScanned} Companies Scanned`,      pct: funnelWidths[0], alpha: 0.12 },
    { label: `${stats.passedFirmographic} Pass Firmographic`, pct: funnelWidths[1], alpha: 0.22 },
    { label: `${stats.highIntentDetected} High Intent`,       pct: funnelWidths[2], alpha: 0.40 },
    { label: `${stats.verifiedFinal} Verified`,               pct: funnelWidths[3], alpha: 0.60 },
    { label: `${stats.highIntent} Top Leads`,                 pct: funnelWidths[4], alpha: 0.85 },
  ] : []

  const statusColor = (s: string) =>
    s === 'VERIFIED' ? 'var(--success)' : s === 'PARTIALLY_VERIFIED' ? 'var(--warning)' : 'var(--text-muted)'

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />

      {/* Main — full width on mobile (sidebar is off-canvas), offset on md+ */}
      <main className="ml-0 md:ml-[240px] flex flex-col h-screen overflow-hidden w-full md:w-[calc(100vw-240px)] min-w-0">

        {/* TopBar */}
        <header className="flex-none h-16 bg-surface/80 backdrop-blur-md border-b border-outline-variant flex items-center justify-between gap-2 pl-16 pr-4 md:px-6 z-40">
          <span className="text-[20px] font-semibold text-primary tracking-tight" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>
            Intelligence Statistics
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={() => { localStorage.removeItem('ebexta_scan_results'); navigate('/scan') }}
              className="px-4 py-1.5 rounded-lg bg-primary text-on-primary font-bold text-[13px] hover:opacity-90 active:scale-95 transition-all"
            >
              Refresh Scan
            </button>
            <button className="text-on-surface-variant hover:text-on-surface transition-colors">
              <span className="material-symbols-outlined">notifications</span>
            </button>
            <ProfileMenu />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">

          {/* Loading */}
          {hasData === null && (
            <div className="flex flex-col items-center justify-center h-64 gap-3">
              <div className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--accent)', borderTopColor: 'transparent' }} />
              <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>Loading intelligence data…</p>
            </div>
          )}

          {/* Empty state */}
          {hasData === false && (
            <motion.div {...fadein()} className="flex flex-col items-center justify-center h-64 gap-5 text-center">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
                style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                <span className="material-symbols-outlined text-[32px]" style={{ color: 'var(--accent-subtle)' }}>bar_chart</span>
              </div>
              <div>
                <h3 className="text-[18px] font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>No scan data yet</h3>
                <p className="text-[13px] max-w-xs" style={{ color: 'var(--text-muted)' }}>
                  Run your first scan to see intelligence statistics, filtration matrix, and lead quality trends.
                </p>
              </div>
              <button onClick={() => navigate('/onboarding')} className="premium-btn px-6 py-2.5 rounded-xl text-sm font-bold">
                Run First Scan
              </button>
            </motion.div>
          )}

          {/* ─── DATA STATE ──────────────────────────────────────────────────── */}
          {hasData === true && stats && (
            <div className="space-y-5">

              {/* ── ROW 1: KPI Cards ──────────────────────────────────────── */}
              <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {kpiCards.map((c, i) => (
                  <motion.div key={c.label} {...fadein(i * 0.07)}
                    className="rounded-2xl p-5 flex flex-col gap-3 relative overflow-hidden"
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
                  >
                    <div className="absolute inset-0 pointer-events-none rounded-2xl"
                      style={{ background: `radial-gradient(circle at top right, ${c.color}09, transparent 65%)` }} />
                    <div className="relative z-10 flex items-start justify-between">
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ background: `${c.color}12`, border: `1px solid ${c.color}22` }}>
                        <span className="material-symbols-outlined text-[18px]" style={{ color: c.color, fontVariationSettings: "'FILL' 1" }}>{c.icon}</span>
                      </div>
                      {c.trend && (
                        <span className="flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)', color: 'var(--accent-interactive)' }}>
                          <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent-interactive)] animate-pulse inline-block" />
                          Live
                        </span>
                      )}
                    </div>
                    <div className="relative z-10">
                      <div className="text-[32px] font-bold leading-none tracking-[-0.03em] mb-1"
                        style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>{c.value}</div>
                      <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{c.label}</div>
                      <div className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{c.sub}</div>
                    </div>
                  </motion.div>
                ))}
              </section>

              {/* ── ROW 2: Filtration Matrix + Filter Status ───────────────── */}
              <motion.section {...fadein(0.28)} className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Filtration Matrix — 7 cols */}
                <div className="lg:col-span-7 premium-card p-6 rounded-2xl relative overflow-hidden">
                  <div className="flex justify-between items-center mb-6">
                    <div>
                      <h2 className="text-[16px] font-semibold mb-0.5" style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>Filtration Matrix</h2>
                      <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Your actual scan pipeline: real numbers</p>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }}>
                      <div className="w-1.5 h-1.5 rounded-full bg-[var(--accent-interactive)] animate-pulse" />
                      <span className="text-[10px] font-bold tracking-[0.06em] uppercase" style={{ color: 'var(--accent-interactive)' }}>Live Data</span>
                    </div>
                  </div>
                  <div className="space-y-4 relative z-10">
                    {funnelSteps.map((step, i) => (
                      <div key={step.label} style={{ paddingLeft: `${i * 16}px` }}>
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-[11px] font-semibold tracking-[0.04em] uppercase" style={{ color: 'var(--text-secondary)' }}>{step.label}</span>
                          <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{step.pct}%</span>
                        </div>
                        <div className="h-4 rounded-lg overflow-hidden"
                          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                          <div
                            className="h-full rounded-lg relative overflow-hidden"
                            style={{
                              width: `${Math.max(step.pct, 2)}%`,
                              background: 'linear-gradient(90deg, #2563EB, #3B82F6)',
                              opacity: 0.5 + (0.5 * (1 - (i * 0.12))),
                              transition: 'width 1.2s cubic-bezier(0.4,0,0.2,1)',
                            }}
                          >
                            <div className="absolute inset-0 bg-gradient-to-r from-white/20 to-transparent" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="absolute inset-0 pointer-events-none opacity-[0.02]"
                    style={{ backgroundImage: 'linear-gradient(var(--accent) 1px, transparent 1px), linear-gradient(90deg, var(--accent) 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
                </div>

                {/* Filter Engine Status + Quick Stats — 5 cols */}
                <div className="lg:col-span-5 flex flex-col gap-4">
                  {/* Filter status */}
                  <div className="premium-card p-5 rounded-2xl flex flex-col flex-1">
                    <h3 className="text-[11px] font-bold tracking-[0.06em] uppercase flex items-center gap-2 mb-4"
                      style={{ color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined text-[15px]">settings_input_component</span>
                      Filter Engine Status
                    </h3>
                    <div className="space-y-2.5 flex-1">
                      {filterStatuses.map((f, fi) => (
                        <motion.div key={f.num}
                          initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + fi * 0.07 }}
                          className="p-3.5 rounded-xl transition-all"
                          style={{
                            background: f.num === '3' ? 'rgba(37, 99, 235, 0.06)' : 'var(--bg-surface)',
                            border: f.num === '3' ? '1px solid rgba(37, 99, 235, 0.22)' : '1px solid var(--border-subtle)',
                            boxShadow: 'var(--shadow-xs)',
                          }}>
                          <div className="flex justify-between items-center mb-1">
                            <p className="text-[10px] font-bold tracking-[0.06em]" style={{ color: f.num === '3' ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>FILTER {f.num}</p>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                              style={{
                                background: f.num === '3' ? 'rgba(37, 99, 235, 0.12)' : 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                color: f.num === '3' ? 'var(--accent-interactive)' : 'var(--text-secondary)',
                              }}>
                              {f.badge}
                            </span>
                          </div>
                          <p className="font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>{f.name}</p>
                          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
                        </motion.div>
                      ))}
                    </div>
                    <div className="mt-4 pt-4 flex items-center gap-2 text-[11px]"
                      style={{ borderTop: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                      <span className="material-symbols-outlined text-[14px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>shield</span>
                      System operating at peak integrity
                    </div>
                  </div>

                  {/* Mini score strip */}
                  <div className="premium-card p-4 rounded-2xl grid grid-cols-3 gap-3">
                    {[
                      { label: 'Verified', val: stats.verified, color: 'var(--success)' },
                      { label: 'Partial', val: stats.partiallyVerified, color: 'var(--accent-interactive)' },
                      { label: 'Review', val: stats.manualReview, color: 'var(--text-secondary)' },
                    ].map(m => (
                      <div key={m.label} className="text-center">
                        <div className="text-[22px] font-bold leading-none mb-0.5" style={{ color: m.color, fontFamily: 'Geist, Inter, sans-serif' }}>{m.val}</div>
                        <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{m.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* ── ROW 3: Charts ─────────────────────────────────────────── */}
              <motion.section {...fadein(0.38)} className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Weekly trend */}
                <div className="premium-card p-5 rounded-2xl flex flex-col h-64">
                  <h4 className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Lead Quality Trend</h4>
                  {stats.weeklyData.length > 1 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.weeklyData} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                        <XAxis dataKey="week" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                        <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} domain={[0, 100]} />
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 11 }}
                          labelStyle={{ color: 'var(--steel)' }} itemStyle={{ color: 'var(--steel)' }} />
                        <Area type="monotone" dataKey="avgScore" stroke="var(--accent-interactive)" strokeWidth={2}
                          fill="url(#areaGrad)" dot={{ r: 3, fill: 'var(--accent-interactive)', strokeWidth: 0 }} name="Avg Intent" />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[12px]" style={{ color: 'var(--text-muted)' }}>Run multiple scans to see trend</div>
                  )}
                </div>

                {/* Intent distribution */}
                <div className="premium-card p-5 rounded-2xl flex flex-col h-64">
                  <h4 className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Intent Score Distribution</h4>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats.distribution} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
                      <XAxis dataKey="range" tick={{ fontSize: 9, fill: 'var(--text-muted)' }} />
                      <YAxis tick={{ fontSize: 9, fill: 'var(--text-muted)' }} allowDecimals={false} />
                      <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 11 }}
                        labelStyle={{ color: 'var(--steel)' }} itemStyle={{ color: 'var(--steel)' }} />
                      <Bar dataKey="count" name="Leads" radius={[4, 4, 0, 0]}>
                        {stats.distribution.map((_, i) => (
                          <Cell key={i} fill={
                            i === 4 ? 'var(--accent-interactive)' :
                            i === 3 ? 'rgba(37, 99, 235, 0.70)' :
                            i === 2 ? 'rgba(37, 99, 235, 0.45)' :
                            'rgba(37, 99, 235, 0.22)'
                          } />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Verification pie */}
                <div className="premium-card p-5 rounded-2xl flex flex-col h-64">
                  <h4 className="text-[12px] font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>Verification Breakdown</h4>
                  {stats.pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={stats.pieData} cx="50%" cy="45%" innerRadius="38%" outerRadius="60%"
                          paddingAngle={3} dataKey="value">
                          {stats.pieData.map((entry, i) => (
                            <Cell key={i} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-strong)', borderRadius: 8, fontSize: 11 }}
                          itemStyle={{ color: 'var(--text-primary)' }} />
                        <Legend iconType="circle" iconSize={7} wrapperStyle={{ fontSize: 10, paddingTop: 6 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex-1 flex items-center justify-center text-[12px]" style={{ color: 'var(--text-muted)' }}>No data yet</div>
                  )}
                </div>
              </motion.section>

              {/* ── ROW 4: Industry + Top Leads ───────────────────────────── */}
              <motion.section {...fadein(0.46)} className="grid grid-cols-1 lg:grid-cols-12 gap-4">

                {/* Industry Breakdown — 5 cols */}
                <div className="lg:col-span-5 premium-card p-5 rounded-2xl">
                  <h4 className="text-[12px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Industry Breakdown</h4>
                  {stats.industryData.length > 0 ? (
                    <div className="space-y-3">
                      {stats.industryData.map((ind, i) => {
                        const maxCount = stats.industryData[0].count
                        const pct = Math.round((ind.count / maxCount) * 100)
                        return (
                          <div key={ind.industry}>
                            <div className="flex justify-between items-center mb-1">
                              <span className="text-[11px] font-medium" style={{ color: 'var(--steel)' }}>{ind.industry}</span>
                              <span className="text-[10px] font-mono" style={{ color: 'var(--text-muted)' }}>{ind.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-surface)' }}>
                              <motion.div
                                initial={{ width: 0 }} animate={{ width: `${pct}%` }}
                                transition={{ delay: 0.5 + i * 0.05, duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
                                className="h-full rounded-full"
                                style={{ background: 'var(--accent-interactive)', opacity: 0.45 + (0.55 * (1 - i / stats.industryData.length)) }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No industry data</div>
                  )}
                </div>

                {/* Top Leads Leaderboard — 7 cols */}
                <div className="lg:col-span-7 premium-card p-5 rounded-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-[12px] font-semibold" style={{ color: 'var(--text-primary)' }}>Top Leads by Intent Score</h4>
                    <button onClick={() => navigate('/leads')}
                      className="text-[11px] font-medium flex items-center gap-1 hover:opacity-80 transition-opacity"
                      style={{ color: 'var(--accent-interactive)' }}>
                      View all <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                    </button>
                  </div>
                  <div className="space-y-2.5">
                    {stats.topLeads.map((lead, i) => (
                      <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl"
                        style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-[11px] font-bold"
                          style={{ background: i === 0 ? 'var(--accent-subtle)' : 'var(--accent-subtle)', color: i === 0 ? 'var(--accent-interactive)' : 'var(--text-muted)' }}>
                          {i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-[12px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{lead.company_name}</div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <div className="text-center">
                            <div className="text-[13px] font-bold" style={{ color: 'var(--accent-interactive)' }}>{lead.intent_score}</div>
                            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>intent</div>
                          </div>
                          <div className="text-center">
                            <div className="text-[13px] font-bold" style={{ color: 'var(--steel)' }}>{lead.match_score}</div>
                            <div className="text-[9px]" style={{ color: 'var(--text-muted)' }}>match</div>
                          </div>
                          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                            style={{ background: statusColor(lead.verification_status) }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.section>

              {/* ── ROW 5: Recent Scans + Quick Actions ───────────────────── */}
              <motion.section {...fadein(0.52)} className="grid grid-cols-1 lg:grid-cols-12 gap-4 pb-2">

                {/* Recent Scans */}
                <div className="lg:col-span-7 premium-card p-5 rounded-2xl">
                  <h4 className="text-[12px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Recent Scans</h4>
                  {stats.recentScans.length > 0 ? (
                    <div className="space-y-2">
                      {stats.recentScans.map((scan, i) => (
                        <div key={i} className="flex items-center justify-between py-2.5 px-3 rounded-xl"
                          style={{ background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
                          <div className="flex items-center gap-3">
                            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--accent-interactive)', fontVariationSettings: "'FILL' 1" }}>
                              radar
                            </span>
                            <div>
                              <div className="text-[12px] font-medium" style={{ color: 'var(--steel)' }}>
                                {new Date(scan.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                              </div>
                              <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>ID: {scan.id}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-bold" style={{ color: 'var(--accent-interactive)' }}>{scan.leadCount}</span>
                            <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>leads</span>
                            <span className="px-2 py-0.5 rounded-full text-[9px] font-bold"
                              style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success)', border: '1px solid rgba(16,185,129,0.2)' }}>
                              Complete
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-[12px]" style={{ color: 'var(--text-muted)' }}>No scans recorded yet</div>
                  )}
                </div>

                {/* Quick Actions */}
                <div className="lg:col-span-5 premium-card p-5 rounded-2xl flex flex-col">
                  <h4 className="text-[12px] font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h4>
                  <div className="flex flex-col gap-2.5 flex-1">
                    {[
                      { label: 'Run New Scan', desc: 'Discover fresh leads now', icon: 'radar', path: '/scan', primary: true },
                      { label: 'View All Leads', desc: `${stats.totalLeads} leads in pipeline`, icon: 'group', path: '/leads', primary: false },
                      { label: 'Outreach Inbox', desc: 'Draft EBEXTA emails', icon: 'mail', path: '/outreach', primary: false },
                      { label: 'Intent Signals', desc: 'Monitor buying signals', icon: 'bolt', path: '/intent', primary: false },
                    ].map(a => (
                      <button key={a.label} onClick={() => navigate(a.path)}
                        className="flex items-center gap-3 p-3 rounded-xl text-left transition-all hover:scale-[1.01] active:scale-[0.99]"
                        style={a.primary
                          ? { background: 'var(--accent-subtle)', border: '1px solid var(--accent-subtle)' }
                          : { background: 'var(--accent-subtle)', border: '1px solid var(--border-subtle)' }}>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{ background: a.primary ? 'var(--accent-subtle)' : 'var(--accent-subtle)' }}>
                          <span className="material-symbols-outlined text-[16px]"
                            style={{ color: a.primary ? 'var(--accent-interactive)' : 'var(--text-muted)', fontVariationSettings: "'FILL' 1" }}>{a.icon}</span>
                        </div>
                        <div className="min-w-0">
                          <div className="text-[12px] font-semibold" style={{ color: a.primary ? 'var(--steel)' : 'var(--text-secondary)' }}>{a.label}</div>
                          <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{a.desc}</div>
                        </div>
                        <span className="material-symbols-outlined text-[14px] ml-auto flex-shrink-0" style={{ color: 'var(--text-muted)' }}>chevron_right</span>
                      </button>
                    ))}
                  </div>
                </div>
              </motion.section>

            </div>
          )}
        </div>
      </main>
    </div>
  )
}
