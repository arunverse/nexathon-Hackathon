# EBEXTA CODE_STANDARDS.md

> Conventions the codebase follows. New code must match.

## Language / tooling
- TypeScript (strict via `tsconfig.app.json`). No `any` unless justified; prefer precise types + zod for external data.
- React 19 function components + hooks. No class components (except a future ErrorBoundary).
- ESLint (`eslint.config.js`) with react-hooks + react-refresh plugins. `npm run lint`.

## Naming conventions
- Components: `PascalCase.tsx` (e.g. `LeadCard.tsx`). Hooks: `useX.ts`. Libs/services: `camelCase.ts`.
- Pages under `src/pages/**`; reusable UI under `src/components/**`; domain logic under `src/lib/**`.
- localStorage keys: `ebexta_<domain>_<detail>` (e.g. `ebexta_leads_provider`, `ebexta_onboarded`).
- SQL migrations: descriptive `snake_case.sql`; security finals named `*_hardening.sql` / `*_lockdown.sql`.

## Folder structure
```
src/
  main.tsx, App.tsx, index.css
  contexts/   AuthContext, ThemeContext
  components/ (auth/, layout/, ui/) + shared components
  pages/      public + onboarding/ + dashboard/ + admin/ + demo/
  lib/        supabase, scanEngine, geminiProxy, sanitize, ...
  hooks/, types/
supabase/     *.sql migrations + functions/{gemini,account,_shared}
docs/         this documentation suite
public/       favicon.svg, logo*.svg, icons-ready.js
```

## Component structure
- One component per file (single-file artifacts). Props typed inline or via `interface`.
- Keep JSX flat; extract sub-components when a block repeats or exceeds ~40 lines.
- Styling via Tailwind classes + CSS variables (theme tokens). No hardcoded hex except in
  brand assets/logo (documented exception).

## Hooks
- Follow the rules of hooks; effects have correct deps; cleanup returned. Guard async setState with an `alive` flag.

## Database access
- Client: `supabase.from(...)` (RLS-governed) or `supabase.rpc(...)`. **Never raw SQL from the client.**
- Privileged writes: RPC (`SECURITY DEFINER`, checks `is_admin()`/`auth.uid()`) or Edge Function only.
- Prefer explicit column selects over `select('*')` on wide tables.

## Error handling
- Non-fatal side effects (logging, cache) are try/caught and never block the user.
- Never surface DB/stack/internal detail to the client; Edge Functions log detail server-side + return `cid`.

## Logging & comments
- Use `console.error/warn` for genuine errors only (no PII, no debug `console.log` in shipped paths).
- Comments explain *why*, not *what*; keep them accurate (stale comments are bugs).

## Tailwind / responsive rules
- Mobile-first. Multi-column grids MUST carry responsive prefixes (`grid-cols-1 md:grid-cols-N`).
- Sidebar-offset pages: `ml-0 md:ml-[240px]` (admin `md:ml-[220px]`), `min-w-0`, `overflow-x-hidden`.
- Single-line flex rows with dynamic content: add `min-w-0`/`shrink-0`/`flex-wrap` to prevent overlap.
- No fixed pixel content widths for layout; prefer `max-w-*`, `clamp()`, `minmax()`.

## Performance rules
- Prefer localStorage cache reads over refetch; batch AI calls; avoid heavy blur/gradients in scroll paths.

## Accessibility rules
- Semantic elements; `aria-label` on icon-only buttons; sufficient contrast; keyboard-navigable controls.

## Security rules
- Validate inputs (zod/sanitize), sanitize outputs, never bypass RLS, never hardcode secrets,
  never `VITE_`-prefix a server secret. See `PROJECT_RULES.md`.

## Git standards
- Branch: work on `main`; deploy branch is `master` (`git push origin main:master`).
- Commits: imperative, scoped, one concern (e.g. `Fix seeker/provider mode desync`).
- Every code change updates the relevant `docs/*.md` + `CHANGELOG.md` before it's "done".
