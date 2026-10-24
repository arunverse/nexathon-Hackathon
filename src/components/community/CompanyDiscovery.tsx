import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { DataOriginBadge } from './CompanyFeed'

interface CompanyDiscoveryProps {
  onOpenCompanyProfile: (userId: string, companyName?: string) => void
}

interface DiscoveredCompany {
  id: string
  company_name: string
  sender_email?: string | null
  mission?: string | null
  mode?: string | null
  website?: string | null
  company_profile?: {
    industry?: string
    employees?: string
    location?: string
    services?: string[]
    recent_signals?: string[]
  } | null
  created_at?: string
}

const DEMO_COMPANIES: DiscoveredCompany[] = [
  {
    id: 'demo-1',
    company_name: 'Manufacturer Seeking Logistics',
    mission: 'Auto components manufacturer expanding exports, need a freight forwarding and customs clearance partner for container shipments.',
    mode: 'seeker',
    website: 'https://autocomp-exports.in',
    company_profile: {
      industry: 'Manufacturing & Industrial',
      employees: '50-200',
      location: 'Pune / Chennai',
      services: ['Container Freight', 'Customs Clearance', 'Warehousing'],
      recent_signals: ['Hiring Export Managers', 'Expanding Factory Floor'],
    },
  },
  {
    id: 'demo-2',
    company_name: 'NexGen AI Automation Labs',
    mission: 'Enterprise AI agency specializing in custom LLM workflow automation, agentic pipelines, and automated customer operations.',
    mode: 'provider',
    website: 'https://nexgen-ai.io',
    company_profile: {
      industry: 'Technology & Software',
      employees: '11-50',
      location: 'Bengaluru, India',
      services: ['AI Integration', 'Agentic Workflows', 'Custom LLM Fine-Tuning'],
      recent_signals: ['Raised Seed Funding', 'Launched Multi-Agent Framework'],
    },
  },
  {
    id: 'demo-3',
    company_name: 'Kuber Freight & Logistics',
    mission: 'End-to-end multi-modal logistics platform providing air freight, port handling, and cold chain shipping across Pan-India.',
    mode: 'provider',
    website: 'https://kuberlogistics.com',
    company_profile: {
      industry: 'Logistics & Supply Chain',
      employees: '201-500',
      location: 'Mumbai / Delhi NCR',
      services: ['Cold Chain', 'Air Cargo', '3PL Warehousing'],
      recent_signals: ['Opened New Cold Storage Hub', 'Partnered with FMCG Giants'],
    },
  },
  {
    id: 'demo-4',
    company_name: 'Infinita Health Tech SaaS',
    mission: 'HIPAA-compliant telemedicine, electronic health record (EHR) management, and patient communication suite for clinics.',
    mode: 'seeker',
    website: 'https://infinita-health.com',
    company_profile: {
      industry: 'Healthcare & Pharma',
      employees: '51-200',
      location: 'Hyderabad, India',
      services: ['EHR Integration', 'Telemedicine APIs', 'Health Security'],
      recent_signals: ['SOC2 Certification Completed', 'Hiring Compliance Lead'],
    },
  },
  {
    id: 'demo-5',
    company_name: 'FinFlow Pay & Billing Engine',
    mission: 'Sub-second recurring billing and subscription revenue infrastructure for modern B2B SaaS companies.',
    mode: 'provider',
    website: 'https://finflow.dev',
    company_profile: {
      industry: 'Fintech & Banking',
      employees: '11-50',
      location: 'Bengaluru, India',
      services: ['Subscription Billing', 'Payout APIs', 'Tax Automation'],
      recent_signals: ['Series A Funding Announced', 'Processing $10M ARR'],
    },
  },
  {
    id: 'demo-6',
    company_name: 'Zenith Retail Commerce Solutions',
    mission: 'Omnichannel inventory sync and headless commerce storefront engineering for D2C brands.',
    mode: 'seeker',
    website: 'https://zenithretail.in',
    company_profile: {
      industry: 'E-commerce & Retail',
      employees: '51-200',
      location: 'Gurugram, India',
      services: ['Shopify Plus Migration', 'ERP Sync', 'D2C Analytics'],
      recent_signals: ['Expanding into SEA Market', 'Hiring Lead Engineers'],
    },
  },
]

const INDUSTRIES = [
  'All Industries',
  'Technology & Software',
  'E-commerce & Retail',
  'Healthcare & Pharma',
  'Fintech & Banking',
  'SaaS & Cloud Solutions',
  'Manufacturing & Industrial',
  'Logistics & Supply Chain',
  'Consulting & Professional Services',
]

