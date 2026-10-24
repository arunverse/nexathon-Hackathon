// REFERENCE COPY — NOT IMPORTED BY ANY FUNCTION.
//
// The Supabase Dashboard function editor deploys a single file, so each Edge
// Function carries its own verbatim copy of the block below rather than
// importing it. This file is the source of truth: change it here, then paste
// it into credits, gemini, site-walkthrough and account.
//
// Verify they have not drifted:
//   for f in credits gemini site-walkthrough account; do
//     sed -n '/^const DEFAULT_ALLOWED/,/^}$/p' supabase/functions/$f/index.ts | md5sum
//   done
// All four hashes must match.
//
// If you later adopt the Supabase CLI, delete the inline copies and
// `import { corsHeaders, isOriginAllowed } from '../_shared/cors.ts'` instead.

// ═══════════════════════════════════════════════════════════════════════════
// CORS — ONE ALLOWLIST, COPIED VERBATIM INTO EVERY EDGE FUNCTION
//
// This block is byte-identical in credits, gemini, site-walkthrough and
// account. It is duplicated rather than imported from _shared/cors.ts on
// purpose: the Supabase Dashboard function editor deploys a SINGLE file, and a
// _shared import would fail there. _shared/cors.ts is the reference copy — if
// you change one, change them all.
//
// You should rarely need to. To allow a new origin WITHOUT redeploying
// anything, add it to the ALLOWED_ORIGINS secret (comma-separated) under
// Edge Functions → Secrets. It is merged with the list below and applies to
// every function at once.
//
// Never "*". The Supabase JWT is the real auth gate; this is defence in depth.
// ═══════════════════════════════════════════════════════════════════════════
const DEFAULT_ALLOWED = [
  // Production
  'https://ebexta.com', 'https://www.ebexta.com',
  'https://webexta.com', 'https://www.webexta.com',
  // Local development. vite.config.ts pins the dev server to port 8000
  // (strictPort), so that is the one that actually matters day to day. The
  // others are kept for preview builds and older setups.
  'http://localhost:8000', 'http://127.0.0.1:8000',
  'http://localhost:5173', 'http://127.0.0.1:5173',
  'http://localhost:4000', 'http://127.0.0.1:4000',
  'http://localhost:4173', 'http://127.0.0.1:4173',
  'http://localhost:3000', 'http://127.0.0.1:3000',
]
export function allowedOrigins(): string[] {
  const fromEnv = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map(s => s.trim()).filter(Boolean)
  return [...new Set([...DEFAULT_ALLOWED, ...fromEnv])]
}
export function isOriginAllowed(req: Request): boolean {
  const origin = req.headers.get('Origin') ?? ''
  if (!origin) return true
  const allow = allowedOrigins()
  if (allow.includes(origin)) return true
  try {
    const url = new URL(origin)
    const host = url.hostname.toLowerCase()
    if (host === 'ebexta.com' || host.endsWith('.ebexta.com')) return true
    if (host === 'webexta.com' || host.endsWith('.webexta.com')) return true
    if (host.endsWith('.vercel.app')) return true
    if (host === 'localhost' || host === '127.0.0.1') return true
  } catch {
    return false
  }
  return false
}
export function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get('Origin') ?? ''
  const allowed = isOriginAllowed(req)
  return {
    'Access-Control-Allow-Origin': allowed ? (origin || '*') : 'https://ebexta.com',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff',
  }
}
