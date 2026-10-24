/**
 * EBEXTA Requirement Rules Engine — Complete Production Taxonomy
 * ------------------------------------------------------------------
 * Core principle: hunt REQUIREMENT, not PROMINENCE. A gap = a need; an
 * anti-signal = an exclusion. A polished, well-known company is NOT a lead
 * unless there's evidence of a gap or a triggering business event.
 *
 * 30 Sector Families:
 *   1–10  Digital-service sectors (web-presence / ABSENCE_HUNT based)
 *   11–30 Expanded B2B families   (physical / EVENT_TRIGGER / ABSENCE_HUNT)
 * 30 Universal Meta-Rules (appliesTo: ['ALL']).
 * 12 Qualification & Accuracy Safeguards.
 */
import { supabase } from './supabase'

export type SectorStrategy = 'ABSENCE_HUNT' | 'EVENT_TRIGGER' | 'STANDARD'

export interface Signal { signal: string; points: number }

export interface SectorRule {
  id?: string
  sector: string
  aliases: string[]
  strategy: string
  gapSignals: Signal[]
  triggerSignals: Signal[]
  antiSignals: string[]
  buyerRoles: string[]
  searchQueries: string[]
  /** true for physical/event families → event-evidence prompt mode */
  physicalEvidence?: boolean
  isBuiltin?: boolean
  sortOrder?: number
}

export interface MetaRule {
  id?: string
  name: string
  points: number
  description: string
  appliesTo: string[]
  isBuiltin?: boolean
  sortOrder?: number
}

