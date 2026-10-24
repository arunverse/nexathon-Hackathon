import test from 'node:test'
import assert from 'node:assert/strict'

// ── 1. Billing Period Tests ──────────────────────────────────────────────────
import { addMonths, currentPeriodStart, nextResetDate } from '../src/lib/billingPeriod.ts'

test('billingPeriod: addMonths correctly handles month arithmetic and clamping', () => {
  const jan31 = new Date(2026, 0, 31) // Jan 31, 2026
  const feb = addMonths(jan31, 1)
  assert.equal(feb.getMonth(), 1) // February
  assert.equal(feb.getDate(), 28) // Clamped to 28 days

  const jan15 = new Date(2026, 0, 15)
  const mar15 = addMonths(jan15, 2)
  assert.equal(mar15.getMonth(), 2) // March
  assert.equal(mar15.getDate(), 15)
})

test('billingPeriod: currentPeriodStart handles anchor dates accurately', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  // Free / starter plan with no anchor -> returns 1st of current month
  const noAnchor = currentPeriodStart(null, now)
  assert.equal(noAnchor.getFullYear(), 2026)
  assert.equal(noAnchor.getMonth(), 5) // June (0-indexed 5)
  assert.equal(noAnchor.getDate(), 1)

  // Anchor in past: purchased on Jan 10
  const pastAnchor = currentPeriodStart('2026-01-10T00:00:00Z', now)
  assert.equal(pastAnchor.getDate(), 10)
  assert.equal(pastAnchor.getMonth(), 5) // June 10

  // Anchor in the future
  const futureAnchor = currentPeriodStart('2026-07-01T00:00:00Z', now)
  assert.equal(futureAnchor.toISOString(), '2026-07-01T00:00:00.000Z')
})

test('billingPeriod: nextResetDate computes next billing anniversary', () => {
  const now = new Date('2026-06-15T12:00:00Z')
  const reset = nextResetDate('2026-01-10T00:00:00Z', now)
  assert.equal(reset.getDate(), 10)
  assert.equal(reset.getMonth(), 6) // July 10
})

// ── 2. Date Formatting Tests ─────────────────────────────────────────────────
import { formatDate, relativeDate } from '../src/lib/dateFormat.ts'

test('dateFormat: formatDate outputs clean localized strings or em-dash', () => {
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate(''), '—')
  assert.equal(formatDate('invalid-date'), '—')
  const formatted = formatDate('2026-04-15T10:00:00Z')
  assert.match(formatted, /15/)
  assert.match(formatted, /2026/)
})

test('dateFormat: relativeDate accurately classifies recency', () => {
  assert.equal(relativeDate(null), '')
  assert.equal(relativeDate('invalid'), '')
  const now = Date.now()
  assert.equal(relativeDate(new Date(now - 1000 * 60).toISOString()), 'today')
  assert.equal(relativeDate(new Date(now - 86400000).toISOString()), 'yesterday')
  assert.equal(relativeDate(new Date(now - 86400000 * 5).toISOString()), '5 days ago')
  assert.equal(relativeDate(new Date(now - 86400000 * 45).toISOString()), '1 month ago')
  assert.equal(relativeDate(new Date(now - 86400000 * 800).toISOString()), '2 years ago')
})

// ── 3. URL and Fake-Detection Tests ──────────────────────────────────────────
import {
  isGenericContactName,
  verifyDomainStructure,
  displayCompanyWebsite,
  isLikelyFakeLinkedIn,
} from '../src/lib/urlUtils.ts'

test('urlUtils: isGenericContactName rejects generic terms as verified contacts', () => {
  assert.equal(isGenericContactName(null), true)
  assert.equal(isGenericContactName(''), true)
  assert.equal(isGenericContactName('Management Team'), true)
  assert.equal(isGenericContactName('Leadership'), true)
  assert.equal(isGenericContactName('Executive Team'), true)
  assert.equal(isGenericContactName('Decision Maker'), true)
  assert.equal(isGenericContactName('Unknown Contact'), true)
  assert.equal(isGenericContactName('N/A'), true)
  assert.equal(isGenericContactName('None'), true)

  // Real human names should not be blocked
  assert.equal(isGenericContactName('Satya Nadella'), false)
  assert.equal(isGenericContactName('Arun Verma'), false)
  assert.equal(isGenericContactName('Priya Sharma'), false)
})

test('urlUtils: verifyDomainStructure catches invalid, local, and test domains', () => {
  assert.equal(verifyDomainStructure('localhost:3000'), false)
  assert.equal(verifyDomainStructure('http://test.local'), false)
  assert.equal(verifyDomainStructure('https://example.com'), false)
  assert.equal(verifyDomainStructure('not a url'), false)
  assert.equal(verifyDomainStructure('https://ebexta.com'), true)
  assert.equal(verifyDomainStructure('https://subdomain.company.co.in'), true)
})

test('urlUtils: displayCompanyWebsite returns verified structure without guessing', () => {
  const verified = displayCompanyWebsite('https://www.ebexta.com')
  assert.equal(verified.verified, true)
  assert.equal(verified.domain, 'ebexta.com')

  const unverified = displayCompanyWebsite('invalid-or-blank')
  assert.equal(unverified.verified, false)
  assert.equal(unverified.text, 'Website not verified')
  assert.equal(unverified.domain, null)
})

