# Volleyball Tournament Organizer

A full-stack web app for organizing volleyball tournaments. Organizers create tournaments, teams register and pay online, pool and bracket schedules are generated automatically, and everyone can follow live scores on their phones.

> **Status: in development.** Items marked with a checked box below are working. The rest are planned.

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

> Setup instructions will be added once the first version is running.

```bash
git clone <repo-url>
cd <repo-folder>
npm install
cp .env.example .env.local   # then fill in your own keys
npm run dev
```

### Environment variables

The final list lives in `.env.example`. Expect the following:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_APP_URL=
```

Use Stripe **test mode** keys only. Never commit `.env.local`.

## Design Decisions

Design choices and their tradeoffs will be documented in `DECISIONS.md`.

## Roadmap

Not planned for the first version: court and time-slot scheduling, multiple divisions per tournament, email notifications and real-money payments.

## Demo

_Add a screenshot or a live link here once the app is deployed._