// ════════════════════════════════════════════════════════════════════════
// SECTOR_RULES — 30 Production Sector Families
// ════════════════════════════════════════════════════════════════════════
export const SECTOR_RULES: SectorRule[] = [
  // ─── 1. WEB DEVELOPMENT ───
  {
    sector: 'WEB_DEVELOPMENT',
    aliases: ['web development', 'website design', 'web design', 'website', 'landing page', 'wordpress', 'shopify', 'web app', 'ui development', 'frontend'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'No website, or a dated/broken/non-responsive site', points: 35 },
      { signal: 'Poor mobile experience / missing SSL / slow site', points: 25 },
      { signal: 'Strong offline brand with weak web presence', points: 30 },
      { signal: 'Site not updated for years (stale copyright, old content)', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Rebrand or new product launch', points: 30 },
      { signal: 'Funding announced (scaling digital channels)', points: 30 },
      { signal: 'Marketing / growth hiring', points: 20 },
      { signal: 'Expanding to a new geography', points: 25 },
      { signal: 'Website traffic growth / new digital channel', points: 25 },
    ],
    antiSignals: ['Recently redesigned modern site', 'Strong internal web team', 'Web development agency', 'Active website rebuild'],
    buyerRoles: ['Founder', 'CEO', 'Owner', 'Marketing Head', 'Product Head'],
    searchQueries: ['{industry} companies {location}', '{industry} companies without website {location}', '"{company}" website', '{company} redesign'],
  },

  // ─── 2. SEO / SEM ───
  {
    sector: 'SEO_SEM',
    aliases: ['SEO', 'SEM', 'Google Ads', 'PPC', 'search marketing', 'keyword ranking', 'organic traffic', 'performance marketing'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Not ranking for core category terms', points: 35 },
      { signal: 'Thin content / no useful blog or resource layer', points: 30 },
      { signal: 'Competitors dominate relevant search', points: 30 },
      { signal: 'No paid search for high-intent terms', points: 20 },
    ],
    triggerSignals: [
      { signal: 'New website launched (needs ranking)', points: 30 },
      { signal: 'Competitive market entry', points: 25 },
      { signal: 'Funding / growth mandate', points: 25 },
      { signal: 'New product or new market launch', points: 25 },
    ],
    antiSignals: ['Top rankings for key terms', 'Mature in-house SEO/performance team', 'SEO agency', 'Recent search program'],
    buyerRoles: ['Marketing Head', 'Growth Head', 'Founder', 'CEO'],
    searchQueries: ['{industry} companies {location}', '"{company}" SEO', '"{company}" Google rankings', '{industry} competitors {location}'],
  },

  // ─── 3. BRANDING & DESIGN ───
  {
    sector: 'BRANDING_DESIGN',
    aliases: ['branding', 'logo', 'identity', 'graphic design', 'UI/UX', 'visual identity', 'rebrand'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Inconsistent identity / dated branding', points: 30 },
      { signal: 'Generic visual identity / no design system', points: 30 },
      { signal: 'Inconsistent product/marketing assets', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Rebrand / repositioning announced', points: 35 },
      { signal: 'New product line or new market', points: 30 },
      { signal: 'Funding announced (upgrading brand identity)', points: 25 },
      { signal: 'Merger / name change', points: 25 },
    ],
    antiSignals: ['Recent rebrand', 'Established in-house design team', 'Design studio/agency'],
    buyerRoles: ['Founder', 'CEO', 'Marketing Head', 'Brand Manager'],
    searchQueries: ['"{company}" rebrand', '{industry} companies {location}', '"{company}" new brand'],
  },

  // ─── 4. SOCIAL MEDIA MARKETING ───
  {
    sector: 'SOCIAL_MEDIA',
    aliases: ['social media', 'SMM', 'Instagram marketing', 'LinkedIn marketing', 'community', 'content calendar', 'reels'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Inactive handles / low relevant engagement', points: 30 },
      { signal: 'Missing audience-relevant channels', points: 25 },
      { signal: 'Inconsistent publishing schedule', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Product launch / campaign season', points: 30 },
      { signal: 'D2C scaling / consumer brand push', points: 30 },
      { signal: 'Funding announced', points: 25 },
      { signal: 'New market entry', points: 25 },
    ],
    antiSignals: ['Highly active / high-engagement presence', 'In-house social team', 'Social agency'],
    buyerRoles: ['Marketing Head', 'Founder', 'Brand Manager', 'Growth Head'],
    searchQueries: ['"{company}" Instagram', '"{company}" LinkedIn', '{industry} companies {location}'],
  },

  // ─── 5. APP DEVELOPMENT ───
  {
    sector: 'APP_DEVELOPMENT',
    aliases: ['app development', 'mobile app', 'Android', 'iOS', 'Flutter', 'React Native', 'mobile development'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Web-only model with clear mobile use case', points: 35 },
      { signal: 'Poor app ratings / obsolete app', points: 30 },
      { signal: 'Missing required mobile functionality', points: 25 },
      { signal: 'Competitors have useful app, they do not', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Funding for mobile platform', points: 35 },
      { signal: 'D2C / marketplace launch', points: 30 },
      { signal: 'Mobile engineer hiring', points: 25 },
      { signal: 'New digital product launch', points: 25 },
    ],
    antiSignals: ['Well-rated maintained app', 'In-house mobile team', 'App development company'],
    buyerRoles: ['Founder', 'CTO', 'Product Head', 'CEO'],
    searchQueries: ['"{company}" mobile app', '"{company}" Android', '"{company}" iOS'],
  },

  // ─── 6. CUSTOM SOFTWARE ───
  {
    sector: 'CUSTOM_SOFTWARE',
    aliases: ['custom software', 'software development', 'SaaS development', 'automation', 'internal tools', 'workflow software', 'CRM development'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Manual / spreadsheet processes at scale', points: 35 },
      { signal: 'Repetitive operations / fragmented tools', points: 30 },
      { signal: 'Off-the-shelf software mismatch', points: 25 },
      { signal: 'Multi-location coordination issues', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Scaling operations / multi-location expansion', points: 30 },
      { signal: 'Funding announced', points: 30 },
      { signal: 'New process / compliance mandate', points: 25 },
      { signal: 'Acquisition / integration', points: 25 },
    ],
    antiSignals: ['Recent custom platform', 'In-house engineering team', 'Software development firm'],
    buyerRoles: ['Founder', 'COO', 'CTO', 'Operations Head'],
    searchQueries: ['"{company}" automation', '"{company}" software', '{industry} manual operations'],
  },

  // ─── 7. CLOUD & DEVOPS ───
  {
    sector: 'CLOUD_DEVOPS',
    aliases: ['cloud', 'DevOps', 'AWS', 'Azure', 'GCP', 'Kubernetes', 'migration', 'infrastructure', 'CI/CD', 'SRE'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Legacy / on-prem at meaningful scale', points: 35 },
      { signal: 'Downtime / scaling bottlenecks', points: 30 },
      { signal: 'Manual deployments / missing CI/CD', points: 25 },
      { signal: 'Infrastructure cost or performance bottlenecks', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Rapid traffic growth / scaling phase', points: 30 },
      { signal: 'Funding announced', points: 30 },
      { signal: 'DevOps / SRE hiring', points: 25 },
      { signal: 'Cloud migration initiative', points: 30 },
      { signal: 'New product scale', points: 25 },
    ],
    antiSignals: ['Modern cloud-native stack', 'Strong internal platform team', 'Cloud/DevOps consultancy'],
    buyerRoles: ['CTO', 'VP Engineering', 'Founder', 'IT Head'],
    searchQueries: ['"{company}" AWS', '"{company}" cloud migration', '"{company}" DevOps'],
  },

  // ─── 8. CYBERSECURITY ───
  {
    sector: 'CYBERSECURITY',
    aliases: ['cybersecurity', 'security audit', 'VAPT', 'penetration testing', 'infosec', 'SOC', 'ISO27001', 'data security', 'compliance security'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'Sensitive data with weak visible security posture', points: 35 },
      { signal: 'Missing relevant certification (ISO27001/SOC2)', points: 30 },
      { signal: 'No internal security function / control gaps', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Security breach or incident reported', points: 40 },
      { signal: 'Enterprise client demand for audit', points: 35 },
      { signal: 'Regulated-market expansion / fintech/health scale', points: 30 },
      { signal: 'Funding announced', points: 25 },
    ],
    antiSignals: ['ISO27001 / SOC2 already current', 'Strong internal security function', 'Cybersecurity provider'],
    buyerRoles: ['CISO', 'CTO', 'CIO', 'Founder', 'Compliance Head'],
    searchQueries: ['"{company}" security audit', '"{company}" ISO 27001', '"{company}" breach', '{industry} security requirements'],
  },

  // ─── 9. DATA & ANALYTICS ───
  {
    sector: 'DATA_ANALYTICS',
    aliases: ['analytics', 'BI', 'dashboards', 'data warehouse', 'reporting', 'data science', 'ML'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Manual reporting / no dashboards', points: 35 },
      { signal: 'Growing data volume without analytics layer', points: 30 },
      { signal: 'Fragmented reporting across business units', points: 25 },
      { signal: 'Decisions dependent on manual analysis', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Scaling operations / multi-location', points: 30 },
      { signal: 'Funding announced', points: 30 },
      { signal: 'Analyst / data hiring', points: 25 },
      { signal: 'Data-heavy product launch', points: 25 },
    ],
    antiSignals: ['Mature analytics stack (Snowflake/Looker/Tableau)', 'In-house analytics team', 'Analytics company'],
    buyerRoles: ['Founder', 'COO', 'CFO', 'Data Head', 'CEO'],
    searchQueries: ['"{company}" analytics', '"{company}" dashboard', '{industry} reporting'],
  },

  // ─── 10. DIGITAL MARKETING & DEMAND GEN ───
  {
    sector: 'DIGITAL_MARKETING',
    aliases: ['digital marketing', 'performance marketing', 'growth marketing', 'lead generation', 'email marketing', 'automation', 'demand generation', 'media buying'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'No paid / performance marketing layer', points: 35 },
      { signal: 'Weak conversion funnel / weak lead generation', points: 30 },
      { signal: 'Low digital footprint / limited lifecycle marketing', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Funding / growth mandate', points: 30 },
      { signal: 'CAC pressure / demand scaling need', points: 30 },
      { signal: 'Product launch / market launch', points: 25 },
      { signal: 'Growth team hiring', points: 20 },
    ],
    antiSignals: ['Sophisticated performance program', 'In-house growth team', 'Marketing agency'],
    buyerRoles: ['Growth Head', 'Marketing Head', 'Founder', 'CEO'],
    searchQueries: ['"{company}" lead generation', '"{company}" performance marketing', '{industry} demand generation'],
  },

  // ─── 11. INDUSTRIAL & MANUFACTURING ───
  {
    sector: 'INDUSTRIAL',
    aliases: ['automation', 'IoT', 'machine AMC', 'spares', 'contract manufacturing', 'job work', 'tooling', 'ISO', 'BIS', 'PLC', 'SCADA', 'equipment', 'fabrication'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Manual production / aging machinery', points: 35 },
      { signal: 'Missing relevant certification (ISO/BIS)', points: 30 },
      { signal: 'Quality rejection / maintenance gap', points: 30 },
      { signal: 'Capacity constraints in plant', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New plant / facility setup', points: 40 },
      { signal: 'Capacity expansion announced', points: 35 },
      { signal: 'Large order / government tender win', points: 35 },
      { signal: 'Export order / government scheme', points: 30 },
      { signal: 'Production / maintenance hiring', points: 25 },
    ],
    antiSignals: ['Recent automation completed', 'In-house maintenance team', 'Relevant certification already held', 'Industrial services provider'],
    buyerRoles: ['Owner', 'MD', 'Plant Head', 'Production Head', 'Purchase Head'],
    searchQueries: ['"{company}" new plant', '"{company}" expansion', '"{company}" tender', '"{company}" machinery'],
  },

  // ─── 12. LOGISTICS & SUPPLY CHAIN ───
  {
    sector: 'LOGISTICS',
    aliases: ['freight', 'warehouse', 'last-mile', 'customs', 'CHA', 'fleet', 'cold chain', '3PL', 'transport', 'shipping', 'courier'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Expansion without warehouse / fleet support', points: 35 },
      { signal: 'Perishables / pharma without cold chain', points: 35 },
      { signal: 'Delivery complaints / missing logistics capability', points: 30 },
      { signal: 'Import / export without customs support', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Geographic expansion / multi-city rollout', points: 35 },
      { signal: 'D2C channel scaling', points: 30 },
      { signal: 'Export / import volume ramp', points: 30 },
      { signal: 'New plant / peak season', points: 30 },
      { signal: 'Order volume growth', points: 25 },
    ],
    antiSignals: ['Owned adequate fleet/warehouse', 'Recent 3PL contract signed', 'Logistics company itself'],
    buyerRoles: ['Owner', 'MD', 'Supply Chain Head', 'Operations Head', 'COO'],
    searchQueries: ['"{company}" warehouse', '"{company}" export', '"{company}" logistics', '"{company}" cold chain'],
  },

  // ─── 13. FACILITY & WORKPLACE SERVICES ───
  {
    sector: 'FACILITY',
    aliases: ['housekeeping', 'security', 'cafeteria', 'transport', 'office interiors', 'fit-out', 'HVAC AMC', 'electrical AMC', 'FM', 'pest control', 'maintenance'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'New / growing office without facility vendor evidence', points: 35 },
      { signal: 'Headcount surge without cafeteria / transport', points: 30 },
      { signal: 'Employee facility complaints', points: 25 },
      { signal: 'Missing admin/workplace ownership', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New office / facility lease signed', points: 40 },
      { signal: 'Office relocation / renovation', points: 35 },
      { signal: 'Headcount surge / RTO mandate', points: 30 },
      { signal: 'New floor / building addition', points: 30 },
    ],
    antiSignals: ['Integrated FM partner active', 'Large in-house admin team', 'Coworking package already covers all needs', 'Facility services company'],
    buyerRoles: ['Admin Head', 'HR Head', 'Founder', 'COO', 'Office Manager'],
    searchQueries: ['"{company}" new office', '"{company}" relocation', '"{company}" office expansion'],
  },

  // ─── 14. LEGAL & CORPORATE COMPLIANCE ───
  {
    sector: 'LEGAL',
    aliases: ['corporate law', 'IP', 'trademark', 'licensing', 'labor compliance', 'environmental clearance', 'legal', 'company secretary', 'FEMA', 'GST'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'Growing brand without trademark registration', points: 35 },
      { signal: 'Missing corporate counsel / CS', points: 30 },
      { signal: 'Regulated activity without visible licenses', points: 30 },
      { signal: 'Founder-managed legal compliance', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Fundraise / investment closing', points: 35 },
      { signal: 'New state / international market entry', points: 30 },
      { signal: 'Hiring surge / dispute / notice', points: 30 },
      { signal: 'Trademark opposition / acquisition / IPO preparation', points: 35 },
    ],
    antiSignals: ['In-house legal team', 'Retained legal counsel with active scope', 'Legal services company'],
    buyerRoles: ['Founder', 'CEO', 'CFO', 'Company Secretary', 'COO'],
    searchQueries: ['"{company}" trademark', '"{company}" funding', '"{company}" legal notice', '"{company}" expansion'],
  },

  // ─── 15. FINANCIAL SERVICES & WORKING CAPITAL ───
  {
    sector: 'FINANCIAL_SERVICES',
    aliases: ['working capital', 'invoice discounting', 'insurance', 'payment gateway', 'trade finance', 'business loans', 'credit insurance', 'treasury'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'Long receivables / cash conversion lag', points: 35 },
      { signal: 'Missing online payment capabilities', points: 30 },
      { signal: 'Uninsured commercial assets / weak finance function', points: 30 },
    ],
    triggerSignals: [
      { signal: 'Large order win / export contract', points: 35 },
      { signal: 'D2C channel scaling', points: 30 },
      { signal: 'Inventory / capacity expansion', points: 30 },
      { signal: 'Seasonal procurement window', points: 25 },
    ],
    antiSignals: ['Recent debt/credit facility closed', 'Bank partnership active', 'Payment gateway already integrated', 'Financial services company'],
    buyerRoles: ['Founder', 'MD', 'CFO', 'Finance Head', 'Purchase Head'],
    searchQueries: ['"{company}" working capital', '"{company}" export', '"{company}" payment gateway'],
  },

  // ─── 16. TRADE & DISTRIBUTION ───
  {
    sector: 'TRADE_DISTRIBUTION',
    aliases: ['raw material', 'supplier', 'wholesaler', 'distributor', 'import/export', 'sourcing', 'procurement', 'trading'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Single-supplier dependency / supply disruption', points: 35 },
      { signal: 'Missing distribution in target region', points: 30 },
      { signal: 'International sourcing without dedicated import partner', points: 30 },
    ],
    triggerSignals: [
      { signal: 'Capacity expansion / new product line', points: 35 },
      { signal: 'Geographic expansion / localization push', points: 30 },
      { signal: 'Commodity price shifts', points: 25 },
    ],
    antiSignals: ['Vertically integrated operations', 'Exclusive distribution already established', 'Same-category trading company'],
    buyerRoles: ['Owner', 'MD', 'Purchase Head', 'Procurement Head', 'Sales Head'],
    searchQueries: ['"{company}" distributor', '"{company}" sourcing', '"{company}" procurement', '{industry} distributors'],
  },

  // ─── 17. CREATIVE & MEDIA PRODUCTION ───
  {
    sector: 'CREATIVE_MEDIA',
    aliases: ['content writing', 'video', 'photography', 'PR', 'influencer', 'events', 'printing', 'packaging', 'corporate gifting', 'exhibition', 'brand films'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'No content / blog / social creative layer', points: 30 },
      { signal: 'Weak visual imagery / generic packaging', points: 30 },
      { signal: 'No PR or media presence', points: 25 },
      { signal: 'No exhibition / event presence in trade sector', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Product launch / new campaign', points: 35 },
      { signal: 'Funding / gifting season approaching', points: 30 },
      { signal: 'Rebrand / industry exhibition upcoming', points: 30 },
      { signal: 'Company milestone / anniversary', points: 25 },
    ],
    antiSignals: ['In-house creative/content team', 'Agency of record engaged', 'Creative agency itself'],
    buyerRoles: ['Founder', 'Marketing Head', 'Brand Manager', 'CEO'],
    searchQueries: ['"{company}" product launch', '"{company}" packaging', '"{company}" PR', '"{company}" exhibition'],
  },

  // ─── 18. IT & ENTERPRISE SYSTEMS ───
  {
    sector: 'IT_ENTERPRISE',
    aliases: ['hardware', 'networking', 'IT AMC', 'ERP', 'SAP', 'licensing', 'BI', 'analytics', 'AI consulting', 'data engineering', 'systems integration'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'Spreadsheet operations / no ERP at multi-location scale', points: 35 },
      { signal: 'Aging IT hardware / legacy networking', points: 30 },
      { signal: 'Manual reporting / data without analytics layer', points: 30 },
    ],
    triggerSignals: [
      { signal: 'Multi-location expansion / new office branch', points: 35 },
      { signal: 'Funding / compliance mandate', points: 30 },
      { signal: 'Digital transformation initiative', points: 30 },
    ],
    antiSignals: ['Recent ERP deployment completed', 'Strong in-house IT team / SI', 'IT services company'],
    buyerRoles: ['MD', 'CIO', 'CTO', 'IT Head', 'CFO', 'COO'],
    searchQueries: ['"{company}" ERP', '"{company}" SAP', '"{company}" IT infrastructure', '"{company}" digital transformation'],
  },

  // ─── 19. PEOPLE SERVICES & WORKFORCE ───
  {
    sector: 'PEOPLE_SERVICES',
    aliases: ['payroll', 'staffing', 'L&D', 'training', 'background verification', 'HRMS', 'PEO', 'compliance staffing'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'Manual payroll / no HR system at meaningful headcount', points: 35 },
      { signal: 'Training / skill gaps reported', points: 30 },
      { signal: 'Hiring without background verification infrastructure', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Headcount surge / rapid hiring', points: 35 },
      { signal: 'Multi-state expansion / compliance requirements', points: 30 },
      { signal: 'Attrition / seasonal project hiring', points: 25 },
    ],
    antiSignals: ['HRMS / payroll system already mature', 'Retained staffing partner', 'Large internal HR department', 'HR services company'],
    buyerRoles: ['Founder', 'HR Head', 'CFO', 'COO'],
    searchQueries: ['"{company}" hiring', '"{company}" HRMS', '"{company}" payroll', '"{company}" training'],
  },

  // ─── 20. CUSTOMER OPERATIONS & BPO ───
  {
    sector: 'CUSTOMER_OPS',
    aliases: ['BPO', 'support outsourcing', 'call center', 'virtual assistant', 'customer service', 'chat support'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Customer support complaints / long response times', points: 35 },
      { signal: 'No support beyond basic contact form / email', points: 30 },
      { signal: 'Founder-led support / timezone coverage gap', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Rapid user growth / product launch', points: 35 },
      { signal: 'Ticket volume surge / new market timezone', points: 30 },
      { signal: 'Funding / persistent support hiring', points: 25 },
    ],
    antiSignals: ['Scaled in-house support center', 'Existing BPO contract', 'BPO / customer support company'],
    buyerRoles: ['Founder', 'COO', 'Customer Success Head', 'Operations Head'],
    searchQueries: ['"{company}" customer support', '"{company}" helpdesk', '"{company}" BPO'],
  },

  // ─── 21. ECOMMERCE & MARKETPLACE SERVICES ───
  {
    sector: 'ECOM_SERVICES',
    aliases: ['marketplace onboarding', 'catalog', 'seller account', 'ASO', 'Amazon', 'Flipkart', 'ecommerce services', 'ecommerce photography', 'listing optimization'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Retail brand absent from major marketplaces', points: 35 },
      { signal: 'Poor listings / low reviews / poor imagery', points: 30 },
      { signal: 'Strong offline presence with no online channels', points: 30 },
      { signal: 'Over-dependence on a single marketplace', points: 25 },
    ],
    triggerSignals: [
      { signal: 'D2C launch announced', points: 35 },
      { signal: 'Festival sale season approaching', points: 30 },
      { signal: 'New product line launch / going online', points: 25 },
    ],
    antiSignals: ['Strong multi-marketplace presence', 'In-house ecommerce team', 'Ecommerce agency'],
    buyerRoles: ['Owner', 'Founder', 'Ecommerce Head', 'Sales Head'],
    searchQueries: ['"{company}" Amazon', '"{company}" Flipkart', '"{company}" marketplace'],
  },

  // ─── 22. ENERGY & SUSTAINABILITY ───
  {
    sector: 'ENERGY_SUSTAINABILITY',
    aliases: ['solar', 'EV charging', 'waste management', 'ESG', 'energy audit', 'renewable', 'sustainability', 'carbon', 'green certification'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Energy-intensive operations without visible optimization', points: 35 },
      { signal: 'No ESG layer / missing waste partner in waste-heavy sector', points: 30 },
      { signal: 'Fleet operations without EV transition plan', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Tariff increase in region', points: 30 },
      { signal: 'Export customers requiring ESG compliance', points: 35 },
      { signal: 'New factory / subsidy available', points: 35 },
      { signal: 'CSR / BRSR reporting mandate applying', points: 30 },
    ],
    antiSignals: ['Solar already installed', 'Current ESG reporting published', 'Sustainability head with established program', 'Energy provider'],
    buyerRoles: ['Owner', 'MD', 'Plant Head', 'CFO', 'Sustainability Head'],
    searchQueries: ['"{company}" solar', '"{company}" ESG', '"{company}" sustainability', '"{company}" new plant'],
  },

  // ─── 23. CONSTRUCTION & REAL ESTATE ───
  {
    sector: 'CONSTRUCTION_REAL_ESTATE',
    aliases: ['construction', 'real estate', 'EPC', 'contractor', 'developer', 'property management', 'civil works', 'interiors', 'MEP', 'facility development'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'New project without visible contractors / vendors', points: 35 },
      { signal: 'Project expansion / delayed project', points: 30 },
      { signal: 'Missing MEP / interior / security / logistics capability', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New project / land acquisition announced', points: 40 },
      { signal: 'Project award / construction start', points: 35 },
      { signal: 'Handover / expansion / renovation phase', points: 30 },
    ],
    antiSignals: ['Project completed', 'Established in-house construction capability', 'Contracted vendor clearly identified', 'Same-category service provider'],
    buyerRoles: ['Promoter', 'Director', 'Project Head', 'Procurement Head', 'Construction Head', 'Facility Head'],
    searchQueries: ['"{company}" new project', '"{company}" construction', '"{company}" tender', '"{company}" expansion'],
  },

  // ─── 24. HEALTHCARE SERVICES ───
  {
    sector: 'HEALTHCARE_SERVICES',
    aliases: ['hospital', 'clinic', 'diagnostic center', 'pathology', 'radiology', 'healthcare', 'medical center', 'pharmacy'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'New facility without operational vendors', points: 35 },
      { signal: 'Outdated patient systems / capacity constraints', points: 30 },
      { signal: 'Missing digital booking/support / procurement gaps', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New hospital / clinic branch opening', points: 40 },
      { signal: 'Bed expansion / diagnostic capacity expansion', points: 35 },
      { signal: 'NABH / accreditation / new medical specialty', points: 30 },
    ],
    antiSignals: ['Modern hospital system already deployed', 'Established vendors', 'Healthcare service provider itself'],
    buyerRoles: ['Founder', 'Promoter', 'Hospital Administrator', 'COO', 'Procurement Head', 'Medical Director'],
    searchQueries: ['"{company}" new hospital', '"{company}" clinic expansion', '"{company}" diagnostic center'],
  },

  // ─── 25. EDUCATION SERVICES ───
  {
    sector: 'EDUCATION_SERVICES',
    aliases: ['school', 'college', 'university', 'training institute', 'coaching', 'edtech', 'vocational training', 'education'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Manual admissions / weak digital presence', points: 35 },
      { signal: 'Outdated LMS / student support gaps', points: 30 },
      { signal: 'Campus infrastructure gaps', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New campus / admissions season approaching', points: 40 },
      { signal: 'New course / degree program launch', points: 30 },
      { signal: 'Expansion / accreditation / online program launch', points: 30 },
    ],
    antiSignals: ['Mature LMS / digital stack active', 'Established vendors in place', 'Education services provider itself'],
    buyerRoles: ['Founder', 'Director', 'Principal', 'Administrator', 'COO', 'IT Head', 'Marketing Head'],
    searchQueries: ['"{company}" new campus', '"{company}" admissions', '"{company}" LMS', '"{company}" expansion'],
  },

  // ─── 26. HOSPITALITY & TRAVEL ───
  {
    sector: 'HOSPITALITY_TRAVEL',
    aliases: ['hotel', 'resort', 'restaurant', 'hospitality', 'travel', 'tourism', 'hotel management', 'booking', 'guest experience'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Weak booking channel / guest complaints', points: 35 },
      { signal: 'Outdated property management systems (PMS)', points: 30 },
      { signal: 'Staffing / facility gaps / poor digital presence', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New property / outlet opening', points: 40 },
      { signal: 'Renovation / peak tourist season', points: 30 },
      { signal: 'Expansion / tourism campaign launch', points: 30 },
    ],
    antiSignals: ['Modern PMS / booking engine deployed', 'Established vendor network', 'Hospitality service provider'],
    buyerRoles: ['Owner', 'General Manager', 'Operations Head', 'Revenue Manager', 'Marketing Head', 'Procurement Head'],
    searchQueries: ['"{company}" new hotel', '"{company}" renovation', '"{company}" opening', '"{company}" booking'],
  },

  // ─── 27. FOOD & AGRI-PROCESSING ───
  {
    sector: 'FOOD_AGRI_PROCESSING',
    aliases: ['food processing', 'agriculture', 'agritech', 'dairy', 'poultry', 'seafood', 'cold storage', 'packaging', 'farm', 'processing plant'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Capacity constraints / aging processing equipment', points: 35 },
      { signal: 'Quality issues / cold-chain gaps', points: 35 },
      { signal: 'Packaging gap / procurement dependency', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New plant / capacity expansion announced', points: 40 },
      { signal: 'Export order / harvest season surge', points: 35 },
      { signal: 'New product line / certification / tender', points: 30 },
    ],
    antiSignals: ['Modern plant with automated lines', 'Established cold chain', 'Current certifications held', 'Same-category provider'],
    buyerRoles: ['Owner', 'MD', 'Plant Head', 'Procurement Head', 'Operations Head', 'Supply Chain Head'],
    searchQueries: ['"{company}" new plant', '"{company}" food processing', '"{company}" cold storage', '"{company}" export'],
  },

  // ─── 28. PROFESSIONAL SERVICES ───
  {
    sector: 'PROFESSIONAL_SERVICES',
    aliases: ['consulting', 'accounting', 'audit', 'advisory', 'recruitment', 'executive search', 'management consulting', 'professional services'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Weak lead generation / outdated website', points: 35 },
      { signal: 'Weak authority content / manual client operations', points: 30 },
      { signal: 'Missing CRM or modern process layer', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New practice area / geographic expansion', points: 35 },
      { signal: 'Partner hire / funding announced', points: 30 },
      { signal: 'New service offering launch', points: 25 },
    ],
    antiSignals: ['Strong digital acquisition machine', 'Mature CRM / marketing team', 'Established agency/provider'],
    buyerRoles: ['Founder', 'Partner', 'Managing Director', 'Practice Head', 'Marketing Head', 'Operations Head'],
    searchQueries: ['"{company}" consulting', '"{company}" new practice', '"{company}" expansion'],
  },

  // ─── 29. TELECOM & NETWORK INFRASTRUCTURE ───
  {
    sector: 'TELECOM_NETWORK_INFRA',
    aliases: ['telecom', 'ISP', 'fiber', 'networking', 'data center', 'tower', 'connectivity', 'unified communications', 'network infrastructure'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Capacity constraints / legacy network setup', points: 35 },
      { signal: 'Coverage gaps / reliability issues', points: 30 },
      { signal: 'Missing network monitoring / security posture', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Network expansion / new site deployment', points: 40 },
      { signal: 'Data center launch / 5G or fiber rollout', points: 35 },
      { signal: 'Enterprise contract win', points: 30 },
    ],
    antiSignals: ['Modern network stack active', 'Established infrastructure provider', 'Current upgrade program'],
    buyerRoles: ['CTO', 'CIO', 'Network Head', 'Infrastructure Head', 'Procurement Head', 'COO'],
    searchQueries: ['"{company}" network expansion', '"{company}" fiber', '"{company}" data center'],
  },

  // ─── 30. MANUFACTURING & PROCUREMENT SOURCING ───
  {
    sector: 'MANUFACTURING_PROCUREMENT',
    aliases: ['procurement', 'sourcing', 'supplier development', 'raw materials', 'components', 'contract manufacturing', 'vendor management'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Single-source dependency / supplier quality issues', points: 35 },
      { signal: 'Long lead times / procurement fragmentation', points: 30 },
      { signal: 'Material shortages / lack of verified vendor pool', points: 25 },
    ],
    triggerSignals: [
      { signal: 'New product line / capacity expansion', points: 40 },
      { signal: 'Large order / export contract win', points: 35 },
      { signal: 'Localization push / supplier diversification mandate', points: 30 },
    ],
    antiSignals: ['Vertically integrated supply chain', 'Stable multi-source network', 'Procurement service provider'],
    buyerRoles: ['Purchase Head', 'Procurement Head', 'Supply Chain Head', 'Plant Head', 'COO'],
    searchQueries: ['"{company}" supplier', '"{company}" procurement', '"{company}" sourcing', '"{company}" new product'],
  },

  // ─── 31. GAMING & INTERACTIVE TECHNOLOGY ───
  {
    sector: 'GAMING_INTERACTIVE',
    aliases: ['gaming', 'game development', 'outsourced game development', 'co-dev', 'contract game development', 'animation', 'video game development', 'interactive technology', 'unity', 'unreal engine', '3d art', 'artists for mural art', 'mural art'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Game studio scaling without co-dev / art partner', points: 35 },
      { signal: 'Delayed production timeline / engineering bottlenecks', points: 30 },
      { signal: 'Art asset backlog / lack of 3D/animation capacity', points: 30 },
      { signal: 'Missing live-ops / porting / QA infrastructure', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Game title greenlit / new IP announced', points: 40 },
      { signal: 'Publisher funding / Kickstarter / Epic MegaGrant', points: 35 },
      { signal: 'Platform porting (PC/Console/Mobile)', points: 30 },
      { signal: 'Rapid gameplay/art team expansion', points: 25 },
    ],
    antiSignals: ['Fully staffed internal co-dev team', 'Publisher with dedicated internal studios', 'Same-category game studio agency'],
    buyerRoles: ['Executive Producer', 'Studio Head', 'Creative Director', 'VP Engineering', 'Founder', 'Art Director'],
    searchQueries: ['"{company}" game development', '"{company}" co-dev', '"{company}" unreal engine', '{industry} game studios {location}'],
  },

  // ─── 32. AI CCTV & SURVEILLANCE ANALYTICS ───
  {
    sector: 'SECURITY_SURVEILLANCE_CCTV',
    aliases: ['ai cctv', 'ai cctv analytical platform', 'cctv', 'video analytics', 'surveillance', 'physical security', 'access control', 'smart surveillance', 'computer vision security'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Legacy analog CCTV with no intelligent analytics', points: 35 },
      { signal: 'Security blindspots across large physical footprint', points: 30 },
      { signal: 'Manual monitoring without automated intrusion/incident alerts', points: 30 },
    ],
    triggerSignals: [
      { signal: 'New warehouse, factory, plant, or retail store chain rollout', points: 40 },
      { signal: 'Security incident / theft / perimeter breach reported', points: 35 },
      { signal: 'Compliance mandate for 24/7 video surveillance storage', points: 30 },
    ],
    antiSignals: ['Modern AI vision surveillance already deployed', 'In-house physical security engineering', 'Surveillance hardware provider'],
    buyerRoles: ['Chief Security Officer', 'Head of Security', 'Facility Head', 'Operations Head', 'Plant Head', 'MD'],
    searchQueries: ['"{company}" cctv', '"{company}" surveillance', '"{company}" physical security', '{industry} facilities {location}'],
  },

  // ─── 33. FINTECH & EMBEDDED FINANCE ───
  {
    sector: 'FINTECH_INSURTECH',
    aliases: ['fintech', 'insurtech', 'embedded finance', 'b2b saas / fintech', 'insurtech / healthtech / b2b saas', 'wealthtech', 'lending tech', 'payment gateway'],
    strategy: 'EVENT_TRIGGER',
    gapSignals: [
      { signal: 'High user volume platform with no monetized financial layer', points: 35 },
      { signal: 'Manual lending/underwriting/reconciliation workflows', points: 30 },
      { signal: 'Legacy banking core connectivity / slow settlement', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Banking / NBFC license or partnership announced', points: 40 },
      { signal: 'Embedded lending / cards / insurance product launch', points: 35 },
      { signal: 'Series A/B funding for fintech expansion', points: 30 },
    ],
    antiSignals: ['In-house banking/payment gateway fully integrated', 'Fintech provider itself'],
    buyerRoles: ['CEO', 'CTO', 'Head of Fintech', 'Head of Product', 'CFO'],
    searchQueries: ['"{company}" fintech', '"{company}" embedded finance', '"{company}" lending', '{industry} fintech {location}'],
  },

  // ─── 34. AEROSPACE & DEFENSE DEEP-TECH ───
  {
    sector: 'AEROSPACE_DEFENSE_DEEPTECH',
    aliases: ['aerospace', 'defense', 'aerospace & defense / deep-tech engineering', 'deep-tech', 'avionics', 'drones', 'uav', 'precision engineering', 'space tech'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Complex subsystem development without specialized precision partners', points: 35 },
      { signal: 'Missing AS9100 / military standard certifications', points: 30 },
      { signal: 'Testing / simulation bottlenecks in hardware prototyping', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Defense procurement / government contract award', points: 40 },
      { signal: 'New R&D testing facility / flight test milestone', points: 35 },
      { signal: 'iDEX / defense grant / venture funding round', points: 35 },
    ],
    antiSignals: ['Fully vertically integrated defense prime', 'Same-category defense engineering provider'],
    buyerRoles: ['Chief Technology Officer', 'Head of R&D', 'Chief Engineer', 'Managing Director', 'Procurement Head'],
    searchQueries: ['"{company}" aerospace', '"{company}" defense contract', '"{company}" drone', '{industry} aerospace {location}'],
  },

  // ─── 35. DOCUMENT & RECORDS MANAGEMENT ───
  {
    sector: 'DOCUMENT_RECORDS_MANAGEMENT',
    aliases: ['document management', 'records services', 'document management & records services', 'digitization', 'scanning', 'records management', 'DMS', 'archiving'],
    strategy: 'ABSENCE_HUNT',
    gapSignals: [
      { signal: 'Massive physical paperwork archives without digital searchability', points: 35 },
      { signal: 'Compliance audit risk due to fragmented paper files', points: 30 },
      { signal: 'Manual data entry from physical invoices/documents', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Regulatory digitization mandate (court, healthcare, banking, tax)', points: 35 },
      { signal: 'Office relocation / branch consolidation reducing storage', points: 30 },
      { signal: 'M&A due diligence requiring complete records audit', points: 25 },
    ],
    antiSignals: ['Fully digitized cloud document management stack', 'Records management provider'],
    buyerRoles: ['Head of Administration', 'Chief Information Officer', 'Legal Head', 'Compliance Officer', 'COO'],
    searchQueries: ['"{company}" document management', '"{company}" records', '{industry} digitization {location}'],
  },

  // ─── 36. AUTOMOTIVE & MOBILITY SERVICES ───
  {
    sector: 'AUTOMOTIVE_MOBILITY',
    aliases: ['automotive', 'automotive repair', 'automotive repair & services', 'automotive / e-commerce tech', 'fleet repair', 'auto parts', 'dealerships', 'mobility tech'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Commercial fleet with unmonitored maintenance downtime', points: 35 },
      { signal: 'Automotive dealership with weak digital service booking', points: 30 },
      { signal: 'Auto parts retailer with no e-commerce catalog', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Fleet size expansion / EV fleet induction', points: 35 },
      { signal: 'New service center / dealership showroom opening', points: 30 },
      { signal: 'Auto parts supply chain digital transformation', points: 25 },
    ],
    antiSignals: ['OEM in-house service network', 'Automotive service provider'],
    buyerRoles: ['Fleet Manager', 'Managing Director', 'Service Head', 'Operations Head', 'Owner'],
    searchQueries: ['"{company}" fleet maintenance', '"{company}" automotive', '{industry} dealerships {location}'],
  },

  // ─── 37. FACILITY LANDSCAPING & GROUNDS ───
  {
    sector: 'FACILITY_LANDSCAPING',
    aliases: ['landscaping', 'gardening services', 'landscaping & gardening services', 'groundskeeping', 'horticulture', 'campus landscaping', 'indoor plant services'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Large corporate campus / tech park with untended grounds', points: 35 },
      { signal: 'Commercial property with missing landscape maintenance partner', points: 30 },
    ],
    triggerSignals: [
      { signal: 'New campus or commercial building inauguration', points: 40 },
      { signal: 'Green building / IGBC / LEED certification initiative', points: 35 },
      { signal: 'Spring / monsoon landscape rejuvenation season', points: 25 },
    ],
    antiSignals: ['In-house horticulture team', 'Integrated FM covering grounds', 'Landscaping provider'],
    buyerRoles: ['Facility Director', 'Admin Head', 'Campus Manager', 'Property Manager'],
    searchQueries: ['"{company}" campus', '"{company}" commercial building', '{industry} facility {location}'],
  },

  // ─── 38. RETAIL & SUPERMARKETS ───
  {
    sector: 'RETAIL_SUPERMARKETS',
    aliases: ['retail', 'retail & supermarkets', 'supermarkets', 'retail & luxury goods', 'grocery', 'hypermarket', 'retail chains', 'department store', 'FMCG retail'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'Supermarket chain without omnichannel / quick-commerce app', points: 35 },
      { signal: 'High inventory shrinkage / stockout complaints in reviews', points: 30 },
      { signal: 'Manual billing queues during peak footfall hours', points: 25 },
    ],
    triggerSignals: [
      { signal: 'Store chain expansion / 10+ new outlet openings', points: 40 },
      { signal: 'Omnichannel fulfillment / warehouse setup', points: 35 },
      { signal: 'Private label FMCG brand launch', points: 30 },
    ],
    antiSignals: ['Fully deployed POS & omnichannel inventory stack', 'Retail consulting provider'],
    buyerRoles: ['Retail Director', 'Managing Director', 'Chief Operating Officer', 'Procurement Head', 'Supply Chain Head'],
    searchQueries: ['"{company}" supermarket', '"{company}" retail expansion', '"{company}" new store', '{industry} retail {location}'],
  },

  // ─── 39. WIRELESS & TELECOM TESTING ───
  {
    sector: 'WIRELESS_TELECOM_TESTING',
    aliases: ['wireless engineering', 'telecom testing', 'wireless engineering and telecom testing', 'RF testing', 'spectrum analysis', '5G testing', 'device certification', 'EMC testing', 'bnn'],
    strategy: 'EVENT_TRIGGER',
    physicalEvidence: true,
    gapSignals: [
      { signal: 'IoT/Hardware device manufacturer without in-house RF/wireless test lab', points: 35 },
      { signal: 'Missing mandatory telecom/wireless regulatory certifications (TEC, WPC, FCC)', points: 30 },
    ],
    triggerSignals: [
      { signal: 'New 5G / IoT wireless hardware launch', points: 40 },
      { signal: 'Export market compliance testing required', points: 35 },
      { signal: 'Network upgrade or private 5G deployment', points: 30 },
    ],
    antiSignals: ['In-house accredited RF/EMC test lab', 'Wireless testing lab provider'],
    buyerRoles: ['Head of Hardware Engineering', 'VP QA/Testing', 'CTO', 'Compliance Head', 'R&D Director'],
    searchQueries: ['"{company}" wireless testing', '"{company}" RF compliance', '"{company}" 5G testing', '{industry} wireless {location}'],
  },
]

// ════════════════════════════════════════════════════════════════════════
// META_RULES — 30 Universal Meta-Rules
// ════════════════════════════════════════════════════════════════════════
export const META_RULES: MetaRule[] = [
  { name: 'FUNDING_RAISED', points: 35, appliesTo: ['ALL'], description: 'Recently raised capital indicates fresh budget and a growth mandate; apply across relevant categories, not as standalone proof of purchase.' },
  { name: 'RAPID_GROWTH', points: 30, appliesTo: ['ALL'], description: 'Fast revenue, customer, user, order, or footprint growth can outgrow existing systems, vendors, capacity, and operations.' },
  { name: 'STALE_PRESENCE', points: 25, appliesTo: ['ALL'], description: 'Dated websites, abandoned channels, old collateral, or visibly outdated digital assets indicate an addressable gap.' },
  { name: 'COMPETITOR_MOVE', points: 25, appliesTo: ['ALL'], description: 'A relevant competitor upgraded its product, site, certification, plant, channel, or capability, creating potential competitive pressure.' },
  { name: 'GEO_EXPANSION', points: 30, appliesTo: ['ALL'], description: 'Entry into a new city, state, country, or market creates localized operational, marketing, compliance, distribution, and staffing needs.' },
  { name: 'PRODUCT_LAUNCH', points: 30, appliesTo: ['ALL'], description: 'A new product or service can create design, marketing, distribution, software, support, compliance, and operational requirements.' },
  { name: 'REBRAND', points: 25, appliesTo: ['ALL'], description: 'A rebrand, repositioning, merger, or name change creates identity, web, content, collateral, legal, and communication needs.' },
  { name: 'TECH_ADOPTION_GAP', points: 25, appliesTo: ['ALL'], description: 'Manual, spreadsheet-heavy, fragmented, or legacy operations at meaningful scale indicate possible automation, software, data, or infrastructure needs.' },
  { name: 'REVIEW_SENTIMENT', points: 30, appliesTo: ['ALL'], description: 'Repeated public reviews identify a concrete customer-facing gap; use the specific complaint area rather than a generic requirement.' },
  { name: 'NO_DIGITAL_PRESENCE', points: 30, appliesTo: ['ALL'], description: 'A real operating business with little or no digital footprint may need broad digital enablement, but identity must first be verified.' },
  { name: 'TENDER_WIN', points: 35, appliesTo: ['ALL'], description: 'A major public or private contract can create capacity, staffing, procurement, compliance, logistics, and technology requirements.' },
  { name: 'NEW_FACILITY', points: 40, appliesTo: ['ALL'], description: 'A new plant, office, warehouse, branch, or facility creates physical, IT, security, utilities, logistics, and vendor requirements.' },
  { name: 'EXPORT_ENTRY', points: 35, appliesTo: ['ALL'], description: 'Entering export markets can create certification, freight, customs, trade finance, insurance, and compliance requirements.' },
  { name: 'HEADCOUNT_SURGE', points: 30, appliesTo: ['ALL'], description: 'Rapid hiring can create payroll, HRMS, transport, cafeteria, training, facility, recruitment, and compliance needs.' },
  { name: 'D2C_LAUNCH', points: 35, appliesTo: ['ALL'], description: 'Moving direct-to-consumer creates gateway, marketplace, catalog, packaging, last-mile, support, and digital marketing needs.' },
  { name: 'SEASONAL_WINDOW', points: 25, appliesTo: ['ALL'], description: 'A relevant seasonal or festival demand window can create time-bound marketing, staffing, logistics, inventory, and customer-operations requirements.' },
  { name: 'COMPLIANCE_DEADLINE', points: 30, appliesTo: ['ALL'], description: 'A known regulatory deadline creates dated and potentially unavoidable requirements.' },
  { name: 'ASSET_AGE', points: 25, appliesTo: ['ALL'], description: 'Aging machinery, hardware, fleet, infrastructure, or equipment can create maintenance, replacement, upgrade, and financing requirements.' },
  { name: 'LEADERSHIP_CHANGE', points: 20, appliesTo: ['ALL'], description: 'A new CXO, head, owner, or procurement leader can open a vendor-review or process-change window.' },
  { name: 'COMPLAINT_SIGNAL', points: 30, appliesTo: ['ALL'], description: 'Public complaints about a specific operational gap indicate a requirement in that exact area.' },
  { name: 'MULTI_SIGNAL_CONVERGENCE', points: 40, appliesTo: ['ALL'], description: 'Award only when multiple independent signals point to the same requirement. Do not stack duplicate mentions of the same source.' },
  { name: 'EVIDENCE_DIVERSITY', points: 20, appliesTo: ['ALL'], description: 'Increase confidence when the requirement is supported by different source types such as official company information, credible news, hiring data, reviews, filings, or public posts.' },
  { name: 'RECENCY_BOOST', points: 20, appliesTo: ['ALL'], description: 'Recent evidence should receive more weight than old evidence. Prefer current signals and reduce stale evidence unless the condition is structural.' },
  { name: 'BUYING_WINDOW', points: 30, appliesTo: ['ALL'], description: 'A requirement tied to an identifiable implementation window, launch, deadline, expansion date, contract start, or procurement cycle is more actionable.' },
  { name: 'REQUIREMENT_SPECIFICITY', points: 20, appliesTo: ['ALL'], description: 'Explicitly identify what the company likely needs and why; generic statements such as "may need marketing" should not qualify as strong evidence.' },
  { name: 'VENDOR_GAP', points: 25, appliesTo: ['ALL'], description: 'Evidence that the company lacks a suitable vendor, partner, capability, or internal owner strengthens the requirement.' },
  { name: 'DECISION_MAKER_ACCESS', points: 15, appliesTo: ['ALL'], description: 'A verified or strongly matched buyer role improves outreach readiness; it must never compensate for missing requirement evidence.' },
  { name: 'NEGATIVE_EVIDENCE', points: -35, appliesTo: ['ALL'], description: 'Strong evidence that the requirement is already solved, recently purchased, internally owned, or otherwise unnecessary reduces the score.' },
  { name: 'SOURCE_CONFLICT', points: -25, appliesTo: ['ALL'], description: 'Conflicting evidence about company identity, requirement, current vendor, or status reduces confidence until resolved.' },
  { name: 'INSUFFICIENT_EVIDENCE', points: -50, appliesTo: ['ALL'], description: 'If the core requirement cannot be supported by concrete evidence, sharply reduce the score and do not label the opportunity as interested.' },
]

// ════════════════════════════════════════════════════════════════════════
// QUALIFICATION & ACCURACY SAFEGUARDS (Production Safeguards)
// ════════════════════════════════════════════════════════════════════════
export const QUALIFICATION_SAFEGUARDS = [
  '1. Company identity must be resolved before scoring a requirement. Match legal/company name, domain, location, industry and other identifiers where available.',
  '2. One company + one concrete requirement = one opportunity. Do not create multiple leads from duplicate evidence.',
  '3. Requirement Score, Evidence Confidence, Contact Confidence and Outreach Readiness must remain separate fields.',
  '4. "Interested" requires explicit or strong buying evidence. A high score alone is not interest.',
  '5. A client possibility requires requirement + relevant timing + concrete evidence + relevant buyer role/contact. It is not a conversion guarantee.',
  '6. Anti-signals can suppress an otherwise high score. Recent proof that the need is already solved must take priority.',
  '7. Do not fabricate intent, contact details, company websites, evidence, vendor relationships, or buying activity.',
  '8. If evidence is weak or conflicting, return fewer opportunities rather than padding results.',
  '9. Use recency and source quality. Current official/company evidence should generally outrank stale or weak third-party mentions.',
  '10. Calibrate thresholds from actual EBEXTA test outcomes by sector and requirement type.',
  '11. Relevant buyer role must be inferred from the requirement and industry, then verified where possible. Never treat a generic "management team" result as a verified contact.',
  '12. If no verified requirement exists, label the result as "Insufficient evidence" rather than forcing a lead.',
]

// ════════════════════════════════════════════════════════════════════════
// RUNTIME CACHE & DATABASE SYNC
// ════════════════════════════════════════════════════════════════════════
export interface StrategyRow { id: string; name: string; description: string | null; is_builtin?: boolean }

let cachedSectors: SectorRule[] | null = null
let cachedMetas: MetaRule[] | null = null
let cachedStrategies: StrategyRow[] | null = null
let rulesLoaded = false

export function getSectorRules(): SectorRule[] {
  return cachedSectors ?? SECTOR_RULES
}

export function getMetaRules(): MetaRule[] {
  return cachedMetas ?? META_RULES
}

export function getStrategies(): StrategyRow[] {
  return cachedStrategies ?? [
    { id: 'b-absence', name: 'ABSENCE_HUNT', description: 'Find companies missing, weak in, or underdeveloped in a capability that EBEXTA can identify from observable evidence.', is_builtin: true },
    { id: 'b-event', name: 'EVENT_TRIGGER', description: 'Find companies where a concrete business event creates a likely new requirement.', is_builtin: true },
    { id: 'b-standard', name: 'STANDARD', description: 'Find explicit or strongly evidenced requirements without requiring an absence or event trigger.', is_builtin: true },
  ]
}

export async function ensureRulesLoaded(): Promise<void> {
  if (rulesLoaded && cachedSectors) return
  try {
    const [s, m, st] = await Promise.all([
      adminFetchSectors(),
      adminFetchMetas(),
      adminFetchStrategies(),
    ])
    cachedSectors = s.length > 0 ? s : SECTOR_RULES
    cachedMetas = m.length > 0 ? m : META_RULES
    cachedStrategies = st.length > 0 ? st : null
    rulesLoaded = true
  } catch (err) {
    console.warn('[EBEXTA] Error loading dynamic rules from Supabase, using built-ins:', err)
    cachedSectors = SECTOR_RULES
    cachedMetas = META_RULES
    rulesLoaded = true
  }
}

// ════════════════════════════════════════════════════════════════════════
// DATABASE CRUD OPS
// ════════════════════════════════════════════════════════════════════════
export async function adminFetchSectors(): Promise<SectorRule[]> {
  try {
    const { data, error } = await supabase
      .from('sector_rules')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error || !data) return []
    return data.map((r: any) => ({
      id: r.id,
      sector: r.sector,
      aliases: r.aliases ?? [],
      strategy: r.strategy ?? 'STANDARD',
      gapSignals: r.gap_signals ?? [],
      triggerSignals: r.trigger_signals ?? [],
      antiSignals: r.anti_signals ?? [],
      buyerRoles: r.buyer_roles ?? [],
      searchQueries: r.search_queries ?? [],
      physicalEvidence: !!r.physical_evidence,
      sortOrder: r.sort_order,
    }))
  } catch { return [] }
}

export async function adminFetchMetas(): Promise<MetaRule[]> {
  try {
    const { data, error } = await supabase
      .from('meta_rules')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error || !data) return []
    return data.map((m: any) => ({
      id: m.id,
      name: m.name,
      points: m.points ?? 20,
      description: m.description ?? '',
      appliesTo: m.applies_to ?? ['ALL'],
      sortOrder: m.sort_order,
    }))
  } catch { return [] }
}

export async function adminFetchStrategies(): Promise<StrategyRow[]> {
  try {
    const { data, error } = await supabase
      .from('rule_strategies')
      .select('*')
      .order('name', { ascending: true })
    if (error || !data) return []
    return data
  } catch { return [] }
}

export async function saveSector(rule: SectorRule): Promise<{ error: string | null }> {
  try {
    const payload = {
      sector: rule.sector.toUpperCase().replace(/\s+/g, '_'),
      aliases: rule.aliases,
      strategy: rule.strategy,
      gap_signals: rule.gapSignals,
      trigger_signals: rule.triggerSignals,
      anti_signals: rule.antiSignals,
      buyer_roles: rule.buyerRoles,
      search_queries: rule.searchQueries,
      physical_evidence: !!rule.physicalEvidence,
    }
    const { error } = rule.id
      ? await supabase.from('sector_rules').update(payload).eq('id', rule.id)
      : await supabase.from('sector_rules').upsert(payload, { onConflict: 'sector' })
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Save failed' }
  }
}

export async function removeSector(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('sector_rules').delete().eq('id', id)
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Delete failed' }
  }
}

export async function saveMeta(meta: MetaRule): Promise<{ error: string | null }> {
  try {
    const payload = {
      name: meta.name.toUpperCase().replace(/\s+/g, '_'),
      points: meta.points,
      description: meta.description,
      applies_to: meta.appliesTo,
    }
    const { error } = meta.id
      ? await supabase.from('meta_rules').update(payload).eq('id', meta.id)
      : await supabase.from('meta_rules').upsert(payload, { onConflict: 'name' })
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Save failed' }
  }
}

export async function removeMeta(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('meta_rules').delete().eq('id', id)
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Delete failed' }
  }
}

export async function addStrategy(name: string, description: string): Promise<{ error: string | null }> {
  try {
    const clean = name.toUpperCase().replace(/\s+/g, '_')
    const { error } = await supabase.from('rule_strategies').upsert({ name: clean, description }, { onConflict: 'name' })
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Failed to add strategy' }
  }
}

export async function removeStrategy(id: string): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase.from('rule_strategies').delete().eq('id', id)
    if (!error) {
      rulesLoaded = false
      await ensureRulesLoaded()
    }
    return { error: error ? error.message : null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Failed to delete strategy' }
  }
}

/** Seed the database tables with the complete 30-sector, 30-meta production rules */
export async function seedBuiltins(): Promise<{ error: string | null }> {
  try {
    // 1. Strategies
    const defaultStrats = [
      { name: 'ABSENCE_HUNT', description: 'Find companies missing, weak in, or underdeveloped in a capability that EBEXTA can identify from observable evidence.', is_builtin: true },
      { name: 'EVENT_TRIGGER', description: 'Find companies where a concrete business event creates a likely new requirement.', is_builtin: true },
      { name: 'STANDARD', description: 'Find explicit or strongly evidenced requirements without requiring an absence or event trigger.', is_builtin: true },
    ]
    for (const st of defaultStrats) {
      await supabase.from('rule_strategies').upsert(st, { onConflict: 'name' })
    }

    // 2. Metas
    for (let i = 0; i < META_RULES.length; i++) {
      const m = META_RULES[i]
      await supabase.from('meta_rules').upsert({
        name: m.name,
        points: m.points,
        description: m.description,
        applies_to: m.appliesTo,
        is_builtin: true,
        sort_order: i + 1,
      }, { onConflict: 'name' })
    }

    // 3. Sectors
    for (let i = 0; i < SECTOR_RULES.length; i++) {
      const s = SECTOR_RULES[i]
      await supabase.from('sector_rules').upsert({
        sector: s.sector,
        aliases: s.aliases,
        strategy: s.strategy,
        gap_signals: s.gapSignals,
        trigger_signals: s.triggerSignals,
        anti_signals: s.antiSignals,
        buyer_roles: s.buyerRoles,
        search_queries: s.searchQueries,
        physical_evidence: !!s.physicalEvidence,
        is_builtin: true,
        sort_order: i + 1,
      }, { onConflict: 'sector' })
    }

    rulesLoaded = false
    await ensureRulesLoaded()
    return { error: null }
  } catch (err) {
    return { error: (err as Error)?.message ?? 'Seed failed' }
  }
}

// ════════════════════════════════════════════════════════════════════════
// RESOLUTION ENGINE
// ════════════════════════════════════════════════════════════════════════
export interface ResolvedSector {
  rule: SectorRule | null
  matched: boolean
  strategy: string
  metaRules: MetaRule[]
  ties: string[]
  serviceText: string
  resolvedSector?: string
  sectorConfidence?: 'matched' | 'nearest_fallback' | 'unmatched'
}

export interface TaxonomyRow {
  id?: string
  branch: string
  sub_category: string
  seeker_profile: string
  loophole_signal: string
  signal_source: string
  verifiability: string
  registry_backed: boolean
  notes?: string
}

function aliasOverlap(text: string, rule: SectorRule): number {
  const t = text.toLowerCase()
  let score = 0
  for (const a of rule.aliases) {
    const al = a.toLowerCase()
    if (t.includes(al)) score += Math.min(3, al.split(/\s+/).length)
  }
  const sectorWords = rule.sector.toLowerCase().replace(/_/g, ' ')
  if (t.includes(sectorWords)) score += 1
  return score
}

export function resolveSectorRule(serviceText: string): ResolvedSector {
  const text = (serviceText ?? '').trim()
  const base: ResolvedSector = {
    rule: null,
    matched: false,
    strategy: 'STANDARD',
    metaRules: getMetaRules(),
    ties: [],
    serviceText: text,
    resolvedSector: 'UNRESOLVED',
    sectorConfidence: 'unmatched',
  }
  if (!text) return base

  const scored = getSectorRules()
    .map(rule => ({ rule, score: aliasOverlap(text, rule) }))
    .filter(s => s.score > 0)
    .sort((a, b) => b.score - a.score)

  if (scored.length > 0) {
    const top = scored[0]
    return {
      rule: top.rule,
      matched: true,
      strategy: top.rule.strategy,
      metaRules: getMetaRules(),
      ties: scored.filter(s => s.score === top.score).map(s => s.rule.sector),
      serviceText: text,
      resolvedSector: top.rule.sector,
      sectorConfidence: 'matched',
    }
  }

  return base
}

export function resolveSectorRuleForProduct(productProfile: { ideal_buyer?: { industries?: string[] } }, fallbackText: string): ResolvedSector {
  const industries = productProfile.ideal_buyer?.industries ?? []
  for (const ind of industries) {
    const res = resolveSectorRule(ind)
    if (res.matched) return res
  }
  return resolveSectorRule(fallbackText)
}

/**
 * Format a resolved sector rule into prompt instructions for grounded discovery & enrichment.
 */
export function buildRulePromptBlock(resolved: ResolvedSector): string {
  const { rule, strategy } = resolved
  if (!rule) {
    return `GENERAL REQUIREMENT-HUNTING DIRECTIVE:
Look for companies with clear, evidenced demand signals for this service.
- Priority: companies experiencing growth, hiring surges, expansion, or public gaps in this domain.`
  }

  const gapLines = rule.gapSignals.map(g => `- ${g.signal} (+${g.points} pts)`).join('\n')
  const trigLines = rule.triggerSignals.map(t => `- ${t.signal} (+${t.points} pts)`).join('\n')
  const antiLines = rule.antiSignals.map(a => `- EXCLUDE: ${a}`).join('\n')
  const roleLines = rule.buyerRoles.length > 0 ? `Target Decision-Maker Roles: ${rule.buyerRoles.join(', ')}` : ''

  return `SECTOR PRECISION HUNTING RULE [${rule.sector} — Strategy: ${strategy}]:
${rule.physicalEvidence ? 'PHYSICAL / EVENT-TRIGGER EVIDENCE MODE: Focus on public news, tenders, facility openings, capacity expansions, and operational notices.' : 'DIGITAL GAP & EVENT MODE: Focus on digital footprint gaps, website quality, channel gaps, and recent business trigger events.'}

${roleLines}

GAP SIGNALS (Points awarded when evidenced):
${gapLines}

TRIGGER SIGNALS (Points awarded when evidenced):
${trigLines}

ANTI-SIGNALS (Strict Exclusions):
${antiLines}`
}
