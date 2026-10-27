import type { PGlite } from "@electric-sql/pglite";
import { describe, expect, it } from "vitest";
import { buildCaptainEdit } from "@/lib/scores/edits";
import type { FormatId, MatchRow, MatchSetRow, TeamRow, TournamentRow } from "@/lib/supabase/database.types";
import { planScoreEdit, planTournamentStart } from "@/lib/tournament/progress";
import type { CommitChanges, SetRecord } from "@/lib/tournament/rows";
import { asRole, createTestDb } from "./test-db";

/**
 * End-to-end check that the TypeScript planners and the commit_tournament_changes SQL function
 * agree on the payload: start a tournament and play it to a champion entirely through the DB.
 */

const ORGANIZER = "00000000-0000-0000-0000-0000000000aa";

async function setup(db: PGlite, format: FormatId, teamCount: number, formatOptions: object = {}) {
  await db.query("insert into auth.users (id) values ($1) on conflict do nothing", [ORGANIZER]);
  const { rows } = await db.query<{ id: string }>(
    `insert into tournaments (organizer_id, slug, name, event_date, location, environment, format, format_options, max_teams, registration_fee_cents)
     values ($1, $2, 'Integration Cup', '2026-07-01', 'Gym', 'indoor', $3, $4, 32, 2000) returning id`,
    [ORGANIZER, `cup-${format.replace(/_/g, "-")}-${teamCount}`, format, formatOptions],
  );
  const tournamentId = rows[0].id;
  for (let i = 1; i <= teamCount; i++) {
    await db.query(
      `insert into teams (tournament_id, name, payment_status, paid_at) values ($1, $2, 'paid', now() + ($3 || ' seconds')::interval)`,
      [tournamentId, `Team ${i}`, String(i)],
    );
  }
  return tournamentId;
}

async function load(db: PGlite, tournamentId: string) {
  const tournament = (await db.query<TournamentRow>("select * from tournaments where id = $1", [tournamentId])).rows[0];
  const teams = (await db.query<TeamRow>("select * from teams where tournament_id = $1 and payment_status = 'paid'", [tournamentId])).rows;
  const matches = (await db.query<MatchRow>("select * from matches where tournament_id = $1 order by order_index", [tournamentId])).rows;
  const sets = (await db.query<MatchSetRow>("select * from match_sets where tournament_id = $1", [tournamentId])).rows;
  return { tournament, teams, matches, sets };
}

async function commit(db: PGlite, tournamentId: string, version: number, changes: CommitChanges) {
  await asRole(db, "service_role", null, () =>
    db.query("select commit_tournament_changes($1, $2, $3)", [tournamentId, version, JSON.stringify(changes)]),
  );
}

const captainSet = (n: number, a: number, b: number, teamId: string): SetRecord => ({
  set_number: n,
  score_a: a,
  score_b: b,
  reported_by: "captain",
  reported_by_team_id: teamId,
  reported_by_user_id: null,
});

async function playToChampion(db: PGlite, tournamentId: string) {
  let ids = 0;
  const idFactory = () => `00000000-0000-4000-8000-${String(++ids).padStart(12, "0")}`;
  for (let guard = 0; guard < 200; guard++) {
    const { tournament, teams, matches, sets } = await load(db, tournamentId);
    if (tournament.status === "completed") return tournament;
    const ready = matches.find((m) => m.status === "ready" || m.status === "in_progress");
    if (!ready) throw new Error("Stuck: no playable match");
    // Report one set at a time, like a captain would; the better seed (lower name) wins.
    const seedA = teams.find((t) => t.id === ready.team_a_id)!.seed!;
    const seedB = teams.find((t) => t.id === ready.team_b_id)!.seed!;
    const aWins = seedA < seedB;
    const existing = sets.filter((s) => s.match_id === ready.id).length;
    const set = aWins ? captainSet(existing + 1, 25, 18, ready.team_a_id!) : captainSet(existing + 1, 18, 25, ready.team_b_id!);
    const { changes } = planScoreEdit(
      { tournament, teams: teams.map((t) => ({ id: t.id, seed: t.seed!, pool: t.pool })), matches, sets },
      { matchId: ready.id, append: [set] },
      idFactory,
      new Date(),
    );
    await commit(db, tournamentId, tournament.version, changes);
  }
  throw new Error("Tournament did not finish");
}