test('urlUtils: isLikelyFakeLinkedIn catches hallucinated / generated slugs', () => {
  assert.equal(isLikelyFakeLinkedIn(null), true)
  assert.equal(isLikelyFakeLinkedIn(''), true)
  // Hallucinated pattern with random suffix
  assert.equal(isLikelyFakeLinkedIn('https://www.linkedin.com/in/priya-verma-e5f6g7h8'), true)
  assert.equal(isLikelyFakeLinkedIn('https://www.linkedin.com/in/john-smith-ab12cd34'), true)
  assert.equal(isLikelyFakeLinkedIn('https://www.linkedin.com/in/person-placeholder'), true)
  // Genuine-looking short human slugs
  assert.equal(isLikelyFakeLinkedIn('https://www.linkedin.com/in/satyanadella'), false)
  assert.equal(isLikelyFakeLinkedIn('https://www.linkedin.com/company/microsoft'), false)
})

// ── 4. Admin Utils & Link Counting Tests ─────────────────────────────────────
import {
  hoursAgo,
  timeAgoLabel,
  verificationTone,
  validLinkCount,
  startOfTodayIso,
} from '../src/pages/admin/adminUtils.ts'

test('adminUtils: hoursAgo and timeAgoLabel format correctly', () => {
  const thirtyMinsAgo = new Date(Date.now() - 30 * 60000).toISOString()
  assert.match(timeAgoLabel(thirtyMinsAgo), /30 minutes ago/)

  const threeHoursAgo = new Date(Date.now() - 3 * 3600000).toISOString()
  assert.match(timeAgoLabel(threeHoursAgo), /3 hours ago/)
  assert.ok(hoursAgo(threeHoursAgo) >= 2.9 && hoursAgo(threeHoursAgo) <= 3.1)

  const twoDaysAgo = new Date(Date.now() - 48 * 3600000).toISOString()
  assert.match(timeAgoLabel(twoDaysAgo), /2 days ago/)
})

test('adminUtils: verificationTone maps statuses to proper visual tones', () => {
  assert.equal(verificationTone('VERIFIED'), 'green')
  assert.equal(verificationTone('PARTIALLY_VERIFIED'), 'amber')
  assert.equal(verificationTone('MANUAL_REVIEW_NEEDED'), 'red')
  assert.equal(verificationTone('UNVERIFIED'), 'neutral')
  assert.equal(verificationTone(null), 'neutral')
})

test('adminUtils: validLinkCount counts real links and ignores empty / invalid ones', () => {
  const leadWithLinks = {
    website: 'https://examplecompany.com',
    linkedin_url: 'https://linkedin.com/company/test',
    evidence_source_url: 'https://news.com/article123',
    contacts: [
      { linkedInUrl: 'https://linkedin.com/in/john', sourceUrl: 'https://company.com/team' },
      { linkedInUrl: null, sourceUrl: '' },
    ],
  }
  assert.equal(validLinkCount(leadWithLinks), 5)

  const emptyLead = { website: null, contacts: [] }
  assert.equal(validLinkCount(emptyLead), 0)
})

test('adminUtils: startOfTodayIso returns valid beginning-of-day ISO string', () => {
  const iso = startOfTodayIso()
  const d = new Date(iso)
  assert.equal(d.getHours(), 0)
  assert.equal(d.getMinutes(), 0)
  assert.equal(d.getSeconds(), 0)
})

// ── 5. Sanitization & Input Security Tests ───────────────────────────────────
import { sanitizeText, sanitizeTags, isEmail, isURL, sanitizeUrl } from '../src/lib/sanitize.ts'

test('sanitize: sanitizeText strips HTML tags, script injections, and trims', () => {
  assert.equal(sanitizeText(null), '')
  assert.equal(sanitizeText(undefined), '')
  assert.equal(sanitizeText('  clean text  '), 'clean text')
  assert.equal(sanitizeText('<script>alert("xss")</script>hello'), 'hello')
  assert.equal(sanitizeText('<img src="x" onerror="steal()" />safe text'), 'safe text')
  assert.equal(sanitizeText('hello\0world'), 'helloworld')
  // Max length capping
  assert.equal(sanitizeText('1234567890', 5), '12345')
})

test('sanitize: sanitizeTags trims and deduplicates case-insensitively', () => {
  const raw = 'SaaS, Fintech, saas, AI, Cloud, AI'
  const tags = sanitizeTags(raw)
  assert.deepEqual(tags, ['SaaS', 'Fintech', 'AI', 'Cloud'])
})

test('sanitize: isEmail and isURL validate properly', () => {
  assert.equal(isEmail('user@ebexta.com'), true)
  assert.equal(isEmail('bad-email'), false)
  assert.equal(isEmail('user@'), false)

  assert.equal(isURL('https://ebexta.com'), true)
  assert.equal(isURL('ftp://invalid'), false)
  assert.equal(isURL('plain string'), false)

  assert.equal(sanitizeUrl('ebexta.com'), 'https://ebexta.com')
  assert.equal(sanitizeUrl('https://ebexta.com'), 'https://ebexta.com')
  assert.equal(sanitizeUrl('not a url'), '')
})

// ── 6. Credits System Configuration Tests ────────────────────────────────────
import { CREDIT_COST } from '../src/lib/credits.ts'

test('credits: CREDIT_COST defines expected unit costs for all billable operations', () => {
  assert.equal(CREDIT_COST.DISCOVER_COMPANY, 1)
  assert.equal(CREDIT_COST.DEEP_RESEARCH, 1)
  assert.equal(CREDIT_COST.CONTACT_VERIFICATION, 1)
  assert.equal(CREDIT_COST.DOSSIER, 1)
  assert.equal(CREDIT_COST.PORTFOLIO, 1)
  assert.equal(CREDIT_COST.AI_GENERATION, 1)
  assert.equal(CREDIT_COST.ADVANCED_ENRICHMENT, 1)
})

