/**
 * "WHAT THEIR WEBSITE ACTUALLY SAYS" + "CLAIM VERIFICATION"
 * ---------------------------------------------------------------------------
 * The proof layer. Everything here came from pages EBEXTA genuinely fetched, so
 * every line can carry a clickable source. When the site could not be read we
 * say so plainly rather than dressing inference up as fact.
 *
 * Theme tokens only — no new colours, no new fonts.
 */

import { useState } from 'react'
import { openExternal } from '../lib/urlUtils'
import { readStatusLabel } from '../lib/siteWalkthrough'
import type {
  SiteWalkthrough, PageRead, ClaimCheck, ClaimStatus, SiteReadStatus,
  VerifiedSignal, UnconfirmedSignal,
} from '../lib/siteWalkthrough'

/**
 * How an absence is presented. "Absent" is the only one we assert; the others
 * admit we could not tell. Stating "they have no leadership page" when the page
 * was a grid of team photos is the failure this exists to prevent.
 */
const ABSENCE_META: Record<string, { label: string; color: string; bg: string }> = {
  absent:                 { label: 'Not found',  color: 'var(--warning)',    bg: 'var(--warning-bg)' },
  not_checked:            { label: 'Not checked', color: 'var(--text-muted)', bg: 'var(--bg-surface)' },
  present_but_unreadable: { label: 'In images',  color: 'var(--text-muted)', bg: 'var(--bg-surface)' },
}

// ─── Source badges — the three provenance states ─────────────────────────────

export type SourceKind = 'site' | 'human' | 'inferred' | 'not_checked'