describe("tournament progression through the database", () => {
  it.each([
    ["double_elim", 5, {}],
    ["double_elim", 8, {}],
    ["pool_to_single_elim", 7, { poolSize: 4, advancePerPool: 2 }],
  ] as const)("plays %s with %i teams to a champion", async (format, teamCount, options) => {
    const db = await createTestDb();
    const tournamentId = await setup(db, format, teamCount, options);
    const before = await load(db, tournamentId);
    let n = 0;
    const startIds = () => `10000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
    await commit(db, tournamentId, 0, planTournamentStart(before.tournament, before.teams, startIds, new Date()));

    const afterStart = await load(db, tournamentId);
    expect(afterStart.tournament.status).toBe("in_progress");
    expect(afterStart.teams.every((t) => t.seed !== null)).toBe(true);

    const finished = await playToChampion(db, tournamentId);
    const seed1 = afterStart.teams.find((t) => t.seed === 1)!;
    expect(finished.status).toBe("completed");
    expect(finished.champion_team_id).toBe(seed1.id);

    const final = await load(db, tournamentId);
    expect(final.matches.every((m) => ["completed", "bye", "not_needed"].includes(m.status))).toBe(true);
    expect(final.sets.every((s) => s.reported_by === "captain" && s.reported_by_team_id)).toBe(true);
  });

  it("lets only one of two captains record the same set when they report at once", async () => {
    const db = await createTestDb();
    const tournamentId = await setup(db, "double_elim", 4);
    const initial = await load(db, tournamentId);
    let n = 0;
    await commit(db, tournamentId, 0, planTournamentStart(initial.tournament, initial.teams, () => `30000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, new Date()));

    // Both captains load the same state...
    const snapshot = await load(db, tournamentId);
    const match = snapshot.matches.find((m) => m.status === "ready")!;
    const plan = (s: typeof snapshot, teamId: string, a: number, b: number) =>
      planScoreEdit(
        { tournament: s.tournament, teams: s.teams.map((t) => ({ id: t.id, seed: t.seed!, pool: t.pool })), matches: s.matches, sets: s.sets },
        buildCaptainEdit(s, teamId, match.id, { setNumber: 1, scoreA: a, scoreB: b }),
        () => crypto.randomUUID(),
        new Date(),
      ).changes;

    // ...the first commit wins, the second is rejected by the version check.
    await commit(db, tournamentId, snapshot.tournament.version, plan(snapshot, match.team_a_id!, 25, 20));
    await expect(commit(db, tournamentId, snapshot.tournament.version, plan(snapshot, match.team_b_id!, 25, 21))).rejects.toThrow(/version_conflict/);

    // On retry with fresh data, the second captain is told the set already exists.
    const fresh = await load(db, tournamentId);
    expect(() => plan(fresh, match.team_b_id!, 25, 21)).toThrow(/already reported/);
    expect(fresh.sets).toHaveLength(1);
    expect(fresh.sets[0]).toMatchObject({ score_a: 25, score_b: 20, reported_by_team_id: match.team_a_id });
  });

  it("rejects a commit based on a stale version", async () => {
    const db = await createTestDb();
    const tournamentId = await setup(db, "double_elim", 4);
    const { tournament, teams } = await load(db, tournamentId);
    let n = 0;
    const changes = planTournamentStart(tournament, teams, () => `20000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, new Date());
    await commit(db, tournamentId, 0, changes);
    await expect(commit(db, tournamentId, 0, { match_updates: [] })).rejects.toThrow(/version_conflict/);
  });
});
