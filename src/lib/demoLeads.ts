/**
 * EBEXTA — DEMO DATA (isolated).
 *
 * Hardcoded sample leads used ONLY by the public /demo experience. Nothing here
 * touches Supabase, Gemini, credits, or the live dashboard. It exists so a
 * prospect can experience the full flow (onboarding → filters → results →
 * dossier) with zero API burn and no signup.
 */

export type Impression = 'good' | 'bad' | 'none'

export interface DemoSignal {
  icon: string
  text: string
  date: string
}

export interface DemoLead {
  id: string
  company: string
  website: string
  logoInitial: string
  industry: string
  location: string
  size: string
  stage: string
  matchScore: number       // 0-100
  intentScore: number      // 0-100
  intentLabel: string
  summary: string
  signals: DemoSignal[]
  rationale: string
  impressed: { verdict: Impression; who: string; note: string }
  contact: { name: string; role: string; email: string; linkedin: string; verified: boolean }
  deepIntel: { heading: string; points: string[] }
  dossier: { heading: string; body: string }[]
  portfolioTeaser: string
}

export const DEMO_PROFILE = {
  companyName: 'Ebexta Labs',
  mission: 'We build EBEXTA-powered lead-intelligence and verification tooling for B2B teams.',
  website: 'ebexta.com',
}

export const DEMO_FILTERS = {
  industry: 'B2B SaaS / Technology',
  sizeRange: '50–500 employees',
  country: 'India',
  stages: ['Series A', 'Series B', 'Growth'],
}

