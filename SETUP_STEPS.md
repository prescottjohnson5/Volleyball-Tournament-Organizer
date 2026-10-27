# Setup Steps (things you do by hand)

Everything here is a one-time manual step that the code cannot do for you. Follow the sections in
order. All commands are for **Windows PowerShell**, run from the project folder
(`Volleyball-Tournament-Organizer`). You do **not** need the Supabase CLI.

> **Never paste keys into chat, commit them, or share screenshots of them.** They only go in
> `.env.local`, which Git ignores.

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
   Pages that need keys show a yellow **Setup needed** box listing the missing variable names.
   Open http://localhost:3000/setup at any time to see which variables are still missing.

---

## Part B — Supabase (database, organizer accounts, live updates)

### B1. Create the project
1. Go to https://supabase.com and sign in (the free plan is fine).
2. Click **New project**. Pick any name (for example `volleyball`), set a database password
   (save it in your password manager) and choose the region closest to you.
3. Wait until the project dashboard finishes setting up (about 2 minutes).

### B2. Create the tables (run the SQL migrations)
Run the four files in `supabase/migrations/` **in order**: `0001`, `0002`, `0003`, `0004`.

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
| `0003_functions.sql` | Adds the two database functions the server uses for safe multi-row writes |
| `0004_realtime.sql` | Turns on Realtime for `tournaments`, `teams`, `matches` and `match_sets` (safe to re-run) |

### B3. Check that Realtime is on
1. In Supabase, open **Database** → **Publications**.
2. Click **supabase_realtime**. The tables `tournaments`, `teams`, `matches` and `match_sets`
   should be switched on. If not, run `0004_realtime.sql` again.

### B4. Copy the Supabase keys into `.env.local`
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
5. Save the file, then stop (`Ctrl+C`) and restart `npm run dev`. Environment variables are only
   read when the dev server starts.

### B5. Configure organizer sign-up
1. In Supabase, open **Authentication** → **URL Configuration**.
2. Set **Site URL** to `http://localhost:3000`.
3. Under **Redirect URLs**, click **Add URL** and add `http://localhost:3000/auth/callback`.
4. Optional, for faster local testing: open **Authentication** → **Sign In / Providers** →
   **Email** and turn off **Confirm email**. New organizers can then sign in straight away.
   If you leave it on, Supabase emails a confirmation link (its built-in email service only
   sends a few emails per hour).

### B6. Try it
1. Open http://localhost:3000/signup and create an organizer account.
2. You land on the dashboard. Click **New tournament** and create one.
3. In Supabase, open **Table Editor** → `tournaments` to see the row.

---

## Part C — Stripe test mode (registration payments)

Everything here uses Stripe **test mode**: no real money moves, and the app refuses live keys.

### C1. Get your test secret key
1. Create a free account at https://dashboard.stripe.com/register (no business details are needed
   for test mode).
2. Make sure the dashboard is in **test mode** (the "Test mode" / sandbox toggle at the top).
3. Open **Developers** → **API keys**. Click **Reveal test key** next to **Secret key** (it starts
   with `sk_test_`) and paste it into `.env.local` as `STRIPE_SECRET_KEY`.

### C2. Install the Stripe CLI on Windows (to receive webhooks locally)
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

### C3. Forward webhooks and copy the signing secret
1. In the same PowerShell window (keep it open while you test), run:
   ```powershell
   .\stripe.exe listen --forward-to localhost:3000/api/stripe/webhook
   ```
2. It prints `Ready! Your webhook signing secret is whsec_...`. Copy that value into `.env.local`
   as `STRIPE_WEBHOOK_SECRET`. The secret stays the same each time you run `stripe listen` on this
   computer.
3. Restart `npm run dev` in your other PowerShell window so it reads the new values.

### C4. Make a test registration
1. Sign in at http://localhost:3000/dashboard, open a tournament and click **Copy link** under
   *Registration link* (or scan the QR code with your phone if your phone can reach your computer).
2. Fill in a team name, your name and an email, then click **Pay … and register**.
3. On the Stripe page, pay with the test card `4242 4242 4242 4242`, any future expiry date (for
   example `12/34`), any 3-digit CVC and any postal code.
4. You return to the success page. Within a few seconds it shows **…is registered!** and your
   private captain link. In the `stripe listen` window you will see `checkout.session.completed`
   with a `[200]` response.
5. Refresh the organizer dashboard: the team is listed as paid.

**If the success page keeps saying "Confirming your payment…":** the webhook is not reaching the
app. Check that `stripe listen` is still running, that `STRIPE_WEBHOOK_SECRET` matches what it
printed, and that you restarted `npm run dev`.

Useful test cards: `4000 0000 0000 9995` (declined, insufficient funds),
`4000 0025 0000 3155` (asks for 3-D Secure authentication).

---

## Part D — Run a tournament end to end (scores and live updates)

1. Register at least **3** teams using Part C4 (use a different team name each time). Keep each
   captain link (open them in different browser profiles or a private window).
2. On the organizer dashboard, click **Start tournament** → **Yes, start**. The schedule is
   generated and the *Matches* list appears.
3. Open the public page (**Public page** link, or `/t/<slug>`) on your phone or in another window.
   It shows **Live updates on** with a green dot.
4. Open a captain link for a team with a match marked **Up next**. Enter the first set's score
   (for example 25 and 20 indoors) and click **Save set 1**.
5. Without refreshing, the public page and the organizer dashboard show the new score within about a
   second. Invalid scores (for example 25-24) are rejected with an explanation.
6. To correct a score, on the dashboard click **Edit score** on that match, change the numbers and
   click **Save score**.

**If the public page says "Reconnecting (refreshing every 15s)":** Realtime is not enabled for the
tables. Re-run `supabase/migrations/0004_realtime.sql` and check Part B3. Scores still appear, just
up to 15 seconds late.
