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

## Product rules (simplest reasonable option)

| Question | Decision | Why |
|---|---|---|
| Free tournaments? | Fee must be $1.00–$10,000. | Stripe's minimum charge is $0.50; free events would need a second registration path. Out of scope. |
| Minimum teams | 3 | Two teams is a single match, not a tournament. |
| Editing a tournament | Only while registration is open. Max teams cannot drop below the number of paid teams. | Changing format or rules after the bracket exists would invalidate it. |
| Deleting a tournament | Refused once any team has paid. | Deleting would orphan real (test) payments. Cancelling with refunds is out of scope. |
| Public URL | `/t/<name>-<6 random chars>` | Readable, shareable, not guessable by counting. |
| Organizer session check | `supabase.auth.getClaims()` on the server | It verifies the JWT; `getSession()` only reads the cookie. |