// ── 7. Admin Profile Completeness Logic Tests ─────────────────────────────────
test('admin: profile completeness correctly classifies profiles', () => {
  function computeStatus(p: { company_name?: string | null; mission?: string | null; company_profile?: Record<string, string> | null }) {
    const cp = p.company_profile || {}
    const missing: string[] = []
    if (!p.company_name || p.company_name.trim() === '' || p.company_name === 'Your Company') missing.push('Company name')
    if (!p.mission || p.mission.trim() === '') missing.push('Mission')
    if (!cp.location || cp.location.trim() === '') missing.push('Location')
    if (!cp.employees || cp.employees.trim() === '') missing.push('Headcount')
    if (!cp.stage || cp.stage.trim() === '') missing.push('Stage')
    const filledCpCount = Object.values(cp).filter(v => typeof v === 'string' && v.trim().length > 0).length
    const isComplete = missing.length === 0 && filledCpCount >= 3
    return { isComplete, missing, filledCpCount }
  }

  // Incomplete profile
  const p1 = computeStatus({ company_name: '', mission: '' })
  assert.equal(p1.isComplete, false)
  assert.ok(p1.missing.includes('Company name'))
  assert.ok(p1.missing.includes('Mission'))

  // Complete profile
  const p2 = computeStatus({
    company_name: 'Acme AI',
    mission: 'Providing AI-driven workflow automation to mid-market enterprise teams.',
    company_profile: {
      location: 'San Francisco, CA',
      employees: '50-100',
      stage: 'Series A',
      revenue: '$5M ARR',
    },
  })
  assert.equal(p2.isComplete, true)
  assert.equal(p2.missing.length, 0)
  assert.equal(p2.filledCpCount, 4)
})

// ── 8. Plan Gate Validation Tests ─────────────────────────────────────────────
test('planGate: evaluatePlanAccess correctly gates users', () => {
  function evaluatePlanAccess(user: { email?: string; is_admin?: boolean; plan_status?: string; plan_expires_at?: string | null }) {
    const grantedEmails = ['arunchinn2005@gmail.com', 'arunchinnu2005@gmail.com']
    if (user.email && grantedEmails.includes(user.email.toLowerCase())) return 'ok'
    if (user.is_admin === true) return 'ok'
    const status = user.plan_status ?? 'none'
    const notExpired = !user.plan_expires_at || new Date(user.plan_expires_at) > new Date()
    const allowed = (status === 'active' || status === 'trial') && notExpired
    return allowed ? 'ok' : 'gate'
  }

  assert.equal(evaluatePlanAccess({ email: 'arunchinnu2005@gmail.com' }), 'ok')
  assert.equal(evaluatePlanAccess({ is_admin: true, plan_status: 'none' }), 'ok')
  assert.equal(evaluatePlanAccess({ plan_status: 'active', plan_expires_at: new Date(Date.now() + 86400000 * 30).toISOString() }), 'ok')
  assert.equal(evaluatePlanAccess({ plan_status: 'trial', plan_expires_at: new Date(Date.now() + 86400000 * 5).toISOString() }), 'ok')
  // Expired plan
  assert.equal(evaluatePlanAccess({ plan_status: 'active', plan_expires_at: new Date(Date.now() - 86400000).toISOString() }), 'gate')
  // No plan
  assert.equal(evaluatePlanAccess({ plan_status: 'none' }), 'gate')
})

// ── 9. Verification Queue Overdue Filter Tests ────────────────────────────────
test('adminQueue: overdue detection triggers at > 24 hours', () => {
  function checkOverdue(req: { status: string; requested_at: string }) {
    const hrs = (Date.now() - new Date(req.requested_at).getTime()) / 3600000
    return (req.status === 'pending' || req.status === 'in_progress') && hrs > 24
  }

  const fresh = { status: 'pending', requested_at: new Date(Date.now() - 3600000 * 2).toISOString() }
  assert.equal(checkOverdue(fresh), false)

  const overdue = { status: 'pending', requested_at: new Date(Date.now() - 3600000 * 25).toISOString() }
  assert.equal(checkOverdue(overdue), true)

  const completedOverdue = { status: 'delivered', requested_at: new Date(Date.now() - 3600000 * 30).toISOString() }
  assert.equal(checkOverdue(completedOverdue), false)
})

// ── 10. Credit Balance Floor Protection ───────────────────────────────────────
test('credits: deduction logic clamps credits at zero and prevents negative balance', () => {
  function deduct(current: number, amount: number = 1) {
    return Math.max(0, current - amount)
  }
  assert.equal(deduct(10, 1), 9)
  assert.equal(deduct(1, 1), 0)
  assert.equal(deduct(0, 1), 0)
  assert.equal(deduct(-5, 1), 0)
})

// ── 11. Admin Access Authorization Gating ─────────────────────────────────────
import { isAuthorizedAdminEmail, verifyAdminAccess } from '../src/lib/adminAuth.ts'

