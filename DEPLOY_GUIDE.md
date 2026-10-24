# EBEXTA Go-Live Guide (do these 5 things once)

You have two ways to do the Edge Function + secret steps. **Option A is all
clicking in the Supabase website no terminal.** Option B is the terminal way.
Steps 3–5 (SQL + admin + .env) are the same for both.

Your Supabase dashboard: https://supabase.com/dashboard → pick your EBEXTA project.

---

## OPTION A Dashboard only (recommended, no terminal)

### 1. Create the `gemini` Edge Function
1. In the **left sidebar**, click **Edge Functions** (the icon that looks like `λ` / "Functions").
2. Top-right, click the green **"Deploy a new function"** → choose **"Via editor"** (or **"Create a new function"**).
3. Name it exactly: `gemini`  (lowercase, no spaces).
4. Delete the sample code in the editor, then **paste the entire contents** of
   `supabase/functions/gemini/index.ts` from your project.
5. Top-right, click **Deploy** (or **Save and deploy**). Wait for the green "Deployed" tick.

### 2. Add the secret key
1. Still in **Edge Functions**, click the **Secrets** tab (top of the page) or
   **Project Settings** (gear, bottom-left) → **Edge Functions** → **Secrets**.
2. Click **"Add new secret"**. Add:
   Name: `GEMINI_API_KEY`  → Value: *your Gemini key* (the value now sitting in `.env`).
3. (Optional, locks down CORS) Add another secret:
   Name: `ALLOWED_ORIGINS` → Value: `http://localhost:4000,https://ebexta.ebexta.com`
4. Click **Save**. (Secrets apply to the function automatically no redeploy needed.)

Now jump to **step 3** below.

---

## OPTION B Terminal (Supabase CLI)
Run from the project folder (`/Users/arunv/NEXA V.01`):
```bash
# one-time setup
npm i -g supabase
supabase login
supabase link --project-ref <your-project-ref>   # ref is in Project Settings → General

# set the secret + deploy
supabase secrets set GEMINI_API_KEY="<your gemini key>"
supabase secrets set ALLOWED_ORIGINS="http://localhost:4000,https://ebexta.ebexta.com"
supabase functions deploy gemini
```

---

## 3. Run the security SQL  (both options)
1. Left sidebar → **SQL Editor** → **"+ New query"**.
2. Open `supabase/production_hardening.sql`, copy everything, paste it in.
3. Click **Run** (bottom-right, or Ctrl/Cmd+Enter). You should see "Success".

## 4. Make yourself an admin  (both options)
In the same SQL Editor, run one line (this is the ONLY way in now the old
password login is gone):
```sql
UPDATE profiles SET is_admin = true WHERE sender_email = 'arunchinnu2005@gmail.com';
```
Sign out and back in; the **Admin Console** option now appears in your profile menu.

## 5. `.env` already done ✅
I already renamed the secret keys (dropped `VITE_`) so they stay out of the
browser. Nothing to paste. Your public keys (`VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, etc.) are untouched. A backup is at `.env.bak`.

---

## Check it worked
1. `npm run dev`, log in, run a scan or generate an email.
2. If leads/email come back → the proxy is live. 🎉
3. If you get "Unauthorized" or "Gemini proxy request failed" → the function
   isn't deployed or the `GEMINI_API_KEY` secret is missing/typo'd. Recheck steps 1–2.
4. In the Supabase dashboard → Edge Functions → `gemini` → **Logs** tab shows each call.
