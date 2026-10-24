/**
 * EBEXTA AI Automated Unit Test Suite
 * Validates Intent Classification, Parameter Extraction, and Routing Logic.
 */

import { classifyIntent } from '../src/lib/ebexta-ai/intentRouter.ts'

const testCases = [
  {
    query: 'Find SaaS companies in Bangalore with 100-500 employees.',
    expectedIntent: 'DISCOVER_COMPANIES',
    expectedParams: { industry: 'saas', location: 'Bangalore', minEmployees: 100, maxEmployees: 500 },
  },
  {
    query: 'Find fintech companies in Mumbai',
    expectedIntent: 'DISCOVER_COMPANIES',
    expectedParams: { industry: 'fintech', location: 'Mumbai' },
  },
  {
    query: 'Show me decision makers at this company',
    expectedIntent: 'DISCOVER_DECISION_MAKERS',
    expectedParams: {},
  },
  {
    query: 'Why is this account important?',
    expectedIntent: 'SCORE_EXPLANATION',
    expectedParams: {},
  },
  {
    query: 'Why is this lead scored 92?',
    expectedIntent: 'SCORE_EXPLANATION',
    expectedParams: { targetScore: 92 },
  },
  {
    query: 'What signals are we seeing?',
    expectedIntent: 'ANALYZE_SIGNALS',
    expectedParams: {},
  },
  {
    query: 'Prepare outreach for these accounts',
    expectedIntent: 'GENERATE_OUTREACH',
    expectedParams: {},
  },
  {
    query: 'Why did our pipeline fall this month?',
    expectedIntent: 'ANOMALY_DETECTION',
    expectedParams: {},
  },
  {
    query: 'Show stalled deals in our funnel',
    expectedIntent: 'BOTTLENECK_DETECTION',
    expectedParams: {},
  },
  {
    query: 'I need to speak with an EBEXTA expert',
    expectedIntent: 'TALK_TO_EXPERT',
    expectedParams: {},
  },
]

let passed = 0
let failed = 0

console.log('--- RUNNING EBEXTA AI TEST SUITE ---\n')

for (const tc of testCases) {
  const result = classifyIntent(tc.query)
  let ok = result.intent === tc.expectedIntent

  if (ok && tc.expectedParams) {
    for (const [k, v] of Object.entries(tc.expectedParams)) {
      if (result.parameters[k] !== v) {
        ok = false
        console.error(`❌ Param mismatch for [${tc.query}]: expected ${k}=${v}, got ${result.parameters[k]}`)
      }
    }
  }

  if (ok) {
    console.log(`✅ [${result.intent}] -> "${tc.query}"`)
    passed++
  } else {
    console.error(`❌ FAILED: "${tc.query}" -> Expected ${tc.expectedIntent}, got ${result.intent}`)
    failed++
  }
}

console.log(`\nResults: ${passed} passed, ${failed} failed.`)
if (failed > 0) process.exit(1)
