# EBEXTA Deploy to your domain (Hostinger)

Your app = static Vite build (`dist/`) + Supabase (already hosted). You just
host `dist/` and point your domain at it. `.htaccess` (Apache/Hostinger) and
`_redirects` (Netlify/Cloudflare) are already bundled for SPA routing.

Replace `YOURDOMAIN.com` everywhere with your real domain.

---

## Build first (both options)
```
cd "/Users/arunv/NEXA V.01"
npm run build
```
This creates the `dist/` folder that's what you host.

---

## Option A Hostinger web hosting (upload dist)
Use this if your Hostinger plan includes **hosting** (not just a domain).
1. Hostinger **hPanel** → **Websites** → your site → **File Manager**.
2. Open **`public_html`** and delete its default files (default.php, etc.).
3. Upload **the contents of `dist/`** (not the folder itself) into `public_html`
   including `index.html`, the `assets/` folder, and the hidden `.htaccess`.
   (In File Manager, enable "show hidden files" so `.htaccess` uploads.)
4. Visit `https://YOURDOMAIN.com` it should load. Hostinger issues free SSL
   automatically (hPanel → SSL if not on yet).

## Option B Vercel/Netlify (recommended for a Vite SPA), domain via DNS
Free, global CDN, auto-HTTPS, redeploys on git push.
1. Push this project to GitHub.
2. **vercel.com** (or **netlify.com**) → New Project → import the repo.
   Build command: `npm run build` · Output dir: `dist`.
   Add env vars: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (public keys only).
3. Deploy → you get a `*.vercel.app` URL. Confirm it works.
4. In Vercel/Netlify → Domains → add `YOURDOMAIN.com`. It shows DNS records.
5. In **Hostinger** → Domains → DNS/Nameservers → add those records (usually an
   `A` record to their IP + a `CNAME` for `www`). Wait for propagation (mins–hours).

---

## ⚠️ After deploying REQUIRED so login + AI work on the live domain
1. **CORS** the Edge Functions only accept allow-listed origins. Add your domain:
   `supabase secrets set ALLOWED_ORIGINS="https://YOURDOMAIN.com,https://www.YOURDOMAIN.com,http://localhost:4000"`
   (No redeploy needed secrets apply live.)
2. **Google login redirect** Supabase Dashboard → Authentication → URL
   Configuration → set **Site URL** to `https://YOURDOMAIN.com` and add it to
   **Redirect URLs**. Also add the domain in your Google Cloud OAuth client's
   "Authorized redirect URIs".
3. **Gemini/Razorpay** already run server-side on Supabase nothing to change
   there except the CORS origins above.
4. Razorpay: switch from `rzp_test_…` to **live** keys in the Supabase secrets
   once you've tested.

That's it Supabase stays as your backend; only the frontend moves to your domain.
