import { useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { EbextaLogo } from '../../components/common/EbextaLogo'

const GEOGRAPHY_DATA: Record<string, Record<string, string[]>> = {
  'India': {
    'Karnataka': ['Bengaluru', 'Mysuru', 'Mangaluru', 'Hubli'],
    'Maharashtra': ['Mumbai', 'Pune', 'Nagpur', 'Nashik'],
    'Delhi NCR': ['New Delhi', 'Gurugram', 'Noida'],
    'Tamil Nadu': ['Chennai', 'Coimbatore', 'Madurai'],
    'Telangana': ['Hyderabad', 'Warangal'],
    'Gujarat': ['Ahmedabad', 'Surat', 'Vadodara'],
  },
  'United States': {
    'California': ['San Francisco', 'Los Angeles', 'San Diego', 'San Jose'],
    'New York': ['New York City', 'Buffalo'],
    'Texas': ['Austin', 'Dallas', 'Houston', 'San Antonio'],
    'Washington': ['Seattle', 'Bellevue', 'Redmond'],
    'Massachusetts': ['Boston', 'Cambridge'],
    'Illinois': ['Chicago', 'Evanston'],
  },
  'United Kingdom': {
    'England': ['London', 'Manchester', 'Birmingham', 'Bristol', 'Cambridge'],
    'Scotland': ['Edinburgh', 'Glasgow'],
    'Wales': ['Cardiff', 'Swansea'],
  },
  'Canada': {
    'Ontario': ['Toronto', 'Ottawa', 'Waterloo'],
    'British Columbia': ['Vancouver', 'Victoria'],
    'Quebec': ['Montreal', 'Quebec City'],
  },
  'Australia': {
    'New South Wales': ['Sydney', 'Newcastle'],
    'Victoria': ['Melbourne', 'Geelong'],
    'Queensland': ['Brisbane', 'Gold Coast'],
  },
  'Germany': {
    'Berlin': ['Berlin'],
    'Bavaria': ['Munich', 'Nuremberg'],
    'Hesse': ['Frankfurt'],
  },
  'Singapore': {
    'Central Region': ['Downtown Core', 'Marina Bay', 'Orchard'],
    'East Region': ['Changi', 'Tampines'],
  },
  'UAE': {
    'Dubai': ['Dubai City', 'Jebel Ali'],
    'Abu Dhabi': ['Abu Dhabi City'],
  },
  'Netherlands': {
    'North Holland': ['Amsterdam', 'Haarlem'],
    'South Holland': ['Rotterdam', 'The Hague'],
  },
  'France': {
    'Île-de-France': ['Paris'],
    'Auvergne-Rhône-Alpes': ['Lyon', 'Grenoble'],
  }
}

const TECH_SUGGESTIONS = ['AWS', 'Azure', 'GCP', 'Shopify', 'React', 'Flutter', 'Salesforce', 'HubSpot']

export default function OnboardingGeography() {
  const navigate = useNavigate()
  
  // Restore previously saved filters so going back or reloading keeps selections
  const saved = (() => {
    try { return JSON.parse(localStorage.getItem('ebexta_scan_filters') ?? '{}') } catch { return {} }
  })()

  const [countries, setCountries] = useState<string[]>(() => {
    if (Array.isArray(saved.countries) && saved.countries.length > 0) return saved.countries as string[]
    if (saved.country) {
      const parts = String(saved.country).split(',').map((s: string) => s.trim()).filter(Boolean)
      if (parts.length > 0) return parts
    }
    return ['India']
  })
  const [countryOptions, setCountryOptions] = useState<string[]>(() => {
    const fromSaved = Array.isArray(saved.countries) ? (saved.countries as string[]) : []
    return Array.from(new Set([...Object.keys(GEOGRAPHY_DATA), ...fromSaved]))
  })
  const [customCountryInput, setCustomCountryInput] = useState('')

  const [states, setStates] = useState<string[]>(() =>
    Array.isArray(saved.techHubs) && saved.techHubs.length > 0
      ? (saved.techHubs as string[])
      : Array.isArray(saved.states) ? (saved.states as string[]) : []
  )
  const [customStateInput, setCustomStateInput] = useState('')

  const [cities, setCities] = useState<string[]>(() =>
    Array.isArray(saved.cities) ? (saved.cities as string[]) : []
  )
  const [customCityInput, setCustomCityInput] = useState('')
  
  const [techStack, setTechStack] = useState<string[]>(() =>
    Array.isArray(saved.techStack) ? (saved.techStack as string[]) : []
  )
  const [techInput, setTechInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Toggle helpers
  function toggleCountry(c: string) {
    setCountries(prev => {
      const next = prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
      return next
    })
  }

  function addCustomCountry(c: string) {
    const trimmed = c.trim()
    if (!trimmed) return
    if (!countryOptions.includes(trimmed)) {
      setCountryOptions(prev => [...prev, trimmed])
    }
    if (!countries.includes(trimmed)) {
      setCountries(prev => [...prev, trimmed])
    }
    setCustomCountryInput('')
  }

  function toggleState(s: string) {
    setStates(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s])
  }

  function addCustomState(s: string) {
    const trimmed = s.trim()
    if (!trimmed) return
    if (!states.includes(trimmed)) {
      setStates(prev => [...prev, trimmed])
    }
    setCustomStateInput('')
  }

  function toggleCity(c: string) {
    setCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function addCustomCity(name: string) {
    const trimmed = name.trim()
    if (!trimmed) return
    if (!cities.includes(trimmed)) {
      setCities(prev => [...prev, trimmed])
    }
    setCustomCityInput('')
  }

  function addTech(t: string) {
    if (t.trim() && !techStack.includes(t.trim())) setTechStack(prev => [...prev, t.trim()])
    setTechInput('')
  }
  
  function removeTech(t: string) { setTechStack(prev => prev.filter(x => x !== t)) }

  // Derived lists for UI based on selections
  const availableStates = useMemo(() => {
    let list: string[] = []
    countries.forEach(c => {
      if (GEOGRAPHY_DATA[c]) {
        list = list.concat(Object.keys(GEOGRAPHY_DATA[c]))
      }
    })
    return Array.from(new Set([...list, ...states]))
  }, [countries, states])

  const availableCities = useMemo(() => {
    let list: string[] = []
    countries.forEach(c => {
      if (GEOGRAPHY_DATA[c]) {
        if (states.length > 0) {
          states.forEach(s => {
            if (GEOGRAPHY_DATA[c][s]) {
              list = list.concat(GEOGRAPHY_DATA[c][s])
            }
          })
        } else {
          // If no state is selected, show all top cities for the selected countries!
          Object.values(GEOGRAPHY_DATA[c]).forEach(cityArr => {
            list = list.concat(cityArr)
          })
        }
      }
    })
    // Also include any selected cities
    return Array.from(new Set([...list, ...cities]))
  }, [countries, states, cities])

  async function handleLaunch() {
    try {
      setLoading(true)
      setError(null)

      const existing = localStorage.getItem('ebexta_scan_filters')
      const parsed = existing ? JSON.parse(existing) : {}

      // Mode is now handled in Step 1, so we just read it back out.
      const mode = parsed.mode ?? 'seeker'
      const primaryCountry = countries[0] ?? 'India'

      const finalFilters = {
        ...parsed,
        country: countries.join(', ') || 'India', 
        countries,
        region: states[0] ?? cities[0] ?? primaryCountry,
        techHubs: states.length > 0 ? states : cities,
        states,
        cities: cities,
        techStack,
        mode,
      }
      
      delete (finalFilters as { senderEmail?: string }).senderEmail
      localStorage.setItem('ebexta_scan_filters', JSON.stringify(finalFilters))

      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Fetch existing profile to preserve personal name, master email, and company
        const { data: existingProf } = await supabase
          .from('profiles')
          .select('company_name, sender_email, email, name')
          .eq('id', user.id)
          .maybeSingle()

        const profileUpdate: Record<string, unknown> = {
          id: user.id,
          email: user.email || existingProf?.email || '',
          company_name: parsed.companyName?.trim() || existingProf?.company_name || '',
          website: parsed.companyWebsite ?? '',
          mission: parsed.mission ?? '',
          mode, 
          updated_at: new Date().toISOString(),
        }

        // Only update outreach sender_email if explicitly provided; otherwise preserve existing or default to account email
        if (parsed.senderEmail && parsed.senderEmail.trim()) {
          profileUpdate.sender_email = parsed.senderEmail.trim()
        } else if (!existingProf?.sender_email) {
          profileUpdate.sender_email = user.email || ''
        }

        // Retain user's actual name
        const fullName = user.user_metadata?.full_name || user.user_metadata?.name || existingProf?.name
        if (fullName) {
          profileUpdate.name = fullName
        }

        await supabase
          .from('profiles')
          .upsert(profileUpdate)
          .select()
          .single()
          
        await supabase.rpc('ebexta_mark_onboarded')
        window.dispatchEvent(new CustomEvent('ebexta_mode_changed', { detail: { mode } }))
        window.dispatchEvent(new Event('ebexta_profile_updated'))
      }

      try { localStorage.setItem('ebexta_onboarded', 'true') } catch { /* ignore */ }
      navigate('/scan')
    } catch (err: unknown) {
      console.error('Onboarding error:', err)
      navigate('/scan')
    } finally {
      setLoading(false)
    }
  }

  const geo = { fontFamily: 'Geist, Inter, sans-serif' }

  return (
    <div className="bg-background text-on-surface min-h-screen flex flex-col items-center font-sans">
      <div className="fixed top-[20%] left-[10%] -z-20 w-1/3 h-1/3 bg-primary/5 rounded-full blur-[120px]" />
      <div className="fixed bottom-[10%] right-[10%] -z-20 w-1/4 h-1/4 bg-secondary/5 rounded-full blur-[100px]" />

      <header className="fixed top-0 w-full bg-surface/80 backdrop-blur-md z-50 border-b border-outline-variant">
        <div className="flex justify-between items-center px-6 py-4 w-full max-w-[1280px] mx-auto">
          <EbextaLogo variant="horizontal" size={32} priority />
          <span className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase">Step 3 of 3: Where are you looking?</span>
        </div>
      </header>

      <main className="flex-grow flex items-start justify-center pt-24 pb-10 px-4 w-full max-w-3xl mx-auto overflow-y-auto">
        <div className="w-full glass-panel rounded-xl p-6 md:p-10 relative overflow-hidden" style={{ boxShadow: '0 0 20px var(--border-subtle)' }}>
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary-container/5 rounded-full blur-3xl" />

          {/* Progress */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-1 flex-1 bg-primary rounded-full" />
            <div className="h-1 flex-1 bg-primary rounded-full" />
            <div className="h-1 flex-1 bg-primary rounded-full" />
          </div>

          <div className="mb-8 relative z-10">
            <h1 className="text-[32px] font-bold text-primary mb-2 tracking-[-0.04em]" style={geo}>Where are you looking?</h1>
            <p className="text-[16px] text-on-surface-variant max-w-lg">Pick the regions and cities where you want to find matches.</p>
          </div>

          <section className="space-y-8 relative z-10">
            
            {/* 1. Countries */}
            <div className="space-y-3 p-5 rounded-xl border border-outline-variant bg-surface">
              <label className="text-[12px] font-bold tracking-[0.06em] text-primary uppercase block">
                1. Select Countries
              </label>
              <div className="flex flex-wrap gap-2">
                {countryOptions.map(c => {
                  const active = countries.includes(c)
                  return (
                    <button
                      key={c}
                      type="button"
                      onClick={() => toggleCountry(c)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[13px] font-medium transition-all ${
                        active
                          ? 'bg-primary text-on-primary border-primary shadow-md'
                          : 'bg-surface-container-lowest border-outline-variant text-on-surface-variant hover:border-primary hover:text-primary'
                      }`}
                    >
                      <span className="material-symbols-outlined text-[16px]">
                        {active ? 'check_box' : 'check_box_outline_blank'}
                      </span>
                      {c}
                    </button>
                  )
                })}
              </div>

              {/* Custom country input */}
              <div className="pt-2 border-t border-outline-variant/30 flex items-center gap-2">
                <input
                  type="text"
                  value={customCountryInput}
                  onChange={e => setCustomCountryInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addCustomCountry(customCountryInput)
                    }
                  }}
                  placeholder="Add custom country..."
                  className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-[13px] text-on-surface focus:outline-none focus:border-primary"
                />
                <button
                  type="button"
                  onClick={() => addCustomCountry(customCountryInput)}
                  disabled={!customCountryInput.trim()}
                  className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                >
                  + Add Country
                </button>
              </div>

              {countries.length === 0 && (
                <p className="text-[11px] text-error">Select at least one country to proceed.</p>
              )}
            </div>

            {/* 2. States / Regions (Cascaded) */}
            {countries.length > 0 && (
              <div className="space-y-3 p-5 rounded-xl border border-outline-variant bg-surface animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-[12px] font-bold tracking-[0.06em] text-primary uppercase block flex items-center justify-between">
                  <span>2. Select States and Regions</span>
                  <span className="text-[10px] font-mono opacity-60 normal-case">{states.length} selected</span>
                </label>

                {availableStates.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {availableStates.map(s => {
                      const active = states.includes(s)
                      return (
                        <button
                          key={s}
                          type="button"
                          onClick={() => toggleState(s)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-medium transition-all ${
                            active
                              ? 'bg-secondary text-on-secondary border-secondary shadow-sm'
                              : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:border-secondary hover:text-secondary'
                          }`}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {active ? 'check_circle' : 'radio_button_unchecked'}
                          </span>
                          {s}
                        </button>
                      )
                    })}
                  </div>
                )}

                {/* Custom / Other State or Region typing box */}
                <div className="pt-2 border-t border-outline-variant/30 flex items-center gap-2">
                  <input
                    type="text"
                    value={customStateInput}
                    onChange={e => setCustomStateInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomState(customStateInput)
                      }
                    }}
                    placeholder="Other / Add custom state or region (e.g. Maharashtra, Ontario, Bavaria)..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-[13px] text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomState(customStateInput)}
                    disabled={!customStateInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:brightness-110 disabled:opacity-50 transition-all shrink-0"
                  >
                    + Add State/Region
                  </button>
                </div>
              </div>
            )}

            {/* 3. Cities and Tech Hubs */}
            {countries.length > 0 && availableCities.length > 0 && (
              <div className="space-y-3 p-5 rounded-xl border border-outline-variant bg-surface animate-in fade-in slide-in-from-top-4 duration-300">
                <label className="text-[12px] font-bold tracking-[0.06em] text-primary uppercase block flex items-center justify-between">
                  <span>3. Select Cities and Tech Hubs</span>
                  <span className="text-[10px] font-mono opacity-60 normal-case">{cities.length} selected</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {availableCities.map(c => {
                    const active = cities.includes(c)
                    return (
                      <button
                        key={c}
                        type="button"
                        onClick={() => toggleCity(c)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[12px] font-bold transition-all ${
                          active
                            ? 'bg-tertiary text-on-tertiary border-tertiary shadow-sm'
                            : 'bg-surface-container-lowest border-outline-variant text-on-surface hover:border-tertiary hover:text-tertiary'
                        }`}
                      >
                        {c}
                      </button>
                    )
                  })}
                </div>

                {/* Custom City input */}
                <div className="pt-2 border-t border-outline-variant/30 flex items-center gap-2">
                  <input
                    type="text"
                    value={customCityInput}
                    onChange={e => setCustomCityInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addCustomCity(customCityInput)
                      }
                    }}
                    placeholder="Add custom city (e.g. Pune, Austin, London)..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-outline-variant bg-surface-container-lowest text-[13px] text-on-surface focus:outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    onClick={() => addCustomCity(customCityInput)}
                    disabled={!customCityInput.trim()}
                    className="px-3 py-1.5 rounded-lg bg-primary text-on-primary text-[12px] font-semibold hover:brightness-110 disabled:opacity-50 transition-all"
                  >
                    + Add City
                  </button>
                </div>
              </div>
            )}

            {/* Tech Stack */}
            <div className="space-y-2 mt-8">
              <div>
                <label className="text-[11px] font-bold tracking-[0.06em] text-on-surface-variant block">Target Companies Using These Tools</label>
                <p className="text-[11px] text-on-surface-variant/60 mt-0.5">Based on EBEXTA Engine inference (not guaranteed)</p>
              </div>
              <div className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg p-3 min-h-[70px] focus-within:border-primary transition-all">
                <div className="flex flex-wrap gap-2 mb-2">
                  {techStack.map(t => (
                    <div key={t} className="flex items-center gap-1 px-3 py-1 rounded-lg text-[11px] font-bold"
                      style={{ background: 'var(--accent-subtle)', border: '1px solid var(--accent)', color: 'var(--accent-interactive)' }}>
                      {t}
                      <button type="button" onClick={() => removeTech(t)}>
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  ))}
                  <input
                    value={techInput}
                    onChange={e => setTechInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && techInput.trim()) { e.preventDefault(); addTech(techInput.trim()) } }}
                    className="bg-transparent border-none focus:ring-0 outline-none p-1 text-[14px] flex-grow"
                    placeholder="Add technology…"
                    type="text"
                  />
                </div>
                <div className="border-t border-outline-variant/30 pt-2">
                  <p className="text-[11px] text-on-surface-variant mb-2 font-bold tracking-[0.06em] px-1">Suggestions</p>
                  <div className="flex flex-wrap gap-2">
                    {TECH_SUGGESTIONS.filter(t => !techStack.includes(t)).map(t => (
                      <button key={t} type="button" onClick={() => addTech(t)}
                        className="px-3 py-1 rounded border border-outline-variant hover:border-primary hover:text-primary text-[12px] transition-all bg-surface-container-low">
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-[var(--critical-bg)] border border-[var(--critical)]/30 text-[var(--critical)] text-sm">
                {error}
              </div>
            )}

            <div className="pt-4 flex items-center justify-between">
              <button
                onClick={() => navigate('/onboarding/filters')}
                className="flex items-center gap-1 text-[14px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-[18px]">arrow_back</span> Back
              </button>

              <button
                onClick={handleLaunch}
                disabled={loading || countries.length === 0}
                className="h-14 px-10 bg-primary text-on-primary font-semibold rounded-lg flex items-center justify-center gap-3 hover:brightness-110 active:scale-[0.98] disabled:opacity-60 transition-all group"
                style={{ boxShadow: '0 0 24px var(--border-subtle)', fontFamily: 'Geist, Inter, sans-serif', fontSize: '18px' }}
              >
                {loading ? 'Launching…' : 'Find my matches'}
                {!loading && <span className="material-symbols-outlined group-hover:translate-x-1 transition-transform">rocket_launch</span>}
              </button>
            </div>
            <p className="text-center text-on-surface-variant text-[11px] font-bold tracking-[0.06em] opacity-60">Your first scan is free</p>
          </section>
        </div>
      </main>
    </div>
  )
}

