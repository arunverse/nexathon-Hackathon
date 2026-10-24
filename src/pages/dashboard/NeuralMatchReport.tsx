import { useNavigate, useParams } from 'react-router-dom'
import { Sidebar } from '../../components/layout/Sidebar'
import { ProgressBar } from '../../components/ui/ProgressBar'
import { ProfileMenu } from '../../components/layout/ProfileMenu'
import { EbextaLogo } from '../../components/common/EbextaLogo'

const metrics = [
  { label: 'Proximity Score', value: '0.92', pct: 92, color: 'primary' },
  { label: 'Velocity Factor', value: 'High', pct: 85, color: 'primary' },
  { label: 'Risk Vector', value: 'Minimal', pct: 12, color: 'violet' },
  { label: 'Confidence', value: 'Verified', pct: 99, color: 'primary' },
]

const seekerNeeds = [
  { title: 'Global Payout Infrastructure', detail: 'Requirement for multi-region ledgering & complex settlement.' },
  { title: 'Low-Latency API Hooks', detail: 'Webhook response times must sit under 250ms consistently.' },
  { title: 'AML/KYC Automation', detail: 'Automated identity verification for cross-border flows.' },
]

const providerAttrs = [
  { title: 'Stripe Treasury & Issuing', detail: 'Proprietary ledger infrastructure across 45+ countries.' },
  { title: '99.999% API Uptime', detail: 'Best-in-class developer platform with ultra-low latency.' },
  { title: 'Stripe Identity Suite', detail: 'Integrated KYC matching all Seeker compliance metrics.' },
]

const chartBars = [
  { h: 40, type: 'primary' },
  { h: 65, type: 'primary' },
  { h: 80, type: 'secondary' },
  { h: 45, type: 'primary' },
  { h: 90, type: 'primary' },
  { h: 60, type: 'secondary' },
  { h: 30, type: 'primary' },
]

const sideCards = [
  { accent: 'primary', label: 'Bilateral Strength', value: '9.8/10', detail: 'Signal strength is optimized for immediate outreach.' },
  { accent: 'secondary', label: 'Competitor Noise', value: 'Low (1.2%)', detail: 'Minimal overlap with Adyen or Checkout.com intent.' },
  { accent: 'violet', label: 'Signal Source', value: 'Looming RFP', detail: 'Early-stage RFP detected in internal procurement signals.' },
]

const stakeholders = [
  { name: 'Sarah Chen', title: 'VP of Engineering', role: 'Decision Maker', roleIcon: 'check_circle', roleColor: 'text-[var(--accent-interactive)]', sentiment: 88 },
  { name: 'Jameson Burke', title: 'Head of Partnerships', role: 'Influencer', roleIcon: 'bolt', roleColor: 'text-primary', sentiment: 72 },
  { name: 'Elena Rodriguez', title: 'Strategic Sourcing', role: 'Gatekeeper', roleIcon: 'key', roleColor: 'text-outline', sentiment: 94 },
]

const nextSteps = [
  { n: '01', title: 'Engage Sarah Chen via LinkedIn', detail: "Reference 'Latency Reduction' whitepaper." },
  { n: '02', title: 'Ship Custom Technical Sandbox', detail: 'Pre-configured with Stripe-EBEXTA bridge.' },
  { n: '03', title: 'Schedule Bilateral Discovery', detail: 'Targeting Week 46 procurement cycle.' },
]

function geo(fontFamily: string) {
  return { fontFamily }
}