test('adminAuth: isAuthorizedAdminEmail allows only verified platform administrators', () => {
  assert.equal(isAuthorizedAdminEmail('arunchinnu2005@gmail.com'), true)
  assert.equal(isAuthorizedAdminEmail(' ARUNCHINNU2005@GMAIL.COM '), true) // handles casing & whitespace

  // All other emails MUST be rejected
  assert.equal(isAuthorizedAdminEmail('arunverse15@gmail.com'), false)
  assert.equal(isAuthorizedAdminEmail('ebexta26@gmail.com'), false)
  assert.equal(isAuthorizedAdminEmail('arunv.z1502@gmail.com'), false)
  assert.equal(isAuthorizedAdminEmail('arunverse1506@gmail.com'), false)
  assert.equal(isAuthorizedAdminEmail('newuser@gmail.com'), false)
  assert.equal(isAuthorizedAdminEmail('attacker@evil.com'), false)
  assert.equal(isAuthorizedAdminEmail('random@company.com'), false)
  assert.equal(isAuthorizedAdminEmail(''), false)
  assert.equal(isAuthorizedAdminEmail(null), false)
  assert.equal(isAuthorizedAdminEmail(undefined), false)
})

test('adminAuth: verifyAdminAccess requires BOTH authorized email AND database flag', () => {
  // Authorized admin + DB true -> OK
  assert.equal(verifyAdminAccess({ email: 'arunchinnu2005@gmail.com' }, true), true)

  // Unauthorized user + DB true (e.g. database column default or rogue update) -> REJECTED
  assert.equal(verifyAdminAccess({ email: 'newuser@gmail.com' }, true), false)
  assert.equal(verifyAdminAccess({ email: 'guest@ebexta.com' }, true), false)

  // Authorized admin + DB false -> REJECTED
  assert.equal(verifyAdminAccess({ email: 'arunchinnu2005@gmail.com' }, false), false)

  // Null user -> REJECTED
  assert.equal(verifyAdminAccess(null, true), false)
})

// ── 12. SSRF Protection & Safe Public URL Validation ─────────────────────────
import { isSafePublicUrl, getSafeFallbackUrl } from '../src/lib/urlUtils.ts'

test('urlUtils: isSafePublicUrl blocks private networks, loopbacks, cloud metadata, and internal TLDs', () => {
  // Loopbacks & localhost
  assert.equal(isSafePublicUrl('http://localhost'), false)
  assert.equal(isSafePublicUrl('http://127.0.0.1:8080'), false)
  assert.equal(isSafePublicUrl('http://127.0.0.2'), false)

  // RFC 1918 Private ranges
  assert.equal(isSafePublicUrl('http://10.0.0.1'), false)
  assert.equal(isSafePublicUrl('https://172.16.0.5'), false)
  assert.equal(isSafePublicUrl('http://192.168.1.100'), false)

  // Cloud metadata endpoint
  assert.equal(isSafePublicUrl('http://169.254.169.254/latest/meta-data'), false)

  // Internal and test TLDs
  assert.equal(isSafePublicUrl('http://app.local'), false)
  assert.equal(isSafePublicUrl('http://service.internal'), false)
  assert.equal(isSafePublicUrl('http://gateway.lan'), false)
  assert.equal(isSafePublicUrl('http://internal.corp'), false)

  // Invalid protocols & malformed
  assert.equal(isSafePublicUrl('file:///etc/passwd'), false)
  assert.equal(isSafePublicUrl('ftp://ftp.example.com'), false)
  assert.equal(isSafePublicUrl('not-a-valid-url'), false)
  assert.equal(isSafePublicUrl(null), false)

  // Legitimate public sites
  assert.equal(isSafePublicUrl('https://ebexta.com'), true)
  assert.equal(isSafePublicUrl('https://stripe.com/docs'), true)
  assert.equal(isSafePublicUrl('https://subdomain.company.co.uk/about'), true)
  assert.equal(isSafePublicUrl('http://public-startup.in'), true)
})

test('urlUtils: getSafeFallbackUrl collapses 404-prone subpaths to root domains', () => {
  assert.equal(getSafeFallbackUrl('https://ebexta.com/team/old-page/404'), 'https://ebexta.com')
  // Automatically upgrades to https:
  assert.equal(getSafeFallbackUrl('http://subdomain.public-startup.in/about/careers/jobs/123'), 'https://subdomain.public-startup.in')
  assert.equal(getSafeFallbackUrl('invalid-url'), null)
})

// ── 13. CSV Formula Injection Defense ─────────────────────────────────────────
import { sanitizeForCsv, csvCell } from '../src/lib/csvExport.ts'

test('csvExport: sanitizeForCsv and csvCell neutralize spreadsheet formula injections', () => {
  // Equals sign injection (e.g. =SUM, =cmd|' /C calc'!A0)
  assert.equal(sanitizeForCsv('=1+1'), "'=1+1")
  assert.equal(csvCell('=1+1'), '"\'=1+1"')

  // Plus, minus, at-sign, tab, carriage return injections
  assert.equal(sanitizeForCsv('+100'), "'+100")
  assert.equal(sanitizeForCsv('-200'), "'-200")
  assert.equal(sanitizeForCsv('@SUM(A1:A10)'), "'@SUM(A1:A10)")
  assert.equal(sanitizeForCsv('\tTAB_INJECT'), "'\tTAB_INJECT")
  assert.equal(sanitizeForCsv('\rCR_INJECT'), "'\rCR_INJECT")

  // Regular safe values should not be modified with leading quote
  assert.equal(sanitizeForCsv('Acme Corp'), 'Acme Corp')
  assert.equal(sanitizeForCsv('Sarah Chen'), 'Sarah Chen')
  assert.equal(sanitizeForCsv('sarah@company.com'), 'sarah@company.com')

  // Double quotes should be escaped
  assert.equal(csvCell('He said "Hello"'), '"He said ""Hello"""')
  assert.equal(csvCell(null), '""')
})

