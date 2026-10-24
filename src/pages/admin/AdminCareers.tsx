/**
 * /admin/careers — Applications submitted through /careers.
 * Persistent in Supabase. Admins can review profiles, open/download resumes,
 * update candidate status, take notes, search, filter, sort, and safely delete.
 */

import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { PageHeader, Loading, EmptyState, Card, Th, Td, Pill } from './shared'
import { fmtDate, timeAgoLabel } from './adminUtils'
import { adminDeleteCareerApplication, adminUpdateCareerApplication } from './adminActions'
import { createPortal } from 'react-dom'

export interface CareerApp {
  id: string
  created_at: string
  updated_at: string
  full_name: string
  email: string
  phone: string
  location: string | null
  role: string
  employment_type: string | null
  linkedin_url: string | null
  portfolio_url: string | null
  resume_url: string | null
  resume_filename: string | null
  introduction: string | null
  relevant_experience: string | null
  why_ebexta: string | null
  application_status: 'New' | 'Reviewing' | 'Shortlisted' | 'Interview' | 'Selected' | 'Rejected'
  admin_notes: string | null
}

const STATUSES: Array<CareerApp['application_status']> = [
  'New',
  'Reviewing',
  'Shortlisted',
  'Interview',
  'Selected',
  'Rejected',
]

const STATUS_TONE: Record<CareerApp['application_status'], 'indigo' | 'amber' | 'neutral' | 'green' | 'red'> = {
  New: 'indigo',
  Reviewing: 'amber',
  Shortlisted: 'neutral',
  Interview: 'indigo',
  Selected: 'green',
  Rejected: 'red',
}