export function CompanyDiscovery({ onOpenCompanyProfile }: CompanyDiscoveryProps) {
  const { user } = useAuth()
  const [companies, setCompanies] = useState<DiscoveredCompany[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndustry, setSelectedIndustry] = useState('All Industries')
  const [selectedSize, setSelectedSize] = useState('All Company Sizes')

  const fetchCompanies = useCallback(async () => {
    try {
      setLoading(true)
      let list: DiscoveredCompany[] = []

      const { data, error } = await supabase
        .from('profiles')
        .select('id, company_name, sender_email, mission, mode, website, company_profile, created_at')
        .order('created_at', { ascending: false })
        .limit(40)

      if (!error && data && data.length > 0) {
        list = data.map((d) => ({
          id: d.id,
          company_name: d.company_name || 'Enterprise Network Member',
          sender_email: d.sender_email,
          mission: d.mission,
          mode: d.mode,
          website: d.website,
          company_profile: d.company_profile as any,
          created_at: d.created_at,
        }))
      }

      // Merge with DEMO_COMPANIES to ensure rich discovery directory
      const mergedMap = new Map<string, DiscoveredCompany>()
      DEMO_COMPANIES.forEach((demo) => mergedMap.set(demo.id, demo))
      list.forEach((real) => {
        if (real.id !== user?.id) {
          mergedMap.set(real.id, real)
        }
      })

      setCompanies(Array.from(mergedMap.values()))
    } catch (err) {
      console.error('Error discovering companies:', err)
      setCompanies(DEMO_COMPANIES)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchCompanies()
  }, [fetchCompanies])

  const filteredCompanies = companies.filter((c) => {
    const name = c.company_name?.toLowerCase() || ''
    const mission = c.mission?.toLowerCase() || ''
    const ind = c.company_profile?.industry || ''
    const size = c.company_profile?.employees || ''

    const matchesSearch = name.includes(searchQuery.toLowerCase()) || mission.includes(searchQuery.toLowerCase())
    const matchesIndustry = selectedIndustry === 'All Industries' || ind.includes(selectedIndustry)
    const matchesSize = selectedSize === 'All Company Sizes' || size.includes(selectedSize)

    return matchesSearch && matchesIndustry && matchesSize
  })

  return (
    <div className="space-y-6">
      {/* Search & Filter Header Bar */}
      <div className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-4 shadow-sm">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-[20px] text-[var(--accent-interactive)]">travel_explore</span>
          <h3 className="text-[15px] font-bold text-[var(--text-primary)]" style={{ fontFamily: 'Geist, sans-serif' }}>
            Company Discovery Directory
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Keyword Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[17px] text-[var(--text-muted)]">
              search
            </span>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search companies by name, service or keyword..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none transition-colors"
            />
          </div>

          {/* Industry Filter */}
          <div>
            <select
              value={selectedIndustry}
              onChange={(e) => setSelectedIndustry(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none transition-colors"
            >
              {INDUSTRIES.map((ind) => (
                <option key={ind} value={ind}>
                  {ind}
                </option>
              ))}
            </select>
          </div>

          {/* Size Filter */}
          <div>
            <select
              value={selectedSize}
              onChange={(e) => setSelectedSize(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[12.5px] text-[var(--text-primary)] focus:border-[var(--accent-interactive)] focus:outline-none transition-colors"
            >
              <option value="All Company Sizes">All Company Sizes</option>
              <option value="11-50">11-50 employees</option>
              <option value="50-200">50-200 employees</option>
              <option value="201-500">201-500 employees</option>
              <option value="500+">500+ employees</option>
            </select>
          </div>
        </div>
      </div>

      {/* Directory Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] animate-pulse" />
          ))}
        </div>
      ) : filteredCompanies.length === 0 ? (
        <div className="text-center py-16 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] space-y-2">
          <span className="material-symbols-outlined text-[36px] text-[var(--text-muted)]">corporate_fare</span>
          <h4 className="text-[14px] font-bold text-[var(--text-primary)]">No companies found matching criteria</h4>
          <p className="text-[12px] text-[var(--text-muted)]">Try adjusting your industry filters or search terms.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredCompanies.map((c) => {
            const cp = c.company_profile || {}
            return (
              <motion.div
                key={c.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all flex flex-col justify-between space-y-4 shadow-xs"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-[var(--accent-subtle)] to-[var(--bg-surface)] border border-[var(--border-strong)] flex items-center justify-center font-bold text-[17px] text-[var(--accent-interactive)] shrink-0 shadow-xs">
                        {c.company_name ? c.company_name[0]?.toUpperCase() : 'C'}
                      </div>
                      <div>
                        <h4
                          className="text-[14.5px] font-bold text-[var(--text-primary)] hover:text-[var(--accent-interactive)] transition-colors cursor-pointer"
                          style={{ fontFamily: 'Geist, sans-serif' }}
                          onClick={() => onOpenCompanyProfile(c.id, c.company_name)}
                        >
                          {c.company_name}
                        </h4>
                        <p className="text-[11px] text-[var(--text-muted)] mt-0.5">
                          {cp.industry || 'B2B Enterprise'} • {cp.employees || '50-200'}
                        </p>
                      </div>
                    </div>

                    <DataOriginBadge origin="ebexta_verified" />
                  </div>

                  <p className="text-[12.5px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                    {c.mission || 'Strategic enterprise member operating in the EBEXTA B2B network.'}
                  </p>
                </div>

                <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  <span className="text-[11px] font-bold text-[var(--accent-interactive)] uppercase tracking-wider">
                    Mode: {c.mode || 'Seeker'}
                  </span>
                  <button
                    onClick={() => onOpenCompanyProfile(c.id, c.company_name)}
                    className="px-3.5 py-1.5 rounded-xl text-[12px] font-bold bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] hover:bg-[var(--accent-interactive)] hover:text-white transition-all flex items-center gap-1 cursor-pointer"
                  >
                    View Network Profile
                    <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
                  </button>
                </div>
              </motion.div>
            )
          })}
        </div>
      )}
    </div>
  )
}
