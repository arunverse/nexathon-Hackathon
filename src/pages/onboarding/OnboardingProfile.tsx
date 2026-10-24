import { useRef, useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import { sanitizeText, sanitizeUrl, isEmail, MISSION_MAX } from '../../lib/sanitize'
import { useAuth } from '../../contexts/AuthContext'
import {
  validateDoc, extractDocText, uploadProductDoc, analyzeProduct, saveProduct, setCompanyTargeting,
} from '../../lib/productAnalysis'
import { PrerequisiteField } from '../../components/PrerequisiteField'
import { supabase } from '../../lib/supabase'
import { checkDescriptionVagueness, type VaguenessCheckResult } from '../../lib/vagueness'
import { ClarificationFlow } from '../../components/ClarificationFlow'
import { EbextaLogo } from '../../components/common/EbextaLogo'

type TargetType = 'company' | 'product'

export default function OnboardingProfile() {
  const navigate = useNavigate()
  const { user } = useAuth()
  // Restore anything already entered (so going back from step 2 doesn't wipe it).
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { return {} }
  })()
  const [targetType, setTargetType] = useState<TargetType>(saved.targetType === 'product' ? 'product' : 'company')
  const [company, setCompany] = useState<string>(saved.companyName ?? '')
  const [email, setEmail] = useState<string>(saved.senderEmail ?? '')
  const [website, setWebsite] = useState<string>(saved.companyWebsite ?? '')
  const [mission, setMission] = useState<string>(saved.mission ?? '')
  const [mode, setMode] = useState<'seeker' | 'provider'>(saved.mode ?? 'seeker')

  const [userTouchedMode, setUserTouchedMode] = useState(!!saved.mode)

  // Product fields
  const [productName, setProductName] = useState<string>(saved.productName ?? '')
  const [productDesc, setProductDesc] = useState<string>(saved.productDescription ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (userTouchedMode) return
    const combined = `${company} ${mission} ${productDesc} ${productName}`.toLowerCase()
    const isProviderPattern = /\b(studio|agency|services?|consulting|consultancy|solutions?|provider|developer|development|firm|house|custom|freelance|b2b service|outsourc|game dev)\b/i.test(combined)
    if (isProviderPattern && mode !== 'provider') {
      setMode('provider')
    }
  }, [company, mission, productDesc, productName, userTouchedMode])

  useEffect(() => {
    if (!user) return
    if (!email && user.email) setEmail(user.email)
    supabase
      .from('profiles')
      .select('company_name, sender_email, website, mission, mode')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          if (!company && data.company_name) setCompany(data.company_name)
          if (!email && (data.sender_email || user.email)) setEmail(data.sender_email || user.email || '')
          if (!website && data.website) setWebsite(data.website)
          if (!mission && data.mission) setMission(data.mission)
          if (data.mode && (data.mode === 'seeker' || data.mode === 'provider')) {
            setMode(data.mode)
            setUserTouchedMode(true)
          }
        }
      })
  }, [user])
  // What a client must ALREADY have. Empty for most sellers and empty means
  // the feasibility gate never runs for them.
  const [prerequisites, setPrerequisites] = useState<string[]>(
    Array.isArray(saved.prerequisites) ? saved.prerequisites : [],
  )

  const [emailError, setEmailError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
  const [productErr, setProductErr] = useState('')

  // Vagueness State
  const [vaguenessResult, setVaguenessResult] = useState<VaguenessCheckResult | null>(null)
  const [hasClarified, setHasClarified] = useState(false)
  const [showClarification, setShowClarification] = useState(false)
  const [enrichedDescription, setEnrichedDescription] = useState('')
  const [clarificationAnswers, setClarificationAnswers] = useState<any[]>([])
  const [clarificationRound, setClarificationRound] = useState(0)

  function pickFile(f: File | null) {
    setFileError('')
    if (!f) { setFile(null); return }
    const err = validateDoc(f)
    if (err) { setFileError(err); setFile(null); if (fileInput.current) fileInput.current.value = ''; return }
    setFile(f)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (busy) return
    // Sanitize every field before persisting (S4).
    const cleanCompany = sanitizeText(company, 120)
    const cleanEmail = sanitizeText(email, 320)
    const cleanMission = sanitizeText(mission, MISSION_MAX)
    const cleanedWebsite = sanitizeUrl(website)
    const cleanProductName = sanitizeText(productName, 160)
    const cleanProductDesc = sanitizeText(productDesc, 2000)
    const cleanPrereqs = prerequisites
      .map(p => sanitizeText(p, 120))
      .filter(Boolean)
      .slice(0, 3)

    setEmailError(cleanEmail && !isEmail(cleanEmail) ? 'That doesn’t look like an email we’ll use it anyway.' : '')

    if (targetType === 'product') {
      if (!cleanProductName || cleanProductDesc.length < 10) {
        setProductErr('Please add the product name and a short description of what it does and who it’s for.')
        return
      }
    }

    const descriptionToCheck = targetType === 'product' ? cleanProductDesc : cleanMission
    const currentEnriched = enrichedDescription || descriptionToCheck

    // If we haven't done clarification yet, check vagueness first
    if (!hasClarified) {
      setBusy(true)
      setBusyLabel('Analyzing description...')
      const res = await checkDescriptionVagueness(descriptionToCheck)
      setBusy(false)
      setBusyLabel('')
      
      if (res.specificity === 'vague' && res.clarifying_questions && res.clarifying_questions.length > 0) {
        setVaguenessResult(res)
        setShowClarification(true)
        return
      }
    }

    const finalMission = targetType === 'company' ? currentEnriched : cleanMission
    const finalProductDesc = targetType === 'product' ? currentEnriched : cleanProductDesc

    const existing = localStorage.getItem('ebexta_scan_filters')
    const parsed = existing ? JSON.parse(existing) : {}
    localStorage.setItem('ebexta_scan_filters', JSON.stringify({
      ...parsed,
      companyName: cleanCompany,
      senderEmail: cleanEmail,
      companyWebsite: cleanedWebsite,
      mission: finalMission,
      targetType,
      productName: cleanProductName,
      productDescription: finalProductDesc,
      prerequisites: cleanPrereqs,
      mode,
    }))

    // Company-level prerequisites & description tracking.
    if (user) {
      try {
        await supabase.from('profiles').update({ 
          mode,
          prerequisites: cleanPrereqs,
          raw_description: targetType === 'company' ? cleanMission : null,
          enriched_description: targetType === 'company' ? finalMission : null,
          clarification_answers: clarificationAnswers,
          description_specificity: vaguenessResult?.specificity || 'specific'
        }).eq('id', user.id)
        window.dispatchEvent(new CustomEvent('ebexta_mode_changed', { detail: { mode } }))
        window.dispatchEvent(new Event('ebexta_profile_updated'))
      } catch { /* column missing = SQL not run yet; gate stays off */ }
    }

    // Product path analyze the product into an ideal-buyer profile (backend proxy).
    if (targetType === 'product' && user) {
      setBusy(true); setProductErr('')
      try {
        let docPath: string | null = null
        let docText = ''
        if (file) {
          setBusyLabel('Uploading your document…')
          const up = await uploadProductDoc(user.id, file)
          docPath = up.path
          setBusyLabel('Reading your document…')
          docText = await extractDocText(file)
        }
        setBusyLabel('Analyzing your product & finding its ideal buyer…')
        const ideal = await analyzeProduct({ name: cleanProductName, description: finalProductDesc, docText })
        // What the user typed wins; otherwise use what the analysis derived
        // from the product description. Either way it is editable in Settings.
        const derived = cleanPrereqs.length > 0 ? cleanPrereqs : (ideal.prerequisites ?? [])
        await saveProduct(user.id, {
          name: cleanProductName,
          description: finalProductDesc,
          docPath,
          docText,
          idealBuyer: ideal,
          prerequisites: derived,
          raw_description: cleanProductDesc,
          enriched_description: finalProductDesc,
          clarification_answers: clarificationAnswers,
        })
        if (cleanPrereqs.length === 0 && derived.length > 0) {
          // Mirror the derived value to the profile so it is visible and
          // editable in Settings rather than silently applied.
          try { await supabase.from('profiles').update({ prerequisites: derived }).eq('id', user.id) } catch { /* ignore */ }
        }
      } catch (err) {
        // Best-effort: don't block onboarding if analysis hiccups still save the product.
        console.warn('[EBEXTA] Product analysis issue:', err)
        try { await saveProduct(user.id, { name: cleanProductName, description: finalProductDesc, idealBuyer: {} }) } catch { /* ignore */ }
      } finally {
        setBusy(false); setBusyLabel('')
      }
    } else if (targetType === 'company' && user) {
      // Marketing the whole company clear any active product targeting.
      try { await setCompanyTargeting(user.id) } catch { /* ignore */ }
    }

    navigate('/onboarding/filters')
  }

  const geo = { fontFamily: 'Geist, Inter, sans-serif' }

  return (
    <div className="bg-surface-container-lowest min-h-screen flex flex-col font-sans text-on-surface">
      <div className="fixed inset-0 pointer-events-none -z-10 overflow-hidden">
        <div className="absolute -top-[20%] -left-[10%] w-[50%] h-[50%] bg-primary/5 blur-[120px] rounded-full" />
        <div className="absolute top-[60%] -right-[10%] w-[40%] h-[40%] bg-tertiary/5 blur-[100px] rounded-full" />
      </div>

      <header className="fixed top-0 w-full z-50 bg-surface border-b border-outline-variant">
        <div className="flex justify-between items-center px-6 py-4 w-full max-w-[1280px] mx-auto">
          <EbextaLogo variant="horizontal" size={32} priority />
          <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Step 1 of 3 Your Profile</span>
        </div>
      </header>

      <main className="flex-grow flex items-start justify-center px-4 pt-24 pb-10 overflow-y-auto">
        <div className="w-full max-w-[640px] glass-card rounded-xl p-6 shadow-2xl relative overflow-hidden">
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 flex-1 bg-primary rounded-full" />
            <div className="h-1 flex-1 bg-outline-variant rounded-full" />
            <div className="h-1 flex-1 bg-outline-variant rounded-full" />
          </div>

          {/* ── Fork: what are you taking to market? ── */}
          <div className="mb-8">
            <h1 className="text-[26px] md:text-[30px] font-bold text-on-surface tracking-tight mb-1" style={geo}>What are you taking to market?</h1>
            <p className="text-on-surface-variant text-[14px] mb-4">This shapes who we find for you.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {([
                { key: 'company', icon: 'apartment', title: 'My whole company or services', desc: 'Find matches for what your company broadly offers or needs.' },
                { key: 'product', icon: 'inventory_2', title: 'A specific product or service', desc: 'Target the exact ideal buyer for one product.' },
              ] as const).map(opt => {
                const on = targetType === opt.key
                return (
                  <button key={opt.key} type="button" onClick={() => setTargetType(opt.key)}
                    className="text-left p-4 rounded-xl border transition-all"
                    style={{
                      borderColor: on ? 'var(--primary, #2D6A4F)' : 'var(--outline-variant, rgba(0,0,0,0.12))',
                      background: on ? 'color-mix(in srgb, var(--primary, #2D6A4F) 8%, transparent)' : 'transparent',
                      boxShadow: on ? '0 0 0 1px var(--primary, #2D6A4F)' : 'none',
                    }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="material-symbols-outlined text-[20px] text-primary">{opt.icon}</span>
                      <span className="text-[14px] font-bold text-on-surface" style={geo}>{opt.title}</span>
                    </div>
                    <p className="text-[12.5px] text-on-surface-variant leading-snug">{opt.desc}</p>
                  </button>
                )
              })}
            </div>
          </div>

          {/* How EBEXTA works bilateral matching clarity */}
          <div className="mb-8 p-4 rounded-xl border border-primary/25 bg-primary/5">
            <p className="text-[12px] font-bold tracking-[0.06em] text-primary uppercase mb-2">How EBEXTA matches you</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              {([
                { m: 'seeker' as const, icon: '🔍', title: 'Seeker', line: 'You need a service or product.', gives: 'EBEXTA finds PROVIDERS for you.' },
                { m: 'provider' as const, icon: '🏢', title: 'Provider', line: 'You offer a service or product.', gives: 'EBEXTA finds SEEKERS (clients) for you.' },
              ]).map(o => {
                const isActive = mode === o.m
                return (
                  <button key={o.m} type="button" onClick={() => { setMode(o.m); setUserTouchedMode(true) }}
                    className={`text-left p-4 rounded-lg border transition-all ${isActive ? 'bg-primary/5 border-primary' : 'bg-surface-container-lowest border-outline-variant hover:border-primary'}`}
                    style={isActive ? { boxShadow: '0 0 16px var(--border-subtle)' } : undefined}>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[18px]">{o.icon}</span>
                      <span className="text-[15px] font-bold" style={{ color: isActive ? 'var(--primary, var(--accent))' : 'var(--text-primary)' }}>{o.title}</span>
                      {isActive && <span className="material-symbols-outlined text-[18px] ml-auto text-primary">check_circle</span>}
                    </div>
                    <p className="text-[12px] text-on-surface-variant">{o.line}</p>
                    <p className="text-[12px] font-semibold text-primary mt-1">{o.gives}</p>
                  </button>
                )
              })}
            </div>
            <p className="text-[12px] text-on-surface-variant">We only ever show you the <strong>opposite side</strong>, never competitors.</p>
          </div>

          {showClarification && vaguenessResult ? (
            <ClarificationFlow
              checkResult={vaguenessResult}
              onCancel={() => setShowClarification(false)}
              onComplete={async (clarificationText, structuredAnswers) => {
                const base = targetType === 'product' ? productDesc : mission
                const enriched = `${base}\n\nClarification: ${clarificationText}`
                setEnrichedDescription(enriched)
                setClarificationAnswers(structuredAnswers)
                setShowClarification(false)
                setBusy(true)
                setBusyLabel('Verifying enriched description...')

                // Re-run specificity check ONCE to confirm it passes
                if (clarificationRound === 0) {
                  setClarificationRound(1)
                  const secondCheck = await checkDescriptionVagueness(enriched)
                  setBusy(false)
                  setBusyLabel('')
                  setHasClarified(true)

                  if (secondCheck.specificity === 'vague') {
                    // Note case in system_logs if still vague after one round
                    try {
                      await supabase.from('system_logs').insert({
                        event: 'vagueness_unresolved_after_round_1',
                        details: {
                          user_id: user?.id,
                          target_type: targetType,
                          original: base,
                          enriched,
                          missing_info: secondCheck.missing_info,
                        },
                      })
                    } catch { /* ignore */ }
                  }
                  setVaguenessResult(secondCheck)
                } else {
                  setBusy(false)
                  setBusyLabel('')
                  setHasClarified(true)
                }

                // Proceed with submission
                setTimeout(() => {
                  const form = document.getElementById('profile-form') as HTMLFormElement
                  if (form) form.requestSubmit()
                }, 100)
              }}
              onSkip={(freeTextOverride?: string) => {
                setHasClarified(true)
                setShowClarification(false)
                if (freeTextOverride) {
                  if (targetType === 'product') setProductDesc(freeTextOverride)
                  else setMission(freeTextOverride)
                  setEnrichedDescription(freeTextOverride)
                  setTimeout(() => {
                    const form = document.getElementById('profile-form') as HTMLFormElement
                    if (form) form.requestSubmit()
                  }, 100)
                } else {
                  const textarea = document.getElementById(targetType === 'product' ? 'productDesc-textarea' : 'mission-textarea')
                  if (textarea) textarea.focus()
                }
              }}
            />
          ) : null}

          <form id="profile-form" className={`space-y-8 ${showClarification ? 'opacity-50 pointer-events-none' : ''}`} onSubmit={handleSubmit}>
            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">Your company name</label>
              <div className="flex items-center gap-4 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <span className="material-symbols-outlined text-outline">business</span>
                <input autoFocus required value={company} onChange={e => setCompany(e.target.value)}
                  className="flex-grow bg-transparent border-none p-0 text-[16px] text-on-surface placeholder:text-outline focus:ring-0 outline-none"
                  placeholder="Your company name" type="text" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">Outreach Sender Email</label>
              <div className="flex items-center gap-4 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <span className="material-symbols-outlined text-outline">alternate_email</span>
                <input required value={email} onChange={e => setEmail(e.target.value)}
                  className="flex-grow bg-transparent border-none p-0 text-[16px] text-on-surface placeholder:text-outline focus:ring-0 outline-none"
                  placeholder="you@company.com" type="text" inputMode="email" />
              </div>
              <p className="text-[11px] text-on-surface-variant/60">The email address your prospective clients see when you reach out (defaults to your account email).</p>
              {emailError && <p className="text-[12px] text-on-surface-variant">{emailError}</p>}
            </div>

            <div className="space-y-2">
              <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">Company website</label>
              <div className="flex items-center gap-4 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                <span className="material-symbols-outlined text-outline">language</span>
                <input value={website} onChange={e => setWebsite(e.target.value)}
                  onBlur={() => {
                    let clean = website.trim()
                    if (clean.startsWith('http://')) clean = clean.substring(7)
                    if (clean.startsWith('https://')) clean = clean.substring(8)
                    if (clean.endsWith('/')) clean = clean.slice(0, -1)
                    setWebsite(clean)
                  }}
                  className="flex-grow bg-transparent border-none p-0 text-[16px] text-on-surface placeholder:text-outline focus:ring-0 outline-none"
                  placeholder="yourcompany.com" type="text" />
              </div>
              <p className="text-[11px] text-on-surface-variant/60">Shown to matched companies alongside your posted intents.</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-end">
                <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">What does your company do?</label>
                <span className={`text-[13px] font-mono ${mission.length >= MISSION_MAX * 0.93 ? 'text-error' : 'text-primary/60'}`}>{mission.length} / {MISSION_MAX}</span>
              </div>
              <div className="border border-outline-variant rounded-lg bg-surface-container-lowest focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden transition-all">
                {/* This field drives the entire match. resize-y and a taller
                    default so 5,000 characters is genuinely usable, not a
                    5-line window you scroll through. */}
                <textarea id="mission-textarea" required value={mission} onChange={e => {
                  setMission(e.target.value.slice(0, MISSION_MAX))
                  setHasClarified(false) // reset clarification if they edit
                }}
                  className="w-full bg-transparent border-none p-4 text-[14px] text-on-surface placeholder:text-outline focus:ring-0 outline-none resize-y leading-relaxed"
                  placeholder="Describe what you offer or what you need the more specific, the better your matches. Include your services, who you typically work with, and the kinds of problems you solve for them."
                  rows={10} />
              </div>
            </div>

            {/* Feasibility gate captured once, then every scan skips companies
                that physically cannot deploy what this user sells. */}
            <PrerequisiteField values={prerequisites} onChange={setPrerequisites} />

            {/* ── Product-only fields ── */}
            {targetType === 'product' && (
              <div className="space-y-6 p-5 rounded-xl border border-primary/25 bg-primary/[0.04]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[20px] text-primary">inventory_2</span>
                  <p className="text-[13px] font-bold text-on-surface" style={geo}>Tell us about the product you're taking to market</p>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">Product or service name</label>
                  <div className="flex items-center gap-4 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
                    <span className="material-symbols-outlined text-outline">label</span>
                    <input value={productName} onChange={e => setProductName(e.target.value)}
                      className="flex-grow bg-transparent border-none p-0 text-[16px] text-on-surface placeholder:text-outline focus:ring-0 outline-none"
                      placeholder="e.g. PulseHR payroll & attendance for SMEs" type="text" />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">What it does + who it's for</label>
                    <span className={`text-[13px] font-mono ${productDesc.length >= 1900 ? 'text-error' : 'text-primary/60'}`}>{productDesc.length} / 2000</span>
                  </div>
                  <div className="border border-outline-variant rounded-lg bg-surface-container-lowest focus-within:ring-1 focus-within:ring-primary/20 overflow-hidden transition-all">
                    <textarea id="productDesc-textarea" value={productDesc} onChange={e => {
                      setProductDesc(e.target.value.slice(0, 2000))
                      setHasClarified(false) // reset clarification if they edit
                    }}
                      className="w-full bg-transparent border-none p-4 text-[14px] text-on-surface placeholder:text-outline focus:ring-0 outline-none resize-none leading-relaxed"
                      placeholder="The problem it solves, key features, and the kind of business that buys it. The clearer this is, the sharper the buyer targeting." rows={4} />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block">Optional upload a one-pager, deck or spec</label>
                  <input ref={fileInput} type="file" accept=".pdf,.doc,.docx" className="hidden"
                    onChange={e => pickFile(e.target.files?.[0] ?? null)} />
                  <button type="button" onClick={() => fileInput.current?.click()}
                    className="w-full flex items-center gap-3 bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg px-4 py-3 hover:border-primary/50 transition-all text-left">
                    <span className="material-symbols-outlined text-primary">{file ? 'description' : 'upload_file'}</span>
                    <span className="flex-grow text-[14px] text-on-surface truncate">
                      {file ? file.name : 'PDF, DOC or DOCX under 5 MB'}
                    </span>
                    {file && (
                      <span className="material-symbols-outlined text-outline text-[18px]"
                        onClick={ev => { ev.stopPropagation(); pickFile(null); if (fileInput.current) fileInput.current.value = '' }}>close</span>
                    )}
                  </button>
                  {fileError && <p className="text-[12px] text-error">{fileError}</p>}
                  <p className="text-[11px] text-on-surface-variant/60">We read it to sharpen the buyer profile. Your file stays private to your account.</p>
                </div>

                {productErr && <p className="text-[12.5px] text-error font-medium">{productErr}</p>}
              </div>
            )}

            <div className="pt-4 flex justify-end">
              <button type="submit" disabled={busy}
                className="group flex items-center gap-3 bg-primary hover:brightness-110 text-on-primary font-bold px-10 py-4 rounded-lg transition-all active:scale-95 disabled:opacity-70"
                style={geo}>
                {busy ? (
                  <>
                    <div className="w-5 h-5 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />
                    <span className="text-[15px]">{busyLabel || 'Working…'}</span>
                  </>
                ) : (
                  <>
                    <span className="text-[18px]">Save Profile</span>
                    <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
