# Design Decisions

Each entry gives the choice, why I made it, and what it costs. Written to be talked through in an
interview: the tradeoffs matter more than the choice.

---

## Architecture

### 1. Tournament logic is pure TypeScript; Postgres stores and commits it
**Choice.** Rules, formats, bracket progression and standings live in `src/lib/` as pure functions
with no I/O. Server routes load rows, run the pure logic, and write the result in one call to a
Postgres function (`commit_tournament_changes`).

**Why.** The hard part of this app is the tournament logic (byes, double-elimination drops, grand
final resets, tiebreakers). Pure functions make it fast to unit test, reusable in the browser (for
form validation and the demo page) and independent of Supabase.

**Tradeoff.** Two languages touch the data: TypeScript decides, SQL commits. Business rules in SQL
(triggers or functions) would be enforced even for writes that skip the app. I accept that because
every write already goes through the server routes (see 2).

### 2. Public read, server-only writes
**Choice.** RLS is on for every table. Select policies let anonymous visitors read tournaments,
paid teams, matches and sets. There are **no** insert/update/delete policies, and browser roles have
those privileges revoked. All writes go through Next.js route handlers that check the organizer
session or captain token and then use the service-role key.

**Why.** Captains have no account, so RLS cannot identify them; a token checked on the server can.
One write path also means one place for validation, authorization and audit fields
(`reported_by`).

**Tradeoff.** The browser cannot write directly, so every write costs a round trip through Vercel.
If the service-role key leaked, RLS would not protect anything, so it is only read in modules
marked `server-only` (the build fails if one is imported into client code).

### 3. Optimistic locking with a tournament version number
**Choice.** `tournaments.version` is incremented by every bracket write. `commit_tournament_changes`
only applies when the caller's expected version matches; otherwise it raises `version_conflict` and
writes nothing.

**Why.** Two captains can report scores at the same moment. Without a guard, both servers would
compute the bracket from the same old state and one result would silently overwrite the other.

**Tradeoff.** A conflict means a retry (the server reloads and recomputes). Under real tournament
load (a handful of writes per minute) conflicts are rare and cheap. Row-level pessimistic locks
would be more complex to express through PostgREST.

### 4. Captain contact details live in a separate table
**Choice.** `teams` holds public data; `team_private` holds captain name, email and the token hash,
readable only by the tournament's organizer.

**Why.** RLS works per row, not per column. Splitting the table keeps "public team" and "private
captain" rules simple and impossible to mix up.

**Tradeoff.** One extra table and join. Column-level `GRANT`s would also work but break `select *`
for anonymous users and are easy to undo by accident.

### 5. Hand-written database types
**Choice.** `src/lib/supabase/database.types.ts` mirrors the migrations by hand, in the same shape
`supabase gen types` produces.

**Why.** The project deliberately does not require the Supabase CLI. Typed queries still catch
column typos at compile time.

**Tradeoff.** The types can drift from the SQL. The PGlite tests (see 7) catch SQL mistakes, and a
later switch to generated types needs no call-site changes.

### 6. Next.js 16 without Cache Components
**Choice.** `cacheComponents` (on by default in new Next 16 apps) is turned off; pages render
dynamically per request.

**Why.** Almost every page depends on the request (organizer session, live scores, captain token).
Cache Components would require Suspense boundaries around every session read for little gain.

**Tradeoff.** No prerendered static shell, so the first byte waits for the server render. The
public tournament page streams live updates over Realtime anyway.

### 7. SQL is tested in PGlite
**Choice.** `src/test/db/` loads the real migration files into PGlite (Postgres compiled to
WebAssembly) with small stubs for Supabase's `auth` schema and roles, then tests RLS and the
database functions.

**Why.** Migrations are pasted into the SQL Editor by hand, so a syntax error or a missing policy
would only be found in production. These tests run in about 2 seconds with no Docker and no keys.

**Tradeoff.** The stubs are not Supabase. Realtime and Auth themselves are not exercised.

### 8. Missing keys produce a setup page, not a crash
**Choice.** `src/lib/env.ts` throws `MissingEnvError` naming the variable. API routes turn it into
a 503 JSON error; the proxy rewrites `/dashboard` to `/setup`; pages show a "Setup needed" box.

**Why.** The app must build and run before any keys exist, and a newcomer should see exactly which
variable is missing.

**Tradeoff.** A few pages are forced dynamic so the notice is never baked into static HTML.

---

## Tournament logic

