/**
 * LegalPage — renders a policy markdown file from /public/legal as a readable,
 * on-brand page. Used for /terms, /privacy, /refund (linked from the signup
 * consent checkbox and the footer). No markdown library needed — a small,
 * safe renderer handles the headings/bold/lists/tables our policies use.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { EbextaLogo } from '../components/common/EbextaLogo'

const geist = { fontFamily: 'Geist, Inter, sans-serif' }

const DOCS: Record<string, { file: string; title: string }> = {
  terms:   { file: '/legal/terms.md',   title: 'Terms of Service' },
  privacy: { file: '/legal/privacy.md', title: 'Privacy Policy' },
  refund:  { file: '/legal/refund.md',  title: 'Refund & Cancellation Policy' },
  dpdp:    { file: '/legal/dpdp.md',    title: 'DPDP & Data Handling' },
}

// Inline **bold** → <strong>, escaping everything else (XSS-safe: no raw HTML).
function inline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i} style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{p.slice(2, -2)}</strong>
      : <span key={i}>{p}</span>,
  )
}

function Markdown({ src }: { src: string }) {
  const lines = src.replace(/\r/g, '').split('\n')
  const out: React.ReactNode[] = []
  let list: string[] = []
  const flush = () => {
    if (list.length) {
      out.push(
        <ul key={`ul-${out.length}`} style={{ margin: '0 0 14px 18px', listStyle: 'disc' }}>
          {list.map((li, i) => <li key={i} style={{ margin: '4px 0', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{inline(li)}</li>)}
        </ul>,
      )
      list = []
    }
  }
  for (const raw of lines) {
    const l = raw.trimEnd()
    if (l.startsWith('> ')) { flush(); out.push(<p key={out.length} style={{ margin: '0 0 14px', padding: '10px 14px', borderLeft: '3px solid var(--border-strong)', background: 'var(--bg-surface)', color: 'var(--text-muted)', fontSize: 13, borderRadius: 4 }}>{inline(l.slice(2))}</p>); continue }
    if (l.startsWith('### ')) { flush(); out.push(<h3 key={out.length} style={{ ...geist, fontSize: 15, fontWeight: 600, margin: '18px 0 6px', color: 'var(--text-primary)' }}>{inline(l.slice(4))}</h3>); continue }
    if (l.startsWith('## ')) { flush(); out.push(<h2 key={out.length} style={{ ...geist, fontSize: 18, fontWeight: 600, margin: '26px 0 8px', color: 'var(--text-primary)' }}>{inline(l.slice(3))}</h2>); continue }
    if (l.startsWith('# ')) { flush(); out.push(<h1 key={out.length} style={{ ...geist, fontSize: 26, fontWeight: 700, margin: '0 0 12px', color: 'var(--text-primary)' }}>{inline(l.slice(2))}</h1>); continue }
    if (l.startsWith('---')) { flush(); out.push(<hr key={out.length} style={{ border: 0, borderTop: '1px solid var(--border-subtle)', margin: '20px 0' }} />); continue }
    if (l.startsWith('- ')) { list.push(l.slice(2)); continue }
    if (l.startsWith('|')) { flush(); out.push(<p key={out.length} style={{ margin: '2px 0', fontFamily: '"Geist Mono", monospace', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap' }}>{l.replace(/\|/g, '  ')}</p>); continue }
    if (l === '') { flush(); continue }
    flush()
    out.push(<p key={out.length} style={{ margin: '0 0 12px', color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7 }}>{inline(l)}</p>)
  }
  flush()
  return <>{out}</>
}

export default function LegalPage({ doc }: { doc: 'terms' | 'privacy' | 'refund' | 'dpdp' }) {
  const meta = DOCS[doc]
  const [src, setSrc] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    setSrc(null); setFailed(false)
    fetch(meta.file)
      .then(r => r.ok ? r.text() : Promise.reject())
      .then(t => { if (alive) setSrc(t) })
      .catch(() => { if (alive) setFailed(true) })
    return () => { alive = false }
  }, [meta.file])

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <header className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[820px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/home" className="flex items-center gap-2">
            <EbextaLogo variant="horizontal" size={26} priority />
          </Link>
          <nav className="flex items-center gap-4 text-[13px] font-medium">
            <Link to="/terms" className={`hover:underline ${doc === 'terms' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Terms</Link>
            <Link to="/privacy" className={`hover:underline ${doc === 'privacy' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Privacy</Link>
            <Link to="/refund" className={`hover:underline ${doc === 'refund' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Refund</Link>
            <Link to="/dpdp" className={`hover:underline ${doc === 'dpdp' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>DPDP</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-[820px] mx-auto px-6 py-12">
        {src === null && !failed && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Loading {meta.title}…</p>}
        {failed && <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Could not load the {meta.title}. Please try again later.</p>}
        {src && <Markdown src={src} />}
      </main>

      <footer className="border-t py-8 mt-8" style={{ borderColor: 'var(--border-subtle)' }}>
        <div className="max-w-[820px] mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-[13px]" style={{ color: 'var(--text-muted)' }}>
          <p>© {new Date().getFullYear()} EBEXTA. All rights reserved.</p>
          <nav className="flex items-center gap-6">
            <Link to="/terms" className={`hover:underline ${doc === 'terms' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Terms</Link>
            <Link to="/privacy" className={`hover:underline ${doc === 'privacy' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Privacy</Link>
            <Link to="/refund" className={`hover:underline ${doc === 'refund' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>Refund Policy</Link>
            <Link to="/dpdp" className={`hover:underline ${doc === 'dpdp' ? 'text-[var(--text-primary)] font-semibold' : 'text-[var(--text-secondary)]'}`}>DPDP</Link>
          </nav>
        </div>
      </footer>
    </div>
  )
}
