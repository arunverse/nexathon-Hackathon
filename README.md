# EBEXTA by Ebexta

## 🔐 Security Secrets & Key Rotation (READ BEFORE DEPLOYING)

> [!CAUTION]
> **CRITICAL SECURITY WARNING: ROTATE PREVIOUSLY HARDCODED SECRETS IMMEDIATELY**
> If any API key, credential, or secret was previously pasted, hardcoded, or committed, **it remains accessible in git commit history**. You MUST immediately rotate all keys in provider dashboards before deploying to production:
> 1. **Gemini API Key**: Delete and regenerate a new key in Google AI Studio.
> 2. **Supabase Service Role Key**: Roll the service role key in Supabase → Project Settings → API.
> 3. **Google OAuth Client Secret**: Rotate client secret in Google Cloud Console.
> 4. **Stripe / Razorpay Keys**: Regenerate live secret keys in provider dashboards.

**All production secrets live server-side only.** The browser bundle contains **only** `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and `VITE_GOOGLE_CLIENT_ID` (the anon key is safe **only because Row Level Security (RLS) is enforced on every table** — never disable RLS).

Gemini, Razorpay, and the Supabase **service-role** key live exclusively in Supabase Edge Functions / Server environment variables and NEVER reach the client browser.

**Do not** re-introduce `VITE_GEMINI_API_KEY`, `VITE_RAZORPAY_KEY_SECRET`, or `VITE_SUPABASE_SERVICE_ROLE_KEY` — any `VITE_` prefix bakes the value into every visitor's browser bundle. See `.env.example` for the allowed frontend environment variables.

Required database hardening scripts: `production_hardening.sql` (RLS) and `secure_profiles.sql` (locks privileged columns).

---

# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type-aware lint rules:

```js
export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...

      // Remove tseslint.configs.recommended and replace with this
      tseslint.configs.recommendedTypeChecked,
      // Alternatively, use this for stricter rules
      tseslint.configs.strictTypeChecked,
      // Optionally, add this for stylistic rules
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
