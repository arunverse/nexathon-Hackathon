# EBEXTA PROJECT_RULES.md

> The law of the project. These are non-negotiable. Breaking one requires a new
> `DECISIONS.md` ADR that explicitly supersedes the rule.

## Security
1. **Never hardcode secrets.** Secrets live in env/Supabase secrets only.
2. **Never `VITE_`-prefix a server secret** (it ships to the browser).
3. **Never bypass RLS.** All data access is RLS-governed or via a `SECURITY DEFINER`
   function that checks `is_admin()`/`auth.uid()`.
4. **Never trust the client for authorization.** UI gates are convenience; the DB/Edge Fn is the boundary.
5. **Always validate inputs** (zod/sanitize) and **sanitize outputs**.
6. **Never return internal detail to the client** (stack/DB/keys) log server-side + return a `cid`.

## Data & correctness
7. **Never duplicate business logic.** The lead pipeline lives in `scanEngine.ts`; mode truth is
   `ebexta_scan_filters.mode`; scoring is one function. Do not fork these.
8. **Always keep evidence links distinct from the funding link.**
9. **Never break existing APIs** (table columns, RPC args, Edge action shapes) that the deployed
   client uses without a coordinated client change.
10. **Always maintain backward compatibility** across a deploy (client + backend ship together).
11. **Respect FK order** on deletes; never leave orphan rows.

## Documentation
12. **The docs are part of the app.** Every code/DB/API/architecture change updates the matching
    `docs/*.md` and `CHANGELOG.md` **before the task is considered complete**.
13. **Never remove documentation.** Supersede with a dated update instead.
14. **Only document what exists.** No aspirational claims stated as current.

## Process
15. **Run migrations in the documented order**, security finals (`privacy_hardening`,
    `rls_lockdown`, `storage_hardening`) LAST.
16. **`npm run build` must pass** (typecheck) before any deploy.
17. **Deploy Edge Functions / run SQL** when they change a frontend push alone is not enough.
18. **Optimize for maintainability, scalability, security, and readability** in that priority
    order when they conflict.

## Product
19. **Opposite-side matching is absolute:** Seeker → Providers, Provider → Seekers. Never show
    a user their competitors.
20. **Verified pool is served first**, credits charged regardless, badge shown.
21. **Weak evidence → Manual Review**, never inflate a score to force a match.