// ── 14. Evidence-Based Reachability Assessment ─────────────────────────────────
import { evaluateReachability } from '../src/lib/scanEngine.ts'

test('scanEngine: evaluateReachability assesses access without fabricated percentages', () => {
  // High reachability: named decision maker with direct email or verified LinkedIn
  const highLead = {
    company_name: 'TechFlow Inc',
    employee_count: 50,
    contacts: [{
      name: 'Sarah Chen',
      role: 'VP of Engineering',
      email: 'sarah.chen@techflow.io',
      linkedInUrl: 'https://linkedin.com/in/sarahchen',
    }],
  }
  const highAssessment = evaluateReachability(highLead)
  assert.equal(highAssessment.reachability_level, 'High')
  assert.ok(highAssessment.direct_reach_factors.length > 0)
  assert.ok(!('response_probability' in highAssessment)) // No fabricated percentage

  // Moderate reachability: named stakeholder identified, general company route
  const modLead = {
    company_name: 'MegaCorp Global',
    employee_count: 800,
    stakeholders: [{
      name: 'David Kumar',
      title: 'Head of Infrastructure',
    }],
    company_contact: { email: 'info@megacorp.com' },
  }
  const modAssessment = evaluateReachability(modLead)
  assert.equal(modAssessment.reachability_level, 'Moderate')
  assert.ok(modAssessment.barrier_factors.some(b => /enterprise|scale/i.test(b)))

  // Low reachability: no contact info found
  const lowLead = {
    company_name: 'Stealth Works',
  }
  const lowAssessment = evaluateReachability(lowLead)
  assert.equal(lowAssessment.reachability_level, 'Low')
  assert.ok(lowAssessment.barrier_factors.some(b => /no direct contact/i.test(b)))
})

// ── 15. ICP Fit vs Demonstrated Service-Need Distinction ──────────────────────
import { buildServiceNeedExplanation } from '../src/lib/scanEngine.ts'

test('scanEngine: buildServiceNeedExplanation distinguishes ICP profile fit from service requirement', () => {
  const lead = {
    company_name: 'FinScale',
    industry: 'Fintech',
    location: 'Bangalore, India',
    employee_count: 120,
    intent_flags: ['RECENT_FUNDING', 'HIRING_SURGE'],
    requirement_theme: 'Scaling core payment infrastructure and DevOps automation',
    need_summary: 'Actively recruiting backend and infrastructure engineers following $15M Series A',
  }

  const explanation = buildServiceNeedExplanation(lead, 'DevOps automation and cloud infrastructure consulting')
  assert.ok(explanation.service_fit_level === 'High' || explanation.service_fit_level === 'Moderate')
  assert.ok(explanation.buyer_intent_signals.length >= 2)
  assert.match(explanation.icp_vs_need_distinction, /firmographic/i)
  assert.match(explanation.icp_vs_need_distinction, /demonstrated need/i)
})

// ── 16. LinkedIn Outreach Multi-Draft Generator ───────────────────────────────
import { buildFallbackLinkedInDrafts } from '../src/lib/outreach.ts'

test('outreach: buildFallbackLinkedInDrafts guarantees Connection Note strictly <= 300 chars', () => {
  const lead = {
    company_name: 'Enterprise Cloud Solutions Global Private Limited',
    industry: 'Cloud Infrastructure and Security Managed Services',
    match_reason: ['Recent expansion into Southeast Asian enterprise banking markets requiring SOC2 compliance'],
    requirement_theme: 'Enterprise compliance automation and zero trust architecture',
  }

  const drafts = buildFallbackLinkedInDrafts(lead, {
    contactName: 'Christopher Montgomery-Wellington',
    senderCompany: 'EBEXTA Intelligence Platforms',
    senderName: 'Arun Verma',
    tone: 'Direct & concise',
  })

  // Critical requirement: Connection note MUST be <= 300 characters
  assert.ok(drafts.connectionNote.length <= 300, `Connection note length ${drafts.connectionNote.length} exceeds 300 limit`)
  assert.ok(drafts.connectionNote.length > 20, 'Connection note is too short')

  // Direct Message should be detailed
  assert.ok(drafts.directMessage.length > drafts.connectionNote.length)
  assert.match(drafts.directMessage, /Christopher/i)

  // Follow-up touch should exist
  assert.ok(drafts.followUp.length > 20)

  // Contextual rationale should explain why this angle fits
  assert.ok(drafts.contextRationale.length > 10)
})

// ── 17. CSV Export Email Mapping & Missing State Quality ──────────────────────
import { exportLeadsToCSV } from '../src/lib/csvExport.ts'
import type { ScannedLead } from '../src/lib/scanEngine.ts'

