# Setup Steps (things you do by hand)

Everything here is a one-time manual step that the code cannot do for you. All commands are for
**Windows PowerShell**, run from the project folder (`Volleyball-Tournament-Organizer`). You do
**not** need the Supabase CLI.

There are two ways to run the app:

- **Supabase only (recommended, Parts A to D).** No payments and no email setup. Registration is
  free and confirmed at once, organizers are signed in right after sign-up, and visitors can press
  **Try it for real** to get a temporary sandbox without an account. This is what a reviewer needs.
- **With payments (Part E, optional).** Adds Stripe test-mode registration fees and Stripe Connect
  payouts. Everything in Parts A to D still applies.

> **Never paste keys into chat, commit them, or share screenshots of them.** They only go in
> `.env.local` (which Git ignores) and in Vercel's environment variable settings.

---

## Part A — Run the app locally without any keys

1. Install dependencies:
   ```powershell
   npm install
   ```
2. Run the checks (lint, type-check, unit tests). They need no keys:
   ```powershell
   npm run check
   ```
3. Start the dev server and open http://localhost:3000:
   ```powershell
   npm run dev
   ```
   The home page and http://localhost:3000/demo (a simulated tournament) work without keys. Pages
   that need keys show a yellow **Setup needed** box listing the missing variable names. Open
   http://localhost:3000/setup at any time to see which variables are still missing.

---

## Part B — Supabase only (database, organizer accounts, sandbox, live updates)

### B1. Create the project
1. Go to https://supabase.com and sign in (the free plan is fine).
2. Click **New project**. Pick any name (for example `volleyball`), set a database password
   (save it in your password manager) and choose the region closest to you.
3. Wait until the project dashboard finishes setting up (about 2 minutes).

### B2. Create the tables (run the SQL migrations)
Run the seven files in `supabase/migrations/` **in order**, from `0001` to `0007`.

For each file:
1. In VS Code, open the file (for example `supabase/migrations/0001_schema.sql`), press
   `Ctrl+A` then `Ctrl+C` to copy everything.
2. In Supabase, click **SQL Editor** in the left sidebar, then **New query** (the `+` button).
3. Paste with `Ctrl+V` and click **Run** (or press `Ctrl+Enter`).
4. You should see **Success. No rows returned**. If you see an error, stop and check that you ran
   the previous files first.

What each file does:
| File | Purpose |
|---|---|
| `0001_schema.sql` | Creates the tables |
| `0002_rls.sql` | Turns on Row Level Security: anyone can read public data, nobody can write from the browser |
| `0003_functions.sql` | Database functions the server uses for safe multi-row writes |
| `0004_realtime.sql` | Turns on Realtime for `tournaments`, `teams`, `matches` and `match_sets` (safe to re-run) |
| `0005_free_registration.sql` | Free registration (no payment step) and tournaments without a fee |
| `0006_rate_limits.sql` | Shared counters for per-IP rate limits |
| `0007_sandbox.sql` | Sandbox organizers and their limits (1 tournament, 8 teams) |

**Already ran `0001`–`0004` for an earlier version?** Just run `0005`, `0006` and `0007`. They are
safe to run more than once.

### B3. Check that Realtime is on
1. In Supabase, open **Database** → **Publications**.
2. Click **supabase_realtime**. The tables `tournaments`, `teams`, `matches` and `match_sets`
   should be switched on. If not, run `0004_realtime.sql` again.

### B4. Configure sign-in (no confirmation emails, sandbox on)
1. Open **Authentication** → **Sign In / Providers**.
2. Under **User Signups**, turn **on** **Allow anonymous sign-ins**. This powers the
   **Try it for real** button (a temporary sandbox account, deleted after 24 hours). Click **Save**.
