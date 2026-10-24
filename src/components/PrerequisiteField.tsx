/**
 * PREREQUISITE FIELD — "Does your product require anything to already exist at
 * the client's side?"
 *
 * Optional and usually empty. When empty, the feasibility gate never runs and
 * the user's results are exactly as they were before this feature existed.
 *
 * Used in onboarding (step 1) and Settings → Company profile.
 */

const EXAMPLES = [
  'existing CCTV cameras',
  'physical stores',
  'a vehicle fleet',
  'an ERP system',
  'cloud infrastructure',
]

export function PrerequisiteField({
  values, onChange, variant = 'onboarding', max = 3,
}: {
  values: string[]
  onChange: (next: string[]) => void
  /** 'onboarding' uses the tailwind token classes; 'settings' uses theme vars. */
  variant?: 'onboarding' | 'settings'
  max?: number
}) {
  const list = values.length > 0 ? values : ['']

  function setAt(i: number, v: string) {
    const next = [...list]
    next[i] = v
    onChange(next.filter((x, idx) => x.trim() !== '' || idx < next.length))
  }
  function removeAt(i: number) {
    const next = list.filter((_, idx) => idx !== i)
    onChange(next.filter(x => x.trim() !== ''))
  }
  function add() {
    if (list.length >= max) return
    onChange([...list.filter(x => x.trim() !== ''), ''])
  }

  const onboarding = variant === 'onboarding'

  const inputCls = onboarding
    ? 'flex-grow bg-transparent border-none p-0 text-[15px] text-on-surface placeholder:text-outline focus:ring-0 outline-none'
    : 'flex-grow bg-transparent border-none p-0 text-[14px] outline-none'

  const wrapCls = onboarding
    ? 'flex items-center gap-3 bg-surface-container-lowest border border-outline-variant rounded-lg px-4 py-3 focus-within:ring-1 focus-within:ring-primary/20 transition-all'
    : 'flex items-center gap-3 rounded-lg px-4 py-2.5'

  const wrapStyle = onboarding
    ? undefined
    : { background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }

  return (
    <div className="space-y-2">
      <label
        className={onboarding
          ? 'text-[11px] font-bold tracking-[0.06em] text-on-surface-variant uppercase block'
          : 'text-[11px] font-bold tracking-[0.06em] uppercase block'}
        style={onboarding ? undefined : { color: 'var(--text-muted)' }}
      >
        Optional: does your product require anything to already exist at the client's side?
      </label>

      <div className="space-y-2">
        {list.slice(0, max).map((v, i) => (
          <div key={i} className={wrapCls} style={wrapStyle}>
            <span className={onboarding ? 'material-symbols-outlined text-outline' : 'material-symbols-outlined'}
              style={onboarding ? undefined : { color: 'var(--text-muted)', fontSize: 18 }}>
              foundation
            </span>
            <input
              value={v}
              onChange={e => setAt(i, e.target.value.slice(0, 120))}
              className={inputCls}
              style={onboarding ? undefined : { color: 'var(--text-primary)' }}
              placeholder={`e.g. ${EXAMPLES[i % EXAMPLES.length]}`}
              type="text"
            />
            {(v.trim() !== '' || list.length > 1) && (
              <button type="button" onClick={() => removeAt(i)} title="Remove"
                className="shrink-0">
                <span className="material-symbols-outlined text-[18px]"
                  style={{ color: 'var(--text-muted)' }}>close</span>
              </button>
            )}
          </div>
        ))}
      </div>

      {list.filter(x => x.trim() !== '').length > 0 && list.length < max && (
        <button type="button" onClick={add}
          className="inline-flex items-center gap-1 text-[12px] font-semibold"
          style={{ color: 'var(--accent-interactive)' }}>
          <span className="material-symbols-outlined text-[15px]">add</span>
          Add another
        </button>
      )}

      <p className={onboarding ? 'text-[11px] text-on-surface-variant/60' : 'text-[11px]'}
        style={onboarding ? undefined : { color: 'var(--text-muted)' }}>
        We'll only show you companies that can actually use what you sell. Leave blank if your
        product works anywhere (most do).
      </p>
    </div>
  )
}