export default function AdminCareers() {
  const [apps, setApps] = useState<CareerApp[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('All')
  const [roleFilter, setRoleFilter] = useState<string>('All')
  const [trackFilter, setTrackFilter] = useState<'All' | 'Full-time' | 'Internship'>('All')
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest')
  const [selectedApp, setSelectedApp] = useState<CareerApp | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [flashMsg, setFlashMsg] = useState<{ text: string; ok: boolean } | null>(null)

  // Load applications directly from authoritative Supabase table
  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const { data, error } = await supabase
        .from('career_applications')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) {
        setLoadError(`Failed to load applications: ${error.message}. Ensure careers_and_admin_fixes.sql has been run.`)
        setApps([])
      } else {
        setApps((data as CareerApp[]) ?? [])
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setLoadError(msg)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const flash = (text: string, ok: boolean) => {
    setFlashMsg({ text, ok })
    setTimeout(() => setFlashMsg(null), 4000)
  }

  // Handle status update
  async function handleStatusChange(id: string, newStatus: CareerApp['application_status']) {
    setBusyId(id)
    const err = await adminUpdateCareerApplication(id, newStatus)
    setBusyId(null)

    if (err) {
      flash(`Failed to update status: ${err}`, false)
    } else {
      flash(`Application marked as ${newStatus}`, true)
      setApps(prev => prev.map(a => a.id === id ? { ...a, application_status: newStatus, updated_at: new Date().toISOString() } : a))
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp(prev => prev ? { ...prev, application_status: newStatus, updated_at: new Date().toISOString() } : null)
      }
    }
  }

  // Handle notes save
  async function handleSaveNotes(id: string, notes: string) {
    setBusyId(id)
    const err = await adminUpdateCareerApplication(id, selectedApp?.application_status ?? 'New', notes)
    setBusyId(null)

    if (err) {
      flash(`Failed to save notes: ${err}`, false)
    } else {
      flash('Admin notes saved', true)
      setApps(prev => prev.map(a => a.id === id ? { ...a, admin_notes: notes } : a))
      if (selectedApp && selectedApp.id === id) {
        setSelectedApp(prev => prev ? { ...prev, admin_notes: notes } : null)
      }
    }
  }

  // Handle delete
  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`Permanently delete application from ${name}? This cannot be undone.`)) {
      return
    }

    setBusyId(id)
    const err = await adminDeleteCareerApplication(id)
    setBusyId(null)

    if (err) {
      flash(`Delete failed: ${err}`, false)
    } else {
      flash(`Deleted application for ${name}`, true)
      setApps(prev => prev.filter(a => a.id !== id))
      if (selectedApp?.id === id) {
        setSelectedApp(null)
      }
    }
  }

  // Open or download resume
  async function handleOpenResume(app: CareerApp) {
    if (!app.resume_url) {
      alert('No resume file or URL provided.')
      return
    }

    if (app.resume_url.startsWith('http://') || app.resume_url.startsWith('https://')) {
      window.open(app.resume_url, '_blank', 'noopener,noreferrer')
      return
    }

    // Storage path in career-resumes bucket
    const { data, error } = await supabase.storage
      .from('career-resumes')
      .createSignedUrl(app.resume_url, 3600)

    if (error || !data?.signedUrl) {
      alert(`Could not open resume from storage: ${error?.message || 'File not found'}`)
      return
    }

    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  // Filtered & Sorted applications
  const uniqueRoles = useMemo(() => {
    const set = new Set<string>()
    apps.forEach(a => { if (a.role) set.add(a.role) })
    return Array.from(set).sort()
  }, [apps])

  const filteredApps = useMemo(() => {
    return apps.filter(a => {
      if (statusFilter !== 'All' && a.application_status !== statusFilter) return false
      if (roleFilter !== 'All' && a.role !== roleFilter) return false
      if (trackFilter !== 'All' && !a.employment_type?.toLowerCase().includes(trackFilter.toLowerCase())) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        const matchName = a.full_name?.toLowerCase().includes(q)
        const matchEmail = a.email?.toLowerCase().includes(q)
        const matchPhone = a.phone?.toLowerCase().includes(q)
        const matchRole = a.role?.toLowerCase().includes(q)
        const matchLoc = a.location?.toLowerCase().includes(q)
        if (!matchName && !matchEmail && !matchPhone && !matchRole && !matchLoc) return false
      }
      return true
    }).sort((a, b) => {
      const timeA = new Date(a.created_at).getTime()
      const timeB = new Date(b.created_at).getTime()
      return sortOrder === 'newest' ? timeB - timeA : timeA - timeB
    })
  }, [apps, statusFilter, roleFilter, trackFilter, search, sortOrder])

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { All: apps.length }
    STATUSES.forEach(s => { counts[s] = 0 })
    apps.forEach(a => {
      counts[a.application_status] = (counts[a.application_status] ?? 0) + 1
    })
    return counts
  }, [apps])

  if (loading) return <Loading label="Loading career applications from Supabase…" />

  return (
    <div>
      <PageHeader
        icon="work"
        title="Careers / Applications"
        subtitle={`${apps.length} total applicant${apps.length === 1 ? '' : 's'} · ${statusCounts['New'] ?? 0} new`}
      />

      {flashMsg && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-[13px] font-semibold transition-all flex items-center justify-between"
          style={{
            background: flashMsg.ok ? 'var(--success-bg)' : 'var(--critical-bg)',
            color: flashMsg.ok ? 'var(--success)' : 'var(--critical)',
            border: `1px solid ${flashMsg.ok ? 'var(--success)' : 'var(--critical)'}`,
          }}
        >
          <span>{flashMsg.text}</span>
          <button onClick={() => setFlashMsg(null)} className="text-[12px] opacity-70 hover:opacity-100">✕</button>
        </div>
      )}

      {loadError && (
        <div
          className="mb-4 px-4 py-3 rounded-xl text-[13px] font-medium"
          style={{
            background: 'rgba(239,68,68,0.1)',
            border: '1px solid rgba(239,68,68,0.3)',
            color: 'var(--critical)',
          }}
        >
          <strong>Database Notice:</strong> {loadError}
        </div>
      )}

      {/* Control Bar: Filters, Search & Sort */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs */}
        <div
          className="flex items-center gap-1 p-1 rounded-xl overflow-x-auto"
          style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
        >
          {['All', ...STATUSES].map(st => {
            const isActive = statusFilter === st
            return (
              <button
                key={st}
                onClick={() => setStatusFilter(st)}
                className="px-3 py-1 rounded-lg text-[12px] font-semibold whitespace-nowrap transition-all"
                style={{
                  background: isActive ? 'var(--accent-subtle)' : 'transparent',
                  color: isActive ? 'var(--accent-interactive)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--accent-subtle)' : '1px solid transparent',
                }}
              >
                {st} <span className="ml-1 opacity-60 font-mono text-[11px]">({statusCounts[st] ?? 0})</span>
              </button>
            )
          })}
        </div>

        {/* Search, Role Filter, Sort */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-[12px]"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}
          >
            <span className="material-symbols-outlined text-[16px]" style={{ color: 'var(--text-muted)' }}>search</span>
            <input
              type="text"
              placeholder="Search candidate, role, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="bg-transparent outline-none w-48 sm:w-60 text-[12px]"
              style={{ color: 'var(--text-primary)' }}
            />
            {search && (
              <button onClick={() => setSearch('')} className="text-[12px]" style={{ color: 'var(--text-muted)' }}>✕</button>
            )}
          </div>

          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-1.5 rounded-xl text-[12px] outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="All">All Roles</option>
            {uniqueRoles.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          <select
            value={trackFilter}
            onChange={e => setTrackFilter(e.target.value as 'All' | 'Full-time' | 'Internship')}
            className="px-3 py-1.5 rounded-xl text-[12px] outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="All">All Tracks</option>
            <option value="Full-time">Full-time Only</option>
            <option value="Internship">Internship Only</option>
          </select>

          <select
            value={sortOrder}
            onChange={e => setSortOrder(e.target.value as 'newest' | 'oldest')}
            className="px-3 py-1.5 rounded-xl text-[12px] outline-none"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
          >
            <option value="newest">Newest First</option>
            <option value="oldest">Oldest First</option>
          </select>

          <button
            onClick={() => void load()}
            title="Refresh list from database"
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:opacity-80"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
          >
            <span className="material-symbols-outlined text-[17px]">refresh</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <Card>
        {filteredApps.length === 0 ? (
          <EmptyState
            title={apps.length === 0 ? 'No career applications yet' : 'No matching applications'}
            hint={apps.length === 0 ? 'Applications submitted via /careers will be permanently saved and appear here.' : 'Try changing your search keywords or status filter.'}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr>
                  <Th>Applicant</Th>
                  <Th>Role</Th>
                  <Th>Email</Th>
                  <Th>Phone</Th>
                  <Th>Type</Th>
                  <Th>Submitted</Th>
                  <Th>Status</Th>
                  <Th right>Actions</Th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border-subtle)' }}>
                {filteredApps.map(app => (
                  <tr
                    key={app.id}
                    className="hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer"
                    onClick={() => setSelectedApp(app)}
                  >
                    <Td>
                      <div className="font-semibold text-[13px]" style={{ color: 'var(--text-primary)' }}>
                        {app.full_name}
                      </div>
                      {app.location && (
                        <div className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          {app.location}
                        </div>
                      )}
                    </Td>

                    <Td>
                      <span className="font-medium text-[12px]" style={{ color: 'var(--text-primary)' }}>
                        {app.role}
                      </span>
                    </Td>

                    <Td>
                      <a
                        href={`mailto:${app.email}`}
                        onClick={e => e.stopPropagation()}
                        className="text-[12px] hover:underline"
                        style={{ color: 'var(--accent-interactive)' }}
                      >
                        {app.email}
                      </a>
                    </Td>

                    <Td>
                      <span className="text-[12px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                        {app.phone}
                      </span>
                    </Td>

                    <Td>
                      <span className="text-[11px] px-2 py-0.5 rounded-md" style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                        {app.employment_type || 'Full-time'}
                      </span>
                    </Td>

                    <Td>
                      <div className="text-[11px]" style={{ color: 'var(--text-primary)' }}>{fmtDate(app.created_at)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{timeAgoLabel(app.created_at)}</div>
                    </Td>

                    <Td onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <Pill label={app.application_status} tone={STATUS_TONE[app.application_status]} />
                        <select
                          value={app.application_status}
                          disabled={busyId === app.id}
                          onChange={e => handleStatusChange(app.id, e.target.value as CareerApp['application_status'])}
                          className="px-1.5 py-0.5 rounded text-[10px] outline-none cursor-pointer"
                          style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
                        >
                          {STATUSES.map(s => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                    </Td>

                    <Td right onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {app.resume_url && (
                          <button
                            onClick={() => handleOpenResume(app)}
                            title={app.resume_filename || 'Open Resume'}
                            className="p-1.5 rounded-lg transition-colors hover:bg-[var(--accent-subtle)] hover:text-[var(--accent-interactive)]"
                            style={{ color: 'var(--text-secondary)' }}
                          >
                            <span className="material-symbols-outlined text-[17px]">description</span>
                          </button>
                        )}
                        <button
                          onClick={() => setSelectedApp(app)}
                          title="View Details"
                          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-elevated)]"
                          style={{ color: 'var(--text-secondary)' }}
                        >
                          <span className="material-symbols-outlined text-[17px]">visibility</span>
                        </button>
                        <button
                          onClick={() => handleDelete(app.id, app.full_name)}
                          disabled={busyId === app.id}
                          title="Delete application permanently"
                          className="p-1.5 rounded-lg transition-colors hover:bg-[rgba(239,68,68,0.15)] hover:text-[var(--critical)]"
                          style={{ color: 'var(--critical)' }}
                        >
                          <span className="material-symbols-outlined text-[17px]">delete</span>
                        </button>
                      </div>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Application Drilldown Modal */}
      {selectedApp && (
        <ApplicationModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onStatusChange={handleStatusChange}
          onSaveNotes={handleSaveNotes}
          onDelete={handleDelete}
          onOpenResume={handleOpenResume}
          busy={busyId === selectedApp.id}
        />
      )}
    </div>
  )
}

function ApplicationModal({
  app,
  onClose,
  onStatusChange,
  onSaveNotes,
  onDelete,
  onOpenResume,
  busy,
}: {
  app: CareerApp
  onClose: () => void
  onStatusChange: (id: string, st: CareerApp['application_status']) => void
  onSaveNotes: (id: string, notes: string) => void
  onDelete: (id: string, name: string) => void
  onOpenResume: (app: CareerApp) => void
  busy: boolean
}) {
  const [notes, setNotes] = useState(app.admin_notes || '')
  const [notesDirty, setNotesDirty] = useState(false)

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div
        className="w-full max-w-[760px] max-h-[90vh] overflow-y-auto rounded-2xl p-6 shadow-2xl flex flex-col"
        style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b shrink-0" style={{ borderColor: 'var(--border-subtle)' }}>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-[19px] font-bold tracking-tight">{app.full_name}</h2>
              <Pill label={app.application_status} tone={STATUS_TONE[app.application_status]} />
            </div>
            <p className="text-[13px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Applying for <strong style={{ color: 'var(--text-primary)' }}>{app.role}</strong> ({app.employment_type || 'Full-time'})
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <span className="material-symbols-outlined text-[17px]">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="py-5 space-y-6 flex-1 text-[13px]">
          {/* Quick Contact & Links Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Email</p>
              <a href={`mailto:${app.email}`} className="font-medium hover:underline" style={{ color: 'var(--accent-interactive)' }}>
                {app.email}
              </a>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Phone</p>
              <span className="font-mono">{app.phone}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Location</p>
              <span>{app.location || '—'}</span>
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Submitted</p>
              <span>{new Date(app.created_at).toLocaleString()}</span>
            </div>
          </div>

          {/* External Profile Links & Resume */}
          <div className="flex flex-wrap gap-2.5">
            {app.resume_url && (
              <button
                onClick={() => onOpenResume(app)}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-[12px] font-bold transition-all hover:scale-[1.02] active:scale-[0.98]"
                style={{
                  background: 'var(--accent-subtle)',
                  color: 'var(--accent-interactive)',
                  border: '1px solid var(--accent-subtle)'
                }}
              >
                <span className="material-symbols-outlined text-[16px]">file_open</span>
                {app.resume_filename || 'Open Resume / CV'}
              </button>
            )}

            {app.linkedin_url && (
              <a
                href={app.linkedin_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <span className="material-symbols-outlined text-[16px]">link</span>
                LinkedIn Profile
              </a>
            )}

            {app.portfolio_url && (
              <a
                href={app.portfolio_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[12px] font-medium transition-colors"
                style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
              >
                <span className="material-symbols-outlined text-[16px]">laptop_mac</span>
                Portfolio / GitHub
              </a>
            )}
          </div>

          {/* Narrative sections */}
          {app.introduction && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Introduction / Note
              </h4>
              <div className="p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                {app.introduction}
              </div>
            </div>
          )}

          {app.relevant_experience && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Relevant Experience & Background
              </h4>
              <div className="p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                {app.relevant_experience}
              </div>
            </div>
          )}

          {app.why_ebexta && (
            <div>
              <h4 className="text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                Why EBEXTA?
              </h4>
              <div className="p-3.5 rounded-xl leading-relaxed whitespace-pre-wrap" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                {app.why_ebexta}
              </div>
            </div>
          )}

          {/* Admin Private Notes */}
          <div className="p-4 rounded-xl space-y-2.5" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Internal Admin Notes (Private)
              </span>
              {notesDirty && (
                <span className="text-[11px]" style={{ color: 'var(--warning)' }}>Unsaved changes</span>
              )}
            </div>
            <textarea
              rows={3}
              value={notes}
              onChange={e => { setNotes(e.target.value); setNotesDirty(true) }}
              placeholder="Add interviewer notes, feedback, interview schedule details…"
              className="w-full p-3 rounded-xl text-[12px] outline-none resize-none"
              style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            />
            <div className="flex justify-end">
              <button
                onClick={() => { onSaveNotes(app.id, notes); setNotesDirty(false) }}
                disabled={busy}
                className="px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all"
                style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)', border: '1px solid var(--accent-subtle)' }}
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="pt-4 border-t shrink-0 flex flex-wrap items-center justify-between gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
              Set Status:
            </span>
            <select
              value={app.application_status}
              disabled={busy}
              onChange={e => onStatusChange(app.id, e.target.value as CareerApp['application_status'])}
              className="px-3 py-1.5 rounded-lg text-[12px] font-semibold outline-none"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' }}
            >
              {STATUSES.map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onDelete(app.id, app.full_name)}
              disabled={busy}
              className="px-3 py-1.5 rounded-lg text-[12px] font-bold transition-colors"
              style={{ background: 'rgba(239,68,68,0.1)', color: 'var(--critical)', border: '1px solid rgba(239,68,68,0.25)' }}
            >
              Delete Application
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg text-[12px] font-medium transition-colors"
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
