import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabaseConfigured } from './lib/supabase'
import { AuthProvider } from './contexts/AuthContext'
import { ToastProvider } from './contexts/ToastContext'
import { EbextaAIPanel } from './components/ebexta-ai/EbextaAIPanel'
import { CompanyProfilePrompt } from './components/CompanyProfilePrompt'
import { ProtectedRoute } from './components/auth/ProtectedRoute'
import { PlanGate } from './components/auth/PlanGate'
import { AdminRoute } from './components/auth/AdminRoute'
import { Layout } from './components/Layout'
import { CanonicalManager } from './components/common/CanonicalManager'

import LandingPage from './pages/LandingPage'
import AboutPage from './pages/AboutPage'
import B2BBusinessIntelligencePage from './pages/B2BBusinessIntelligencePage'
import BusinessSignalsPage from './pages/BusinessSignalsPage'
import B2BIntentIntelligencePage from './pages/B2BIntentIntelligencePage'
import CompanyIntelligencePage from './pages/CompanyIntelligencePage'
import B2BBusinessNetworkPage from './pages/B2BBusinessNetworkPage'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LegalPage from './pages/LegalPage'
import CareersPage from './pages/CareersPage'
import ChoosePlan from './pages/ChoosePlan'
import Welcome from './pages/Welcome'
import OnboardingProfile from './pages/onboarding/OnboardingProfile'
import OnboardingFilters from './pages/onboarding/OnboardingFilters'
import OnboardingGeography from './pages/onboarding/OnboardingGeography'

/** Auth + active-plan gate. No plan → redirected to /choose-plan. */
function Gated({ children }: { children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <PlanGate>{children}</PlanGate>
    </ProtectedRoute>
  )
}

// Protected: scan
import DeepScanActive from './pages/DeepScanActive'

// Protected: dashboard
import IntelligenceHub from './pages/IntelligenceHub'
import LeadDetail from './pages/dashboard/LeadDetail'
import NeuralMatchReport from './pages/dashboard/NeuralMatchReport'
import NeuralEmailEditor from './pages/dashboard/NeuralEmailEditor'
import InboxSentiment from './pages/dashboard/InboxSentiment'
import IntelligenceStats from './pages/dashboard/IntelligenceStats'
import DeclaredIntentBoard from './pages/dashboard/DeclaredIntentBoard'
import GlobalIntelligenceDiscovery from './pages/GlobalIntelligenceDiscovery'
import Settings from './pages/dashboard/Settings'
import RenewPlan from './pages/dashboard/RenewPlan'
import ScanSettings from './pages/dashboard/ScanSettings'
import NetworkStatusDashboard from './pages/dashboard/NetworkStatusDashboard'
import SignalWatch from './pages/dashboard/SignalWatch'
import VerifiedContactsPage from './pages/dashboard/VerifiedContactsPage'
import SavedLeads from './pages/dashboard/SavedLeads'
import Companies from './pages/dashboard/Companies'
import CompanyMemory from './pages/dashboard/CompanyMemory'
import RoiDashboard from './pages/dashboard/RoiDashboard'
import UsagePage from './pages/dashboard/UsagePage'
import Community from './pages/dashboard/Community'

// Admin console (DEV-ONLY auth — see AdminRoute)
import AdminLayout from './pages/admin/AdminLayout'
import AdminOverview from './pages/admin/AdminOverview'
import AdminCareers from './pages/admin/AdminCareers'
import AdminQueue from './pages/admin/AdminQueue'
import AdminUsers from './pages/admin/AdminUsers'
import AdminRequests from './pages/admin/AdminRequests'
import AdminDossiers from './pages/admin/AdminDossiers'
import AdminLeads from './pages/admin/AdminLeads'
import AdminVerifiedLeads from './pages/admin/AdminVerifiedLeads'
import AdminApi from './pages/admin/AdminApi'
import AdminIntents from './pages/admin/AdminIntents'
import AdminLogs from './pages/admin/AdminLogs'
import AdminReviews from './pages/admin/AdminReviews'
import AdminRules from './pages/admin/AdminRules'
import AdminSupport from './pages/admin/AdminSupport'
import AdminConversations from './pages/admin/AdminConversations'
import AdminAccuracy from './pages/admin/AdminAccuracy'
import { SessionBanner } from './components/SessionBanner'

