/**
 * ProductManager — manage what a user takes to market: their whole company, or
 * one of several specific products. Lives in Settings. Lets the user:
 *   • switch between company-level and product-level targeting
 *   • add a product (name + description + optional doc → AI ideal-buyer profile)
 *   • pick which product the scans currently target
 *   • re-analyze or delete a product
 */
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchProducts, saveProduct, setActiveProduct, useCompanyTargeting,
  reanalyzeProduct, deleteProduct, validateDoc, extractDocText, uploadProductDoc, analyzeProduct,
  type UserProduct,
} from '../lib/productAnalysis'
import { checkDescriptionVagueness, type VaguenessCheckResult } from '../lib/vagueness'
import { ClarificationFlow, type ClarificationAnswer } from './ClarificationFlow'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

export function ProductManager({ userId }: { userId: string }) {
  const [products, setProducts] = useState<UserProduct[]>([])
  const [mode, setMode] = useState<'company' | 'product'>('company')
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  // add-form state
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveLabel, setSaveLabel] = useState('')
  const [formErr, setFormErr] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)

  // Vagueness & clarification state
  const [vaguenessResult, setVaguenessResult] = useState<VaguenessCheckResult | null>(null)
  const [showClarification, setShowClarification] = useState(false)
  const [hasClarified, setHasClarified] = useState(false)
  const [clarificationAnswers, setClarificationAnswers] = useState<ClarificationAnswer[]>([])

  async function refresh() {
    const list = await fetchProducts(userId)
    setProducts(list)
    const { data } = await supabase.from('profiles').select('target_type').eq('id', userId).maybeSingle()
    setMode((data?.target_type === 'product' && list.some(p => p.is_active)) ? 'product' : 'company')
    setLoading(false)
  }
  useEffect(() => { refresh() }, [userId])

  async function switchToCompany() {
    setBusyId('company')
    await useCompanyTargeting(userId)
    await refresh()
    setBusyId(null)
  }

  async function activate(id: string) {
    setBusyId(id)
    await setActiveProduct(userId, id)
    await refresh()
    setBusyId(null)
  }

  async function reanalyze(p: UserProduct) {
    setBusyId(p.id)
    try { await reanalyzeProduct(p) } catch { /* ignore */ }
    await refresh()
    setBusyId(null)
  }

  async function remove(id: string) {
    if (!confirm('Remove this product? Your scans will fall back to company-level targeting if it was active.')) return
    setBusyId(id)
    await deleteProduct(userId, id)
    await refresh()
    setBusyId(null)
  }

  function pickFile(f: File | null) {
    setFileError('')
    if (!f) { setFile(null); return }
    const err = validateDoc(f)
    if (err) { setFileError(err); setFile(null); if (fileInput.current) fileInput.current.value = ''; return }
    setFile(f)
  }

  async function addProduct(overrideDesc?: string, overrideAnswers?: ClarificationAnswer[]) {
    const rawDescription = desc.trim()
    const currentDescription = (overrideDesc ?? desc).trim()
    if (!name.trim() || currentDescription.length < 10) { 
      setFormErr('Add a product name and a short description (what it does + who it’s for).')
      return 
    }

    // Run vagueness check before saving unless already clarified
    if (!hasClarified && !overrideDesc) {
      setSaving(true)
      setSaveLabel('Checking description specificity…')
      setFormErr('')
      const check = await checkDescriptionVagueness(currentDescription)
      if (check.specificity === 'vague' && check.clarifying_questions && check.clarifying_questions.length > 0) {
        setVaguenessResult(check)
        setShowClarification(true)
        setSaving(false)
        setSaveLabel('')
        return
      }
    }

    setSaving(true); setFormErr('')
    try {
      let docPath: string | null = null
      let docText = ''
      if (file) {
        setSaveLabel('Uploading…')
        const up = await uploadProductDoc(userId, file); docPath = up.path
        setSaveLabel('Reading document…'); docText = await extractDocText(file)
      }
      setSaveLabel('Analyzing ideal buyer…')
      const ideal = await analyzeProduct({ name: name.trim(), description: currentDescription, docText })
      await saveProduct(userId, { 
        name: name.trim(), 
        description: currentDescription, 
        docPath, 
        docText, 
        idealBuyer: ideal,
        raw_description: rawDescription,
        enriched_description: currentDescription,
        clarification_answers: overrideAnswers ?? clarificationAnswers,
      })
      setName(''); setDesc(''); setFile(null); if (fileInput.current) fileInput.current.value = ''
      setAdding(false)
      setShowClarification(false)
      setHasClarified(false)
      setClarificationAnswers([])
      await refresh()
    } catch {
      setFormErr('Could not analyze the product just now. Please try again.')
    } finally { setSaving(false); setSaveLabel('') }
  }

  const activeProduct = products.find(p => p.is_active)

  return (
    <section className="mb-8 p-6 rounded-xl border border-outline-variant bg-surface-container-low">
      <div className="flex items-center gap-2 mb-1">
        <span className="material-symbols-outlined text-primary">inventory_2</span>
        <h2 className="text-[20px] font-semibold text-on-surface" style={geist}>What you're taking to market</h2>
      </div>
      <p className="text-[13px] text-on-surface-variant mb-5">Target your whole company, or a specific product's ideal buyer. Scans use whatever is active here.</p>

      {/* company vs product toggle */}
      <div className="flex gap-2 mb-5">
        <button onClick={switchToCompany} disabled={busyId === 'company'}
          className="flex-1 p-3 rounded-xl border text-left transition-all"
          style={{
            borderColor: mode === 'company' ? 'var(--primary,#2D6A4F)' : 'var(--outline-variant,rgba(0,0,0,0.12))',
            background: mode === 'company' ? 'color-mix(in srgb, var(--primary,#2D6A4F) 8%, transparent)' : 'transparent',
          }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">apartment</span>
            <span className="text-[13px] font-bold text-on-surface" style={geist}>Whole company</span>
            {mode === 'company' && <span className="material-symbols-outlined text-[16px] text-primary ml-auto">check_circle</span>}
          </div>
        </button>
        <div className="flex-1 p-3 rounded-xl border text-left"
          style={{
            borderColor: mode === 'product' ? 'var(--primary,#2D6A4F)' : 'var(--outline-variant,rgba(0,0,0,0.12))',
            background: mode === 'product' ? 'color-mix(in srgb, var(--primary,#2D6A4F) 8%, transparent)' : 'transparent',
          }}>
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[18px] text-primary">inventory_2</span>
            <span className="text-[13px] font-bold text-on-surface" style={geist}>A specific product</span>
            {mode === 'product' && <span className="material-symbols-outlined text-[16px] text-primary ml-auto">check_circle</span>}
          </div>
          <p className="text-[11.5px] text-on-surface-variant mt-1 truncate">
            {activeProduct ? `Active: ${activeProduct.product_name}` : 'Add or pick a product below'}
          </p>
        </div>
      </div>

      {/* product list */}
      {loading ? (
        <div className="h-16 rounded-xl bg-surface-container animate-pulse" />
      ) : (
        <div className="space-y-2.5">
          {products.map(p => {
            const ib = p.ideal_buyer_profile?.ideal_buyer
            const on = p.is_active
            return (
              <div key={p.id} className="p-4 rounded-xl border"
                style={{ borderColor: on ? 'var(--primary,#2D6A4F)' : 'var(--outline-variant,rgba(0,0,0,0.12))', background: 'var(--surface-container-lowest, transparent)' }}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[14px] font-bold text-on-surface break-words" style={geist}>{p.product_name}</span>
                      {on && <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-primary text-on-primary">Active</span>}
                    </div>
                    {p.ideal_buyer_profile?.product_summary && (
                      <p className="text-[12.5px] text-on-surface-variant mt-1 break-words">{p.ideal_buyer_profile.product_summary}</p>
                    )}
                    {ib?.industries?.length ? (
                      <p className="text-[11.5px] text-on-surface-variant/80 mt-1.5 break-words">
                        <span className="font-semibold">Buyers:</span> {ib.industries.slice(0, 4).join(', ')}
                        {ib.buyer_roles?.length ? ` · ${ib.buyer_roles.slice(0, 3).join(', ')}` : ''}
                      </p>
                    ) : (
                      <p className="text-[11.5px] text-on-surface-variant/60 mt-1.5">No buyer profile yet: try Re-analyze.</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    {!on && (
                      <button onClick={() => activate(p.id)} disabled={busyId === p.id}
                        className="text-[11.5px] font-bold px-3 py-1.5 rounded-lg bg-primary text-on-primary hover:brightness-110 transition-all">
                        {busyId === p.id ? '…' : 'Scan for this'}
                      </button>
                    )}
                    <div className="flex gap-1">
                      <button onClick={() => reanalyze(p)} disabled={busyId === p.id} title="Re-analyze"
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-surface-container transition-all">
                        <span className="material-symbols-outlined text-[15px] text-on-surface-variant">{busyId === p.id ? 'hourglass_empty' : 'refresh'}</span>
                      </button>
                      <button onClick={() => remove(p.id)} disabled={busyId === p.id} title="Delete"
                        className="w-8 h-8 rounded-lg flex items-center justify-center border border-outline-variant hover:bg-surface-container transition-all">
                        <span className="material-symbols-outlined text-[15px] text-on-surface-variant">delete</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* add product */}
      {adding ? (
        <div className="mt-4 p-4 rounded-xl border border-primary/30 bg-primary/[0.04] space-y-3">
          {showClarification && vaguenessResult ? (
            <ClarificationFlow
              checkResult={vaguenessResult}
              onCancel={() => setShowClarification(false)}
              onComplete={(clarificationText, answers) => {
                const enriched = `${desc.trim()}\n\nClarification: ${clarificationText}`
                setDesc(enriched)
                setClarificationAnswers(answers)
                setShowClarification(false)
                setHasClarified(true)
                void addProduct(enriched, answers)
              }}
              onSkip={(freeTextOverride?: string) => {
                setShowClarification(false)
                setHasClarified(true)
                if (freeTextOverride) {
                  setDesc(freeTextOverride)
                  void addProduct(freeTextOverride)
                }
              }}
            />
          ) : null}
          <input value={name} onChange={e => setName(e.target.value)} maxLength={160}
            placeholder="Product or service name"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary" />
          <textarea value={desc} onChange={e => setDesc(e.target.value.slice(0, 2000))} rows={3}
            placeholder="What it does + who it's for"
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-2.5 text-[14px] text-on-surface outline-none focus:border-primary resize-none" />
          <input ref={fileInput} type="file" accept=".pdf,.doc,.docx" className="hidden" onChange={e => pickFile(e.target.files?.[0] ?? null)} />
          <button type="button" onClick={() => fileInput.current?.click()}
            className="w-full flex items-center gap-3 bg-surface-container-lowest border border-dashed border-outline-variant rounded-lg px-4 py-2.5 hover:border-primary/50 transition-all text-left">
            <span className="material-symbols-outlined text-primary text-[18px]">{file ? 'description' : 'upload_file'}</span>
            <span className="flex-grow text-[13px] text-on-surface truncate">{file ? file.name : 'Optional (PDF, DOC, or DOCX under 5 MB)'}</span>
          </button>
          {fileError && <p className="text-[12px] text-error">{fileError}</p>}
          {formErr && <p className="text-[12px] text-error">{formErr}</p>}
          <div className="flex justify-end gap-2">
            <button onClick={() => { setAdding(false); setShowClarification(false); setFormErr('') }} className="px-4 py-2 rounded-lg text-[13px] font-semibold text-on-surface-variant border border-outline-variant">Cancel</button>
            <button onClick={() => addProduct()} disabled={saving}
              className="px-4 py-2 rounded-lg text-[13px] font-bold bg-primary text-on-primary hover:brightness-110 transition-all flex items-center gap-2 disabled:opacity-70">
              {saving ? <><div className="w-4 h-4 border-2 border-on-primary border-t-transparent rounded-full animate-spin" />{saveLabel || 'Saving…'}</> : <>Add & analyze</>}
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setAdding(true)}
          className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-outline-variant text-[13px] font-semibold text-on-surface-variant hover:border-primary/50 hover:text-primary transition-all">
          <span className="material-symbols-outlined text-[17px]">add_circle</span>
          Add a product
        </button>
      )}
    </section>
  )
}
