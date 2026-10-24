# Testing Razorpay payments (no CLI / Docker needed)

Payments run through the **`razorpay` Edge Function**. It holds the secret
server-side and verifies every payment's signature. To test, deploy that
function and set two secrets all from the **Supabase Dashboard** in your
browser. No terminal required.

Your project: `bwulvxrggpcvqducpuuq`

---

## 1. Deploy the `razorpay` function (Dashboard)

1. Supabase Dashboard → your project → **Edge Functions** (left sidebar).
2. Click **Deploy a new function** → **Via editor** (or "Create function").
3. Name it exactly **`razorpay`**.
4. Open `supabase/functions/razorpay/index.ts` in this project, copy **all** of it,
   and paste it into the editor.
5. Click **Deploy**.

Repeat the same steps for the other two functions if you haven't deployed them:
- **`account`** → paste `supabase/functions/account/index.ts` (coupons, delete account)
- **`gemini`** → paste `supabase/functions/gemini/index.ts` (AI + the monthly reset)

> Tip: whenever you change one of these `index.ts` files, re-paste + Deploy.

---

## 2. Set the secrets (Dashboard)

Edge Functions → **Secrets** (a.k.a. "Manage secrets"), add:

| Name                  | Value                                  |
|-----------------------|----------------------------------------|
| `RAZORPAY_KEY_ID`     | *(your `rzp_test_…` key id)*            |
| `RAZORPAY_KEY_SECRET` | *(your test secret)*                   |
| `ALLOWED_ORIGINS`     | `http://localhost:4000`                |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically you
don't set those. (`GEMINI_API_KEY` should also be here for AI features.)

> The exact test key values were shared in chat. They're already in your local
> `.env` for reference, but the Dashboard secrets are what the deployed function
> actually uses.

---

## 3. Test the flow

1. Run the app (`npm run dev`) and log in.
2. Go to **Billing → Commercial Tiers** and click **Get SEEKER** (or any plan).
3. The Razorpay checkout opens. Pay with a **test card**:

   | Field    | Value                          |
   |----------|--------------------------------|
   | Card no. | `4111 1111 1111 1111`          |
   | Expiry   | any future date (e.g. `12/30`) |
   | CVV      | any 3 digits (e.g. `123`)      |
   | Name/OTP | anything; OTP `1234` if asked  |

   UPI test success: `success@razorpay`.

4. On success you'll see "Plan activated" and the page reloads. Check **Billing →
   Overview**: your plan, credit limit, and the "credits reset on" date update.

Nothing is charged these are test-mode keys, so real money never moves.

---

## 4. Going live later

- Swap the Dashboard secrets to your **live** `rzp_live_…` key id + live secret.
- Add your production domain to `ALLOWED_ORIGINS`
  (e.g. `https://ebexta.ebexta.com,https://www.ebexta.ebexta.com`).
- Rotate any key that was ever pasted in chat or committed.

## Troubleshooting

- **"Payments aren't set up yet…"** → the `razorpay` function isn't deployed, or
  its secrets aren't set. Re-check steps 1–2.
- **"Razorpay keys not configured"** → `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
  secrets are missing on the function.
- **"Payment signature invalid" / "Amount mismatch"** → the key id and secret
  don't belong to the same account, or prices in `razorpay/index.ts` were edited
  after an order was created. Re-check the keys.
- **CORS error in the console** → add `http://localhost:4000` to `ALLOWED_ORIGINS`.