3. On the same page, open the **Email** provider and turn **off** **Confirm email**, then **Save**.
   Organizers are then signed in the moment they create an account, and the app never needs to
   send an email. (If you leave it on, sign-up still works, but the organizer has to click a link
   that Supabase emails them, and Supabase's built-in email only sends a few emails per hour.)
4. Open **Authentication** → **URL Configuration**:
   - Set **Site URL** to `http://localhost:3000` for now (you change it to your Vercel address in
     Part D).
   - Under **Redirect URLs**, click **Add URL** and add `http://localhost:3000/**`. In Part D you
     also add your Vercel address.

### B5. Copy the keys into `.env.local`
1. Create your local env file from the template:
   ```powershell
   Copy-Item .env.example .env.local
   notepad .env.local
   ```
2. In Supabase, click the **Connect** button at the top of the project (or open
   **Project Settings** → **Data API**) and copy the **Project URL** into
   `NEXT_PUBLIC_SUPABASE_URL`.
3. Open **Project Settings** → **API Keys**:
   - Copy the **publishable** key (starts with `sb_publishable_`) into
     `NEXT_PUBLIC_SUPABASE_ANON_KEY`. (On older projects, the legacy **anon** key works too.)
   - Copy the **secret** key (starts with `sb_secret_`) into `SUPABASE_SERVICE_ROLE_KEY`.
     (On older projects, the legacy **service_role** key works too.) This key bypasses all
     security rules: it is only ever read on the server and must never be shared.
4. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000`.
5. Make a random `CRON_SECRET` (it protects the daily sandbox cleanup). Run this in PowerShell and
   paste the output after `CRON_SECRET=`:
   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
6. Leave `PAYMENTS_ENABLED` and all `STRIPE_` lines empty.
7. Save the file, then stop (`Ctrl+C`) and restart `npm run dev`. Environment variables are only
   read when the dev server starts.

### B6. Try it locally
1. Open http://localhost:3000 and click **Try it for real**. You land on the organizer dashboard
   with a yellow **Sandbox: data is deleted daily.** banner.
2. Click **New tournament**, fill it in (sandbox tournaments allow up to 8 teams) and save.
3. Click **Copy link** under *Registration link*, open it in a private window and register a team.
   Your private captain link appears immediately. Register at least 3 teams with different names.
4. Continue with Part C to play the tournament.
5. To test a real organizer account, open http://localhost:3000/signup in a private window, create an
   account and check that you land straight on the dashboard (no email needed).

---

## Part C — Run a tournament end to end (scores and live updates)

1. With at least **3** registered teams, click **Start tournament** → **Yes, start** on the organizer
   dashboard. The schedule is generated and the *Matches* list appears.
2. Open the public page (**Public page** link, or `/t/<slug>`) on your phone or in another window.
   It shows **Live updates on** with a green dot.
3. Open a captain link for a team with a match marked **Up next**. Enter the first set's score
   (for example 25 and 20 indoors) and click **Save set 1**.
4. Without refreshing, the public page and the organizer dashboard show the new score within about a
   second. Invalid scores (for example 25-24) are rejected with an explanation.
5. To correct a score, on the dashboard click **Edit score** on that match, change the numbers and
   click **Save score**.

**If the public page says "Reconnecting (refreshing every 15s)":** Realtime is not enabled for the
tables. Re-run `supabase/migrations/0004_realtime.sql` and check Part B3. Scores still appear, just
up to 15 seconds late.

---

## Part D — Deploy to Vercel (Supabase only)

1. Go to https://vercel.com, sign in with GitHub and click **Add New…** → **Project**. Import the
   `Volleyball-Tournament-Organizer` repository. Keep the detected **Next.js** settings.
2. Before clicking **Deploy**, open **Environment Variables** and add
   `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and
   `CRON_SECRET` (the same values as in `.env.local`, or a new random `CRON_SECRET`). Do **not** add
   `PAYMENTS_ENABLED` or any `STRIPE_` variable. Click **Deploy** and wait for it to finish.
3. Copy your site address (for example `https://volleyball-tournament-organizer.vercel.app`). In
   Vercel → **Settings** → **Environment Variables**, add `NEXT_PUBLIC_APP_URL` with that address
   (no trailing slash).
4. Supabase → **Authentication** → **URL Configuration**:
   - Set **Site URL** to your Vercel address, for example
     `https://volleyball-tournament-organizer.vercel.app`.
   - Under **Redirect URLs**, add `https://<your-vercel-address>/**`. Keep
     `http://localhost:3000/**` so local development still works.
   - Optional, for Vercel preview deployments: also add
     `https://*-<your-vercel-team-or-username>.vercel.app/**`.
5. Vercel → **Deployments** → the latest deployment → **⋯** → **Redeploy**, so the new variables
   take effect.
6. Check the daily cleanup: Vercel → **Settings** → **Cron Jobs** lists `/api/cron/cleanup`
   (it comes from `vercel.json` and runs once a day at 04:00 UTC). Vercel sends `CRON_SECRET`
   with each run automatically. To run it once by hand, click **Run** next to the job; its result
   appears in the deployment's **Logs**.
7. Repeat Part B6 and Part C on your phone using the Vercel address.

---

## Part E — Optional: registration fees with Stripe (test mode)

Everything here uses Stripe **test mode**: no real money moves, and the app refuses live keys.
Sandbox tournaments stay free even when payments are on.

### E1. Turn payments on
Set `PAYMENTS_ENABLED=true` in `.env.local` (and later in Vercel). With it on, the fee field, the
payout setup panel and Stripe Checkout appear. Set it back to empty to turn payments off again;
existing tournaments then register teams for free.

### E2. Get your test secret key
1. Create a free account at https://dashboard.stripe.com/register (no business details are needed
   for test mode).