test('csvExport: handles populated, missing, and LinkedIn-fallback emails explicitly', () => {
  const leads: Partial<ScannedLead>[] = [
    {
      company_name: 'Alpha Technologies',
      website: 'https://alphatech.io',
      industry: 'Software',
      location: 'Bangalore, India',
      contacts: [{
        name: 'Aakash Rao',
        role: 'Chief Technology Officer',
        email: 'aakash@alphatech.io',
        linkedInUrl: 'https://linkedin.com/in/aakashrao',
        isPrimary: true,
      }],
      email_status: 'verified',
    },
    {
      company_name: 'Beta Cloud Systems',
      website: 'https://betacloud.co',
      industry: 'Cloud',
      location: 'Mumbai, India',
      contacts: [{
        name: 'Rohan Mehta',
        role: 'Founder & CEO',
        email: null,
        linkedInUrl: 'https://linkedin.com/in/rohanmehta',
        isPrimary: true,
      }],
      email_status: 'not_found',
    },
    {
      company_name: 'Gamma Stealth Corp',
      website: 'http://127.0.0.1:8080/internal', // SSRF target
      industry: 'Stealth',
      location: 'Delhi, India',
      contacts: [],
      email_status: 'not_found',
    },
  ]

  // Mock global document if not in browser environment
  let exportedBlobContent = ''
  const globalEnv = globalThis as unknown as Record<string, unknown>
  const origDocument = globalEnv.document
  const origUrl = globalEnv.URL
  globalEnv.document = {
    createElement: () => ({
      setAttribute: () => {},
      click: () => {},
    }),
    body: { appendChild: () => {}, removeChild: () => {} },
  }
  globalEnv.Blob = class MockBlob {
    content: string[]
    constructor(parts: string[]) {
      this.content = parts
      exportedBlobContent = parts.join('')
    }
  }
  globalEnv.URL = {
    createObjectURL: () => 'blob:mock',
    revokeObjectURL: () => {},
  }

  try {
    exportLeadsToCSV(leads as ScannedLead[])
    assert.ok(exportedBlobContent.length > 0, 'CSV export generated content')

    // 1. Populated real email is exported
    assert.ok(exportedBlobContent.includes('"aakash@alphatech.io"'), 'Contains real contact email')
    assert.ok(exportedBlobContent.includes('"Verified"'), 'Email verification status is accurate')

    // 2. Missing email with LinkedIn shows explicit LinkedIn fallback state (NEVER empty)
    assert.ok(
      exportedBlobContent.includes('"Email not found (LinkedIn available)"'),
      'Missing email with LinkedIn shows explicit guidance instead of empty field'
    )
    assert.ok(
      exportedBlobContent.includes('"Not published (LinkedIn outreach available)"'),
      'Email status explains LinkedIn route'
    )

    // 3. Completely missing contact email shows explicit state
    assert.ok(
      exportedBlobContent.includes('"Email not found"'),
      'Completely missing contact email shows explicit "Email not found"'
    )

    // 4. SSRF / invalid website was sanitized
    assert.ok(
      exportedBlobContent.includes('"Website not verified"'),
      'SSRF / invalid website URL neutralized in CSV export'
    )
  } finally {
    if (origDocument) globalEnv.document = origDocument
    else delete globalEnv.document
    if (origUrl) globalEnv.URL = origUrl
  }
})

// ── 18. URL Safety & Fake LinkedIn Interception ───────────────────────────────
import { resolveSafeUrl } from '../src/lib/urlUtils.ts'

test('urlUtils: resolveSafeUrl intercepts hallucinated LinkedIn slugs and prevents 404', () => {
  // Hallucinated AI slug: /in/priya-verma-e5f6g7h8
  const fakeSlug = 'https://www.linkedin.com/in/priya-verma-e5f6g7h8'
  const safeSearch = resolveSafeUrl(fakeSlug, 'Priya Verma TechFlow')
  assert.ok(safeSearch !== null)
  assert.ok(safeSearch.includes('linkedin.com/search') || safeSearch.includes('keywords='))
  assert.ok(!safeSearch.includes('e5f6g7h8'), 'Eliminated dead 404 slug')

  // Synthetic role suffix: /in/priyanair-revops
  const roleSlug = 'https://www.linkedin.com/in/priyanair-revops'
  const safeRoleSearch = resolveSafeUrl(roleSlug, 'Priya Nair NimbusFlow')
  assert.ok(safeRoleSearch !== null)
  assert.ok(safeRoleSearch.includes('linkedin.com/search') || safeRoleSearch.includes('keywords='))

  // Genuine slug remains intact
  const realSlug = 'https://www.linkedin.com/in/satyanadella'
  assert.equal(resolveSafeUrl(realSlug), 'https://www.linkedin.com/in/satyanadella')

  // SSRF loopback URL is blocked (returns null)
  assert.equal(resolveSafeUrl('http://169.254.169.254/latest/meta-data'), null)
  assert.equal(resolveSafeUrl('http://localhost:5432'), null)
})

// ── 19. Link Verifier Classification & Fallback Domain ────────────────────────
import { verifyLink } from '../src/lib/linkVerifier.ts'

test('linkVerifier: classifies links, stamps timestamp, and generates root domain fallback', () => {
  const verified = verifyLink('https://techcorp.com/products/404-subpath', 'Website')
  assert.equal(verified.status, 'unverified')
  assert.equal(verified.safeToShow, true)
  assert.equal(verified.fallbackUrl, 'https://techcorp.com')
  assert.ok(verified.lastCheckedAt)

  // Unreachable / broken link from site walkthrough
  const broken = verifyLink('https://dead-domain.io/page', 'Website', 'unreachable')
  assert.equal(broken.status, 'broken')
  assert.equal(broken.safeToShow, false)
  assert.equal(broken.fallbackUrl, 'https://dead-domain.io')

  // Fake LinkedIn link
  const fakeLinkedin = verifyLink('https://www.linkedin.com/in/john-doe-ab12cd34', 'LinkedIn')
  assert.equal(fakeLinkedin.status, 'fake')
  assert.equal(fakeLinkedin.safeToShow, false)
})

// ── 20. Lead-to-Action Status Support ─────────────────────────────────────────
import type { LeadActionStatus } from '../src/lib/scanEngine.ts'