export const DEMO_LEADS: DemoLead[] = [
  {
    id: 'demo-1',
    company: 'NimbusFlow Analytics',
    website: 'nimbusflow.io',
    logoInitial: 'N',
    industry: 'Data Analytics SaaS',
    location: 'Bengaluru, India',
    size: '180 employees',
    stage: 'Series B',
    matchScore: 94,
    intentScore: 88,
    intentLabel: 'Actively seeking',
    summary: 'Fast-scaling analytics platform expanding its data-quality stack. Recently posted 4 roles in data engineering and a Head of Revenue Ops — a strong signal they need verification tooling like yours.',
    signals: [
      { icon: 'trending_up', text: 'Closed $22M Series B led by Accel', date: '6 days ago' },
      { icon: 'work', text: 'Hiring: Head of Revenue Operations', date: '11 days ago' },
      { icon: 'campaign', text: 'Announced expansion into MENA market', date: '3 weeks ago' },
      { icon: 'code', text: 'Job posts mention "data verification pipeline"', date: '2 weeks ago' },
    ],
    rationale: 'Their new RevOps hire + fresh funding + explicit "verification pipeline" language in job posts map almost exactly to what Ebexta Labs sells. Budget authority just landed; timing is ideal.',
    impressed: {
      verdict: 'good',
      who: 'VP Engineering & Head of RevOps',
      note: 'Both roles feel the pain of unverified lead data daily and have budget this quarter.',
    },
    contact: {
      name: 'Priya Nair',
      role: 'Head of Revenue Operations',
      email: 'priya.n@nimbusflow.io',
      linkedin: 'https://www.linkedin.com/in/priyanair-revops',
      verified: true,
    },
    deepIntel: {
      heading: 'Why now',
      points: [
        'Series B capital typically triggers a 2–3 quarter tooling spend cycle.',
        'RevOps leaders are measured on pipeline hygiene — your core value prop.',
        'MENA expansion means new, unverified markets where hallucinated leads hurt most.',
        'No incumbent verification vendor detected in their stack.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'NimbusFlow builds a real-time analytics layer for mid-market e-commerce. ~180 staff, HQ Bengaluru, satellite team in Dubai. Revenue estimated ₹90–120 Cr ARR.' },
      { heading: 'Buying committee', body: 'Head of RevOps (economic buyer), VP Engineering (technical evaluator), CFO (final sign-off above ₹15L).' },
      { heading: 'Recommended opener', body: 'Lead with the MENA-expansion angle: unverified leads in new markets are expensive. Offer a 2-week verification pilot on their existing pipeline.' },
    ],
    portfolioTeaser: 'A tailored one-page pitch matching Ebexta Labs’ strengths to NimbusFlow’s exact needs.',
  },
  {
    id: 'demo-2',
    company: 'Vaultline Fintech',
    website: 'vaultline.co',
    logoInitial: 'V',
    industry: 'B2B Payments',
    location: 'Mumbai, India',
    size: '320 employees',
    stage: 'Growth',
    matchScore: 89,
    intentScore: 76,
    intentLabel: 'Warming up',
    summary: 'Payments infrastructure company tightening compliance and KYB processes. Their new Head of Risk publicly discussed "vendor and counterparty verification" pain points.',
    signals: [
      { icon: 'gavel', text: 'RBI compliance mandate deadline approaching', date: '1 week ago' },
      { icon: 'person_add', text: 'Hired Head of Risk & Compliance', date: '4 weeks ago' },
      { icon: 'article', text: 'Blog: "The cost of bad counterparty data"', date: '2 weeks ago' },
    ],
    rationale: 'Compliance deadlines force spend. A public blog on bad counterparty data is essentially a buying signal for verification. Your source-verified approach directly answers their regulatory pressure.',
    impressed: {
      verdict: 'good',
      who: 'Head of Risk & Compliance',
      note: 'Under regulatory clock; verification failures are a personal liability for this role.',
    },
    contact: {
      name: 'Arjun Mehta',
      role: 'Head of Risk & Compliance',
      email: 'a.mehta@vaultline.co',
      linkedin: 'https://www.linkedin.com/in/arjunmehta-risk',
      verified: true,
    },
    deepIntel: {
      heading: 'Why now',
      points: [
        'Regulatory deadline creates a hard, non-negotiable timeline.',
        'New Head of Risk is establishing vendors in their first 90 days.',
        'Public content signals the exact problem you solve.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'Vaultline provides payment rails and KYB APIs to ~400 fintech clients. Growth-stage, profitable, ~320 staff across Mumbai & Pune.' },
      { heading: 'Buying committee', body: 'Head of Risk (champion), CTO (integration), General Counsel (compliance sign-off).' },
      { heading: 'Recommended opener', body: 'Anchor on the RBI deadline. Position verification as risk reduction, not a nice-to-have. Reference their own blog post.' },
    ],
    portfolioTeaser: 'A compliance-focused pitch showing how Ebexta reduces Vaultline’s counterparty risk before the RBI deadline.',
  },
  {
    id: 'demo-3',
    company: 'Cohort Health',
    website: 'cohorthealth.in',
    logoInitial: 'C',
    industry: 'HealthTech SaaS',
    location: 'Hyderabad, India',
    size: '95 employees',
    stage: 'Series A',
    matchScore: 82,
    intentScore: 64,
    intentLabel: 'Early interest',
    summary: 'B2B health-data platform scaling its provider network. Growing fast but earlier-stage — a strong fit technically, with intent still building.',
    signals: [
      { icon: 'trending_up', text: 'Closed $8M Series A', date: '5 weeks ago' },
      { icon: 'hub', text: 'Onboarding 300+ new clinics this quarter', date: '2 weeks ago' },
    ],
    rationale: 'Rapid provider onboarding means lots of new entities to verify. Fit is strong; they may need a quarter before budget frees up. Good pipeline-builder lead.',
    impressed: {
      verdict: 'none',
      who: 'No clear single owner yet',
      note: 'Verification ownership is still split between Ops and Engineering — nurture before pushing.',
    },
    contact: {
      name: 'Sneha Rao',
      role: 'Director of Operations',
      email: 'sneha@cohorthealth.in',
      linkedin: 'https://www.linkedin.com/in/sneharao-ops',
      verified: false,
    },
    deepIntel: {
      heading: 'Why watch',
      points: [
        'High entity-onboarding volume = future verification demand.',
        'Series A means budget is tighter; nurture rather than hard-sell.',
        'No verification owner yet — an opportunity to shape the category for them.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'Cohort Health connects clinics with diagnostic labs via a B2B data layer. ~95 staff, Hyderabad. Early Series A.' },
      { heading: 'Buying committee', body: 'Director of Ops (likely champion), Founder/CEO (still involved in tooling decisions).' },
      { heading: 'Recommended opener', body: 'Offer a low-commitment pilot tied to their clinic-onboarding surge. Educate on verification ROI.' },
    ],
    portfolioTeaser: 'A nurture-oriented pitch positioning Ebexta as Cohort’s verification layer as they scale.',
  },
  {
    id: 'demo-4',
    company: 'Forgepoint Logistics',
    website: 'forgepoint.tech',
    logoInitial: 'F',
    industry: 'Supply-Chain SaaS',
    location: 'Pune, India',
    size: '260 employees',
    stage: 'Series B',
    matchScore: 79,
    intentScore: 58,
    intentLabel: 'Early interest',
    summary: 'Logistics visibility platform with a large, messy vendor network — a natural fit for verification, though they have a competing internal tool.',
    signals: [
      { icon: 'local_shipping', text: 'Expanded to 12 new port cities', date: '3 weeks ago' },
      { icon: 'build', text: 'Job post: "improve vendor data accuracy"', date: '1 week ago' },
    ],
    rationale: 'Clear data-accuracy pain, but they have an internal script-based approach. You would need to displace a build-vs-buy mindset — moderate fit, longer cycle.',
    impressed: {
      verdict: 'bad',
      who: 'VP Engineering (build-oriented)',
      note: 'Prefers in-house tooling; will be skeptical of an external vendor. Reframe around opportunity cost.',
    },
    contact: {
      name: 'Rahul Desai',
      role: 'VP Engineering',
      email: 'rahul.d@forgepoint.tech',
      linkedin: 'https://www.linkedin.com/in/rahuldesai-eng',
      verified: true,
    },
    deepIntel: {
      heading: 'Watch-outs',
      points: [
        'Strong internal-build culture — expect "we can do this ourselves".',
        'Data pain is real, but urgency is moderate.',
        'Best entry via a business owner, not the skeptical VP Eng.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'Forgepoint offers real-time shipment visibility across Indian ports. ~260 staff, Pune HQ.' },
      { heading: 'Buying committee', body: 'VP Eng (skeptic), COO (potential champion via cost savings).' },
      { heading: 'Recommended opener', body: 'Skip the VP Eng first. Reach the COO with a total-cost-of-ownership story vs their internal build.' },
    ],
    portfolioTeaser: 'A build-vs-buy pitch making the ROI case for Ebexta over Forgepoint’s internal tooling.',
  },
  {
    id: 'demo-5',
    company: 'Brightwave Martech',
    website: 'brightwave.ai',
    logoInitial: 'B',
    industry: 'Marketing SaaS',
    location: 'Gurugram, India',
    size: '140 employees',
    stage: 'Series B',
    matchScore: 91,
    intentScore: 83,
    intentLabel: 'Actively seeking',
    summary: 'Martech platform whose entire value depends on clean prospect data. Just launched an "AI-powered SDR" product — verification is now mission-critical for them.',
    signals: [
      { icon: 'rocket_launch', text: 'Launched AI-powered SDR product', date: '9 days ago' },
      { icon: 'reviews', text: 'Users complaining about "bad contact data"', date: '1 week ago' },
      { icon: 'work', text: 'Hiring: Data Quality Lead', date: '2 weeks ago' },
    ],
    rationale: 'Their new AI-powered SDR is only as good as its data. Public user complaints + a Data Quality Lead opening = urgent, funded need that your product solves directly.',
    impressed: {
      verdict: 'good',
      who: 'Chief Product Officer & Data Quality Lead',
      note: 'Product reputation is on the line; verification is the fix and they know it.',
    },
    contact: {
      name: 'Kavya Reddy',
      role: 'Chief Product Officer',
      email: 'kavya@brightwave.ai',
      linkedin: 'https://www.linkedin.com/in/kavyareddy-cpo',
      verified: true,
    },
    deepIntel: {
      heading: 'Why now',
      points: [
        'Their flagship AI-powered SDR fails without verified data — existential.',
        'Public complaints create internal urgency and executive visibility.',
        'A dedicated Data Quality hire means a budget line already exists.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'Brightwave sells EBEXTA-powered outbound tooling to sales teams. ~140 staff, Gurugram. Series B, high growth.' },
      { heading: 'Buying committee', body: 'CPO (champion), Data Quality Lead (evaluator), VP Sales (uses the output).' },
      { heading: 'Recommended opener', body: 'Tie directly to their AI-powered SDR reputation risk. Offer to verify a sample of their live prospect data and show the error rate.' },
    ],
    portfolioTeaser: 'A pitch proving Ebexta makes Brightwave’s AI-powered SDR trustworthy again.',
  },
  {
    id: 'demo-6',
    company: 'Meridian Procure',
    website: 'meridianprocure.com',
    logoInitial: 'M',
    industry: 'Procurement SaaS',
    location: 'Chennai, India',
    size: '210 employees',
    stage: 'Growth',
    matchScore: 86,
    intentScore: 72,
    intentLabel: 'Warming up',
    summary: 'Enterprise procurement platform that vets suppliers for large buyers — verification is core to their own product, making them both a customer and a natural partner.',
    signals: [
      { icon: 'handshake', text: 'Signed 3 new enterprise buyers', date: '2 weeks ago' },
      { icon: 'verified', text: 'Marketing "supplier trust scores"', date: '3 weeks ago' },
      { icon: 'groups', text: 'Hiring across supplier-vetting team', date: '10 days ago' },
    ],
    rationale: 'They already sell trust scores — meaning they value verification and could either buy your data or partner. Dual opportunity: customer and channel.',
    impressed: {
      verdict: 'good',
      who: 'Head of Supplier Network',
      note: 'Owns the trust-score product; better upstream verification makes their own offering stronger.',
    },
    contact: {
      name: 'Deepak Iyer',
      role: 'Head of Supplier Network',
      email: 'deepak.iyer@meridianprocure.com',
      linkedin: 'https://www.linkedin.com/in/deepakiyer-supply',
      verified: true,
    },
    deepIntel: {
      heading: 'Why now',
      points: [
        'New enterprise buyers raise the bar on supplier data quality.',
        'They already monetize trust — verification is a proven priority.',
        'Potential partnership angle beyond a straight sale.',
      ],
    },
    dossier: [
      { heading: 'Company snapshot', body: 'Meridian runs a procurement marketplace vetting suppliers for enterprise buyers. ~210 staff, Chennai. Growth stage.' },
      { heading: 'Buying committee', body: 'Head of Supplier Network (champion), CTO (integration/partnership), CEO (partnership sign-off).' },
      { heading: 'Recommended opener', body: 'Pitch both paths: license your verified data to strengthen their trust scores, or co-market a joint offering.' },
    ],
    portfolioTeaser: 'A dual customer-and-partner pitch tailored to Meridian’s trust-score product.',
  },
]
