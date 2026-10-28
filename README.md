# Volleyball Tournament Organizer

A full-stack web app for organizing volleyball tournaments. Organizers create tournaments, teams register
with one link, pool and bracket schedules are generated automatically, and everyone can follow live scores
on their phones. Anyone can try it in a sandbox that runs in their own browser, with no account and no
database.

> **Status: feature-complete; connected to a live Supabase project, most features not yet tested end to end
> on it.** A box below is ticked only once that feature has been tested end to end in a real browser,
> against a live Supabase project where it needs one (and, for the payment features, a Stripe test account).
> So far that covers the landing page, the browser sandbox and the setup check; the setup check has
> confirmed against a live project that both keys are accepted and the tables from the migrations exist.
> Every feature is implemented, and 426 automated tests pass without any keys: the SQL migrations, RLS policies and database
> functions run in an in-memory Postgres (PGlite); full tournaments are played through the real SQL for both
> formats; the registration, Stripe, sign-up, sandbox and cleanup routes are tested with payments both on
> and off; and both formats are simulated for every team count from 3 to 33. The keyless
> [demo](#watch-a-simulated-demo-no-keys) shows the formats, rules and live page working.

## Features

- [ ] Organizer accounts (signed in right after sign-up, no confirmation email) and a dashboard for creating and managing tournaments
- [x] A landing page (**Tournaments made easy**) with two actions: **Create a Tournament** or **View a Tournament** (search and pick one)
- [x] **Continue without an account:** a browser sandbox. Open a sample tournament or create your own, add teams, start it, enter scores and follow standings and the bracket, with the real formats and rules. Saved only in that browser; works without Supabase
- [x] A setup check at `/setup` that tests the live configuration (missing or wrong variables, both keys, each migration's tables) and never shows a secret
- [ ] Optional online sandbox via Supabase anonymous sign-ins (1 shareable tournament, 8 teams, deleted daily), offered only when anonymous sign-ins are on
- [ ] Team registration through a shareable link or QR code, confirmed at once with a private captain link
- [ ] Two formats: pool play into single elimination, or double elimination
- [ ] Score reporting by team captains, with organizer override
- [ ] Live score updates on players' phones using Supabase Realtime
- [ ] Public tournament page with tabs for matches, teams, pool standings and bracket
- [ ] Per-IP rate limits on public routes, sign-up, sign-in and the sandbox, with friendly error messages
- [ ] Daily cleanup of online sandbox data (Vercel Cron or a server crontab, protected by `CRON_SECRET`)
- [ ] Optional, behind `PAYMENTS_ENABLED`: registration fees with Stripe Checkout, confirmed by Stripe webhooks
- [ ] Optional, behind `PAYMENTS_ENABLED`: payouts to organizers through Stripe Connect (test mode)

## Tech Stack

| Area | Technology |
|---|---|
| Frontend and server routes | Next.js (App Router), TypeScript, Tailwind CSS |
| Database, auth, live updates | Supabase (Postgres, Row Level Security, anonymous sign-ins, Realtime) |
| Payments (optional) | Stripe Checkout and Stripe Connect, test mode only |
| Testing and CI | Vitest, PGlite, GitHub Actions |
| Hosting | One AWS EC2 server with Caddy and pm2 ([DEPLOY_AWS.md](DEPLOY_AWS.md)), or Vercel |

## How It Works

1. An organizer picks **Create a Tournament**, signs up, fills in the form and shares the registration
   link or QR code. (Or continues without an account and runs a practice tournament in the browser
   sandbox.)
2. A team captain registers. The team is confirmed immediately and the captain gets a private link for
   reporting scores. (With payments on, the captain pays through Stripe Checkout first, and a Stripe
   webhook confirms the team.)
3. The organizer starts the tournament, and the app generates pools and brackets.
4. Captains report set scores from their private link. The organizer can override any score.
5. Anyone can pick **View a tournament**, or open the shared link, and watch results update live with no
   account needed.

## Scoring Rules

Each tournament chooses indoor or outdoor and a match length of 1, 3 or 5 sets (best of 3 by default).
All rules live in one module, [`src/lib/rules/ruleset.ts`](src/lib/rules/ruleset.ts):

| Setting | Indoor | Outdoor |
|---|---|---|
| Regular sets | to 25 | to 21 |
| Deciding set (last set of a best-of-3 or best-of-5) | to 15 | to 15 |
| Win by | 2, no cap | 2, no cap |

Reported scores are validated against these rules: for example 27-25 is accepted, but 27-20 is
rejected because the set would have ended at 25-20.

## Watch a simulated demo (no keys)

Run `npm run dev` and open http://localhost:3000/demo (also listed as *Sample tournament* under **View a
tournament**). It renders the public tournament page (live
matches, pool standings, bracket) from a simulated tournament generated by the same format and rules
modules the real app uses. You can switch format, indoor/outdoor, match length, team count and how
far the tournament has progressed.

## Getting Started

Requires Node.js 20.9 or newer. Commands below are for Windows PowerShell (they also work in bash,
except `Copy-Item`, which is `cp` there).

```powershell
git clone https://github.com/prescottjohnson5/Volleyball-Tournament-Organizer.git
cd Volleyball-Tournament-Organizer
npm install
npm run check        # lint + type-check + tests, no keys needed
npm run dev          # http://localhost:3000
```

The app starts without any keys. The landing page, the browser sandbox (http://localhost:3000/sandbox) and
the demo work straight away; pages that need Supabase say which variables are missing or wrong, and
http://localhost:3000/setup tests the whole connection. To connect a real Supabase project:

```powershell
Copy-Item .env.example .env.local
notepad .env.local   # fill in your own keys
```

Then follow [SETUP_STEPS.md](SETUP_STEPS.md). The **Supabase only** path (no Stripe, no email) walks
through creating the project, running the SQL migrations in `supabase/migrations/` in the SQL Editor,
turning off **Confirm email**, optionally enabling anonymous sign-ins, and setting the Site URL and redirect
URLs. To put it online, follow [DEPLOY_AWS.md](DEPLOY_AWS.md) (one EC2 server and a `.click` domain) or the
Vercel part of SETUP_STEPS.md. Payments are an optional later part.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (strict) |
| `npm test` | Vitest tests, including SQL migration tests in PGlite |
| `npm run check` | All three checks (also run by GitHub Actions on every push) |

### Environment variables

The full list with comments lives in [`.env.example`](.env.example):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_APP_URL=
CRON_SECRET=                   # protects the daily online sandbox cleanup
PAYMENTS_ENABLED=              # optional; "true" turns on Stripe (default off)
STRIPE_SECRET_KEY=             # only with payments on
STRIPE_WEBHOOK_SECRET=         # only with payments on
STRIPE_PLATFORM_FEE_PERCENT=   # optional
```

With payments off (the default), no Stripe variable is needed and Stripe is never called. Use Stripe
**test mode** keys only (the app refuses live keys). Never commit `.env.local`.

## Architecture

```
Browser (phone)                     Next.js (EC2 + Caddy, or Vercel)           Supabase / Stripe
───────────────                     ────────────────────────────────           ─────────────────
Browser sandbox (/sandbox): rules, formats and bracket engine run in the page; saved in localStorage only
Public page, captain page  ──read──────────────────────────────────────────▶  Postgres (RLS: public read)
  └─ Realtime subscription ◀──────────── Postgres Changes ───────────────────  Realtime
Forms (organizer, captain) ──POST──▶ Route handlers
"Try it", sign-up, sign-in            ├─ per-IP rate limit ──▶ rate_limit_hit()
                                      ├─ check organizer session / captain token
                                      ├─ pure TS: rules, formats, bracket engine
                                      └─ service role ──▶ commit_tournament_changes() (one transaction,
                                                          optimistic version check)
Registration ──────────────────────▶ /api/register/[slug]
                                      ├─ payments off ──▶ register_free_team() (locks tournament)
                                      └─ payments on ───▶ Stripe Checkout (destination charge)
Stripe ──── webhook (signed) ──────▶ /api/stripe/webhook ──▶ confirm_team_payment()   (404 when off)
Cron (daily, CRON_SECRET) ────────▶ /api/cron/cleanup ──▶ delete online sandbox data older than 24 hours
```

- **All tournament logic is pure TypeScript** in `src/lib/` (no I/O), so it runs in tests, in the demo
  and in the browser. A match stores *where its teams come from* (seed, bye, winner or loser of another
  match); `resolveMatches()` derives every team, status and winner from that plus the reported sets.
- **Public read, restricted write:** RLS lets anyone read tournaments, confirmed teams, matches and sets.
  There are no write policies; every write goes through a route handler that authorizes the caller and
  then uses the service role.
- **Captains have no account:** a 256-bit token in their private link; only its SHA-256 hash is stored.
- **The browser sandbox** keeps one tournament in localStorage and runs it through the same formats and
  `applyScoreChange()` as the server, so its pools, brackets and score rules are the real ones. Nothing in
  it is sent to the server, so it cannot touch real tournaments.
- **Online sandbox organizers** (optional) are real Supabase users (anonymous sign-ins), so they exercise
  the same RLS, routes and SQL as everyone else. Their limits are enforced by the API and by database
  constraints.
- **Configuration is checked, not assumed:** `src/lib/env.ts` trims a copied `/rest/v1` from the Supabase
  URL, rejects a dashboard link or the app's own address, and refuses the secret key in the public
  variable, so a wrong value gets a clear message instead of a 404 deep inside a request.

### Project structure

| Path | Contents |
|---|---|
| `src/lib/rules/` | The ruleset: point targets, best-of, win-by, set and match validation |
| `src/lib/formats/` | `TournamentFormat` interface, pool play → single elimination, double elimination |
| `src/lib/bracket/` | Bracket engine, seeding, single-elimination builder, schedule (play order) |
| `src/lib/tournament/` | Plans the start and every score edit, maps rows ↔ engine, commits atomically |
| `src/lib/standings.ts` | Pool standings and tiebreakers |
| `src/lib/registration/` | Free and paid registration paths |
| `src/lib/payments.ts` | The `PAYMENTS_ENABLED` decision point |
| `src/lib/rate-limit.ts` | Per-IP rate limits |
| `src/lib/local-sandbox/` | The browser sandbox: one tournament in localStorage, run by the real engine |
| `src/lib/sandbox.ts`, `src/lib/cleanup/` | Online sandbox limits and the daily cleanup |
| `src/lib/env.ts`, `src/lib/setup/` | Environment variable checks and the `/setup` connection test |
| `src/lib/stripe/` | Stripe client, idempotent webhook handler, Connect onboarding |
| `src/lib/scores/` | Captain and organizer score authorization |
| `src/app/` | Pages and API route handlers (`/t/[slug]`, `/captain/[token]`, `/dashboard`, `/api/...`) |
| `supabase/migrations/` | SQL to paste into the Supabase SQL Editor, in order |
| `deploy/` | Caddy config and the update script for the AWS server |
| `src/test/db/` | Runs the real migrations in PGlite to test RLS and the SQL functions |

## Testing

`npm test` runs 426 tests in about 15 seconds with no keys, network or Docker. GitHub Actions runs
`npm run check` on every push.

- **Rules and formats:** set validation edge cases (deuce, deciding set, best-of-1); byes, odd team counts,
  double-elimination drops and the grand final reset; property tests that play complete tournaments for
  every team count from 3 to 33 and check invariants (in double elimination, everyone except the champion
  has exactly two losses).
- **Database:** the migration files run in PGlite (Postgres in WebAssembly). Tests check that anonymous
  users cannot see unconfirmed teams or captain emails and cannot write; that free registration respects
  capacity and names; that paid confirmation is idempotent and refunds when full; that sandbox limits hold
  in the database and deleting a sandbox user removes a played tournament completely; that rate-limit
  counters are atomic; and that full tournaments play to a champion through `commit_tournament_changes`,
  including two captains reporting the same set at once.
- **Both payment modes:** with payments off, registration never touches Stripe and the webhook and
  Connect routes return 404; with payments on, registration goes to Stripe Checkout as before.
- **Browser sandbox:** adding and filling teams, the start rules, refused scores, playoffs appearing once
  pools finish, both formats played to a champion, clearing a score reopening a finished tournament, and
  storage that is unreadable, full or blocked.
- **Configuration:** wrong Supabase URLs and swapped keys are caught; the setup check is run against a fake
  Supabase that is healthy, unreachable, rejects a key or misses a migration.
- **Routes:** sign-up signs in straight away, the sandbox route creates a sandbox organizer, rate limits
  return 429 before any work is done, and the cleanup route refuses requests without `CRON_SECRET`.
- **Payments:** webhook signature verification (wrong secret, tampered body), event idempotency and retry
  behaviour, and Checkout parameters for destination charges with a platform fee.

## Security notes

- Secrets are only read from environment variables; the service-role and Stripe keys are only used in
  `server-only` modules. Live Stripe keys are rejected, and so is a service-role key put in the public
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` variable. `/setup` names problems but never shows a value.
- Per-IP rate limits (stored in Postgres, IPs hashed) on registration, captain score reports, the captain
  link claim, sign-up, sign-in and the sandbox. Supabase's own auth rate limits apply on top.
- The cleanup route requires `Authorization: Bearer <CRON_SECRET>` and refuses to run if it is not set.
- Captain pages send `Referrer-Policy: no-referrer`; all pages send basic security headers.

## Design Decisions

Design choices and their tradeoffs are documented in [DECISIONS.md](DECISIONS.md), including why
payments sit behind a flag and why the sandbox comes with rate limits.

## Roadmap

Not planned for the first version: court and time-slot scheduling, multiple divisions per tournament,
email notifications and real-money payments.

## Demo

Run the app and pick **Create a Tournament** → **Continue without an account** (or open `/sandbox`) for a
practice tournament that needs no keys, or `/demo` for a simulated one. Deployment steps are in
[DEPLOY_AWS.md](DEPLOY_AWS.md) (AWS) and
[SETUP_STEPS.md](SETUP_STEPS.md#part-d--deploy-to-vercel-supabase-only) (Vercel).

_Add a live link here once the app is deployed._
