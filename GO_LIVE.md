# EBEXTA Go-Live Checklist

Do these in order. Everything except the Razorpay bits works immediately;
payments switch on once you deploy the razorpay function with your keys.

Pricing is already locked in code (Seeker ₹1,999/300cr · Provider ₹5,999/900cr ·
Enterprise ₹19,999/3,000cr · packs ₹499/100 · ₹999/200 · ₹1,999/400).

════════════════════════════════════════════════════════════════════════
1. DATABASE run these in Supabase → SQL Editor (skip any already run)
════════════════════════════════════════════════════════════════════════
Run in THIS order (later files depend on earlier ones):
  1. supabase/migrations.sql                  (base tables only if fresh)
  2. supabase/admin_migration.sql
  3. supabase/upgrade_v2.sql
  4. supabase/verified_contacts_migration.sql
  5. supabase/network_intents_migration.sql
  6. supabase/production_hardening.sql        ← is_admin(), RLS, indexes
  7. supabase/user_credit_limits.sql
  8. supabase/admin_account_controls.sql
  9. supabase/payments_migration.sql

Then make yourself admin (once):
  update profiles set is_admin = true where sender_email = 'arunchinnu2005@gmail.com';

════════════════════════════════════════════════════════════════════════
2. EDGE FUNCTIONS deploy in Supabase → Edge Functions
════════════════════════════════════════════════════════════════════════
  • gemini    deploy the current supabase/functions/gemini/index.ts
                (model fix + block + credit-limit + cost cap)
  • razorpay  deploy supabase/functions/razorpay/index.ts  (do this when you
                add your Razorpay keys see step 3)

════════════════════════════════════════════════════════════════════════
3. SECRETS Supabase → Edge Functions → Secrets (or `supabase secrets set`)
════════════════════════════════════════════════════════════════════════
  GEMINI_API_KEY        = your AIza/AQ Gemini key         (already set)
  ALLOWED_ORIGINS       = https://YOURDOMAIN.com,https://www.YOURDOMAIN.com,http://localhost:4000
  RAZORPAY_KEY_ID       = rzp_live_...  (or rzp_test_... to test first)  ← LATER
  RAZORPAY_KEY_SECRET   = ...                                            ← LATER
  (SUPABASE_URL & SUPABASE_SERVICE_ROLE_KEY are injected automatically.)

════════════════════════════════════════════════════════════════════════
4. FRONTEND deploy to Vercel (see DEPLOY_VERCEL.md)
════════════════════════════════════════════════════════════════════════
  • Push repo → import in Vercel → add env vars VITE_SUPABASE_URL,
    VITE_SUPABASE_ANON_KEY → Deploy → point your Hostinger domain.
  • Add the domain to ALLOWED_ORIGINS (step 3) and to Supabase Auth URLs.

════════════════════════════════════════════════════════════════════════
WHAT'S LIVE WHEN
════════════════════════════════════════════════════════════════════════
After steps 1,2(gemini),3(except Razorpay),4:
  ✅ Scans, leads, email, portfolio, deep-intel
  ✅ Per-user credit limits + hard barrier (QUOTA_EXCEEDED)
  ✅ Usage notification banner + Recharge prompts
  ✅ Admin: block / reset / set tier / set credits / see spend & usage
  ✅ Plans/credits can be granted MANUALLY by admin
  ⏳ Self-serve payments (Razorpay checkout) turns on after you deploy the
     razorpay function + set the two Razorpay secrets.

════════════════════════════════════════════════════════════════════════
5. RAZORPAY (when you send me the keys / when you're ready)
════════════════════════════════════════════════════════════════════════
  1. Razorpay Dashboard → Settings → API Keys → generate keys.
  2. Test first: use rzp_test_ keys → deploy razorpay → buy a plan with a
     Razorpay test card → confirm plan/credits update.
  3. Switch to rzp_live_ keys for real money.