2. Make sure the dashboard is in **test mode** (the "Test mode" / sandbox toggle at the top).
3. Open **Developers** → **API keys**. Click **Reveal test key** next to **Secret key** (it starts
   with `sk_test_`) and paste it into `.env.local` as `STRIPE_SECRET_KEY`.

### E3. Install the Stripe CLI on Windows (to receive webhooks locally)
Stripe tells the app "this payment succeeded" by calling a webhook. Your laptop is not reachable from
the internet, so the Stripe CLI forwards those calls to it.
1. Open https://github.com/stripe/stripe-cli/releases/latest and download the file ending in
   `windows_x86_64.zip`.
2. Right-click the zip → **Extract All…** → extract to `C:\stripe-cli`.
3. Open a **new** PowerShell window and run:
   ```powershell
   cd C:\stripe-cli
   .\stripe.exe login
   ```
   A browser tab opens; click **Allow access**.

### E4. Forward webhooks and copy the signing secret
1. In the same PowerShell window (keep it open while you test), run:
   ```powershell
   .\stripe.exe listen --forward-to localhost:3000/api/stripe/webhook
   ```
2. It prints `Ready! Your webhook signing secret is whsec_...`. Copy that value into `.env.local`
   as `STRIPE_WEBHOOK_SECRET`. The secret stays the same each time you run `stripe listen` on this
   computer.
3. Restart `npm run dev` in your other PowerShell window so it reads the new values.

`stripe listen` also forwards events from connected accounts (such as `account.updated`), so one
command covers everything locally.

### E5. Turn on Stripe Connect (one time, for the platform)
Registration fees are paid into each organizer's own Stripe Express account (a "destination
charge"), so your Stripe account must be a Connect platform, even in test mode.
1. In the Stripe dashboard (test mode), open **Connect** from the left menu (or search for
   "Connect") and click **Get started**. When asked, choose that you are building a **platform or
   marketplace** and that sellers/service providers get paid. Follow the prompts until you reach the
   Connect overview page.
2. Open **Settings** (gear icon) → **Connect** → **Branding** and fill in a **business name**,
   an **icon** (any square image) and a **brand color**, then **Save**. Stripe refuses to create
   Express onboarding links until branding is set.
3. Optional platform fee: add `STRIPE_PLATFORM_FEE_PERCENT=5` to `.env.local` to keep 5% of each
   registration. Leave it empty for no fee. Restart `npm run dev` after changing it.

### E6. Set up payouts as an organizer (test data)
Use a real organizer account (Part B6 step 5): sandbox organizers never see payments.
1. Open http://localhost:3000/dashboard. The yellow **Set up payouts** box is at the top. Click
   **Set up payouts with Stripe**.
