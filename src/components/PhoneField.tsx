/**
 * PhoneField — phone/WhatsApp input with a changeable country code.
 * Defaults to +91 (India) since that's EBEXTA's primary market, but every other
 * country is selectable. The value is stored as one string: "+91 9538770402".
 *
 * Reusable — use this anywhere a phone number is collected so the behaviour and
 * the stored format stay identical across the app.
 */

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

/** Common codes first, then the rest alphabetically. */
export const COUNTRY_CODES: Array<{ code: string; label: string }> = [
  { code: '+91',  label: 'IN +91' },
  { code: '+1',   label: 'US/CA +1' },
  { code: '+44',  label: 'UK +44' },
  { code: '+971', label: 'AE +971' },
  { code: '+65',  label: 'SG +65' },
  { code: '+61',  label: 'AU +61' },
  { code: '+49',  label: 'DE +49' },
  { code: '+33',  label: 'FR +33' },
  { code: '+31',  label: 'NL +31' },
  { code: '+81',  label: 'JP +81' },
  { code: '+86',  label: 'CN +86' },
  { code: '+82',  label: 'KR +82' },
  { code: '+55',  label: 'BR +55' },
  { code: '+27',  label: 'ZA +27' },
  { code: '+7',   label: 'RU +7' },
  { code: '+39',  label: 'IT +39' },
  { code: '+34',  label: 'ES +34' },
  { code: '+46',  label: 'SE +46' },
  { code: '+41',  label: 'CH +41' },
  { code: '+353', label: 'IE +353' },
  { code: '+64',  label: 'NZ +64' },
  { code: '+60',  label: 'MY +60' },
  { code: '+62',  label: 'ID +62' },
  { code: '+63',  label: 'PH +63' },
  { code: '+66',  label: 'TH +66' },
  { code: '+84',  label: 'VN +84' },
  { code: '+880', label: 'BD +880' },
  { code: '+92',  label: 'PK +92' },
  { code: '+94',  label: 'LK +94' },
  { code: '+977', label: 'NP +977' },
  { code: '+966', label: 'SA +966' },
  { code: '+974', label: 'QA +974' },
  { code: '+965', label: 'KW +965' },
  { code: '+20',  label: 'EG +20' },
  { code: '+234', label: 'NG +234' },
  { code: '+254', label: 'KE +254' },
]

const DEFAULT_CODE = '+91'

/** Split a stored value ("+91 98765 43210") into its code and local number. */
export function splitPhone(value: string): { code: string; number: string } {
  const v = (value ?? '').trim()
  if (!v.startsWith('+')) return { code: DEFAULT_CODE, number: v }
  // Longest matching code wins (+971 before +97).
  const match = [...COUNTRY_CODES]
    .sort((a, b) => b.code.length - a.code.length)
    .find(c => v.startsWith(c.code))
  if (!match) return { code: DEFAULT_CODE, number: v.replace(/^\+/, '') }
  return { code: match.code, number: v.slice(match.code.length).trim() }
}

export function PhoneField({
  label = 'Phone / WhatsApp',
  value,
  onChange,
  required = false,
}: {
  label?: string
  value: string
  onChange: (full: string) => void
  required?: boolean
}) {
  const { code, number } = splitPhone(value)

  const boxStyle = {
    background: 'var(--bg-base)',
    border: '1px solid var(--border-subtle)',
    color: 'var(--text-primary)',
  } as const

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-bold tracking-[0.05em] uppercase" style={{ color: 'var(--text-muted)' }}>
        {label}{required && ' *'}
      </label>
      <div className="flex gap-2">
        <select
          aria-label="Country code"
          value={code}
          onChange={e => onChange(`${e.target.value} ${number}`.trim())}
          className="px-2 h-11 rounded-lg text-[13px] outline-none shrink-0 cursor-pointer"
          style={{ ...boxStyle, ...geist, maxWidth: 120 }}
        >
          {COUNTRY_CODES.map(c => <option key={c.code} value={c.code}>{c.label}</option>)}
        </select>
        <input
          type="tel"
          inputMode="tel"
          value={number}
          onChange={e => onChange(`${code} ${e.target.value.replace(/[^\d\s-]/g, '')}`.trim())}
          placeholder="9538770402"
          className="flex-1 min-w-0 px-3 h-11 rounded-lg text-[14px] outline-none"
          style={boxStyle}
        />
      </div>
    </div>
  )
}
