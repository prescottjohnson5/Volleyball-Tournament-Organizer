# Volleyball Tournament Organizer

A full-stack web app for organizing volleyball tournaments. Organizers create tournaments, teams register and pay online, pool and bracket schedules are generated automatically, and everyone can follow live scores on their phones.

> **Status: in development.** Items marked with a checked box below are working end to end. The rest are
> planned or in progress. Current progress: database schema with Row Level Security, organizer sign-up and
> tournament create/edit/delete are built and pass automated tests, but have not yet been verified against
> a live Supabase project.

## Features

- [ ] Organizer accounts and a dashboard for creating and managing tournaments
- [ ] Team registration through a shareable link or QR code
- [ ] Registration fees paid with Stripe Checkout, confirmed by Stripe webhooks
- [ ] Payouts to organizers through Stripe Connect (test mode)
- [ ] Two formats: pool play into single elimination, or double elimination
- [ ] Score reporting by team captains, with organizer override
- [ ] Live score updates on players' phones using Supabase Realtime
- [ ] Public tournament page with pool standings, bracket and live matches

## Tech Stack

| Area | Technology |
|---|---|
| Frontend and server routes | Next.js (App Router), TypeScript, Tailwind CSS |
| Database, auth, live updates | Supabase (Postgres, Row Level Security, Realtime) |
| Payments | Stripe Checkout and Stripe Connect |
| Testing | Vitest |
| Hosting | Vercel |

## How It Works

1. An organizer creates a tournament and shares the registration link or QR code.
2. A team captain registers and pays through Stripe Checkout. A Stripe webhook marks the team as paid.
3. The organizer starts the tournament, and the app generates pools and brackets.
4. Captains report set scores from a private link. The organizer can override any score.
5. Anyone with the tournament link can watch results update live, with no account needed.

## Scoring Rules

Every match is best of 3 sets. The rules are configurable in one place in the code:

| Setting | Indoor | Outdoor |
|---|---|---|
| Sets 1 and 2 | to 25 | to 21 |
| Set 3 | to 15 | to 15 |

## Getting Started

Requires Node.js 20 or newer. Commands below are for Windows PowerShell (they also work in bash,
except `Copy-Item`, which is `cp` there).

```powershell
git clone https://github.com/prescottjohnson5/Volleyball-Tournament-Organizer.git
cd Volleyball-Tournament-Organizer
npm install
npm run check        # lint + type-check + unit tests, no keys needed
npm run dev          # http://localhost:3000
```

The app starts without any keys; pages that need Supabase or Stripe show which variables are missing
(see http://localhost:3000/setup). To connect real services:

```powershell
Copy-Item .env.example .env.local
notepad .env.local   # fill in your own keys
```

Then follow [SETUP_STEPS.md](SETUP_STEPS.md): it walks through creating the Supabase project, running
the SQL migrations in `supabase/migrations/` in the SQL Editor, and the Stripe test-mode setup.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript (strict) |
| `npm test` | Vitest unit tests, including SQL migration tests in PGlite |
| `npm run check` | All three checks |

### Environment variables

The full list with comments lives in [`.env.example`](.env.example):

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PLATFORM_FEE_PERCENT=   # optional
NEXT_PUBLIC_APP_URL=
```

Use Stripe **test mode** keys only (the app refuses live keys). Never commit `.env.local`.

## Design Decisions

Design choices and their tradeoffs are documented in [DECISIONS.md](DECISIONS.md).

## Roadmap

Not planned for the first version: court and time-slot scheduling, multiple divisions per tournament, email notifications and real-money payments.

## Demo

_Add a screenshot or a live link here once the app is deployed._
