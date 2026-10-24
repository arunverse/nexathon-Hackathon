import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Sidebar } from '../../components/layout/Sidebar'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { sanitizeText, MISSION_MAX } from '../../lib/sanitize'
import { ProductManager } from '../../components/ProductManager'
import { TeamSettings } from '../../components/TeamSettings'
import { PrerequisiteField } from '../../components/PrerequisiteField'
import { DismissedList } from '../../components/DismissedList'
import { checkDescriptionVagueness, type VaguenessCheckResult } from '../../lib/vagueness'
import { ClarificationFlow } from '../../components/ClarificationFlow'
import { isAuthorizedAdminEmail } from '../../lib/adminAuth'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

// The self-service company-profile fields other members see automatically.
const CP_FIELDS: [string, string, string][] = [
  ['future_scope', 'Future scope', 'Where your company is heading'],
  ['financial_funding', 'Financial & funding', 'Rounds, investors, financial health'],
  ['strategic_needs', 'Strategic needs', 'What you need right now'],
  ['major_projects', 'Major projects', 'Active initiatives / launches'],
  ['employees', 'Employees', 'e.g. 50–200'],
  ['revenue', 'Revenue', 'e.g. ₹25–60 Cr ARR'],
  ['stage', 'Stage', 'e.g. Seed / Series A'],
  ['location', 'Location', 'HQ & key markets'],
  ['recent_signals', 'Recent signals', 'Funding, hiring, expansion news'],
  ['key_contacts', 'Key contacts', 'Name(s) + role(s) to reach'],
  ['data_integrity', 'Data integrity note', 'How current / verified this is'],
]

