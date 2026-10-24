import { useEffect, useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'

const nodes = [
  { id: 'NODE-SF-01', region: 'San Francisco, US', status: 'OPTIMAL', load: 64, latency: '12ms', color: 'text-[var(--accent-interactive)]', borderColor: 'border-[var(--accent)]/20' },
  { id: 'NODE-ZH-04', region: 'Zürich, CH', status: 'OPTIMAL', load: 41, latency: '18ms', color: 'text-[var(--accent-interactive)]', borderColor: 'border-[var(--accent)]/20' },
  { id: 'NODE-TYO-02', region: 'Tokyo, JP', status: 'DEGRADED', load: 89, latency: '68ms', color: 'text-amber-400', borderColor: 'border-amber-500/20' },
  { id: 'NODE-SGP-09', region: 'Singapore, SG', status: 'OPTIMAL', load: 55, latency: '22ms', color: 'text-[var(--accent-interactive)]', borderColor: 'border-[var(--accent)]/20' },
]

const geoNodes = [
  { label: 'SF', x: '12%', y: '40%' },
  { label: 'ZH', x: '46%', y: '30%' },
  { label: 'TYO', x: '80%', y: '36%' },
  { label: 'SGP', x: '74%', y: '60%' },
]

const syncEvents = [
  { time: '14:32:18', label: 'Bilateral sync completed', node: 'NODE-SF-01', type: 'success' },
  { time: '14:31:54', label: 'Hallucination shield triggered', node: 'NODE-TYO-02', type: 'warn' },
  { time: '14:31:12', label: 'Lead cluster verified', node: 'NODE-ZH-04', type: 'success' },
  { time: '14:30:49', label: 'Intent signal ingested', node: 'NODE-SGP-09', type: 'info' },
  { time: '14:30:22', label: 'Data grounding complete', node: 'NODE-SF-01', type: 'success' },
]

export default function NetworkStatusDashboard() {
  const [feed, setFeed] = useState(syncEvents)
  useEffect(() => {
    const id = setInterval(() => {
      const newEntry = {
        time: new Date().toTimeString().slice(0, 8),
        label: ['Neural sync event', 'Verification pass', 'Signal pulse received', 'Node heartbeat OK'][Math.floor(Math.random() * 4)],
        node: nodes[Math.floor(Math.random() * nodes.length)].id,
        type: Math.random() > 0.2 ? 'success' : 'warn',
      }
      setFeed(f => [newEntry, ...f.slice(0, 9)])
    }, 5000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="ml-0 md:ml-[240px] flex-1 min-h-screen flex flex-col">
        {/* Custom top nav */}
        <header className="h-14 border-b border-outline-variant flex items-center pl-16 pr-4 md:px-6 gap-4 md:gap-8 bg-surface overflow-x-auto no-scrollbar">
          {['Network', 'Health', 'Logs', 'Neural Syncs'].map(tab => (
            <button
              key={tab}
              className={`text-[11px] font-bold tracking-[0.06em] pb-0.5 border-b-2 transition-colors ${tab === 'Network'
                ? 'border-primary text-primary'
                : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
            >
              {tab}
            </button>
          ))}
          <div className="ml-auto flex items-center gap-4">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 bg-[var(--accent)]" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--accent)]" />
            </span>
            <span className="text-[11px] font-bold tracking-[0.06em] text-[var(--accent-interactive)]">LIVE MONITORING</span>
          </div>
        </header>

        <div className="flex flex-1">
          {/* Left sidebar */}
          <aside className="w-52 border-r border-outline-variant bg-surface flex flex-col pt-4 shrink-0">
            <div className="px-4 mb-4">
              <p className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Nodes</p>
            </div>
            <nav className="flex flex-col gap-1 px-2 flex-1">
              {[
                { label: 'Global Map', icon: 'language', active: true },
                { label: 'Infrastructure', icon: 'hub', active: false },
                { label: 'Analytics', icon: 'analytics', active: false },
                { label: 'Sync Log', icon: 'history', active: false },
                { label: 'Security', icon: 'shield', active: false },
              ].map(n => (
                <button
                  key={n.label}
                  className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-[14px] font-medium transition-colors text-left ${n.active
                    ? 'bg-primary-container/20 text-primary font-bold'
                    : 'text-on-surface-variant hover:bg-surface-container'}`}
                >
                  <span className="material-symbols-outlined text-[18px]">{n.icon}</span>
                  {n.label}
                </button>
              ))}
            </nav>
            <div className="p-3">
              <button className="w-full py-2.5 bg-primary text-on-primary rounded-lg text-[11px] font-bold tracking-[0.06em] hover:brightness-110 active:scale-95 transition-all">
                SYNC NETWORK
              </button>
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 p-6 space-y-6 overflow-auto">
            {/* Global map */}
            <section className="rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden relative h-64">
              <div className="absolute inset-0 bg-primary/5" />
              <div className="absolute top-3 left-4 text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">GLOBAL TOPOLOGY MAP</div>
              {geoNodes.map(g => (
                <div
                  key={g.label}
                  className="absolute flex flex-col items-center gap-1"
                  style={{ left: g.x, top: g.y, transform: 'translate(-50%, -50%)' }}
                >
                  <div className="relative flex items-center justify-center">
                    <div className="absolute w-8 h-8 rounded-full border border-primary/30 animate-ping opacity-40" />
                    <div className="w-4 h-4 rounded-full bg-primary/40 border border-primary flex items-center justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-primary mt-1">{g.label}</span>
                </div>
              ))}
              {/* Connection lines SVG */}
              <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                {[['12,40', '46,30'], ['46,30', '80,36'], ['80,36', '74,60'], ['12,40', '74,60']].map((pair, i) => {
                  const [from, to] = pair
                  return <line key={i} x1={from.split(',')[0]} y1={from.split(',')[1]} x2={to.split(',')[0]} y2={to.split(',')[1]} stroke="var(--steel)" strokeWidth="0.3" strokeOpacity="0.3" strokeDasharray="2 1" />
                })}
              </svg>
            </section>

            {/* Health Matrix */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Neural Core Load', val: '64.2%', icon: 'memory', color: 'text-primary', pct: 64 },
                { label: 'Bilateral Sync Latency', val: '24ms', icon: 'sync', color: 'text-[var(--accent-interactive)]', pct: 24 },
                { label: 'Encryption', val: '100%', icon: 'lock', color: 'text-[var(--accent-interactive)]', pct: 100 },
              ].map(h => (
                <div key={h.label} className="p-5 rounded-xl border border-outline-variant bg-surface-container-low">
                  <div className="flex items-center gap-2 mb-4">
                    <span className={`material-symbols-outlined ${h.color}`}>{h.icon}</span>
                    <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">{h.label}</span>
                  </div>
                  <p className={`text-[28px] font-bold ${h.color}`} style={{ fontFamily: 'Geist, Inter, sans-serif' }}>{h.val}</p>
                  <div className="mt-3 h-1 w-full bg-surface-container-highest rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${h.pct}%`, backgroundColor: 'var(--accent)' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Node table + Sync Log */}
            <div className="grid grid-cols-2 gap-6">
              {/* Node table */}
              <section className="rounded-xl border border-outline-variant overflow-hidden">
                <div className="p-4 bg-surface-container-high border-b border-outline-variant">
                  <h3 className="text-[14px] font-semibold text-on-surface">Infrastructure Nodes</h3>
                </div>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-outline-variant bg-surface-container text-left">
                      {['Node', 'Region', 'Load', 'Latency', 'Status'].map(h => (
                        <th key={h} className="px-3 py-2.5 text-[10px] font-bold tracking-[0.06em] text-on-surface-variant">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {nodes.map(n => (
                      <tr key={n.id} className="border-b border-outline-variant/40 hover:bg-surface-container/50 transition-colors">
                        <td className="px-3 py-2 font-mono text-[11px] text-primary">{n.id}</td>
                        <td className="px-3 py-2 text-[11px] text-on-surface-variant">{n.region}</td>
                        <td className="px-3 py-2 text-[11px]">{n.load}%</td>
                        <td className="px-3 py-2 font-mono text-[11px]">{n.latency}</td>
                        <td className="px-3 py-2">
                          <span className={`text-[10px] font-bold ${n.color}`}>{n.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>

              {/* Sync log */}
              <section className="rounded-xl border border-outline-variant overflow-hidden">
                <div className="p-4 bg-surface-container-high border-b border-outline-variant flex justify-between items-center">
                  <h3 className="text-[14px] font-semibold text-on-surface">Neural Sync Log</h3>
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[var(--accent)]" />
                  </span>
                </div>
                <div className="divide-y divide-outline-variant/40 max-h-60 overflow-y-auto custom-scrollbar">
                  {feed.map((e, i) => (
                    <div key={i} className="px-4 py-2.5 flex items-start gap-3">
                      <span className="font-mono text-[10px] text-on-surface-variant shrink-0 mt-0.5">{e.time}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] text-on-surface truncate">{e.label}</p>
                        <p className="text-[10px] font-mono text-on-surface-variant">{e.node}</p>
                      </div>
                      <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${e.type === 'success' ? 'bg-[var(--accent)]' : e.type === 'warn' ? 'bg-amber-400' : 'bg-primary'}`} />
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