### 9. Bracket state is derived, not mutated
**Choice.** Each match stores its *structure*: where slot A and slot B come from (`seeded team`,
`bye`, `winner of match X`, `loser of match X`). `resolveMatches()` recomputes every match's teams,
status and winner from that structure plus the reported sets, in play order. The database columns
`team_a_id`, `winner_id`, `status`, etc. are a cache of that output, kept so Realtime subscribers and
SQL queries can read them directly.

**Why.** There is no "advance the winner" code to get wrong. Byes, bye-vs-bye chains in the losers
bracket, organizer overrides and the grand final reset all fall out of one pure function. An override
is just "replace the sets and recompute".

**Tradeoff.** Every write recomputes the whole tournament (microseconds for 64 teams) and diffs it
against the stored rows. The cache could drift if someone edits rows by hand in the SQL editor; the
next score report rewrites it.

### 10. Overrides that would rewrite history are refused
**Choice.** If an override changes a match's winner and a later match that already has scores would
get a different team, the server refuses and names the affected match. Pool results lock once the
playoff bracket exists.

**Why.** Silently moving teams out of a half-played match would destroy recorded results. Making the
organizer clear the later scores first keeps every change deliberate.

**Tradeoff.** Correcting an early mistake late in the day takes several steps.

### 11. One shared format interface
**Choice.** `TournamentFormat` has four members: `createInitialPlan`, `createFollowUpMatches`,
`champion` and metadata. Pool play uses `createFollowUpMatches` to seed the playoff bracket when the
last pool match finishes; double elimination creates everything up front.

**Why.** Adding a format (round robin only, triple elimination) is one module and one registry entry.
Nothing outside `src/lib/formats/` knows which format is running.

**Tradeoff.** The interface assumes the whole schedule is a set of matches with slot sources. Formats
that need dynamic pairing (Swiss) would need a richer follow-up hook.

### 12. Byes are real matches
**Choice.** Brackets are padded to a power of two. Missing seeds become byes for the top seeds and
each bye is stored as a match with status `bye`.

**Why.** The bracket keeps a fixed, standard shape, so the double-elimination drop pattern works for
any team count, and the engine treats byes like any other result.

**Tradeoff.** A few extra rows. The UI hides bye matches.

### 13. Double elimination details
- Losers bracket: round 1 pairs winners-round-1 losers; then each winners round drops its losers
  in, reversed on alternate rounds to reduce rematches; rounds in between halve the field.
- Grand final: winners champion in slot A, losers champion in slot B. If the losers champion wins,
  a "Grand Final (if necessary)" decides it; otherwise that match is marked `not_needed`.
- Tested by simulating every team count from 3 to 33: champion has at most one loss, every other
  team exactly two.

### 14. Pool play details
- Pool count: about `teams / poolSize`, never a pool smaller than 3. Seeds snake across pools
  (1→A, 2→B, 3→B, 4→A for two pools) so pools are balanced.
- Round robin by the circle method; odd pools give one team a rest each round.
- Standings tiebreakers: match wins, set difference, point difference, head-to-head (only for a
  two-way tie, to stay transitive), then seed. Differences rather than FIVB ratios: easier to read on
  a phone and no division by zero.
- Playoff seeds: pool winners first, then runners-up, ordered by record. Then seeds are swapped
  within the same finishing tier so pool-mates do not meet in the first playoff round.
- With a single pool at least two teams advance, so there is always a final.

### 15. Seeding = payment order
**Choice.** Seed 1 is the first team whose payment was confirmed.

**Why.** It is deterministic, needs no extra UI and rewards early registration.

**Tradeoff.** Not skill-based. A "reorder seeds" screen before starting is the natural next step.

### 16. Schedule = waves, not times
**Choice.** "Schedule generation" assigns every match a play order and a wave (a group of matches
that can run in parallel): a match's wave is one more than the latest match feeding it, and pool
matches follow their pool round.

**Why.** Courts and time slots are out of scope, but organizers still need "what's next". Waves give
an order that never schedules a match before its teams can be known.

---

## Scoring rules

### 17. All point rules live in `src/lib/rules/ruleset.ts`
**Choice.** Presets: indoor sets to 25, outdoor to 21, deciding set to 15. `bestOf` is 1, 3 or 5
(chosen per tournament), `winBy` defaults to 2 and there is no cap (an optional cap is supported by
the module but not exposed in the UI). The UI, demo and validation all ask this module.

