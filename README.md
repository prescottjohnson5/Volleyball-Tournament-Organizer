# Volleyball Tournament Organizer

**Tournaments made easy.** A full-stack web app that runs a volleyball tournament from sign-up to
champion. Teams register with one link, pools and brackets build themselves, and everyone follows live
scores on their phones.

Designed and built by **Prescott Johnson**.

## What it does

- **Create a tournament** in one form: indoor or outdoor, best of 1, 3 or 5 sets, team limit and dates.
- **Teams register** through a shareable link or QR code. Each captain gets a private link for reporting scores.
- **Schedules generate automatically:** pool play into a single-elimination bracket, or double elimination.
- **Live scores:** results update on every phone in real time, with no refresh and no account needed.
- **Scores are validated:** each reported score is checked against real volleyball rules (for example
  27-25 is accepted, 27-20 is not).
- **Try it without an account:** a sandbox runs a full practice tournament in your browser.

## Tech stack

| | |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS |
| Backend | Next.js route handlers, Supabase (Postgres, Auth, Realtime, Row Level Security) |
| Payments (optional) | Stripe Checkout and Stripe Connect, in test mode |
| Testing and CI | Vitest, PGlite (Postgres in memory), GitHub Actions |
| Hosting | AWS EC2, with Caddy for HTTPS and pm2 to keep the app running |

## Highlights

- **A tournament engine with no I/O.** Rules, formats and brackets are plain TypeScript, so the server,
  the browser sandbox and the tests all run the same code.
- **Security built in.** Anyone can read the database, but no one can write to it directly: every write
  goes through a server route that checks permissions. Captain links store only a hash of the token.
  Public routes are rate-limited per IP, and secret keys never reach the browser.
- **Writes are atomic.** Each score update is committed in a single database transaction with a version
  check, so two captains reporting at the same moment can't corrupt the bracket.
- **426 automated tests** run in about 15 seconds with no keys, network or Docker. They cover:
  - edge cases in the scoring rules;
  - the database security policies, run against the real SQL migrations;
  - complete tournaments for every team count from 3 to 33.

## Run it locally

Requires Node.js 20.9 or newer.

```bash
git clone https://github.com/prescottjohnson5/Volleyball-Tournament-Organizer.git
cd Volleyball-Tournament-Organizer
npm install
npm run dev        # http://localhost:3000
```

The browser sandbox (`/sandbox`) and a simulated demo (`/demo`) work without any setup. Accounts and real
tournaments need a Supabase project. Copy `.env.example` to `.env.local`, then follow
[SETUP_STEPS.md](SETUP_STEPS.md).

`npm run check` runs lint, the type check and the tests.

## More detail

- [DECISIONS.md](DECISIONS.md): design choices and their tradeoffs
- [SETUP_STEPS.md](SETUP_STEPS.md): connecting Supabase and Stripe
- [DEPLOY_AWS.md](DEPLOY_AWS.md): deploying to AWS
