# EBEXTA → Vercel full click-by-click

Replace `YOURDOMAIN.com` with your real Hostinger domain everywhere.

Your `.env` is NOT pushed to GitHub (it's secret) so you'll paste the two
public Supabase values into Vercel in Part 2, step 4. Get them from your `.env`:
`VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

════════════════════════════════════════════════════════════════════════
PART 1 Put the code on GitHub (using GitHub Desktop, no terminal)
════════════════════════════════════════════════════════════════════════
1. Go to **github.com** → sign up / log in (free).
2. Download **GitHub Desktop** from **desktop.github.com** → install → sign in
   with your GitHub account.
3. In GitHub Desktop: **File → Add Local Repository…** → browse to
   `/Users/arunv/NEXA V.01` → **Add Repository**.
   (It's already a git repo, so it just opens it.)
4. Bottom-left: type a summary like `Initial commit` → click **Commit to main**.
   (This may take a moment it's committing the source, not node_modules/zips,
    which are ignored.)
5. Top bar: click **Publish repository**.
   Name: `ebexta` (anything).
   Keep **"Keep this code private"** ticked (Vercel works fine with private).
   Click **Publish repository**.
   ✅ Your code is now on GitHub.

════════════════════════════════════════════════════════════════════════
PART 2 Deploy on Vercel
════════════════════════════════════════════════════════════════════════
1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub** → Authorize.
2. Vercel dashboard → **Add New… → Project**.
3. Find your `ebexta` repo in the list → click **Import**.
   (If it's not listed: "Adjust GitHub App Permissions" → grant access to the repo.)
4. On the configure screen:
   **Framework Preset**: should auto-say **Vite** (leave it).
   **Build Command**: `npm run build` (default) · **Output Directory**: `dist` (default).
   Expand **Environment Variables** and add these two (copy values from your `.env`):
     | Name | Value |
     |------|-------|
     | `VITE_SUPABASE_URL` | (your Supabase URL) |
     | `VITE_SUPABASE_ANON_KEY` | (your Supabase anon key) |
   **Do NOT** add the Gemini/Razorpay/service-role keys those live only in Supabase.
5. Click **Deploy**. Wait ~1–2 minutes.
6. You get a live URL like `https://ebexta-xxxx.vercel.app` → open it and test login.

════════════════════════════════════════════════════════════════════════
PART 3 Point your Hostinger domain at Vercel
════════════════════════════════════════════════════════════════════════
1. Vercel → your project → **Settings → Domains** → type `YOURDOMAIN.com` → **Add**.
   Add `www.YOURDOMAIN.com` too (Vercel offers to redirect one to the other accept).
2. Vercel shows the DNS records to create usually:
   **A** record: `@` → `76.76.21.21`
   **CNAME**: `www` → `cname.vercel-dns.com`
   (Use whatever Vercel actually displays copy those exact values.)
3. In **Hostinger hPanel** → **Domains** → your domain → **DNS / Nameservers → DNS Zone**:
   Find the existing **A** record for `@` and edit it (or delete + re-add) →
     point it to the IP Vercel gave (`76.76.21.21`).
   Add a **CNAME**: name `www` → value `cname.vercel-dns.com`.
   Remove any old/conflicting `A` records for `@`.
   Save.
4. Back in Vercel → Domains: it will say "Valid Configuration" once DNS propagates
   (minutes to a few hours). HTTPS is issued automatically.

════════════════════════════════════════════════════════════════════════
PART 4 REQUIRED after the domain is live (login + AI won't work without this)
════════════════════════════════════════════════════════════════════════
1. **CORS** allow your domain to call the Edge Functions:
   `supabase secrets set ALLOWED_ORIGINS="https://YOURDOMAIN.com,https://www.YOURDOMAIN.com,http://localhost:4000"`
   (Or set the `ALLOWED_ORIGINS` secret in the Supabase dashboard. No redeploy needed.)
2. **Supabase Auth** Dashboard → **Authentication → URL Configuration**:
   **Site URL** = `https://YOURDOMAIN.com`
   Add `https://YOURDOMAIN.com` (and `www`) to **Redirect URLs**.
3. **Google login** Google Cloud Console → APIs & Services → Credentials → your
   OAuth client → add `https://YOURDOMAIN.com` under **Authorized JavaScript origins**.
   (The Supabase callback URL is usually already in Authorized redirect URIs.)
4. **Razorpay** swap the Supabase secrets to your **live** keys once tested.

════════════════════════════════════════════════════════════════════════
FUTURE UPDATES
════════════════════════════════════════════════════════════════════════
Whenever you change code: GitHub Desktop → **Commit to main** → **Push origin**.
Vercel auto-redeploys in ~1 minute. Nothing else to do.