2. Stripe's Express onboarding opens. In test mode, use test data:
   - If you see a **Use test data** / **Skip this form** button, click it.
   - Otherwise: phone `000 000 0000`, SMS code `000000`, business type **Individual**, any name,
     date of birth `01/01/1901`, SSN `000-00-0000` (or last 4 `0000`), address line 1
     `address_full_match`, bank routing number `110000000`, account number `000123456789`,
     website `https://accessible.stripe.com`.
3. When you finish, Stripe returns you to the dashboard and the box turns into **✅ Payouts ready**.
   If it still says *Finish payout setup*, click **Continue Stripe setup** and complete any
   remaining step. (Status is re-checked every time you open the dashboard.)

If clicking the button shows an error starting with `Stripe:`, read it: it usually means step E5
(Connect sign-up or branding) is not finished.

### E7. Make a test registration
1. Create a tournament with a fee, open it and click **Copy link** under *Registration link*.
2. Fill in a team name, your name and an email, then click **Pay … and register**.
3. On the Stripe page, pay with the test card `4242 4242 4242 4242`, any future expiry date (for
   example `12/34`), any 3-digit CVC and any postal code.
4. You return to the success page. Within a few seconds it shows **…is registered!** and your
   private captain link. In the `stripe listen` window you will see `checkout.session.completed`
   with a `[200]` response.
5. Refresh the organizer dashboard: the team is listed as paid.
6. To see where the money went: on the dashboard click **Open Stripe Express dashboard** (the
   organizer's view), or in your platform's Stripe dashboard open **Connect** → **Connected
   accounts** → the account → **Activity**. The payment shows as a transfer to that account, minus
   the platform fee if you set one.

**If the success page keeps saying "Confirming your payment…":** the webhook is not reaching the
app. Check that `stripe listen` is still running, that `STRIPE_WEBHOOK_SECRET` matches what it
printed, and that you restarted `npm run dev`.

Useful test cards: `4000 0000 0000 9995` (declined, insufficient funds),
`4000 0025 0000 3155` (asks for 3-D Secure authentication).

### E8. Payments on Vercel
1. In Vercel, add `PAYMENTS_ENABLED=true`, `STRIPE_SECRET_KEY` and (optionally)
   `STRIPE_PLATFORM_FEE_PERCENT`.
2. Stripe dashboard (test mode) → **Developers** → **Webhooks** → **Add endpoint**:
   - Endpoint URL: `https://<your-vercel-address>/api/stripe/webhook`
   - Listen to: **Events on your account**
   - Events: `checkout.session.completed`, `checkout.session.expired`,
     `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`
   - Save, then click **Reveal** under *Signing secret* and copy it (`whsec_...`).
3. Optional second endpoint for faster payout status updates: **Add endpoint** again with the same
   URL, choose **Events on Connected accounts** and the event `account.updated`. Copy its signing
   secret too. (Without it, payout status still updates whenever the organizer opens the dashboard.)
4. In Vercel, add `STRIPE_WEBHOOK_SECRET`. With one endpoint, paste its secret. With two, paste both
   separated by a comma, for example `whsec_aaa,whsec_bbb`.
5. Redeploy (Vercel → **Deployments** → **⋯** → **Redeploy**) and repeat E6 and E7 on the Vercel
   address.

---

## Quick reference: every environment variable

| Variable | Where it comes from | Required |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Connect / Project Settings → Data API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Project Settings → API Keys → publishable (or legacy anon) | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Project Settings → API Keys → secret (or legacy service_role) | Yes |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; your Vercel address in production | Yes |
| `CRON_SECRET` | A random string you generate (Part B5), at least 16 characters | Yes, for the daily cleanup |
| `PAYMENTS_ENABLED` | `true` to charge registration fees; empty for free registration | No (default off) |
| `STRIPE_SECRET_KEY` | Stripe (test mode) → Developers → API keys → Secret key `sk_test_…` | Only with payments |
| `STRIPE_WEBHOOK_SECRET` | `stripe listen` output locally; webhook endpoint secret(s) on Vercel | Only with payments |
| `STRIPE_PLATFORM_FEE_PERCENT` | Your choice, 0 to 50 | No |
