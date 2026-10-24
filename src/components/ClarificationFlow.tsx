import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { VaguenessCheckResult } from '../lib/vagueness'

export interface ClarificationAnswer {
  question: string
  answer: string
}

interface ClarificationFlowProps {
  checkResult: VaguenessCheckResult
  onComplete: (enrichedDescription: string, answers: ClarificationAnswer[]) => void
  onSkip: (freeTextOverride?: string) => void
  onCancel?: () => void
  asModal?: boolean
}

export function ClarificationFlow({
  checkResult,
  onComplete,
  onSkip,
  onCancel,
  asModal = true,
}: ClarificationFlowProps) {
  const [step, setStep] = useState(0)
  const [answers, setAnswers] = useState<ClarificationAnswer[]>([])
  const [customText, setCustomText] = useState('')
  const [showCustom, setShowCustom] = useState(false)
  const [showFreeFormEscape, setShowFreeFormEscape] = useState(false)
  const [freeFormText, setFreeFormText] = useState('')

  const questions = checkResult.clarifying_questions || []

  if (questions.length === 0 || step >= questions.length) {
    return null
  }

  const currentQ = questions[step]

  const handleNext = (answerText: string) => {
    const updatedAnswers = [...answers, { question: currentQ.question, answer: answerText }]
    setAnswers(updatedAnswers)
    setShowCustom(false)
    setCustomText('')

    if (step + 1 >= questions.length) {
      // Build enriched description
      const clarificationSummary = updatedAnswers
        .map(a => `${a.question}: ${a.answer}`)
        .join('. ')
      onComplete(clarificationSummary, updatedAnswers)
    } else {
      setStep(s => s + 1)
    }
  }

  const content = (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 12 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 12 }}
      transition={{ duration: 0.22, ease: 'easeOut' }}
      className={`w-full max-w-xl bg-surface border border-primary/35 rounded-2xl p-6 sm:p-7 shadow-2xl relative ${
        asModal ? 'my-auto' : 'mb-6'
      }`}
      style={{
        boxShadow: '0 20px 40px -15px rgba(0, 0, 0, 0.3), 0 0 0 1px var(--border-subtle)',
      }}
    >
      {/* Top action badge + Close button */}
      <div className="flex items-center justify-between mb-4">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/25 text-primary text-[11.5px] font-bold tracking-[0.04em] uppercase">
          <span className="material-symbols-outlined text-[15px] animate-pulse">psychology_alt</span>
          <span>Requirement Engine</span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="p-1.5 rounded-full text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      <div className="mb-4">
        <h3 className="text-[17px] sm:text-[18px] font-bold text-on-surface tracking-tight mb-2">
          We want to find the exact right companies for you — a couple of quick questions.
        </h3>
        <p className="text-[13.5px] text-on-surface-variant leading-relaxed">
          {checkResult.detected_category ? (
            <>
              We noticed this relates to{' '}
              <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-primary/10 text-primary font-semibold text-[13px]">
                {checkResult.detected_category}
              </span>
              . A quick detail helps our matching engine pinpoint real requirements instead of generic keywords.
            </>
          ) : (
            'Your description is a bit broad. A quick detail helps our matching engine pinpoint real requirements instead of generic keywords.'
          )}
        </p>
      </div>

      {showFreeFormEscape ? (
        <div className="space-y-4 pt-2 border-t border-outline-variant">
          <label className="text-[13px] font-semibold text-on-surface block">
            Describe your business or product in your own words:
          </label>
          <textarea
            rows={4}
            autoFocus
            value={freeFormText}
            onChange={e => setFreeFormText(e.target.value)}
            placeholder="e.g. We build custom HR and payroll automation software specifically for mid-size businesses with 100-500 employees..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-xl p-3.5 text-[14px] text-on-surface focus:outline-none focus:border-primary transition-all leading-relaxed"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (freeFormText.trim()) onSkip(freeFormText.trim())
                else onSkip()
              }}
              disabled={!freeFormText.trim()}
              className="bg-primary text-on-primary px-5 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 transition-all shadow-sm"
            >
              Use this description
            </button>
            <button
              type="button"
              onClick={() => setShowFreeFormEscape(false)}
              className="px-4 py-2.5 rounded-xl text-[13px] font-semibold text-on-surface-variant hover:text-on-surface transition-colors"
            >
              Back to questions
            </button>
          </div>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
            className="pt-2 border-t border-outline-variant"
          >
            <h4 className="text-[15px] font-bold text-on-surface mb-3.5">
              {currentQ.question}
            </h4>

            <div className="flex flex-wrap gap-2 mb-4">
              {currentQ.options.map(opt => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => handleNext(opt)}
                  className="px-4 py-2 rounded-full border border-outline-variant hover:border-primary hover:bg-primary/10 bg-surface-container-lowest text-[13px] font-medium text-on-surface transition-all active:scale-[0.98] shadow-sm"
                >
                  {opt}
                </button>
              ))}
              {currentQ.allow_custom && (
                <button
                  type="button"
                  onClick={() => setShowCustom(true)}
                  className={`px-4 py-2 rounded-full border transition-all text-[13px] font-medium shadow-sm ${
                    showCustom
                      ? 'border-primary bg-primary/15 text-primary font-semibold'
                      : 'border-outline-variant hover:border-primary bg-surface-container-lowest text-on-surface'
                  }`}
                >
                  Other — describe it yourself
                </button>
              )}
            </div>

            {showCustom && (
              <div className="mt-3 mb-2 flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={customText}
                  onChange={e => setCustomText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && customText.trim()) {
                      e.preventDefault()
                      handleNext(customText.trim())
                    }
                  }}
                  placeholder="Type your specific focus..."
                  className="flex-grow bg-surface-container-lowest border border-outline-variant rounded-xl px-4 py-2.5 text-[14px] text-on-surface focus:outline-none focus:border-primary transition-all"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customText.trim()) handleNext(customText.trim())
                  }}
                  disabled={!customText.trim()}
                  className="bg-primary text-on-primary px-4 py-2.5 rounded-xl text-[13px] font-bold disabled:opacity-50 transition-all shrink-0"
                >
                  Next
                </button>
              </div>
            )}

            <div className="mt-6 pt-4 border-t border-outline-variant flex justify-between items-center">
              <span className="text-[12px] text-on-surface-variant font-medium">
                Question {step + 1} of {questions.length}
              </span>
              <button
                type="button"
                onClick={() => setShowFreeFormEscape(true)}
                className="text-[12.5px] text-primary hover:underline font-semibold"
              >
                Skip, I'll describe it fully myself
              </button>
            </div>
          </motion.div>
        </AnimatePresence>
      )}
    </motion.div>
  )

  if (!asModal) {
    return content
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-950/75 backdrop-blur-sm overflow-y-auto"
      onClick={e => {
        // Prevent accidental clicks outside if wanted, or close on backdrop
        if (e.target === e.currentTarget && onCancel) {
          onCancel()
        }
      }}
    >
      {content}
    </div>
  )
}