**Edge cases decided:**
- A best-of-1 match is played to the full target (25 or 21), not 15: the "deciding set" rule only
  applies to multi-set matches.
- A set score is valid only if the set would have ended exactly there: 27-25 is valid, 27-20 is not
  (it would have ended at 25-20).
- Captains report one completed set at a time, append-only. They cannot edit an earlier set; the
  organizer can override the whole match. This makes "two captains disagree" a conflict that only
  the organizer resolves.

---

## Registration and payments

### 18. A team row exists before payment, but only the webhook makes it count
**Choice.** Submitting the registration form inserts a `pending` team (plus private captain details)
and creates a Checkout Session for it. Only the `checkout.session.completed` webhook marks it `paid`.
Abandoned checkouts become `expired` when Stripe sends `checkout.session.expired` (sessions last 30
minutes, Stripe's minimum).

**Why.** The webhook is the only trustworthy signal: the success redirect can be faked, skipped
(closed tab) or arrive before the payment settles. Creating the row first gives the webhook something
to update and the organizer visibility into abandoned checkouts.

**Tradeoff.** Pending rows accumulate; they are harmless (RLS hides them from the public) and could be
cleaned up by a scheduled job.

### 19. Capacity is checked twice, and enforced under a lock
**Choice.** The checkout route refuses when the tournament is full, but two captains can still pay
for the last spot at the same time. `confirm_team_payment` locks the tournament row, counts paid
teams, and returns `needs_refund` if it is full or already started; the webhook then refunds
automatically.

**Why.** Overbooking is worse than a refund, and a lock inside one SQL function is the simplest way to
make "check and confirm" atomic.

**Tradeoff.** A captain can occasionally pay and be refunded. Reserving spots during checkout would
avoid that but needs expiry handling for abandoned reservations.

### 20. Webhook idempotency in three layers
1. **Signature** verified on the raw body with `stripe.webhooks.constructEvent`.
2. **Event log:** `stripe_events` records each processed event id; a replay returns early. The event
   is recorded only *after* its side effects succeed, so a crash mid-way leads to a Stripe retry,
   not a lost payment.
3. **Idempotent side effects,** because a retry can still race the first attempt: confirmation is a
   conditional update (`already_paid` on replay), refunds use a Stripe idempotency key and treat
   `charge_already_refunded` as success, expiry only touches `pending` rows.

**Tradeoff.** More moving parts than "insert the event id first", but that simpler version loses
events when processing fails after the insert.

### 21. The captain link is revealed once, using the Checkout Session id as a claim ticket
**Choice.** After payment, the success page polls `/api/register/claim` with the `session_id` Stripe
appended to the redirect. Once the webhook has confirmed payment, the server generates a random
256-bit token, stores **only its SHA-256 hash** (with a conditional `captain_token_hash is null`
update, so only the first claim wins) and returns the token. The browser keeps it in `localStorage`
so a refresh still shows it. Organizers can issue a new link at any time, which invalidates the old
one.

**Why.** The token never passes through Stripe or email (both out of scope), and a database leak does
not expose working links. SHA-256 is enough because the token is random, not a guessable password.

**Tradeoff.** If the captain loses the link they must ask the organizer. The session id is a bearer
secret for a single claim; it is long and random and only reaches the paying browser.

### 22. Captain tokens live in the URL path
`/captain/<token>` is easy to bookmark and share with a co-captain. The route sends
`Referrer-Policy: no-referrer` so the token never leaks to other sites through the Referer header.

### 23. Same team name, paid at the same time
The checkout route refuses a name that is already paid, but if two teams with the same name pay
concurrently, the second is renamed "Name (2)" by `confirm_team_payment` rather than refunded.

---

## Live updates and score reporting

### 24. Realtime events trigger a refetch, not a state patch
**Choice.** The public page, captain page and organizer dashboard subscribe to Supabase Realtime
Postgres Changes on `matches`, `match_sets`, `teams` and `tournaments` (filtered to one tournament).
Any event schedules a debounced (250 ms) refetch of the whole tournament view through the anonymous
client.

**Why.** A score report changes several rows at once (the set, the match, the next match, maybe the
tournament). Patching local state from individual payloads would duplicate the bracket logic in the
browser and break on deletes (overrides delete sets). A tournament is small (at most a few hundred
rows), so a refetch is cheap and always consistent.

**Tradeoff.** More reads than a payload-patching client: every viewer refetches on every change.
Fine for hundreds of viewers; for thousands I would broadcast one "tournament changed" message per
commit, or serve the view from a cache.

### 25. Polling as a fallback, refresh on wake
If the Realtime channel errors or closes (phones going to sleep, flaky Wi-Fi at the beach), the page
shows "Reconnecting" and polls every 15 seconds. It also refetches whenever the tab becomes visible
again, which covers the common "unlock phone, look at scores" case.

### 26. Public pages use a session-less client
Public reads use a Supabase client with no cookies, so an organizer browsing their own public page
sees exactly what everyone else sees (RLS would otherwise also show them unpaid teams).

### 27. Concurrent captain reports
Both captains may report the same set. Set numbers must be consecutive and every commit carries the
tournament version, so the second report is rejected by the version check, retried on fresh data,
and then refused with "Set 1 was already reported". It never creates a duplicate. An integration
test runs this exact race against the real SQL function.

---

## Stripe Connect

### 28. Express accounts with destination charges
**Choice.** Each organizer onboards a Stripe **Express** account. Checkout runs on the platform
account with `payment_intent_data.transfer_data.destination = <organizer account>` and an optional
`application_fee_amount` (`STRIPE_PLATFORM_FEE_PERCENT`, rounded down).

**Why.** Express gives organizers a Stripe-hosted onboarding and payout dashboard with almost no
platform code. Destination charges keep the Checkout Session, webhooks and refunds on the platform
account, so the Phase 3 webhook works unchanged and one signing secret covers payments.

**Alternatives.** *Direct charges* (Checkout on the organizer's account) make the organizer the
merchant of record but scatter webhooks across accounts. *Separate charges and transfers* allow
splitting one payment between several accounts, which this app does not need.

**Tradeoff.** The platform is the merchant of record and bears refunds and disputes first. Refunds
use `reverse_transfer` and `refund_application_fee` so the organizer's share and the fee are pulled
back together.

### 29. Registration waits for a ready connected account
**Choice.** The checkout route refuses (409) unless the organizer's account has `charges_enabled`, and
the registration page says registration opens soon instead of showing the form.

**Why.** Charging on the platform and paying organizers later would mean holding their money and
building manual transfers.

**Tradeoff.** Organizers must finish Stripe onboarding before sharing the link (the dashboard says
so clearly).

### 30. Account status: pull on return, push by webhook
The dashboard re-checks an incomplete account with `accounts.retrieve` on every visit (which covers
returning from onboarding), and the webhook handles `account.updated` when Connect events are
forwarded. Either alone is enough, so a missing Connect webhook in production degrades nothing.
Account creation uses an idempotency key per organizer so a double click cannot create two accounts.

---

## Product rules (simplest reasonable option)

| Question | Decision | Why |
|---|---|---|
| Free tournaments? | Fee must be $1.00–$10,000. | Stripe's minimum charge is $0.50; free events would need a second registration path. Out of scope. |
| Minimum teams | 3 | Two teams is a single match, not a tournament. |
| Editing a tournament | Only while registration is open. Max teams cannot drop below the number of paid teams. | Changing format or rules after the bracket exists would invalidate it. |
| Deleting a tournament | Refused once any team has paid. | Deleting would orphan real (test) payments. Cancelling with refunds is out of scope. |
| Public URL | `/t/<name>-<6 random chars>` | Readable, shareable, not guessable by counting. |
| Organizer session check | `supabase.auth.getClaims()` on the server | It verifies the JWT; `getSession()` only reads the cookie. |

---

## Known limitations and next steps

Honest gaps, roughly in the order I would tackle them:

1. **Verify against live services.** Everything is covered by automated tests, but the full flow has not
   been run against a real Supabase project and Stripe test account yet (see SETUP_STEPS.md).
2. **Rate limiting** on public routes (`/api/register/*`, `/api/captain/*`). Captain tokens are
   unguessable, but a rate limit (for example Vercel KV or Upstash) would stop abusive registration
   attempts.
3. **Seeding control.** Seeds follow payment order. A drag-to-reorder screen before starting the
   tournament would let organizers seed by skill.
4. **Generated database types.** Switch `database.types.ts` to `supabase gen types` output in CI once
   the CLI is acceptable as a dev dependency.
5. **Cleanup job** for old `pending` and `expired` registrations.
6. **Cancel a tournament with refunds.** Deletion is refused once teams have paid; a "cancel and
   refund everyone" action would close that gap.
7. **Browser tests.** Unit and SQL tests cover the logic; a Playwright smoke test against a seeded
   Supabase project would cover the pages and Realtime end to end.
