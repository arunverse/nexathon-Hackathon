/**
 * ZOD — TELL IT NOT TO PROBE FOR eval.
 * ---------------------------------------------------------------------------
 * Zod speeds up object validation by compiling a "fastpass" with `new
 * Function`. To find out whether it can, it tries one inside a try/catch. Our
 * CSP blocks that, zod catches the throw and falls back to its normal path, and
 * nothing actually breaks.
 *
 * But the browser still records the blocked attempt as a Content Security
 * Policy violation. A red error in the Issues panel that means nothing is worse
 * than no error at all — it trains you to ignore the panel where real problems
 * appear. Zod anticipates exactly this and skips the probe when `jitless` is
 * set.
 *
 * WHY ITS OWN FILE: the flag has to be set before any schema is constructed.
 * `z.object()` reads `globalConfig.jitless` in its constructor, and scanEngine
 * builds RawLeadSchema at module load. ES imports evaluate in source order, so
 * importing this module first in main.tsx is what guarantees the ordering.
 *
 * The CSP is not loosened by this and must not be. `unsafe-eval` would trade a
 * cosmetic warning for a real injection risk.
 */

import { config } from 'zod'

config({ jitless: true })