/** Every data point on the lead gets exactly one of these. */
export function SourceBadge({ kind, url, className = '' }: {
  kind: SourceKind
  url?: string | null
  className?: string
}) {
  const meta: Record<SourceKind, { icon: string; label: string; color: string; bg: string; border: string }> = {
    site: {
      icon: 'language', label: 'From their website',
      color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success)',
    },
    human: {
      icon: 'verified', label: 'Human-verified by EBEXTA',
      color: 'var(--success)', bg: 'var(--success-bg)', border: 'var(--success)',
    },
    inferred: {
      icon: 'psychology', label: 'EBEXTA Engine inferred — unverified',
      color: 'var(--text-secondary)', bg: 'var(--accent-subtle)', border: 'var(--border-strong)',
    },
    not_checked: {
      icon: 'help', label: 'Not checked yet',
      color: 'var(--text-muted)', bg: 'var(--bg-base)', border: 'var(--border-subtle)',
    }
  }
  const m = meta[kind]
  const clickable = kind === 'site' && !!url

  return (
    <button
      type="button"
      onClick={clickable ? (e) => { e.stopPropagation(); openExternal(url!) } : undefined}
      disabled={!clickable}
      title={clickable ? `Proved by ${url}` : m.label}
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-[0.06em] uppercase shrink-0 ${clickable ? 'cursor-pointer' : 'cursor-default'} ${className}`}
      style={{ background: m.bg, color: m.color, border: `1px solid ${m.border}` }}
    >
      <span className="material-symbols-outlined text-[11px]" style={{ fontVariationSettings: "'FILL' 1" }}>
        {kind === 'inferred' ? m.icon : kind === 'human' ? 'verified' : kind === 'not_checked' ? 'help' : 'language'}
      </span>
      {kind === 'site' ? 'Their site' : kind === 'human' ? 'EBEXTA verified' : kind === 'not_checked' ? 'Not Checked' : 'EBEXTA Engine inferred'}
      {clickable && <span className="material-symbols-outlined text-[10px]">open_in_new</span>}
    </button>
  )
}

// ─── Small building blocks ───────────────────────────────────────────────────

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-2.5" style={{ borderTop: '1px solid var(--border-subtle)' }}>
      <p className="label-xs mb-1">{label}</p>
      <div className="text-[13px] leading-relaxed" style={{ color: 'var(--text-primary)' }}>{children}</div>
    </div>
  )
}

function Chips({ items, tone = 'default' }: { items: string[]; tone?: 'default' | 'accent' }) {
  if (items.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t, i) => (
        <span key={i} className="px-2 py-0.5 rounded-full text-[11.5px]"
          style={tone === 'accent'
            ? { background: 'var(--accent-subtle)', color: 'var(--text-primary)', border: '1px solid var(--border-strong)' }
            : { background: 'var(--bg-surface)', color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}>
          {t}
        </span>
      ))}
    </div>
  )
}

// ─── The "could not read" state — stated plainly ─────────────────────────────

function UnreadableNotice({ status }: { status: SiteReadStatus }) {
  return (
    <div className="rounded-xl px-4 py-3.5 flex gap-3"
      style={{ background: 'var(--warning-bg)', border: '1px solid var(--warning)' }}>
      <span className="material-symbols-outlined text-[19px] shrink-0"
        style={{ color: 'var(--warning)', fontVariationSettings: "'FILL' 1" }}>report</span>
      <div>
        <p className="text-[13.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>
          Website could not be read — details are EBEXTA Engine inferred and unverified.
        </p>
        <p className="text-[12.5px] mt-1 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
          {status === 'blocked'
            ? 'Their site blocks automated reading (robots.txt), so EBEXTA could not confirm anything published there.'
            : 'The site did not respond when EBEXTA tried to read it. Treat everything on this lead as unconfirmed until you check it yourself.'}
          {' '}This lead can never show a VERIFIED badge.
        </p>
      </div>
    </div>
  )
}

// ─── WHAT THEIR WEBSITE ACTUALLY SAYS ────────────────────────────────────────

export function SiteWalkthroughPanel({
  walkthrough, pagesRead, status, readAt, corrections, signals, unconfirmed,
}: {
  walkthrough: SiteWalkthrough | null | undefined
  pagesRead: PageRead[] | undefined
  status: SiteReadStatus | undefined
  readAt?: string
  corrections?: string[]
  signals?: VerifiedSignal[]
  unconfirmed?: UnconfirmedSignal[]
}) {
  const [pagesOpen, setPagesOpen] = useState(false)
  const pages = pagesRead ?? []
  const unreadable = status === 'unreachable' || status === 'blocked'

  // Confirmed absences and unconfirmed ones live in ONE list, each carrying its
  // own status badge — so a genuine gap and an "we couldn't tell" are never
  // presented as the same thing.
  const absenceRows: Array<{ signal: string; detail: string; source_url: string | null; status: string }> = [
    ...(signals ?? []).filter(s => s.status === 'absent')
      .map(s => ({ signal: s.signal, detail: s.detail, source_url: s.source_url, status: 'absent' })),
    ...(unconfirmed ?? [])
      .map(u => ({ signal: u.signal, detail: u.reason || u.detail, source_url: u.source_url, status: u.status })),
  ]

  // Never rendered at all for leads scanned before the walkthrough shipped —
  // an empty panel would imply we looked and found nothing.
  if (!status) return null

  const dateLabel = readAt
    ? new Date(readAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[18px]"
          style={{ color: 'var(--accent-interactive)' }}>travel_explore</span>
        <h2 className="text-[16px] font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
          What their website actually says
        </h2>
        {!unreadable && (
          <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
            {readStatusLabel(status, pages.length)}{dateLabel ? ` · ${dateLabel}` : ''}
          </span>
        )}
      </div>

      {unreadable && !walkthrough?.what_they_actually_do && (walkthrough?.services_listed ?? []).length === 0 ? (
        <UnreadableNotice status={status} />
      ) : (
        <div className="rounded-xl px-4 py-1"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>

          {/* Pages we actually read — the receipt */}
          <div className="py-3">
            <button onClick={() => setPagesOpen(v => !v)}
              className="flex items-center gap-1.5 text-[12.5px] font-semibold"
              style={{ color: 'var(--accent-interactive)' }}>
              <span className="material-symbols-outlined text-[16px]">
                {pagesOpen ? 'expand_less' : 'expand_more'}
              </span>
              {pages.length} page{pages.length === 1 ? '' : 's'} read
            </button>
            {pagesOpen && (
              <div className="mt-2 space-y-1">
                {pages.map((p, i) => (
                  <button key={i} onClick={() => openExternal(p.url)}
                    className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)' }}>
                    <span className="text-[10px] font-bold tracking-[0.06em] uppercase shrink-0"
                      style={{ color: 'var(--text-muted)', width: 62 }}>{p.kind}</span>
                    <span className="text-[12px] truncate flex-1 underline"
                      style={{ color: 'var(--accent-interactive)' }}>{p.url}</span>
                    <span className="material-symbols-outlined text-[13px] shrink-0"
                      style={{ color: 'var(--text-muted)' }}>open_in_new</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {walkthrough?.what_they_actually_do && (
            <Row label="In their own words">{walkthrough.what_they_actually_do}</Row>
          )}

          {(walkthrough?.services_listed ?? []).length > 0 && (
            <Row label="Services, exactly as published">
              <Chips items={walkthrough!.services_listed} tone="accent" />
            </Row>
          )}

          {(walkthrough?.clients_named ?? []).length > 0 && (
            <Row label="Clients named on their site">
              <Chips items={walkthrough!.clients_named} />
            </Row>
          )}

          {(walkthrough?.certifications_claimed ?? []).length > 0 && (
            <Row label="Certifications they publish">
              <Chips items={walkthrough!.certifications_claimed} />
            </Row>
          )}

          {(walkthrough?.team_members_listed ?? []).length > 0 && (
            <Row label="People listed on their site">
              <div className="space-y-1">
                {walkthrough!.team_members_listed.slice(0, 8).map((t, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="text-[13px] font-semibold" style={{ color: 'var(--text-primary)' }}>{t.name}</span>
                    {t.title && <span className="text-[12px]" style={{ color: 'var(--text-secondary)' }}>· {t.title}</span>}
                    {t.page_url && (
                      <button onClick={() => openExternal(t.page_url)}
                        className="text-[11px] underline" style={{ color: 'var(--accent-interactive)' }}>source</button>
                    )}
                  </div>
                ))}
              </div>
            </Row>
          )}

          {(walkthrough?.open_roles ?? []).length > 0 && (
            <Row label="Roles they are hiring for">
              <Chips items={walkthrough!.open_roles.map(r => r.role).filter(Boolean)} tone="accent" />
            </Row>
          )}

          {(walkthrough?.recent_activity ?? []).length > 0 && (
            <Row label="Latest activity">
              <div className="space-y-1.5">
                {walkthrough!.recent_activity.slice(0, 5).map((a, i) => (
                  <div key={i} className="flex flex-wrap items-baseline gap-x-2">
                    {a.date && <span className="mono-val text-[11px]" style={{ color: 'var(--text-muted)' }}>{a.date}</span>}
                    <span className="text-[12.5px]" style={{ color: 'var(--text-primary)' }}>{a.item}</span>
                    {a.page_url && (
                      <button onClick={() => openExternal(a.page_url)}
                        className="text-[11px] underline" style={{ color: 'var(--accent-interactive)' }}>source</button>
                    )}
                  </div>
                ))}
              </div>
            </Row>
          )}

          {(walkthrough?.locations_listed ?? []).length > 0 && (
            <Row label="Locations they list"><Chips items={walkthrough!.locations_listed} /></Row>
          )}

          {walkthrough?.size_indicators && (
            <Row label="Size, as they describe it">{walkthrough.size_indicators}</Row>
          )}

          {walkthrough?.tone_and_positioning && (
            <Row label="How they position themselves">{walkthrough.tone_and_positioning}</Row>
          )}

          {/* Positive findings only — things we genuinely SAW. */}
          {(signals ?? []).filter(s => s.status !== 'absent').length > 0 && (
            <Row label="Verified from their site">
              <div className="space-y-1.5">
                {signals!.filter(s => s.status !== 'absent').map((s, i) => (
                  <div key={i} className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-[14px] mt-0.5 shrink-0"
                      style={{ color: 'var(--success)' }}>check_circle</span>
                    <div className="min-w-0">
                      <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{s.signal}</span>
                      <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}> — {s.detail}</span>
                      {s.source_url && (
                        <button onClick={() => openExternal(s.source_url)}
                          className="ml-1.5 text-[11px] underline" style={{ color: 'var(--accent-interactive)' }}>source</button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Row>
          )}

          {/* ── NOT FOUND ──
              Absence is a claim, and claims need proof. Anything we could not
              positively establish is labelled as such rather than asserted.
              This block replaced "what's missing that a company like this
              usually has", which stated absences we had never verified. */}
          {absenceRows.length > 0 && (
            <Row label="Not found on the pages we read">
              <p className="text-[11.5px] mb-2 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                We read {pages.length} page{pages.length === 1 ? '' : 's'}. Content shown only in
                images may not be captured — verify before using as a talking point.
              </p>
              <div className="space-y-1.5">
                {absenceRows.map((a, i) => {
                  const meta = ABSENCE_META[a.status]
                  return (
                    <div key={i} className="flex items-start gap-2">
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold tracking-[0.06em] uppercase shrink-0 mt-px"
                        style={{ background: meta.bg, color: meta.color, border: `1px solid ${meta.color}` }}>
                        {meta.label}
                      </span>
                      <div className="min-w-0">
                        <span className="text-[12.5px] font-semibold" style={{ color: 'var(--text-primary)' }}>{a.signal}</span>
                        <span className="text-[12.5px]" style={{ color: 'var(--text-secondary)' }}> — {a.detail}</span>
                        {a.source_url && (
                          <button onClick={() => openExternal(a.source_url)}
                            className="ml-1.5 text-[11px] underline" style={{ color: 'var(--accent-interactive)' }}>page checked</button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </Row>
          )}

          {(corrections ?? []).length > 0 && (
            <Row label="What EBEXTA corrected after reading the site">
              <ul className="space-y-1">
                {corrections!.map((c, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12.5px]" style={{ color: 'var(--text-secondary)' }}>
                    <span className="material-symbols-outlined text-[13px] mt-0.5 shrink-0"
                      style={{ color: 'var(--accent-interactive)' }}>edit</span>
                    {c}
                  </li>
                ))}
              </ul>
            </Row>
          )}
        </div>
      )}
    </div>
  )
}

// ─── CLAIM VERIFICATION TABLE ────────────────────────────────────────────────

const STATUS_META: Record<ClaimStatus, { label: string; color: string; bg: string; icon: string }> = {
  CONFIRMED:    { label: 'Confirmed',   color: 'var(--success)',    bg: 'var(--success-bg)',  icon: 'check_circle' },
  CONTRADICTED: { label: 'Contradicted', color: 'var(--critical)',  bg: 'var(--critical-bg)', icon: 'error' },
  // "Not on site" asserted more than we knew. It only means "not found on the
  // pages we read" — and if we never read the relevant page, "Not checked".
  NOT_ON_SITE:  { label: 'Not found',   color: 'var(--text-muted)', bg: 'var(--bg-surface)',  icon: 'help' },
}

export function ClaimVerificationTable({ checks, pagesRead }: {
  checks: ClaimCheck[] | undefined
  pagesRead?: PageRead[]
}) {
  const rows = checks ?? []
  if (rows.length === 0) return null

  const confirmed = rows.filter(r => r.status === 'CONFIRMED').length
  const contradicted = rows.filter(r => r.status === 'CONTRADICTED').length
  const notFound = rows.filter(r => r.status === 'NOT_ON_SITE').length
  // No source page recorded = we never opened the page this claim lives on.
  const anyPagesRead = (pagesRead ?? []).length > 0

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="material-symbols-outlined text-[18px]"
          style={{ color: 'var(--accent-interactive)' }}>rule</span>
        <h2 className="text-[16px] font-semibold"
          style={{ color: 'var(--text-primary)', fontFamily: 'Geist, Inter, sans-serif' }}>
          EBEXTA verification
        </h2>
        <span className="text-[11.5px]" style={{ color: 'var(--text-muted)' }}>
          {confirmed} confirmed
          {contradicted > 0 && <span style={{ color: 'var(--critical)' }}> · {contradicted} contradicted</span>}
          {notFound > 0 && ` · ${notFound} not on site`}
        </span>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
        {/* Header — hidden on mobile where each row stacks */}
        <div className="hidden md:grid px-3.5 py-2 gap-3 text-[10px] font-bold tracking-[0.06em] uppercase"
          style={{
            gridTemplateColumns: '1.1fr 1.6fr 1.6fr 140px',
            background: 'var(--bg-surface)', color: 'var(--text-muted)',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
          <span className="text-left">Field</span>
          <span className="text-left">EBEXTA said</span>
          <span className="text-left">Their site says</span>
          <span className="text-right">Status</span>
        </div>

        {rows.map((r, i) => {
          const m = STATUS_META[r.status] ?? STATUS_META.NOT_ON_SITE
          return (
            <div key={i}
              className="grid grid-cols-1 md:grid-cols-[1.1fr_1.6fr_1.6fr_140px] gap-1 md:gap-3 px-3.5 py-3 items-start"
              style={{
                background: 'var(--bg-elevated)',
                borderTop: i === 0 ? 'none' : '1px solid var(--border-subtle)',
              }}>
              {/* All three value columns: left-aligned, top-aligned, wrapping.
                  They used to sit mid-row and overflow on long values. */}
              <span className="text-[12.5px] font-semibold text-left break-words"
                style={{ color: 'var(--text-primary)' }}>
                {r.field}
              </span>
              <span className="text-[12.5px] text-left break-words" style={{ color: 'var(--text-secondary)' }}>
                <span className="md:hidden label-xs mr-1">EBEXTA:</span>{r.ai_claim}
              </span>
              <span className="text-[12.5px] text-left break-words"
                style={{ color: r.status === 'CONTRADICTED' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                <span className="md:hidden label-xs mr-1">Site:</span>{r.site_says}
              </span>
              <span className="flex items-center justify-start md:justify-end gap-1.5 shrink-0">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-[0.05em] uppercase"
                  style={{ background: m.bg, color: m.color, border: `1px solid ${m.color}` }}>
                  <span className="material-symbols-outlined text-[12px]">{m.icon}</span>
                  {/* Only claim "not found" if we actually read a page. */}
                  {r.status === 'NOT_ON_SITE' && !(anyPagesRead && r.source_url) ? 'Not checked' : m.label}
                </span>
                {r.source_url && (
                  <button onClick={() => openExternal(r.source_url)}
                    title={r.source_url}
                    className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                    style={{ border: '1px solid var(--border-subtle)' }}>
                    <span className="material-symbols-outlined text-[13px]"
                      style={{ color: 'var(--text-muted)' }}>open_in_new</span>
                  </button>
                )}
              </span>
            </div>
          )
        })}
      </div>

      <p className="text-[11px] mt-2.5" style={{ color: 'var(--text-muted)' }}>
        Where their site contradicted EBEXTA, the site won — the lead above already shows the
        corrected value.
      </p>
    </div>
  )
}
