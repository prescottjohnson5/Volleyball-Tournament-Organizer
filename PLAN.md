# Build Plan

Short working plan for the Volleyball Tournament Organizer. Each phase ends with a push to `origin/main`.
Details and tradeoffs live in `DECISIONS.md`; manual steps live in `SETUP_STEPS.md`.

## Architecture in one paragraph

Next.js App Router (TypeScript strict, Tailwind) talks to Supabase. All tournament logic (rules,
formats, bracket progression, standings) is **pure TypeScript** in `src/lib/` with no I/O, so it is unit
tested with Vitest and runs without any keys. Anonymous visitors read public data straight from
Supabase under Row Level Security. Every write goes through a Next.js route handler that checks the
organizer session or the captain token, then writes with the service role, using Postgres functions
where several rows must change atomically. Stripe Checkout and webhooks handle payment; Stripe
Connect (Express, destination charges) routes money to organizers.

## Phase 1: Scaffold, schema, auth, tournament CRUD
- Next.js + Tailwind + ESLint + Vitest scaffold, `.env.example`, env helpers that name missing variables.
- SQL migrations in `supabase/migrations/` (tables, RLS, Realtime, RPC functions).
- Organizer sign up / sign in with Supabase Auth, session refresh, protected dashboard.
- Tournament create / edit / delete through server routes.

## Phase 2: Rules and formats (no keys needed)
- `rules` module: indoor/outdoor presets, bestOf, winBy, set and match validation.
- Shared `TournamentFormat` interface plus two formats: pool play to single elimination, and double
  elimination. Byes and odd team counts handled.
- Bracket engine that derives every match's teams and status from match structure plus set scores.
- Pool standings and schedule generation. Demo page rendering mock data.

## Phase 3: Registration and Stripe Checkout
- Public registration link and downloadable QR code.
- Checkout session on the platform account, verified and idempotent webhook.
- Success page reveals the captain link once; organizer can regenerate it.

## Phase 4: Scores, standings, live view
- Captain score reporting and organizer override, validated against the ruleset.
- Public tournament page: pool standings, bracket, live match list, Realtime updates.

## Phase 5: Stripe Connect
- Express onboarding, status sync, destination charges with optional platform fee.

## Phase 6: Polish and docs
- Mobile polish, empty and error states, README checkboxes, DECISIONS.md and SETUP_STEPS.md final pass.
