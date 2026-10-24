import { callGeminiProxy } from './geminiProxy'

export type SpecificityStatus = 'specific' | 'vague'

export interface ClarifyingQuestion {
  question: string
  options: string[]
  allow_custom: boolean
}

export interface VaguenessCheckResult {
  specificity: SpecificityStatus
  detected_category?: string
  missing_info?: string[]
  clarifying_questions?: ClarifyingQuestion[]
}

export async function checkDescriptionVagueness(description: string): Promise<VaguenessCheckResult> {
  const prompt = `Evaluate whether this business description is SPECIFIC ENOUGH to identify the exact type of customer who would need this service.

Description: ${description}

A description is SPECIFIC ENOUGH if it identifies:
1. The exact service/product category (not just 'SaaS' or 'IT services' the actual sub-category)
2. Who typically buys it (an industry, business type, or use case even roughly)

A description is TOO VAGUE if it only names a broad category with no sub-category or buyer context (e.g. 'SaaS company', 'we do marketing', 'IT services', 'consulting firm').

Return ONLY JSON matching this structure:
{
  "specificity": "specific" | "vague",
  "detected_category": "the broad category you can tell, e.g. SaaS, IT Services, Marketing",
  "missing_info": ["what's missing sub-category, target industry, buyer type, etc."],
  "clarifying_questions": [
    {
      "question": "a short, specific question to ask the user",
      "options": ["3-5 likely answers for this detected category, based on real sub-categories in that industry"],
      "allow_custom": true
    }
  ]
}

Generate clarifying_questions and their options SPECIFIC to the detected_category do not use generic questions. If detected_category is SaaS, the options should be real SaaS sub-categories (HR tech, fintech infra, healthtech, vertical SaaS, etc.), not generic placeholders.`

  try {
    const res = await callGeminiProxy(prompt, { action: 'enrich', jsonMode: true })
    
    // Remove markdown formatting if the model still outputs it
    let cleanText = res.text.trim()
    if (cleanText.startsWith('\`\`\`json')) {
      cleanText = cleanText.substring(7, cleanText.length - 3).trim()
    } else if (cleanText.startsWith('\`\`\`')) {
      cleanText = cleanText.substring(3, cleanText.length - 3).trim()
    }

    const parsed = JSON.parse(cleanText) as VaguenessCheckResult
    return parsed
  } catch (err) {
    console.warn('[EBEXTA] Vagueness check via Gemini failed, evaluating heuristic fallback:', err)
    return getHeuristicFallback(description)
  }
}

