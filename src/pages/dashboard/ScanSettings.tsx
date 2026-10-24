import { useState } from 'react'
import { Sidebar } from '../../components/layout/Sidebar'
import { ProfileMenu } from '../../components/layout/ProfileMenu'

const sources = [
  { icon: 'link', label: 'LinkedIn', on: true },
  { icon: 'show_chart', label: 'Crunchbase', on: true },
  { icon: 'share', label: 'Twitter / X', on: false },
  { icon: 'newspaper', label: 'News Pulses', on: true },
  { icon: 'account_balance', label: 'Financial Reports', on: true },
]

export default function ScanSettings() {
  const [weights, setWeights] = useState({ firmographics: 45, behavioral: 30, bilateral: 25 })
  const [sensitivity, setSensitivity] = useState(2)
  const [stale, setStale] = useState('7 Days')
  const [autoVerify, setAutoVerify] = useState(true)
  const [srcs, setSrcs] = useState(sources.map(s => s.on))

  function setWeight(key: keyof typeof weights, val: number) {
    setWeights(w => ({ ...w, [key]: val }))
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="ml-0 md:ml-[240px] mt-0 flex flex-col min-h-screen">
        {/* TopBar */}
        <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 flex justify-between items-center px-6 border-b border-outline-variant bg-surface z-40">
          <div className="flex items-center flex-1 max-w-xl">
            <div className="relative w-full">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
              <input className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg py-1.5 pl-10 pr-4 text-[14px] focus:ring-1 focus:ring-primary outline-none transition-all text-on-surface" placeholder="Global engine search..." type="text" />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button className="p-2 text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">notifications</span></button>
            <button className="p-2 text-on-surface-variant hover:text-primary"><span className="material-symbols-outlined">help_outline</span></button>
            <button className="bg-primary-container text-on-primary-container px-4 py-1.5 rounded-lg text-[11px] font-bold tracking-[0.06em]">Create Match</button>
            <ProfileMenu />
          </div>
        </header>

        <div className="mt-16 p-6 flex-1">
          {/* Page header */}
          <div className="mb-10 flex items-end justify-between">
            <div>
              <h2 className="text-[32px] font-semibold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Neural Scan Settings</h2>
              <p className="text-[14px] text-on-surface-variant">Calibrate the intelligence engine for precision lead discovery.</p>
            </div>
            <div className="flex gap-2">
              <button className="px-4 py-2 border border-outline-variant rounded-lg text-[14px] hover:bg-surface-container transition-colors text-on-surface">Discard Changes</button>
              <button className="px-4 py-2 rounded-lg text-[14px] font-bold transition-all text-black" style={{ backgroundColor: 'var(--accent)', boxShadow: '0 0 15px rgba(16,185,129,0.3)' }}>Commit Configuration</button>
            </div>
          </div>

          <div className="grid grid-cols-12 gap-6">
            {/* Configuration column */}
            <div className="col-span-8 space-y-6">
              {/* Engine Weighting */}
              <section className="p-6 bg-surface-container-low border border-outline-variant rounded-xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/30" />
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-primary">balance</span>
                  <h3 className="text-[20px] font-semibold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Engine Weighting</h3>
                </div>
                <div className="space-y-10">
                  {([
                    { key: 'firmographics' as const, label: 'Firmographics', desc: 'Company size, revenue thresholds, and vertical alignment.' },
                    { key: 'behavioral' as const, label: 'Behavioral Intent', desc: 'Real-time website visits, keyword search pulses, and ad engagement.' },
                    { key: 'bilateral' as const, label: 'Bilateral Strength', desc: 'Mutual connection signals and historical interaction depth.' },
                  ] as const).map(w => (
                    <div key={w.key} className="space-y-2">
                      <div className="flex justify-between items-center">
                        <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">{w.label}</label>
                        <span className="text-[13px] font-mono text-primary bg-primary/10 px-2 py-0.5 rounded">{weights[w.key]}%</span>
                      </div>
                      <input
                        type="range" min={0} max={100} value={weights[w.key]}
                        onChange={e => setWeight(w.key, Number(e.target.value))}
                        className="w-full accent-primary"
                      />
                      <p className="text-[10px] text-on-surface-variant opacity-60">{w.desc}</p>
                    </div>
                  ))}
                </div>
              </section>

              {/* Signal Sensitivity + Integrity */}
              <div className="grid grid-cols-2 gap-6">
                <section className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-amber-400">sensors_off</span>
                    <h3 className="text-[20px] font-semibold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Signal Sensitivity</h3>
                  </div>
                  <div className="p-4 rounded-lg bg-surface border border-outline-variant hover:border-amber-400/50 transition-colors">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[14px] font-bold text-on-surface">Match Depth</span>
                      <span className="text-[10px] font-bold tracking-[0.06em] text-amber-400 border border-amber-400 px-1.5 rounded">Precision Mode</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-bold opacity-40">Broad</span>
                      <input
                        type="range" min={0} max={2} value={sensitivity}
                        onChange={e => setSensitivity(Number(e.target.value))}
                        className="flex-1 accent-amber-400"
                      />
                      <span className="text-[9px] font-bold text-amber-400">Precision</span>
                    </div>
                  </div>
                  <p className="text-[11px] text-on-surface-variant leading-tight mt-4">Currently set to 99%+ confidence. This will significantly reduce match volume but maximize accuracy.</p>
                </section>

                <section className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                  <div className="flex items-center gap-2 mb-6">
                    <span className="material-symbols-outlined text-[var(--accent-interactive)]">verified_user</span>
                    <h3 className="text-[20px] font-semibold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Integrity Shield</h3>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <label className="text-[14px] text-on-surface">Stale Data Purge</label>
                      <select
                        value={stale} onChange={e => setStale(e.target.value)}
                        className="bg-surface border border-outline-variant rounded-md text-[11px] font-mono p-1 focus:ring-1 focus:ring-primary outline-none text-on-surface"
                      >
                        <option>24 Hours</option>
                        <option>7 Days</option>
                        <option>30 Days</option>
                      </select>
                    </div>
                    <div className="flex justify-between items-center py-2 border-b border-outline-variant">
                      <label className="text-[14px] text-on-surface">Confidence Interval</label>
                      <span className="text-[13px] font-mono text-[var(--accent-interactive)]">STRICT</span>
                    </div>
                    <div className="flex justify-between items-center py-2">
                      <label className="text-[14px] text-on-surface">Auto-Verification</label>
                      <button
                        type="button"
                        onClick={() => setAutoVerify(v => !v)}
                        className="w-10 h-5 rounded-full relative transition-colors"
                        style={{ backgroundColor: autoVerify ? 'var(--accent)' : 'var(--color-surface-variant)' }}
                      >
                        <div className="absolute top-0.5 w-4 h-4 bg-black rounded-full transition-transform" style={{ transform: autoVerify ? 'translateX(22px)' : 'translateX(2px)' }} />
                      </button>
                    </div>
                  </div>
                </section>
              </div>

              {/* Data Sources */}
              <section className="p-6 bg-surface-container-low border border-outline-variant rounded-xl">
                <div className="flex items-center gap-2 mb-6">
                  <span className="material-symbols-outlined text-primary">database</span>
                  <h3 className="text-[20px] font-semibold text-on-surface" style={{ fontFamily: 'Geist, Inter, sans-serif' }}>Data Source Management</h3>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                  {sources.map((s, i) => (
                    <div key={s.label} className="flex items-center justify-between p-4 bg-surface-container rounded-lg border border-outline-variant">
                      <div className="flex items-center gap-3">
                        <span className="material-symbols-outlined text-[18px]">{s.icon}</span>
                        <span className="text-[14px] text-on-surface">{s.label}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSrcs(prev => prev.map((v, j) => j === i ? !v : v))}
                        className="w-10 h-5 rounded-full relative transition-colors"
                        style={{ backgroundColor: srcs[i] ? 'var(--color-primary-container)' : 'var(--color-surface-variant)' }}
                      >
                        <div className="absolute top-0.5 w-3 h-3 rounded-full transition-transform" style={{ transform: srcs[i] ? 'translateX(23px)' : 'translateX(2px)', backgroundColor: srcs[i] ? 'var(--color-on-primary-container)' : 'var(--color-on-surface-variant)' }} />
                      </button>
                    </div>
                  ))}
                  <div className="flex items-center gap-3 p-4 bg-surface-container rounded-lg border border-outline-variant border-dashed opacity-50 cursor-pointer hover:opacity-70">
                    <span className="material-symbols-outlined text-[18px]">add</span>
                    <span className="text-[14px]">Custom Hook</span>
                  </div>
                </div>
              </section>
            </div>

            {/* Preview sidebar */}
            <aside className="col-span-4 space-y-6">
              <div className="sticky top-24 space-y-6">
                <section className="glass-panel border border-outline-variant rounded-xl overflow-hidden">
                  <div className="p-4 bg-surface-container-high flex justify-between items-center">
                    <h4 className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Live Impact Preview</h4>
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ backgroundColor: 'var(--accent)' }} />
                      <span className="relative inline-flex rounded-full h-2 w-2" style={{ backgroundColor: 'var(--accent)' }} />
                    </span>
                  </div>
                  <div className="p-6 space-y-10">
                    <div className="text-center py-10 bg-background/50 rounded-lg border border-outline-variant/30">
                      <p className="text-[11px] font-bold tracking-[0.06em] opacity-50 mb-2">Expected Daily Matches</p>
                      <div className="text-[48px] font-bold leading-[1.1] tracking-[-0.04em]" style={{ color: 'var(--accent)', fontFamily: 'Geist, Inter, sans-serif' }}>14</div>
                      <div className="mt-4 flex justify-center items-center gap-4">
                        <div className="h-12 w-px bg-outline-variant" />
                        <div className="text-left">
                          <p className="text-[13px] font-mono text-amber-400">-42% volume</p>
                          <p className="text-[13px] font-mono text-[var(--accent-interactive)]">+88% accuracy</p>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      {[{ label: 'Funnel Velocity', val: '2.4m/match', pct: 66 }, { label: 'GPU Load', val: '18%', pct: 18 }].map(m => (
                        <div key={m.label}>
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-[14px] text-on-surface-variant">{m.label}</span>
                            <span className="text-[13px] font-mono">{m.val}</span>
                          </div>
                          <div className="w-full bg-outline-variant h-1 rounded-full overflow-hidden">
                            <div className="bg-primary h-full rounded-full" style={{ width: `${m.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>

                <div className="p-6 rounded-xl border border-outline-variant bg-surface-container-lowest h-64 flex flex-col items-center justify-center relative overflow-hidden">
                  <span className="material-symbols-outlined text-[48px] text-primary animate-pulse">hub</span>
                  <p className="text-[11px] font-bold tracking-[0.06em] mt-4 text-on-surface-variant">Neural Grid State: Optimal</p>
                  <div className="absolute bottom-4 left-4 right-4">
                    <div className="p-2 bg-surface-container-high/50 border border-outline-variant rounded font-mono text-[10px] text-primary/70">
                      system_status: monitoring...<br />
                      sensitivity_locked: precision_ext...
                    </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </main>
    </div>
  )
}