export default function Settings() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, isAdmin } = useAuth()

  useEffect(() => {
    if (location.hash === '#company-profile') {
      setTimeout(() => {
        document.getElementById('company-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } else if (location.hash === '#personal-profile') {
      setTimeout(() => {
        document.getElementById('personal-profile')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [location.hash])

  const [company, setCompany] = useState('')
  const [userName, setUserName] = useState('')
  const [avatarUrl, setAvatarUrl] = useState('')
  const avatarInputRef = useRef<HTMLInputElement>(null)

  const [email, setEmail] = useState('')
  const [mission, setMission] = useState('')
  const [cp, setCp] = useState<Record<string, string>>({})
  // Feasibility gate. Empty = gate off, results exactly as before.
  const [prerequisites, setPrerequisites] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Vagueness Clarification State
  const [isCheckingVagueness, setIsCheckingVagueness] = useState(false)
  const [vaguenessResult, setVaguenessResult] = useState<VaguenessCheckResult | null>(null)
  const [showClarification, setShowClarification] = useState(false)
  const [clarificationAnswers, setClarificationAnswers] = useState<any[]>([])

  // ── Load current profile ────────────────────────────────────────────────
  useEffect(() => {
    try {
      const localAvatar = localStorage.getItem('ebexta_user_avatar')
      const localName = localStorage.getItem('ebexta_user_name')
      if (localAvatar) setAvatarUrl(localAvatar)
      if (localName) setUserName(localName)
    } catch { /* ignore */ }

    const raw = localStorage.getItem('ebexta_scan_filters')
    if (raw) {
      try {
        const f = JSON.parse(raw)
        if (f.companyName) setCompany(f.companyName)
        if (f.mission) setMission(f.mission)
      } catch { /* ignore */ }
    }
    if (user) {
      supabase.from('profiles').select('company_name, full_name, name, profile_image_url, avatar_url, logo_url, sender_email, mission, company_profile, prerequisites').eq('id', user.id).maybeSingle()
        .then(({ data }) => {
          if (data?.company_name) {
            if (data.company_name === 'EBEXTA Admin' && !isAuthorizedAdminEmail(user.email)) {
              setCompany('')
            } else {
              setCompany(data.company_name)
            }
          }
          const resolvedName = data?.full_name || data?.name || user.user_metadata?.full_name || user.user_metadata?.name || ''
          if (resolvedName) setUserName(resolvedName)
          const resolvedAvatar = data?.profile_image_url || data?.avatar_url || data?.logo_url || ''
          if (resolvedAvatar) setAvatarUrl(resolvedAvatar)
          setEmail(data?.sender_email || user.email || '')
          if (data?.mission) setMission(data.mission)
          if (data?.company_profile && typeof data.company_profile === 'object') setCp(data.company_profile as Record<string, string>)
          if (Array.isArray(data?.prerequisites)) setPrerequisites(data.prerequisites as string[])
        })
    }
    if (user?.email) setEmail(prev => prev || user.email || '')
  }, [user])

  const handleAvatarFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      alert('Please select a valid image file.')
      return
    }
    try {
      const reader = new FileReader()
      reader.onload = async (evt) => {
        const img = new Image()
        img.onload = async () => {
          const canvas = document.createElement('canvas')
          const MAX_SIZE = 256
          let width = img.width
          let height = img.height
          if (width > height) {
            if (width > MAX_SIZE) {
              height = Math.round((height * MAX_SIZE) / width)
              width = MAX_SIZE
            }
          } else {
            if (height > MAX_SIZE) {
              width = Math.round((width * MAX_SIZE) / height)
              height = MAX_SIZE
            }
          }
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext('2d')
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height)
            const compressed = canvas.toDataURL('image/webp', 0.85)
            setAvatarUrl(compressed)
            try { localStorage.setItem('ebexta_user_avatar', compressed) } catch { /* ignore */ }
            if (user) {
              await supabase.from('profiles').update({
                profile_image_url: compressed,
                avatar_url: compressed,
                logo_url: compressed,
                updated_at: new Date().toISOString()
              }).eq('id', user.id)
            }
            window.dispatchEvent(new Event('ebexta_profile_updated'))
          }
        }
        img.src = evt.target?.result as string
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error('Avatar selection failed:', err)
    } finally {
      if (e.target) e.target.value = ''
    }
  }

  const handleRemoveAvatar = async () => {
    setAvatarUrl('')
    if (avatarInputRef.current) avatarInputRef.current.value = ''
    try { localStorage.removeItem('ebexta_user_avatar') } catch { /* ignore */ }
    if (user) {
      await supabase.from('profiles').update({
        profile_image_url: null,
        avatar_url: null,
        logo_url: null,
        updated_at: new Date().toISOString()
      }).eq('id', user.id)
    }
    window.dispatchEvent(new Event('ebexta_profile_updated'))
  }

  // ── Save profile (preserves existing scan filters) ──────────────────────
  async function handleSave() {
    setSaving(true)
    try {
      const raw = localStorage.getItem('ebexta_scan_filters')
      const f = raw ? JSON.parse(raw) : {}
      f.companyName = company
      f.mission = mission
      localStorage.setItem('ebexta_scan_filters', JSON.stringify(f))
      if (userName) {
        localStorage.setItem('ebexta_user_name', userName)
      } else {
        localStorage.removeItem('ebexta_user_name')
      }
      if (avatarUrl) {
        localStorage.setItem('ebexta_user_avatar', avatarUrl)
      } else {
        localStorage.removeItem('ebexta_user_avatar')
      }
    } catch { /* ignore */ }
    if (user) {
      const updateData: Record<string, any> = {
        id: user.id,
        full_name: sanitizeText(userName, 120),
        name: sanitizeText(userName, 120),
        profile_image_url: avatarUrl || null,
        avatar_url: avatarUrl || null,
        logo_url: avatarUrl || null,
        sender_email: sanitizeText(email, 320),
        mission: sanitizeText(mission, MISSION_MAX),
        enriched_description: sanitizeText(mission, MISSION_MAX),
        clarification_answers: clarificationAnswers,
        description_specificity: 'specific', // Assumed manual override
        prerequisites: prerequisites.map(p => sanitizeText(p, 120)).filter(Boolean).slice(0, 3),
        updated_at: new Date().toISOString(),
      }
      if (isAdmin) {
        updateData.company_name = sanitizeText(company, 120)
      }

      await supabase.from('profiles').upsert(updateData)
      // Save the self-service company profile (shown to matched members).
      const cleanCp: Record<string, string> = {}
      for (const [k, v] of Object.entries(cp)) cleanCp[k] = sanitizeText(v ?? '', 600)
      await supabase.rpc('ebexta_save_company_profile', { p: cleanCp })
      window.dispatchEvent(new Event('ebexta_profile_updated'))
    }
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleTerminate() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  async function handleDeleteAccount() {
    if (!confirm('Permanently delete your account and ALL your data (scans, leads, saved items, intents, messages)? This cannot be undone.')) return
    if (!confirm('Are you absolutely sure? This is irreversible.')) return
    setDeleting(true)
    const { data, error } = await supabase.functions.invoke('account', { body: { action: 'delete_account' } })
    if (error || !(data as { success?: boolean } | null)?.success) {
      setDeleting(false)
      alert('Could not delete account. Please contact support.')
      return
    }
    try { Object.keys(localStorage).filter(k => k.startsWith('ebexta_')).forEach(k => localStorage.removeItem(k)) } catch { /* ignore */ }
    await supabase.auth.signOut()
    navigate('/')
  }

  async function handleRefineDescription() {
    if (!mission.trim()) return
    setIsCheckingVagueness(true)
    const res = await checkDescriptionVagueness(mission)
    setIsCheckingVagueness(false)
    if (res.specificity === 'vague' && res.clarifying_questions && res.clarifying_questions.length > 0) {
      setVaguenessResult(res)
      setShowClarification(true)
    } else {
      alert("Your description looks specific enough already!")
    }
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />

      <main className="ml-0 md:ml-[240px] flex-1 p-4 md:p-8 pt-16 md:pt-8 max-w-3xl w-full min-w-0">
        <div className="mb-10">
          <h1 className="text-[32px] font-semibold text-on-surface" style={geist}>Settings</h1>
          <p className="text-[14px] text-on-surface-variant">Manage your profile and account.</p>
        </div>

        {/* ── Fresh Search ── */}
        <section className="mb-8 p-6 rounded-xl border border-primary/30 bg-primary/5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface" style={geist}>Run a fresh search</h2>
            <p className="text-[13px] text-on-surface-variant mt-0.5">
              Re-enter your filters (industry, geography, mode) from scratch, then scan. Save any leads you want to keep first.
            </p>
          </div>
          <button onClick={() => navigate('/onboarding')}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold bg-primary text-on-primary hover:brightness-110 active:scale-95 transition-all shrink-0">
            <span className="material-symbols-outlined text-[18px]">tune</span>
            New search / fresh filters
          </button>
        </section>

        {/* ── Help / product tour ── */}
        <section className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-[18px] font-semibold text-on-surface" style={geist}>New here? Take the tour</h2>
            <p className="text-[13px] text-on-surface-variant mt-0.5">A quick 8-step walkthrough of the dashboard replay it any time.</p>
          </div>
          <button
            onClick={() => { try { localStorage.setItem('ebexta_replay_tour', '1') } catch { /* ignore */ } navigate('/dashboard') }}
            className="flex items-center gap-2 px-5 py-3 rounded-xl text-[14px] font-bold border border-outline-variant text-on-surface hover:bg-surface-container active:scale-95 transition-all shrink-0">
            <span className="material-symbols-outlined text-[18px]">tour</span>
            Take the tour
          </button>
        </section>

        {/* ── Personal Profile & Verified Company ── */}
        <section id="personal-profile" className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low scroll-mt-20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person</span>
              <h2 className="text-[20px] font-semibold text-on-surface" style={geist}>Member Profile &amp; Photo</h2>
            </div>
            <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
              <span className="material-symbols-outlined text-[14px]">verified</span>
              EBEXTA Verified Member
            </span>
          </div>

          <input
            ref={avatarInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={handleAvatarFileSelect}
            className="hidden"
          />

          <div className="flex flex-wrap items-center gap-6 mb-8 p-4 rounded-xl bg-surface-container-lowest border border-outline-variant">
            <div className="relative group cursor-pointer" onClick={() => avatarInputRef.current?.click()}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-primary shadow-md shrink-0" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-primary-container flex items-center justify-center text-[28px] font-bold text-on-primary-container border-2 border-primary/40 shrink-0">
                  {(userName || company || user?.email || 'U').charAt(0).toUpperCase()}
                </div>
              )}
              <div className="absolute inset-0 rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white" title="Change Photo">
                <span className="material-symbols-outlined text-[24px]">photo_camera</span>
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-[16px] font-bold text-on-surface">{userName || 'Member User'}</p>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px]">domain</span>
                  {company || 'Verified Company'}
                </span>
              </div>
              <p className="text-[12px] text-on-surface-variant mt-0.5">{email}</p>
              <div className="flex items-center gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => avatarInputRef.current?.click()}
                  className="px-3 py-1.5 rounded-lg text-[12px] font-bold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[16px]">upload</span>
                  Upload Profile Photo
                </button>
                {avatarUrl && (
                  <button
                    type="button"
                    onClick={handleRemoveAvatar}
                    className="px-3 py-1.5 rounded-lg text-[12px] font-bold text-red-500 hover:bg-red-500/10 transition-all cursor-pointer"
                  >
                    Remove Photo
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* ── Highlighted Business / Organization Name (Admin-Gated) ── */}
            <div className="md:col-span-2 p-4 rounded-xl border border-primary/40 bg-primary/5 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">domain</span>
                  <label className="text-[12px] font-bold text-on-surface uppercase tracking-wider">
                    Verified Business / Organization Name
                  </label>
                </div>
                {isAdmin ? (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">admin_panel_settings</span>
                    👑 EBEXTA Admin Mode (Editable)
                  </span>
                ) : (
                  <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold bg-surface-container-high text-on-surface-variant border border-outline-variant flex items-center gap-1">
                    <span className="material-symbols-outlined text-[12px]">lock</span>
                    Managed &amp; Verified by EBEXTA Admin
                  </span>
                )}
              </div>

              <div className="relative flex items-center">
                <input
                  type="text"
                  value={company}
                  onChange={e => isAdmin && setCompany(e.target.value)}
                  disabled={!isAdmin}
                  placeholder="Business / Organization Name"
                  className={`w-full px-4 py-2.5 rounded-lg text-[14px] font-bold transition-all ${
                    isAdmin
                      ? 'bg-surface-container-lowest border border-primary text-on-surface focus:outline-none'
                      : 'bg-surface-container-lowest/70 border border-outline-variant text-on-surface opacity-90 cursor-not-allowed'
                  }`}
                />
                {!isAdmin && (
                  <span className="absolute right-3 material-symbols-outlined text-[18px] text-on-surface-variant pointer-events-none">
                    lock
                  </span>
                )}
              </div>

              {!isAdmin && (
                <p className="text-[11px] text-on-surface-variant flex items-center gap-1.5 pt-1">
                  <span className="material-symbols-outlined text-[14px] text-amber-500">info</span>
                  Company name is verified on EBEXTA. Regular members cannot alter the official business name directly; it is managed by EBEXTA Platform Administrators.
                </p>
              )}
            </div>

            {/* ── User Personal Name (User-Editable) ── */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[15px] text-primary">badge</span>
                Your Display / Member Name (Editable)
              </label>
              <input
                type="text"
                value={userName}
                onChange={e => setUserName(e.target.value)}
                placeholder="e.g. Arun V"
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
              <p className="text-[10px] text-on-surface-variant">
                Displayed alongside your profile photo and verified business badge across posts and messages.
              </p>
            </div>

            {/* ── Contact Email ── */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">Contact email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
              />
            </div>

            {/* ── Mission & Key Expertise ── */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">Mission &amp; key expertise</label>
              {/* Same cap as the save path, so nothing is silently truncated. */}
              <textarea value={mission} onChange={e => setMission(e.target.value.slice(0, MISSION_MAX))} rows={6}
                placeholder="What you do and who you serve. The more specific you are, the sharper your leads this text is what EBEXTA matches on."
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-y" />
              <p className={`text-[11px] text-right font-mono ${mission.length >= MISSION_MAX * 0.93 ? 'text-error' : 'text-on-surface-variant'}`}>
                {mission.length} / {MISSION_MAX}
              </p>
              
              <div className="mt-2">
                <button type="button" onClick={handleRefineDescription} disabled={isCheckingVagueness} className="text-[12px] text-primary hover:underline font-semibold flex items-center gap-1">
                  {isCheckingVagueness ? <div className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[14px]">psychology_alt</span>}
                  Refine your description
                </button>
              </div>
            </div>
          </div>
          
          {showClarification && vaguenessResult && (
            <div className="mt-6">
              <ClarificationFlow 
                checkResult={vaguenessResult}
                onCancel={() => setShowClarification(false)}
                onComplete={(clarificationText, answers) => {
                  const enriched = `${mission}\n\nClarification: ${clarificationText}`
                  setMission(enriched.slice(0, MISSION_MAX))
                  setClarificationAnswers(answers)
                  setShowClarification(false)
                }}
                onSkip={(freeTextOverride?: string) => {
                  if (freeTextOverride) {
                    setMission(freeTextOverride.slice(0, MISSION_MAX))
                  }
                  setShowClarification(false)
                }}
              />
            </div>
          )}

        </section>

        {/* ── Product / company targeting ── */}
        {user && <ProductManager userId={user.id} />}

        {/* ── Company Profile (shown automatically to matched members) ── */}
        <section id="company-profile" className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low scroll-mt-20">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-primary">badge</span>
            <h2 className="text-[20px] font-semibold text-on-surface" style={geist}>Company profile</h2>
          </div>
          <p className="text-[13px] text-on-surface-variant mb-6">Fill this once. When another member connects or messages you, they see this automatically no back-and-forth.</p>

          {/* Feasibility gate what a client must already have for your
              product to be deployable. Blank = no filtering. */}
          <div className="mb-6 pb-6" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
            <PrerequisiteField values={prerequisites} onChange={setPrerequisites} variant="settings" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {CP_FIELDS.map(([key, label, ph]) => (
              <div key={key} className={`space-y-1 ${['future_scope', 'strategic_needs', 'major_projects'].includes(key) ? 'md:col-span-2' : ''}`}>
                <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant">{label}</label>
                <textarea value={cp[key] ?? ''} onChange={e => setCp(s => ({ ...s, [key]: e.target.value }))} rows={['future_scope', 'strategic_needs', 'major_projects'].includes(key) ? 2 : 1}
                  placeholder={ph}
                  className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all resize-none" />
              </div>
            ))}
          </div>
        </section>

        {/* ── Dismissed companies the way back from a permanent action ── */}
        <DismissedList />

        {/* ── Team (V2) ── */}
        <TeamSettings />

        <button onClick={handleSave} disabled={saving}
          className="mb-8 h-12 px-6 bg-primary text-on-primary font-bold rounded-xl text-[14px] hover:brightness-110 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
          {saving ? <div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" /> : <span className="material-symbols-outlined text-[18px]">save</span>}
          {saved ? '✓ Saved' : saving ? 'Saving…' : 'Save profile & company details'}
        </button>

        {/* ── Sign out ── */}
        <div className="mb-6">
          <button onClick={handleTerminate}
            className="w-full h-13 py-3.5 border border-outline-variant text-on-surface font-bold rounded-xl text-[14px] hover:bg-surface-container transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-[18px]">logout</span>
            Sign out
          </button>
        </div>

        {/* ── Danger zone ── */}
        <section className="mb-10 p-6 rounded-xl" style={{ border: '1px solid rgba(111,29,27,0.3)', background: 'var(--critical-bg)' }}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-[16px] font-semibold" style={{ ...geist, color: 'var(--critical)' }}>Delete account</h2>
              <p className="text-[12px] text-on-surface-variant mt-0.5 max-w-md">
                Permanently erases your profile, scans, leads, saved items, intents, messages, and removes your login. This cannot be undone.
              </p>
            </div>
            <button onClick={handleDeleteAccount} disabled={deleting}
              className="px-5 py-3 rounded-xl text-[13px] font-bold text-white hover:brightness-110 active:scale-95 transition-all shrink-0 disabled:opacity-60"
              style={{ background: 'var(--critical)' }}>
              {deleting ? 'Deleting…' : 'Delete my account & data'}
            </button>
          </div>
        </section>
      </main>
    </div>
  )
}