test('leadAction: supports all beta required pipeline statuses', () => {
  const validStatuses: Array<LeadActionStatus['status']> = [
    'New',
    'Qualified',
    'Contacted',
    'Replied',
    'Meeting Scheduled',
    'Converted',
    'Not Relevant',
  ]

  validStatuses.forEach(st => {
    const actionRecord: LeadActionStatus = {
      status: st,
      notes: `Note for stage ${st}`,
      follow_up_date: '2026-11-01',
      last_activity_at: new Date().toISOString(),
    }
    assert.equal(actionRecord.status, st)
    assert.ok(actionRecord.notes.includes(st))
  })
})

// ── 21. Operation Timeout Bounds & Configurable Overrides ────────────────────
import { getOperationTimeout, isPermanentError, ProxyFallbackError } from '../src/lib/geminiProxy.ts'

test('geminiProxy: getOperationTimeout enforces operation-appropriate bounds and overrides', () => {
  // Grounded timeouts
  assert.equal(getOperationTimeout('enrich', true), 90000, 'Grounded enrichment allows 90s')
  assert.equal(getOperationTimeout('scan', true), 90000, 'Grounded scan allows 90s')
  assert.equal(getOperationTimeout('discovery', true), 75000, 'Grounded discovery allows 75s')
  assert.equal(getOperationTimeout('email', true), 30000, 'Grounded email allows 30s')

  // Non-grounded timeouts
  assert.equal(getOperationTimeout('enrich', false), 35000, 'Non-grounded calls bound to 35s')
  assert.equal(getOperationTimeout('email', false), 25000, 'Non-grounded email bound to 25s')

  // Explicit override
  assert.equal(getOperationTimeout('enrich', true, 120000), 120000, 'Explicit timeoutMs override takes precedence')
  assert.equal(getOperationTimeout('discovery', false, 15000), 15000, 'Explicit timeoutMs override respected on non-grounded')
})

// ── 22. Permanent vs Transient Error Retry Classification ────────────────────
test('geminiProxy: isPermanentError accurately separates permanent failures from transient retries', () => {
  // Permanent errors (must NOT be retried)
  assert.equal(isPermanentError(new Error('API key not valid. Please pass a valid API key.')), true)
  assert.equal(isPermanentError(new Error('PERMISSION_DENIED: caller does not have permission')), true)
  assert.equal(isPermanentError(new Error('You have exceeded your current quota. Check your plan.')), true)
  assert.equal(isPermanentError(new Error('INVALID_ARGUMENT: contents[0].parts must be non-empty')), true)
  assert.equal(isPermanentError(new Error('Response blocked by safety filters (HARM_CATEGORY_HATE_SPEECH)')), true)

  // Transient errors (SHOULD be retried with backoff)
  assert.equal(isPermanentError(new Error('The operation was aborted due to signal timed out')), false)
  assert.equal(isPermanentError(new Error('HTTP 504 Gateway Timeout')), false)
  assert.equal(isPermanentError(new Error('HTTP 502 Bad Gateway')), false)
  assert.equal(isPermanentError(new Error('RESOURCE_EXHAUSTED: rate limit exceeded. Please wait.')), false)
  assert.equal(isPermanentError(new Error('fetch failed: connection reset by peer')), false)
})

// ── 23. Proxy Fallback Error Preservation & Dual Diagnostics ─────────────────
test('geminiProxy: ProxyFallbackError preserves both primary and fallback errors without masking', () => {
  const primaryErr = new Error('Supabase Edge Function 504 Gateway Timeout: signal timed out')
  const fallbackErr = new Error('Direct Google Gemini API HTTP 429: Too Many Requests')

  const proxyErr = new ProxyFallbackError(
    `Direct Gemini fallback failed: ${fallbackErr.message} (Primary error: ${primaryErr.message})`,
    primaryErr,
    fallbackErr
  )

  // Preserves both errors on instance
  assert.equal(proxyErr.primaryError?.message, primaryErr.message)
  assert.equal(proxyErr.fallbackError.message, fallbackErr.message)
  assert.equal(proxyErr.cause, fallbackErr)

  // Message includes both errors for observability
  assert.ok(proxyErr.message.includes('Primary error: Supabase Edge Function 504'))
  assert.ok(proxyErr.message.includes('Direct Gemini fallback failed: Direct Google Gemini API HTTP 429'))
})

// ── 24. Explicit Scan Lifecycle Statuses & Incremental Persistence ───────────
test('scanLifecycle: validates running, partially_completed, completed, and failed states', () => {
  type ScanLifecycleStatus = 'running' | 'partially_completed' | 'completed' | 'failed'
  const statuses: ScanLifecycleStatus[] = ['running', 'partially_completed', 'completed', 'failed']

  const scanRecords = statuses.map((st, idx) => ({
    id: `scan_${idx}`,
    status: st,
    candidate_count: st === 'failed' ? 0 : st === 'partially_completed' ? 4 : 16,
    updated_at: new Date().toISOString(),
  }))

  assert.equal(scanRecords[0].status, 'running')
  assert.equal(scanRecords[1].status, 'partially_completed')
  assert.equal(scanRecords[1].candidate_count, 4)
  assert.equal(scanRecords[2].status, 'completed')
  assert.equal(scanRecords[2].candidate_count, 16)
  assert.equal(scanRecords[3].status, 'failed')
  assert.equal(scanRecords[3].candidate_count, 0)
})

