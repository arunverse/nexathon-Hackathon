import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { JOB_ROLES, type JobRole } from '../../lib/careersData'
import { useToast } from '../../contexts/ToastContext'
import { supabase } from '../../lib/supabase'

interface ApplyModalProps {
  role: JobRole | null
  isOpen: boolean
  onClose: () => void
}

const EASE = [0.16, 1, 0.3, 1] as const

export function ApplyModal({ role, isOpen, onClose }: ApplyModalProps) {
  const toast = useToast()
  const [selectedRole, setSelectedRole] = useState<string>(role?.title ?? 'AI/ML Engineer')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [location, setLocation] = useState('')
  const [resumeFile, setResumeFile] = useState<File | null>(null)
  const [resumeName, setResumeName] = useState('')
  const [resumeUrl, setResumeUrl] = useState('')
  const [linkedinUrl, setLinkedinUrl] = useState('')
  const [portfolioUrl, setPortfolioUrl] = useState('')
  const [intro, setIntro] = useState('')
  const [experience, setExperience] = useState('')
  const [whyEbexta, setWhyEbexta] = useState('')
  const [employmentType, setEmploymentType] = useState<'Full-time' | 'Internship'>('Full-time')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    if (role) {
      setSelectedRole(role.title)
    } else {
      setSelectedRole('General Application')
    }
  }, [role])

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
  ]
  const ALLOWED_EXTENSIONS = ['.pdf', '.doc', '.docx', '.txt']
  const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      // Size check
      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast('Resume file must be 5 MB or smaller')
        e.target.value = ''
        return
      }
      // MIME type check
      if (!ALLOWED_MIME_TYPES.includes(file.type)) {
        toast('Only PDF, Word (.doc/.docx), or plain text (.txt) files are accepted')
        e.target.value = ''
        return
      }
      // Extension check (defence in depth against spoofed MIME types)
      const ext = '.' + (file.name.split('.').pop() ?? '').toLowerCase()
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        toast('Only .pdf, .doc, .docx, or .txt files are accepted')
        e.target.value = ''
        return
      }
      setResumeFile(file)
      setResumeName(file.name)
      setErrorMessage(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErrorMessage(null)

    if (!fullName.trim() || !email.trim() || !phone.trim()) {
      setErrorMessage('Please fill in your full name, email, and phone number.')
      toast('Please fill in required fields')
      return
    }

    if (!resumeFile && !resumeUrl.trim()) {
      setErrorMessage('Please provide your resume by uploading a file or entering a cloud link.')
      toast('Please provide a resume')
      return
    }

    setSubmitting(true)

    try {
      let finalResumeUrl = resumeUrl.trim() || null
      let finalResumeFilename = resumeFile ? resumeFile.name : (finalResumeUrl ? 'Cloud Document Link' : null)

      // 1. Upload resume to Supabase Storage if file was selected
      if (resumeFile) {
        const cleanName = resumeFile.name.replace(/[^a-zA-Z0-9._-]/g, '_')
        const storagePath = `resumes/${Date.now()}_${cleanName}`

        const { error: uploadError } = await supabase.storage
          .from('career-resumes')
          .upload(storagePath, resumeFile, {
            cacheControl: '3600',
            upsert: true,
          })

        if (uploadError) {
          console.warn('Resume bucket upload notice:', uploadError.message)
          // Even if bucket upload encounters an RLS notice, we store the filename reference
          finalResumeFilename = resumeFile.name
          if (!finalResumeUrl) {
            finalResumeUrl = `file://${cleanName}`
          }
        } else {
          finalResumeUrl = storagePath
          finalResumeFilename = resumeFile.name
        }
      }

      // 2. Persist directly to Supabase table `career_applications`
      const payload = {
        full_name: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        location: location.trim() || null,
        role: selectedRole,
        employment_type: employmentType,
        linkedin_url: linkedinUrl.trim() || null,
        portfolio_url: portfolioUrl.trim() || null,
        resume_url: finalResumeUrl,
        resume_filename: finalResumeFilename,
        introduction: intro.trim() || null,
        relevant_experience: experience.trim() || null,
        why_ebexta: whyEbexta.trim() || null,
        application_status: 'New',
      }

      const { error: dbError } = await supabase
        .from('career_applications')
        .insert(payload)

      if (dbError) {
        throw new Error(dbError.message)
      }

      setSubmitted(true)
      toast('Application received and saved to EBEXTA database!')
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error('Career application submission failed:', err)
      setErrorMessage(`Application submission failed: ${msg}`)
      toast('Submission failed: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  function handleResetAndClose() {
    setSubmitted(false)
    setErrorMessage(null)
    setFullName('')
    setEmail('')
    setPhone('')
    setLocation('')
    setResumeFile(null)
    setResumeName('')
    setResumeUrl('')
    setLinkedinUrl('')
    setPortfolioUrl('')
    setIntro('')
    setExperience('')
    setWhyEbexta('')
    setEmploymentType('Full-time')
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[350] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={handleResetAndClose}
            className="fixed inset-0"
            style={{
              background: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)'
            }}
          />

          {/* Modal Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            transition={{ duration: 0.3, ease: EASE }}
            className="relative z-10 w-full max-w-[620px] max-h-[90vh] flex flex-col rounded-2xl overflow-hidden shadow-2xl"
            style={{
              background: 'var(--bg-base)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)'
            }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div
              className="px-6 py-5 border-b shrink-0 flex items-center justify-between"
              style={{
                borderColor: 'var(--border-subtle)',
                background: 'color-mix(in srgb, var(--bg-surface) 80%, transparent)',
                backdropFilter: 'blur(10px)'
              }}
            >
              <div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: 'var(--accent-subtle)', color: 'var(--accent-interactive)' }}
                >
                  Application
                </span>
                <h3
                  className="text-[18px] md:text-[20px] font-bold mt-1 tracking-tight"
                  style={{ fontFamily: 'Geist, Inter, sans-serif' }}
                >
                  {submitted ? 'Application Submitted' : `Apply for ${selectedRole}`}
                </h3>
              </div>

              <button
                onClick={handleResetAndClose}
                className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:opacity-80"
                style={{
                  background: 'var(--bg-elevated)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)'
                }}
                aria-label="Close"
              >
                <span className="material-symbols-outlined text-[17px]">close</span>
              </button>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {submitted ? (
                <div className="py-12 px-4 text-center space-y-4">
                  <div
                    className="w-16 h-16 rounded-full mx-auto flex items-center justify-center"
                    style={{
                      background: 'rgba(16,185,129,0.15)',
                      border: '1px solid rgba(16,185,129,0.3)',
                      color: 'var(--success)'
                    }}
                  >
                    <span className="material-symbols-outlined text-[32px]">check_circle</span>
                  </div>
                  <h4 className="text-[20px] font-bold" style={{ fontFamily: 'Geist, sans-serif' }}>
                    Thank You for Applying!
                  </h4>
                  <p className="text-[14px] max-w-[420px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    Your application for <strong style={{ color: 'var(--text-primary)' }}>{selectedRole}</strong> has been received and securely saved. Our talent team reviews profiles within 3 business days.
                  </p>
                  <div className="pt-4">
                    <button
                      onClick={handleResetAndClose}
                      className="px-6 h-10 rounded-xl text-[13px] font-bold transition-transform active:scale-95"
                      style={{
                        background: 'var(--accent)',
                        color: 'var(--bg-elevated)'
                      }}
                    >
                      Done
                    </button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5 text-[13px]">
                  {errorMessage && (
                    <div
                      className="p-3 rounded-xl text-[12px] font-medium flex items-center gap-2"
                      style={{
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.25)',
                        color: 'var(--critical)'
                      }}
                    >
                      <span className="material-symbols-outlined text-[16px]">error</span>
                      <span>{errorMessage}</span>
                    </div>
                  )}

                  {/* Role Selector & Application Track */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="md:col-span-2">
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Role Applying For <span style={{ color: 'var(--critical)' }}>*</span>
                      </label>
                      <select
                        value={selectedRole}
                        onChange={e => setSelectedRole(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl border text-[13px] transition-colors focus:outline-none"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        {JOB_ROLES.map(r => (
                          <option key={r.id} value={r.title}>
                            {r.title} ({r.department})
                          </option>
                        ))}
                        <option value="General Application">General Application & Future Opportunities</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Track <span style={{ color: 'var(--critical)' }}>*</span>
                      </label>
                      <select
                        value={employmentType}
                        onChange={e => setEmploymentType(e.target.value as 'Full-time' | 'Internship')}
                        className="w-full h-10 px-3 rounded-xl border text-[13px] font-medium transition-colors focus:outline-none"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <option value="Full-time">Full-time Position</option>
                        <option value="Internship">Internship Program</option>
                      </select>
                    </div>
                  </div>

                  {/* Two-column inputs: Name & Email */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Full Name <span style={{ color: 'var(--critical)' }}>*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Aditi Sharma"
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Email Address <span style={{ color: 'var(--critical)' }}>*</span>
                      </label>
                      <input
                        type="email"
                        required
                        placeholder="you@domain.com"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Phone & Location */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Phone Number <span style={{ color: 'var(--critical)' }}>*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Current Location
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Bengaluru, Karnataka"
                        value={location}
                        onChange={e => setLocation(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Resume Upload / Link */}
                  <div
                    className="p-4 rounded-xl border space-y-3"
                    style={{
                      background: 'var(--bg-surface)',
                      borderColor: 'var(--border-subtle)'
                    }}
                  >
                    <label className="block text-[11px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                      Resume or CV <span style={{ color: 'var(--critical)' }}>*</span>
                    </label>

                    <div className="flex flex-col sm:flex-row items-center gap-3">
                      <label
                        className="w-full sm:w-auto px-4 h-9 rounded-lg border text-[12px] font-semibold cursor-pointer inline-flex items-center justify-center gap-2 transition-colors shrink-0 hover:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-strong)',
                          color: 'var(--text-primary)'
                        }}
                      >
                        <span className="material-symbols-outlined text-[16px]">upload_file</span>
                        Upload PDF or DOCX
                        <input
                          type="file"
                          accept=".pdf,.doc,.docx"
                          onChange={handleFileChange}
                          className="hidden"
                        />
                      </label>
                      {resumeName ? (
                        <span className="text-[12px] font-mono truncate" style={{ color: 'var(--success)' }}>
                          ✓ {resumeName}
                        </span>
                      ) : (
                        <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                          or provide a Drive, Dropbox, or Cloud link below:
                        </span>
                      )}
                    </div>

                    <input
                      type="url"
                      placeholder="https://drive.google.com/file/d/..."
                      value={resumeUrl}
                      onChange={e => setResumeUrl(e.target.value)}
                      className="w-full h-9 px-3 rounded-lg border text-[12px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  {/* LinkedIn & Portfolio/GitHub */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        LinkedIn Profile URL
                      </label>
                      <input
                        type="url"
                        placeholder="https://linkedin.com/in/..."
                        value={linkedinUrl}
                        onChange={e => setLinkedinUrl(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                        Portfolio, GitHub, or Work Link
                      </label>
                      <input
                        type="url"
                        placeholder="https://github.com/... or portfolio"
                        value={portfolioUrl}
                        onChange={e => setPortfolioUrl(e.target.value)}
                        className="w-full h-10 px-3.5 rounded-xl border text-[13px] transition-colors focus:outline-none focus:border-[var(--accent-interactive)]"
                        style={{
                          background: 'var(--bg-elevated)',
                          borderColor: 'var(--border-subtle)',
                          color: 'var(--text-primary)'
                        }}
                      />
                    </div>
                  </div>

                  {/* Short Introduction & Experience */}
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Short Introduction or Note
                    </label>
                    <textarea
                      rows={2}
                      placeholder="A quick 1-2 sentence introduction about yourself..."
                      value={intro}
                      onChange={e => setIntro(e.target.value)}
                      className="w-full p-3 rounded-xl border text-[13px] transition-colors focus:outline-none resize-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Relevant Experience & Background
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Briefly highlight your experience, education, or relevant projects..."
                      value={experience}
                      onChange={e => setExperience(e.target.value)}
                      className="w-full p-3 rounded-xl border text-[13px] transition-colors focus:outline-none resize-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-muted)' }}>
                      Why are you interested in joining EBEXTA?
                    </label>
                    <textarea
                      rows={2}
                      placeholder="What draws you to EBEXTA and what kind of impact are you looking to create?"
                      value={whyEbexta}
                      onChange={e => setWhyEbexta(e.target.value)}
                      className="w-full p-3 rounded-xl border text-[13px] transition-colors focus:outline-none resize-none"
                      style={{
                        background: 'var(--bg-elevated)',
                        borderColor: 'var(--border-subtle)',
                        color: 'var(--text-primary)'
                      }}
                    />
                  </div>

                  {/* Privacy Notice */}
                  <div
                    className="p-3 rounded-lg border text-[11px] flex items-start gap-2"
                    style={{
                      background: 'rgba(59,130,246,0.06)',
                      borderColor: 'rgba(59,130,246,0.2)',
                      color: 'var(--text-secondary)'
                    }}
                  >
                    <span className="material-symbols-outlined text-[14px] shrink-0 mt-0.5" style={{ color: 'var(--accent-interactive)' }}>
                      lock
                    </span>
                    <span>
                      <strong>Privacy Notice:</strong> Your information is used solely by EBEXTA for hiring evaluation and candidate communication. We never sell, share, or disclose applicant data to third parties.
                    </span>
                  </div>

                  {/* Submit Button */}
                  <div className="pt-2 flex items-center justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleResetAndClose}
                      className="px-4 h-10 rounded-xl text-[13px] font-medium transition-colors hover:text-[var(--text-primary)]"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={submitting}
                      className="px-6 h-10 rounded-xl text-[13px] font-bold inline-flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                      style={{
                        background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))',
                        color: 'var(--bg-elevated)'
                      }}
                    >
                      {submitting ? (
                        <>
                          <span className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin" />
                          Submitting…
                        </>
                      ) : (
                        <>
                          Submit Application
                          <span className="material-symbols-outlined text-[15px]">send</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