function App() {
  // Fail loud, not silent: if the critical Supabase env vars are missing the app
  // can't function (no auth, no data). Show a clear configuration error instead
  // of a half-working UI or a blank white page.
  if (!supabaseConfigured) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#1D2636', color: '#F5F3EF', fontFamily: 'Geist, Inter, sans-serif', padding: 24,
      }}>
        <div style={{ maxWidth: 460, textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 12 }}>Configuration error</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, opacity: 0.85 }}>
            EBEXTA can’t start because required environment variables are missing.
            Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the
            hosting environment, then redeploy.
          </p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <CanonicalManager />
      <AuthProvider>
        <ToastProvider>
        {/* States the cause once, at the top, instead of letting a dead
            session surface as a dozen unrelated data errors. */}
        <SessionBanner />
        <Layout>
          <Routes>
            {/* Public */}
            <Route path="/" element={<LandingPage />} />
            {/* Marketing homepage (also at /home). The interactive demo opens
                inline here as an overlay — there is no separate /demo URL. */}
            <Route path="/home" element={<LandingPage forceShow />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/b2b-business-intelligence" element={<B2BBusinessIntelligencePage />} />
            <Route path="/business-signals" element={<BusinessSignalsPage />} />
            <Route path="/b2b-intent-intelligence" element={<B2BIntentIntelligencePage />} />
            <Route path="/company-intelligence" element={<CompanyIntelligencePage />} />
            <Route path="/b2b-business-network" element={<B2BBusinessNetworkPage />} />
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />

            {/* Public legal pages (linked from signup consent + footer) */}
            <Route path="/terms" element={<LegalPage doc="terms" />} />
            <Route path="/privacy" element={<LegalPage doc="privacy" />} />
            <Route path="/refund" element={<LegalPage doc="refund" />} />
            <Route path="/dpdp" element={<LegalPage doc="dpdp" />} />

            {/* Public Careers Page */}
            <Route path="/careers" element={<CareersPage />} />
            <Route path="/careers/:roleSlug" element={<CareersPage />} />

            {/* Auth required, but NOT plan-gated (this is where you get a plan) */}
            <Route path="/choose-plan" element={<ProtectedRoute><ChoosePlan /></ProtectedRoute>} />

            {/* Route aliases for seamless navigation from notifications & links */}
            <Route path="/inbox" element={<Navigate to="/dashboard/community?tab=messages" replace />} />
            <Route path="/dashboard/inbox" element={<Navigate to="/dashboard/community?tab=messages" replace />} />
            <Route path="/settings" element={<Navigate to="/dashboard/settings" replace />} />
            <Route path="/profile" element={<Navigate to="/dashboard/settings" replace />} />
            <Route path="/dashboard/profile" element={<Navigate to="/dashboard/settings" replace />} />
            <Route path="/leads" element={<Navigate to="/dashboard" replace />} />
            <Route path="/board" element={<Navigate to="/dashboard/community?tab=feed&split=true" replace />} />
            <Route path="/intent" element={<Navigate to="/dashboard/community?tab=feed&split=true" replace />} />
            <Route path="/dashboard/intent" element={<Navigate to="/dashboard/community?tab=feed&split=true" replace />} />
            <Route path="/signals" element={<Navigate to="/dashboard/community?tab=feed&split=true" replace />} />
            <Route path="/dashboard/signals" element={<Navigate to="/dashboard/community?tab=feed&split=true" replace />} />
            <Route path="/roi" element={<Navigate to="/dashboard/companies?tab=roi" replace />} />
            <Route path="/dashboard/roi" element={<Navigate to="/dashboard/companies?tab=roi" replace />} />

            {/* Post-activation welcome overview → leads into onboarding */}
            <Route path="/welcome" element={<Gated><Welcome /></Gated>} />

            {/* Onboarding — requires auth AND an active plan */}
            <Route path="/onboarding" element={<Gated><OnboardingProfile /></Gated>} />
            <Route path="/onboarding/filters" element={<Gated><OnboardingFilters /></Gated>} />
            <Route path="/onboarding/geography" element={<Gated><OnboardingGeography /></Gated>} />

            {/* Protected: scan */}
            <Route
              path="/scan"
              element={
                <Gated>
                  <DeepScanActive />
                </Gated>
              }
            />

            {/* Protected: dashboard */}
            <Route
              path="/dashboard"
              element={
                <Gated>
                  <IntelligenceHub />
                </Gated>
              }
            />
            <Route
              path="/dashboard/lead/:id"
              element={
                <Gated>
                  <LeadDetail />
                </Gated>
              }
            />
            <Route
              path="/dashboard/lead/:id/report"
              element={
                <Gated>
                  <NeuralMatchReport />
                </Gated>
              }
            />
            <Route
              path="/dashboard/lead/:id/email"
              element={
                <Gated>
                  <NeuralEmailEditor />
                </Gated>
              }
            />
            <Route
              path="/dashboard/inbox"
              element={
                <Gated>
                  <InboxSentiment />
                </Gated>
              }
            />
            <Route
              path="/dashboard/stats"
              element={
                <Gated>
                  <IntelligenceStats />
                </Gated>
              }
            />
            <Route
              path="/dashboard/community"
              element={
                <Gated>
                  <Community />
                </Gated>
              }
            />
            <Route
              path="/dashboard/intent"
              element={
                <Gated>
                  <DeclaredIntentBoard />
                </Gated>
              }
            />
            <Route
              path="/dashboard/discovery"
              element={
                <Gated>
                  <GlobalIntelligenceDiscovery />
                </Gated>
              }
            />
            <Route
              path="/dashboard/settings"
              element={
                <Gated>
                  <Settings />
                </Gated>
              }
            />
            <Route
              path="/dashboard/renew"
              element={
                <Gated>
                  <RenewPlan />
                </Gated>
              }
            />
            {/* Billing & usage consolidated — old links go to Renew. */}
            <Route path="/dashboard/billing" element={<Navigate to="/dashboard/renew" replace />} />
            <Route path="/dashboard/usage" element={<Navigate to="/dashboard/renew" replace />} />
            <Route
              path="/dashboard/scan-settings"
              element={
                <Gated>
                  <ScanSettings />
                </Gated>
              }
            />
            <Route
              path="/dashboard/network"
              element={
                <Gated>
                  <NetworkStatusDashboard />
                </Gated>
              }
            />
            <Route path="/dashboard/invoices" element={<Navigate to="/dashboard/renew" replace />} />

            <Route
              path="/dashboard/signals"
              element={
                <Gated>
                  <SignalWatch />
                </Gated>
              }
            />

            <Route
              path="/dashboard/verified"
              element={
                <Gated>
                  <VerifiedContactsPage />
                </Gated>
              }
            />

            <Route
              path="/dashboard/saved"
              element={
                <Gated>
                  <SavedLeads />
                </Gated>
              }
            />

            {/* V2 Intelligence Layer — Company Memory is the container for
                trust history, strategy, relationships, opportunity, verification
                and outcomes. ROI reads the funnel those outcomes write. */}
            <Route
              path="/dashboard/companies"
              element={
                <Gated>
                  <Companies />
                </Gated>
              }
            />
            <Route
              path="/dashboard/companies/:id"
              element={
                <Gated>
                  <CompanyMemory />
                </Gated>
              }
            />
            <Route
              path="/dashboard/roi"
              element={
                <Gated>
                  <RoiDashboard />
                </Gated>
              }
            />
            {/* Credits: what you've used, what's left, full ledger. */}
            <Route
              path="/dashboard/usage"
              element={
                <Gated>
                  <UsagePage />
                </Gated>
              }
            />

            {/* Admin console — protected by AdminRoute, which gates on profiles.is_admin
                read from Supabase (see AuthContext.refreshAdmin / production_hardening.sql). */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              }
            >
              <Route index element={<AdminOverview />} />
              <Route path="careers" element={<AdminCareers />} />
              <Route path="requests" element={<AdminRequests />} />
              <Route path="dossiers" element={<AdminDossiers />} />
              <Route path="queue" element={<AdminQueue />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="leads" element={<AdminLeads />} />
              <Route path="verified-leads" element={<AdminVerifiedLeads />} />
              <Route path="api" element={<AdminApi />} />
              <Route path="intents" element={<AdminIntents />} />
              <Route path="logs" element={<AdminLogs />} />
              <Route path="reviews" element={<AdminReviews />} />
              <Route path="rules" element={<AdminRules />} />
              <Route path="support" element={<AdminSupport />} />
              <Route path="conversations" element={<AdminConversations />} />
              <Route path="accuracy" element={<AdminAccuracy />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
        <EbextaAIPanel />
        <CompanyProfilePrompt />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