export default function NeuralMatchReport() {
  const navigate = useNavigate()
  const { id } = useParams()

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      {/* TopBar */}
      <header className="fixed top-0 right-0 w-[calc(100%-240px)] h-16 bg-surface border-b border-outline-variant z-40 flex justify-between items-center px-6">
        <div className="flex items-center gap-6">
          <button onClick={() => navigate(`/dashboard/lead/${id}`)} className="text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <span className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>Neural Match Report</span>
          <div className="h-6 w-px bg-outline-variant" />
          <div className="flex items-center gap-2 bg-surface-container px-4 py-1 rounded-full border border-outline-variant">
            <span className="material-symbols-outlined text-[18px] text-primary">verified</span>
            <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface uppercase">Bilateral Validated</span>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-2 px-4 py-2 bg-primary-container text-on-primary-container rounded-lg text-[11px] font-bold tracking-[0.06em] uppercase hover:opacity-80 transition-opacity active:scale-[0.98]">
            <span className="material-symbols-outlined">download</span>
            Export Dossier
          </button>
          <button className="flex items-center gap-2 px-4 py-2 border border-outline-variant text-on-surface rounded-lg text-[11px] font-bold tracking-[0.06em] uppercase hover:bg-surface-container transition-colors">
            <span className="material-symbols-outlined">refresh</span>
            Refresh Scan
          </button>
          <button className="p-2 text-on-surface-variant hover:text-on-surface transition-colors">
            <span className="material-symbols-outlined text-[22px]">notifications</span>
          </button>
          <ProfileMenu />
        </div>
      </header>

      <main className="ml-0 md:ml-[240px] pt-16 min-h-screen p-6 max-w-[1200px] w-full custom-scrollbar overflow-y-auto">

        {/* Identity Header */}
        <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          <div className="md:col-span-2">
            <div className="flex items-center gap-4 mb-4">
              <div className="px-3 py-2 bg-surface-container-high rounded-xl border border-outline-variant flex items-center justify-center">
                <EbextaLogo variant="horizontal" size={24} priority />
              </div>
              <span className="material-symbols-outlined text-outline">swap_horiz</span>
              <div className="px-4 py-2 bg-surface-container-high rounded-xl border border-outline-variant flex items-center justify-center w-14 h-14">
                <span className="text-[20px] font-bold text-on-surface-variant">S</span>
              </div>
            </div>
            <h1 className="text-[36px] font-bold leading-[1.2] tracking-[-0.04em] text-on-surface mb-2" style={geo('Geist, Inter, sans-serif')}>
              Bilateral Intelligence Dossier
            </h1>
            <p className="text-[16px] text-on-surface-variant">
              Target: <span className="text-primary font-bold">Stripe, Inc.</span> • Strategic Partnership Matching Engine
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className="text-[11px] font-bold tracking-[0.06em] text-outline uppercase" style={geo('JetBrains Mono, monospace')}>Report ID: NX-9921-ST</span>
            <span className="text-[11px] font-bold tracking-[0.06em] text-outline uppercase" style={geo('JetBrains Mono, monospace')}>Generated: Oct 24, 2023</span>
          </div>
        </section>

        {/* Executive Intelligence Summary */}
        <section className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-10">
          {/* Match probability card */}
          <div className="md:col-span-4 glass-panel p-6 rounded-xl flex flex-col justify-between border-t-2 border-t-primary-container intent-glow relative overflow-hidden">
            <div className="relative z-10">
              <span className="text-[11px] font-bold tracking-[0.06em] text-primary uppercase mb-1 block">Match Probability</span>
              <div className="flex items-baseline gap-2">
                <span className="text-[48px] font-bold leading-[1.1] tracking-[-0.04em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>98.4</span>
                <span className="text-[20px] font-semibold text-primary" style={geo('Geist, Inter, sans-serif')}>%</span>
              </div>
              <p className="text-on-surface-variant text-[14px] mt-4">
                Exceptional structural alignment detected across 14 distinct neural signals. Bilateral proximity exceeds standard enterprise thresholds.
              </p>
            </div>
          </div>

          {/* 4 metric mini-cards */}
          <div className="md:col-span-8 glass-panel p-6 rounded-xl grid grid-cols-2 md:grid-cols-4 gap-6">
            {metrics.map((m) => (
              <div key={m.label} className="space-y-2">
                <span className="text-[11px] font-bold tracking-[0.06em] text-outline uppercase">{m.label}</span>
                <p className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>{m.value}</p>
                <div className="w-full bg-surface-container h-1 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.color === 'violet' ? 'bg-[var(--accent)]' : 'bg-[var(--accent)]'}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Firmographic Alignment */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">align_horizontal_left</span>
            <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>Firmographic Alignment</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-outline-variant/30 rounded-xl overflow-hidden border border-outline-variant">
            {/* Seeker */}
            <div className="bg-surface-dim p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[11px] font-bold tracking-[0.06em] text-primary uppercase">Seeker Requirements (EBEXTA)</span>
                <span className="material-symbols-outlined text-outline">search</span>
              </div>
              <ul className="space-y-4">
                {seekerNeeds.map((n) => (
                  <li key={n.title} className="flex items-start gap-4 p-4 bg-surface-container rounded-lg border border-outline-variant/50">
                    <span className="material-symbols-outlined text-primary mt-1 shrink-0">check_circle</span>
                    <div>
                      <p className="text-[14px] font-bold text-on-surface">{n.title}</p>
                      <p className="text-[14px] text-on-surface-variant">{n.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            {/* Provider */}
            <div className="bg-surface-dim p-6">
              <div className="flex justify-between items-center mb-6">
                <span className="text-[11px] font-bold tracking-[0.06em] text-secondary uppercase">Provider Attributes (Stripe)</span>
                <span className="material-symbols-outlined text-outline">shield</span>
              </div>
              <ul className="space-y-4">
                {providerAttrs.map((a) => (
                  <li key={a.title} className="flex items-start gap-4 p-4 bg-secondary-container/10 rounded-lg border border-secondary/20">
                    <span className="material-symbols-outlined text-secondary mt-1 shrink-0">done_all</span>
                    <div>
                      <p className="text-[14px] font-bold text-on-surface">{a.title}</p>
                      <p className="text-[14px] text-on-surface-variant">{a.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Neural Intent Waves */}
        <section className="mb-10 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 glass-panel rounded-xl p-6 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">analytics</span>
                <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>Neural Intent Waves</h2>
              </div>
              <div className="flex gap-4">
                <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] text-outline">
                  <div className="w-2 h-2 rounded-full bg-primary" /> Financial Pulse
                </span>
                <span className="flex items-center gap-1 text-[10px] font-bold tracking-[0.06em] text-outline">
                  <div className="w-2 h-2 rounded-full bg-secondary" /> Tech Interest
                </span>
              </div>
            </div>
            <div className="flex-1 min-h-[240px] flex items-end justify-between gap-1 relative">
              {chartBars.map((bar, i) => (
                <div
                  key={i}
                  className="flex-1 bg-surface-container-high rounded-t-sm relative overflow-hidden group hover:-translate-y-1 transition-transform cursor-default"
                  style={{ height: `${bar.h}%` }}
                >
                  <div className={`absolute inset-0 ${bar.type === 'primary' ? 'bg-primary' : 'bg-secondary'} opacity-25 group-hover:opacity-40 transition-opacity`} />
                  <div className={`absolute bottom-0 left-0 right-0 h-[2px] ${bar.type === 'primary' ? 'bg-primary' : 'bg-secondary'}`} />
                </div>
              ))}
              {/* Grid lines */}
              <div className="absolute inset-0 pointer-events-none flex flex-col justify-between opacity-10">
                {[0,1,2,3].map(i => <div key={i} className="border-t border-on-surface w-full" />)}
              </div>
            </div>
            <div className="flex justify-between mt-4" style={geo('JetBrains Mono, monospace')}>
              {['Q1 2023','Q2 2023','Q3 2023','Q4 2023 (PROJ.)'].map(q => (
                <span key={q} className="text-[10px] text-outline">{q}</span>
              ))}
            </div>
          </div>

          {/* Side metric cards */}
          <div className="space-y-6">
            {sideCards.map((c) => (
              <div
                key={c.label}
                className={`glass-panel p-6 rounded-xl border-l-4 ${
                  c.accent === 'primary' ? 'border-l-primary' :
                  c.accent === 'secondary' ? 'border-l-secondary' :
                  'border-l-[var(--accent)]'
                }`}
              >
                <span className="text-[11px] font-bold tracking-[0.06em] text-outline uppercase block mb-1">{c.label}</span>
                <p className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface font-bold" style={geo('Geist, Inter, sans-serif')}>{c.value}</p>
                <p className="text-[14px] text-on-surface-variant mt-2">{c.detail}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Verified Stakeholders */}
        <section className="mb-10">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">groups</span>
              <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>Verified Stakeholders</h2>
            </div>
            <button className="text-primary font-bold text-[11px] tracking-[0.06em] uppercase hover:underline">Reveal All (12)</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {stakeholders.map((s) => (
              <div key={s.name} className="glass-panel p-4 rounded-xl hover:border-primary transition-all duration-300 cursor-pointer">
                <div className="flex gap-4 mb-4">
                  <div className="w-16 h-16 rounded-lg border border-outline-variant bg-surface-container-high flex items-center justify-center shrink-0">
                    <span className="text-[24px] font-bold text-on-surface-variant">{s.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="text-[14px] font-bold text-on-surface">{s.name}</p>
                    <p className="text-[10px] font-bold tracking-[0.06em] text-outline uppercase">{s.title}</p>
                    <div className="flex items-center gap-1 mt-1">
                      <span className={`material-symbols-outlined text-[14px] ${s.roleColor}`} style={{ fontVariationSettings: "'FILL' 1" }}>{s.roleIcon}</span>
                      <span className={`text-[10px] font-bold tracking-[0.06em] uppercase ${s.roleColor}`}>{s.role}</span>
                    </div>
                  </div>
                </div>
                <div className="bg-surface-container p-2 rounded-lg border border-outline-variant">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold tracking-[0.06em] text-outline uppercase">Sentiment Score</span>
                    <span className="text-[10px] font-bold text-primary" style={geo('JetBrains Mono, monospace')}>{s.sentiment}/100</span>
                  </div>
                  <ProgressBar value={s.sentiment} height="sm" />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Neural Recommendation Engine */}
        <section className="mb-10 glass-panel p-6 rounded-xl border-t-4 border-t-primary relative">
          <div className="flex items-center gap-2 mb-6">
            <span className="material-symbols-outlined text-primary">auto_awesome</span>
            <h2 className="text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-on-surface" style={geo('Geist, Inter, sans-serif')}>Neural Recommendation Engine</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div className="space-y-6">
              <div>
                <p className="text-[11px] font-bold tracking-[0.2em] text-primary uppercase mb-2" style={geo('JetBrains Mono, monospace')}>EBEXTA ENGINE STRATEGY SELECTION</p>
                <h3 className="text-[20px] font-semibold text-on-surface mb-4" style={geo('Geist, Inter, sans-serif')}>"The Technical Pioneer" Approach</h3>
                <p className="text-[14px] text-on-surface-variant">
                  Based on Sarah Chen's recent whitepaper on 'Decentralized Ledger Latency,' the optimal outreach should prioritize engineering depth over commercial incentives. Lead with the EBEXTA 'Zero-Copy' API protocol.
                </p>
              </div>
              <div className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full border border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-[18px]">hub</span>
                  <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface uppercase">Direct Intro: Tier 1</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-surface-container-high rounded-full border border-outline-variant">
                  <span className="material-symbols-outlined text-primary text-[18px]">history_edu</span>
                  <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface uppercase">Contract Value: $1.2M</span>
                </div>
              </div>
            </div>
            <div className="space-y-4">
              <p className="text-[11px] font-bold tracking-[0.2em] text-outline uppercase" style={geo('JetBrains Mono, monospace')}>SUGGESTED NEXT STEPS</p>
              {nextSteps.map((step) => (
                <div key={step.n} className="flex items-center gap-4 p-4 bg-surface-container-lowest rounded-xl border border-outline-variant/30 hover:bg-surface-container transition-colors group cursor-pointer">
                  <span className="shrink-0 w-8 h-8 rounded-full bg-primary-container flex items-center justify-center text-[13px] font-bold text-on-primary-container" style={geo('JetBrains Mono, monospace')}>
                    {step.n}
                  </span>
                  <div className="flex-1">
                    <p className="text-[14px] font-bold text-on-surface">{step.title}</p>
                    <p className="text-[14px] text-outline">{step.detail}</p>
                  </div>
                  <span className="material-symbols-outlined text-outline group-hover:text-primary transition-colors">chevron_right</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-4 border-t border-outline-variant flex justify-between items-center text-on-surface-variant text-[11px] font-bold tracking-[0.06em] uppercase">
          <div className="flex items-center gap-6">
            <EbextaLogo variant="horizontal" size={20} />
            {['Privacy','Terms','API Docs'].map(l => (
              <a key={l} href="#" className="hover:text-primary transition-colors">{l}</a>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[var(--accent)] animate-pulse" />
            <span>System Status: Optimal</span>
          </div>
        </footer>
      </main>
    </div>
  )
}