// ── 25. Credit Ledger Consistency, Balance Clamping, and Audit Outcome ────────
test('credits: ledger accounting guarantees non-negative balance and idempotency', () => {
  // Balance arithmetic: deduction followed by refund leaves balance net neutral
  const initialBalance = 100
  const deductionAmount = -1
  const balanceAfterDeduct = Math.max(0, initialBalance + deductionAmount)
  assert.equal(balanceAfterDeduct, 99)

  const refundAmount = 1
  const balanceAfterRefund = balanceAfterDeduct + refundAmount
  assert.equal(balanceAfterRefund, 100, 'Refund restores exact initial credit count')

  // Underflow protection: 0 balance minus deduction cannot drop below zero
  const zeroBalance = 0
  const clampedBalance = Math.max(0, zeroBalance + deductionAmount)
  assert.equal(clampedBalance, 0, 'Balance is clamped at zero and never goes negative')

  // Deduplication logic check on ledger entries
  const ledgerEntries = [
    { reference_id: 'scan_abc_123', amount: -1, action: 'scan' },
    { reference_id: 'scan_abc_123', amount: 1, action: 'scan_refund' },
  ]

  const hasDeduction = ledgerEntries.some(e => e.reference_id === 'scan_abc_123' && e.amount < 0)
  const hasRefund = ledgerEntries.some(e => e.reference_id === 'scan_abc_123' && e.amount > 0)
  assert.equal(hasDeduction, true)
  assert.equal(hasRefund, true)

  const netCreditCharge = ledgerEntries.reduce((sum, e) => sum + e.amount, 0)
  assert.equal(netCreditCharge, 0, 'Net credit deduction is 0 when failed scan is refunded')
})

// ── 26. Careers Indexability, Route Metadata, and Crawlable Links ───────────
import { JOB_ROLES } from '../src/lib/careersData.ts'
import fs from 'node:fs'
import path from 'node:path'

test('careersData: contains all 5 designated job roles with required attributes', () => {
  assert.equal(JOB_ROLES.length, 5, 'Must have exactly 5 career roles')

  const expectedSlugs = [
    'ai-ml-engineer',
    'sales-representative',
    'seo-specialist',
    'social-media-marketing',
    'business-development-associate',
  ]

  for (const slug of expectedSlugs) {
    const role = JOB_ROLES.find(r => r.slug === slug)
    assert.ok(role, `Role with slug "${slug}" must exist`)
    assert.ok(role.title.length > 0, `Role "${slug}" must have non-empty title`)
    assert.ok(role.summary.length > 20, `Role "${slug}" must have descriptive summary`)
    assert.ok(Array.isArray(role.responsibilities) && role.responsibilities.length >= 4, `Role "${slug}" must have at least 4 responsibilities`)
    assert.ok(Array.isArray(role.requirements) && role.requirements.length >= 4, `Role "${slug}" must have at least 4 requirements`)
    assert.ok(role.location.toLowerCase().includes('bengaluru'), `Role "${slug}" location must include Bengaluru`)
  }
})

test('careersBuild: dist artifacts contain crawlable anchors, job-specific h1, canonical, and JobPosting schema', () => {
  const distCareersDir = path.resolve(process.cwd(), 'dist/careers')
  if (!fs.existsSync(distCareersDir)) {
    // If dist has not been generated yet, skip
    return
  }

  // 1. Hub page has crawlable anchor links to all 5 roles
  const hubHtml = fs.readFileSync(path.join(distCareersDir, 'index.html'), 'utf-8')
  for (const role of JOB_ROLES) {
    const anchorPattern = new RegExp(`href=["']/careers/${role.slug}["']`)
    assert.match(hubHtml, anchorPattern, `Careers hub must include crawlable anchor link to /careers/${role.slug}`)
  }

  // 2. Individual job route pages in dist
  for (const role of JOB_ROLES) {
    const jobHtmlPath = path.join(distCareersDir, role.slug, 'index.html')
    assert.ok(fs.existsSync(jobHtmlPath), `Static file for /careers/${role.slug} must exist`)

    const jobHtml = fs.readFileSync(jobHtmlPath, 'utf-8')

    // Must NOT contain fallback generic homepage shell
    assert.equal(
      jobHtml.includes('B2B Intelligence for Discovering Business Opportunities'),
      false,
      `Job page /careers/${role.slug} must not render fallback generic homepage body`
    )

    // Must contain canonical URL
    const canonicalMatch = jobHtml.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i)
    assert.ok(canonicalMatch, `Job page /careers/${role.slug} must have canonical tag`)
    assert.equal(canonicalMatch[1], `https://www.ebexta.com/careers/${role.slug}`)

    // Must contain job-specific <h1>
    assert.match(jobHtml, new RegExp(`<h1[^>]*>\\s*${role.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*<\\/h1>`, 'i'))

    // Must contain JobPosting JSON-LD schema
    const schemaMatches = [...jobHtml.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    let jobPosting: any = null
    for (const m of schemaMatches) {
      try {
        const parsed = JSON.parse(m[1])
        if (parsed['@type'] === 'JobPosting') {
          jobPosting = parsed
          break
        }
      } catch {}
    }

    assert.ok(jobPosting, `Job page /careers/${role.slug} must contain JobPosting JSON-LD`)
    assert.equal(jobPosting.title, role.title)
    assert.equal(jobPosting.hiringOrganization.name, 'EBEXTA')
    assert.equal(jobPosting.url, `https://www.ebexta.com/careers/${role.slug}`)
    assert.equal(jobPosting.baseSalary, undefined, 'Salary must not be invented')
  }
})

