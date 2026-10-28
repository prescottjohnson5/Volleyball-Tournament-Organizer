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

### 15. Seeding = registration order
**Choice.** Seed 1 is the first team whose registration was confirmed (with payments on, the first
whose payment was confirmed).

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

## Making it usable by strangers: payments flag, sandbox and rate limits

The app is meant to be tried by reviewers who will not set up Stripe, will not wait for confirmation
emails, and should not need an account. These decisions make that possible without weakening the
paid path.

### 31. Payments sit behind `PAYMENTS_ENABLED` (off by default)
**Choice.** Payments run only when `PAYMENTS_ENABLED` is exactly `true`. When it is off, the fee field,
payout panel and every Stripe call disappear; registration confirms the team immediately and shows the
captain link; the Stripe webhook and Connect routes answer 404; and no Stripe variable is required.
The payment code is untouched and still tested: the route tests run in both modes, and turning the
flag on restores the original behaviour.

**Why.** Stripe test mode still needs an account, Connect onboarding, branding and a webhook
forwarder. That is a lot to ask of someone who wants to see the app work for five minutes, and none
of it is what they are evaluating. Off by default also means a fresh deployment never takes payments
by accident. A server-only flag (not `NEXT_PUBLIC_`) can be flipped in Vercel without a rebuild; pages
read it on the server and pass it to client components as props.

**Tradeoff.** Two registration paths to keep working. I kept the split at a single decision point
(`collectsFees(tournament)`: payments on and the tournament has a fee) so pages and routes cannot
disagree, and the 404 for Stripe routes makes the disabled surface truly absent rather than
half-working.

### 32. Free registration is one SQL function, and "paid" means "confirmed"
**Choice.** `register_free_team` locks the tournament row, checks status, capacity and name, and inserts
the team and its private captain row (with the token hash), all in one transaction. The team is stored
with `payment_status = 'paid'` and no Stripe ids.

**Why.** The paid path already treats `paid` as "this team counts": public RLS, the unique-name index,
capacity checks, seeding and the dashboard all key off it. Reusing it means none of those needed a
second branch. The lock gives the same no-overbooking guarantee as `confirm_team_payment` (19).

**Tradeoff.** The column name now overstates things for free teams. Renaming it to
`registration_status` is the honest fix, but it touches every migration, policy and query, so it is
listed as a cleanup rather than mixed into this change.

### 33. Sign-up works without email confirmation, through server routes
**Choice.** SETUP_STEPS tells the operator to turn **Confirm email** off in Supabase, and sign-up and
sign-in now go through `/api/auth/signup` and `/api/auth/signin`, which set the session cookie on
their response. If a project still requires confirmation, the form says so instead of assuming it.

**Why.** Supabase's built-in email sender allows only a few messages per hour, and a reviewer should
not have to wait for one. Moving the calls to the server is what makes them rate-limitable (35) and
gives one place to turn Supabase's error codes into plain messages.

**Tradeoff.** Anyone can create an account with an address they do not own. For a demo with no money
involved (payments off) that is acceptable; with payments on, an operator should turn confirmation
back on, which the code still supports (`/auth/callback`).

### 34. "Try it" uses Supabase anonymous sign-ins and a capped, self-deleting sandbox
**Choice.** **Try it for real** calls `/api/sandbox`, which signs the visitor in with
`signInAnonymously()` and creates an `organizer_profiles` row with `is_sandbox = true`. Sandbox
organizers get one tournament of at most 8 teams, never a fee, a "Sandbox: data is deleted daily."
banner, and everything is deleted after 24 hours (36).

**Why.** A shared demo login lets visitors vandalise each other's data, and a fake mode would not
prove the real thing works. Anonymous sign-ins give every visitor a private, real organizer session
that goes through the same RLS, routes and SQL as a normal account, with no email and no password.

The limits are enforced twice: the API returns a friendly message, and the database has a `CHECK`
(`max_teams <= 8`, fee 0) and a partial unique index (one sandbox tournament per organizer). The
index also closes the race where two tabs create a tournament at the same moment.

