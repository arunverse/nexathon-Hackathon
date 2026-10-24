import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Sidebar } from '../../components/layout/Sidebar'
import { CompanyFeed } from '../../components/community/CompanyFeed'
import { CompanyDiscovery } from '../../components/community/CompanyDiscovery'
import { CommunityGroups } from '../../components/community/CommunityGroups'
import { CommunityNotifications } from '../../components/community/CommunityNotifications'
import { CompanyProfileModal } from '../../components/community/CompanyProfileModal'
import { SignalIntentSplitPane } from '../../components/community/SignalIntentSplitPane'
import InboxSentiment from './InboxSentiment'

type ViewTab = 'feed' | 'discover' | 'groups' | 'messages' | 'notifications'

export default function Community() {
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTab = (searchParams.get('tab') as ViewTab) || 'feed'
  const initialSplit = searchParams.get('split') === 'true'

  const [activeTab, setActiveTab] = useState<ViewTab>(initialTab)
  const [isSplitView, setIsSplitView] = useState(initialSplit)

  useEffect(() => {
    const t = searchParams.get('tab') as ViewTab
    if (t && ['feed', 'discover', 'groups', 'messages', 'notifications'].includes(t)) {
      setActiveTab(t)
    }
    if (searchParams.get('split') === 'true') {
      setIsSplitView(true)
    }
  }, [searchParams])

  // Company Profile Modal target
  const [selectedCompanyUserId, setSelectedCompanyUserId] = useState<string | null>(null)
  const [selectedCompanyName, setSelectedCompanyName] = useState<string | undefined>(undefined)

  function handleOpenProfile(userId: string, companyName?: string) {
    setSelectedCompanyUserId(userId)
    setSelectedCompanyName(companyName)
  }

  function handleOpenMessage(userId: string) {
    setSelectedCompanyUserId(null)
    setSearchParams({ tab: 'messages', to: userId })
    setActiveTab('messages')
  }

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex">
      <Sidebar />

      <main className="flex-1 md:ml-[240px] p-4 md:p-8 max-w-7xl mx-auto space-y-6 min-w-0">
        {/* Community Dashboard Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-[var(--border-subtle)]">
          <div>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[28px] text-[var(--accent-interactive)]">groups</span>
              <h1 className="text-[22px] font-bold tracking-tight text-[var(--text-primary)]">
                EBEXTA Business Community
              </h1>
            </div>
            <p className="text-[13px] text-[var(--text-muted)] mt-1">
              Verified B2B network for company intelligence, partnerships, corporate broadcasts, and direct connections.
            </p>
          </div>

          {/* Split View Toggle for Signals & Intent */}
          <button
            onClick={() => setIsSplitView(!isSplitView)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[12px] font-bold transition-all ${
              isSplitView
                ? 'bg-[var(--accent-interactive)] text-white shadow-lg'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-strong)] hover:text-[var(--text-primary)]'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">view_column</span>
            {isSplitView ? 'Close Signal & Intent Split View' : 'Signal & Intent Split View'}
          </button>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex flex-wrap items-center gap-2 p-1.5 rounded-2xl bg-[var(--bg-elevated)] border border-[var(--border-subtle)]">
          {[
            { id: 'feed', label: 'Company Feed', icon: 'feed' },
            { id: 'discover', label: 'Discover Companies', icon: 'travel_explore' },
            { id: 'groups', label: 'Groups', icon: 'groups' },
            { id: 'messages', label: 'Messages', icon: 'chat' },
            { id: 'notifications', label: 'Notifications', icon: 'notifications' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as ViewTab)
                setSearchParams({ tab: tab.id })
              }}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-[13px] font-semibold transition-all ${
                activeTab === tab.id
                  ? 'bg-[var(--accent-subtle)] text-[var(--accent-interactive)] border border-[var(--border-strong)] font-bold'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <span className="material-symbols-outlined text-[18px]">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Split View Section (Signal & Intent Stream) */}
        {isSplitView && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
            <SignalIntentSplitPane onOpenCompanyProfile={handleOpenProfile} />
          </motion.div>
        )}

        {/* Primary View Router */}
        <div>
          {activeTab === 'feed' && <CompanyFeed onOpenCompanyProfile={handleOpenProfile} />}
          {activeTab === 'discover' && <CompanyDiscovery onOpenCompanyProfile={handleOpenProfile} />}
          {activeTab === 'groups' && <CommunityGroups onOpenCompanyProfile={handleOpenProfile} />}
          {activeTab === 'messages' && <InboxSentiment embedded={true} />}
          {activeTab === 'notifications' && <CommunityNotifications />}
        </div>
      </main>

      {/* Company Profile Modal Overlay */}
      {selectedCompanyUserId && (
        <CompanyProfileModal
          userId={selectedCompanyUserId}
          companyName={selectedCompanyName}
          onClose={() => setSelectedCompanyUserId(null)}
          onOpenMessage={handleOpenMessage}
        />
      )}
    </div>
  )
}