/** Fallback heuristic based on DESCRIPTION_CLARIFICATION_RESEARCH.md if API is unreachable */
function getHeuristicFallback(description: string): VaguenessCheckResult {
  const text = description.toLowerCase()

  // Specificity heuristics: if long and detailed with specific terms, accept as specific
  if (text.length > 120 && (text.includes('mid-market') || text.includes('enterprise') || text.includes('compliance') || text.includes('platform for') || text.includes('serving') || text.includes('specializing in'))) {
    return { specificity: 'specific' }
  }

  // Check vague industry triggers
  if (text.includes('saas') || text.includes('software company') || text.includes('software platform')) {
    return {
      specificity: 'vague',
      detected_category: 'SaaS / Software',
      missing_info: ['Exact SaaS category', 'Target buyer persona'],
      clarifying_questions: [
        {
          question: 'What category of software do you build or provide?',
          options: ['HR Tech / Payroll', 'FinTech Infrastructure', 'HealthTech', 'Logistics SaaS', 'Vertical SaaS / Industry-specific', 'Marketing / Sales Tech'],
          allow_custom: true,
        },
        {
          question: 'Who is your primary buyer?',
          options: ['Enterprise (Sales-led)', 'Mid-market', 'SMBs (Self-serve)', 'B2B2C'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('it service') || text.includes('tech consulting') || text.includes('software development agency') || text.includes('it consulting')) {
    return {
      specificity: 'vague',
      detected_category: 'IT Services / Consulting',
      missing_info: ['Service lines', 'Engagement model'],
      clarifying_questions: [
        {
          question: 'What are your primary IT service offerings?',
          options: ['Web & Mobile App Development', 'Cloud Architecture / DevOps', 'ERP / CRM Implementation', 'Cybersecurity', 'Data Engineering / BI', 'Staff Augmentation'],
          allow_custom: true,
        },
        {
          question: 'How do you typically engage with clients?',
          options: ['Project-based builds', 'Retainer / Ongoing maintenance', 'Dedicated engineering teams'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('marketing') || text.includes('agency') || text.includes('growth agency')) {
    return {
      specificity: 'vague',
      detected_category: 'Marketing / Creative',
      missing_info: ['Marketing channels', 'Specialization'],
      clarifying_questions: [
        {
          question: 'Which marketing capabilities do you specialize in?',
          options: ['SEO & Organic Search', 'Paid Ads / Performance Marketing', 'Social Media & Influencer', 'Branding & Creative Design', 'Content & Copywriting'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('machine parts') || text.includes('manufacturing') || text.includes('fabrication') || text.includes('industrial')) {
    return {
      specificity: 'vague',
      detected_category: 'Industrial / Manufacturing',
      missing_info: ['Manufacturing process', 'Buyer industry'],
      clarifying_questions: [
        {
          question: 'What specific manufacturing processes do you offer?',
          options: ['CNC Machining / Precision Tooling', 'Sheet Metal Fabrication', 'Metal Casting / Forging', 'Injection Molding', 'Assembly & Turnkey'],
          allow_custom: true,
        },
        {
          question: 'Which industries primarily buy from you?',
          options: ['Automotive', 'Aerospace & Defense', 'Medical Devices', 'General Engineering & Machinery'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('fintech') || text.includes('finance') || text.includes('financial service')) {
    return {
      specificity: 'vague',
      detected_category: 'Financial Services',
      missing_info: ['Domain', 'Target customer'],
      clarifying_questions: [
        {
          question: 'What is your primary financial offering?',
          options: ['Lending & Credit', 'Payments & Gateway', 'Wealth Management', 'InsurTech', 'RegTech & Compliance'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('health') || text.includes('medical') || text.includes('clinic')) {
    return {
      specificity: 'vague',
      detected_category: 'Healthcare-Adjacent',
      missing_info: ['Healthcare product type'],
      clarifying_questions: [
        {
          question: 'What type of healthcare solution do you provide?',
          options: ['Hospital Software / EHR', 'Diagnostics & Lab Systems', 'Telemedicine Platform', 'Medical Devices', 'Pharma Supply Chain'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('logistics') || text.includes('freight') || text.includes('supply chain')) {
    return {
      specificity: 'vague',
      detected_category: 'Logistics',
      missing_info: ['Logistics segment'],
      clarifying_questions: [
        {
          question: 'Which area of logistics do you focus on?',
          options: ['Freight Forwarding & Air/Ocean', 'Last-Mile & Courier Delivery', 'Warehousing / 3PL', 'Cold Chain Logistics', 'Fleet Management'],
          allow_custom: true,
        }
      ]
    }
  }

  if (text.includes('hr') || text.includes('recruitment') || text.includes('staffing')) {
    return {
      specificity: 'vague',
      detected_category: 'Recruitment / HR Services',
      missing_info: ['HR specialization'],
      clarifying_questions: [
        {
          question: 'What is your primary HR service?',
          options: ['Tech Staffing & Recruitment', 'Payroll & Statutory Compliance', 'Executive Search', 'Learning & Development', 'Background Verification'],
          allow_custom: true,
        }
      ]
    }
  }

  // If very short and generic, flag as vague
  if (text.split(' ').length < 5) {
    return {
      specificity: 'vague',
      detected_category: 'General Business',
      missing_info: ['Target industry', 'Specific offering'],
      clarifying_questions: [
        {
          question: 'What specific product or service does your company deliver?',
          options: ['B2B Software / SaaS', 'IT & Development Services', 'Manufacturing & Hardware', 'Professional Consulting', 'Agency / Marketing Services'],
          allow_custom: true,
        }
      ]
    }
  }

  return { specificity: 'specific' }
}