**Tradeoff.** Anonymous sign-ins make it cheap to create users, which is why the endpoint is rate
limited per IP (on top of Supabase's own limit on anonymous sign-ins). A sandbox cannot yet be
upgraded into a real account; creating an account starts fresh. Supabase supports linking an email
to an anonymous user, so this is a straightforward follow-up.

### 35. Rate limits are per IP, stored in Postgres, and fail open
**Choice.** `enforceRateLimit(request, name)` counts hits in fixed windows with one atomic upsert
(`rate_limit_hit`) and returns a 429 with a plain-English message and `Retry-After`. Limits: sign-up
5 per hour, sign-in 10 per 15 minutes, sandbox 5 per hour, registration 10 per 10 minutes, score
reports 60 per 10 minutes, captain link claim 120 per 10 minutes (the success page polls). The IP
comes from `x-forwarded-for` (set by Vercel) and is stored only as a SHA-256 prefix.

**Why Postgres.** Serverless functions do not share memory, so an in-memory counter would reset on
every cold start and differ per instance. A Redis service (Upstash, Vercel KV) is the textbook answer,
but it is one more account and two more secrets for whoever deploys this. The database is already
there, and one indexed upsert per request is cheap at this scale.

**Why fail open.** If the counter query fails, the request goes through and the error is logged. A
rate-limit outage should not take registration down mid-tournament; the routes behind it have their
own protections (validation, capacity locks, unguessable tokens).

**Tradeoff.** Fixed windows allow a burst of up to twice the limit across a window boundary, and
people behind one NAT share a budget (the limits are generous for that reason). The QR route is not
limited: it touches no database and is cached for an hour.

### 36. Daily cleanup is a cron route protected by `CRON_SECRET`
**Choice.** `vercel.json` schedules `GET /api/cron/cleanup` daily. The route compares
`Authorization: Bearer <CRON_SECRET>` in constant time, deletes sandbox tournaments and sandbox users
older than 24 hours, and prunes old rate-limit rows. Deleting the auth user cascades through profile,
tournaments, teams, matches and sets; a PGlite test plays a tournament and checks nothing is left.
Without `CRON_SECRET` the route answers 503 and deletes nothing.

**Why.** Vercel Cron sends the secret automatically, so there is nothing else to configure. Failing
closed when the secret is missing means a misconfigured deployment cannot expose a public "delete
data" endpoint. The logic takes its storage operations as parameters, so it is unit tested without
Supabase.

**Tradeoff.** Data can live up to about 48 hours (24 hours of age plus a daily run). Each run deletes
at most 500 sandbox users, ten at a time, and reports `moreUsersRemaining`; a busier site would run
it hourly.

### 37. CI runs the same `npm run check`, with no secrets
GitHub Actions runs lint, type-check and the full test suite on every push. Because the database tests
run the real migrations in PGlite, CI needs no Supabase project, no Docker and no secrets.

## Minimal redesign

### 38. The home screen offers exactly two choices (the pitch came back in 42)
**Choice.** The landing page shows only **Create a tournament** and **View a tournament**. Create goes
to the creation form (through log in, sign-up or **Continue without an account** for visitors who are
not signed in, then straight back to the form). View goes to a "Find a tournament" page with a name
search. The simulated demo is listed there as *Sample tournament*, and the sandbox is offered on the
log-in screen, so neither needs space on the home page.

**Why.** Almost every visitor is either running an event or following one. Asking that one question
first, and showing nothing else, makes the next click obvious. The earlier home page explained the
product; the two choices now do that job by doing it.

**Tradeoff.** No pitch or feature list for first-time visitors, and the header "Log in" link reads
the same whether or not someone is signed in (checking would make every page wait on Supabase). It
always goes to the dashboard, which asks for a log-in only when needed.

### 39. Sandbox tournaments are never listed publicly
**Choice.** The browse page lists the signed-in organizer's own tournaments (sandbox included) and every
tournament with `is_sandbox = false`. Sandbox tournaments stay reachable by their link.

**Why.** Sandbox tournaments are named by anonymous visitors, so listing them would turn the public page
into a notice board anyone can write on. Real organizers' events are what other visitors are looking for.

**Tradeoff.** A reviewer using the sandbox sees an empty public list on a fresh deployment, with the
explanation and the sample tournament instead. The list shows the 50 most recent events; search covers
the rest by name.

### 40. One section at a time: tabs on tournament pages
**Choice.** The public tournament page shows Matches, Teams, Standings (pool play only) and Bracket as
tabs, and the organizer's page shows Share, Teams and Settings before the start, then Matches, Teams and
Share. The open tab lives in the URL hash, and every panel stays mounted so a half-typed form survives a
tab switch. The primary action (Register a team, Start tournament) sits above the tabs.

**Why.** On a phone the stacked page was several screens of matches, tables and brackets. Tabs keep the
header and the main action in view and let people jump straight to what they came for.

### 41. Black base, palette as accents
**Choice.** Backgrounds are black with neutral near-black surfaces; the palette is used sparingly. Sun
(#E4D329) marks the single main action on a screen, teal (#478B8D) marks links, icons and selected
choices, midnight (#0D0B61) fills selected cards, and steel (#294669) is used for minor badges. All text
colours pass WCAG AA on black.

## Working without an account, and on AWS

### 42. A landing page first, still with two actions
**Choice.** The first page is a product landing page: the headline *Tournaments made easy*, one sentence
on what the app does, the two primary buttons (**Create a Tournament**, **View a Tournament**), a quiet
link to the sandbox, a still preview of a live match and bracket drawn with the app's own styles, and
three one-line features. Nobody is sent to a log-in screen until they choose to create a tournament.

**Why.** The bare two-choice screen (38) made the next click obvious, but it did not say what the product
is; first-time visitors met it as a menu. The two actions stay the only buttons, so the page explains
without adding decisions.

### 43. The no-account path is a browser sandbox, not an anonymous account
**Choice.** **Continue without an account** opens `/sandbox`: one practice tournament kept in the
visitor's localStorage. It is created with the real form and run by the real formats, bracket engine and
`applyScoreChange()` (the same function `planScoreEdit()` uses on the server), and shown with the real
tournament components. A sample tournament part-way through pool play is one click away. The Supabase
anonymous sandbox (34, 36) stays as an optional *online sandbox*, offered only when anonymous sign-ins
are switched on.

**Why.** The anonymous sandbox needed a fully working Supabase project with anonymous sign-ins on, so on
a fresh or half-configured deployment the button failed. The browser sandbox works with no backend, no
rate limit and no cleanup, and cannot write into real tournaments because nothing in it leaves the
browser. Sharing one engine means the practice tournament cannot drift from the real rules.

**Tradeoff.** A browser sandbox tournament has no public page, registration link, captain links or live
updates on other phones, and lives in one browser only; the page says so. It cannot be carried over into
a real account yet.

### 44. Configuration is validated, not only checked for presence
**Choice.** `env.ts` trims a trailing slash or a copied `/rest/v1` from `NEXT_PUBLIC_SUPABASE_URL`, and
rejects a non-URL, the supabase.com dashboard link and the app's own address. It refuses a service-role
key in `NEXT_PUBLIC_SUPABASE_ANON_KEY` (that value is sent to every browser) and the anon key as the
service-role key. Pages show which variable is wrong and why, never the value. The proxy reads the
settings through the same module instead of `process.env` directly.

**Why.** A real setup failed with PostgREST's "Invalid path specified in request URL" (PGRST125) and an
HTML 404, because the URL had extra path on it. Each of those mistakes is easy to make when copying from
the dashboard, and each failed far from its cause.

### 45. `/setup` tests the live connection
**Choice.** The setup page checks, in order, the variables, whether Supabase answers and accepts the anon
key, whether anonymous sign-ins are on, whether the service-role key is accepted, and whether the tables
and columns of each migration exist (naming the file to run). It also notes an app URL that differs from
the address in use.

**Why.** "It talks about Supabase things" is hard to act on. One page that says *run 0006_rate_limits.sql*
or *this is the dashboard address* turns setup into a checklist, locally and on the server.

**Tradeoff.** RLS (0002), the functions (0003, 0005) and Realtime (0004) cannot be checked through the
API without side effects, so the page says to run every file. The page is public, but it shows only
variable names, the project host and pass or fail.

### 46. AWS hosting is one EC2 server with Caddy and pm2
**Choice.** DEPLOY_AWS.md runs `next start` on one free-tier EC2 instance, kept alive by pm2, behind
Caddy for automatic HTTPS, with the domain and DNS in Route 53. `deploy/update.sh` pulls, builds,
restarts and waits for `/api/health`. The daily cleanup becomes a crontab line that reads `CRON_SECRET`
from `.env.local`.

**Why.** It is the plain Node setup the app already supports, so nothing in the code is AWS-specific,
and every piece is free or nearly free. Caddy also replaces a client-sent `X-Forwarded-For` with the
real address, which the per-IP rate limits rely on. Amplify Hosting was the alternative, but its
Next.js support follows new major versions with a delay, and its runtime environment variables need
extra build steps.

**Tradeoff.** You patch and update the server yourself, there are no preview deployments, and the site
is briefly slow while `npm run build` runs on a 1 GB instance (with swap).

---

## Product rules (simplest reasonable option)

| Question | Decision | Why |
|---|---|---|
| Free tournaments? | Always free while payments are off. With payments on, the fee must be $1.00–$10,000, except sandbox tournaments, which are always free. | Stripe's minimum charge is $0.50. A tournament created while payments were off keeps a $0 fee and stays free. |
| Minimum teams | 3 | Two teams is a single match, not a tournament. |
| Editing a tournament | Only while registration is open. Max teams cannot drop below the number of paid teams. | Changing format or rules after the bracket exists would invalidate it. |
| Deleting a tournament | Refused once any team is registered. | Deleting would orphan real (test) payments. Cancelling with refunds is out of scope. |
| Browser sandbox | 1 tournament per browser, up to 64 teams, saved in localStorage until Start over. | Same limits as a real tournament; it costs the server nothing. |
| Online sandbox limits | 1 tournament, up to 8 teams, no fee, deleted after 24 hours. | Enough to try every feature, too small to be worth abusing. |
| Public URL | `/t/<name>-<6 random chars>` | Readable, shareable, not guessable by counting. |
| Organizer session check | `supabase.auth.getClaims()` on the server | It verifies the JWT; `getSession()` only reads the cookie. |

---

## Known limitations and next steps

Honest gaps, roughly in the order I would tackle them:

1. **Verify against live services.** The setup check has confirmed a live Supabase project's keys and
   tables, but the full organizer, registration and captain flow has not been run against it yet (nor,
   with payments on, a Stripe test account). See SETUP_STEPS.md.
2. **Carry a sandbox into a real account:** import the browser sandbox tournament after sign-up, or link
   an email to an online sandbox user, instead of starting fresh.
3. **Seeding control.** Seeds follow registration order. A drag-to-reorder screen before starting the
   tournament would let organizers seed by skill.
4. **Rename `payment_status` to `registration_status`** now that free registration exists (32).
5. **Generated database types.** Switch `database.types.ts` to `supabase gen types` output in CI once
   the CLI is acceptable as a dev dependency.
6. **Extend the daily cleanup** to old `pending` and `expired` paid registrations.
7. **Cancel a tournament with refunds.** Deletion is refused once teams have registered; a "cancel and
   refund everyone" action would close that gap.
8. **Browser tests.** Unit and SQL tests cover the logic; a Playwright smoke test against a seeded
   Supabase project would cover the pages and Realtime end to end.
9. **CAPTCHA on sign-up and "Try it"** if rate limits alone are not enough (Supabase supports
   hCaptcha and Turnstile for auth).
