import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createTestDb } from "./test-db";

const SANDBOX = "00000000-0000-0000-0000-0000000000aa";
const SANDBOX_2 = "00000000-0000-0000-0000-0000000000bb";

let db: PGlite;

function insertTournament(organizerId: string, slug: string, { maxTeams = 8, fee = 0, sandbox = true } = {}) {
  return db.query<{ id: string }>(
    `insert into tournaments
      (organizer_id, slug, name, event_date, location, environment, format, max_teams, registration_fee_cents, is_sandbox)
     values ($1, $2, 'Sandbox Cup', '2026-07-01', 'Gym', 'indoor', 'double_elim', $3, $4, $5) returning id`,
    [organizerId, slug, maxTeams, fee, sandbox],
  );
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query("insert into auth.users (id) values ($1), ($2)", [SANDBOX, SANDBOX_2]);
  await db.query("insert into organizer_profiles (id, is_sandbox) values ($1, true), ($2, true)", [SANDBOX, SANDBOX_2]);
});

describe("sandbox limits in the database", () => {
  it("caps sandbox tournaments at 8 teams and no fee", async () => {
    await expect(insertTournament(SANDBOX, "too-big", { maxTeams: 9 })).rejects.toThrow(/tournaments_sandbox_limits/);
    await expect(insertTournament(SANDBOX, "has-fee", { fee: 500 })).rejects.toThrow(/tournaments_sandbox_limits/);
  });

  it("allows one tournament per sandbox organizer", async () => {
    await insertTournament(SANDBOX, "first-one");
    await expect(insertTournament(SANDBOX, "second-one")).rejects.toThrow(/tournaments_one_per_sandbox_organizer/);
  });

  it("does not limit regular organizers", async () => {
    await insertTournament(SANDBOX_2, "regular-a", { sandbox: false, maxTeams: 32, fee: 2500 });
    await expect(insertTournament(SANDBOX_2, "regular-b", { sandbox: false, maxTeams: 32 })).resolves.toBeDefined();
  });
});

describe("deleting a sandbox user", () => {
  it("removes their profile and a played tournament with all its rows", async () => {
    const { rows } = await insertTournament(SANDBOX_2, "played-cup");
    const tournamentId = rows[0].id;
    const team = (name: string) =>
      db.query<{ id: string }>("insert into teams (tournament_id, name, payment_status) values ($1, $2, 'paid') returning id", [tournamentId, name]);
    const [a, b] = [(await team("Alpha")).rows[0].id, (await team("Bravo")).rows[0].id];
    await db.query("insert into team_private (team_id, tournament_id, captain_name, captain_email) values ($1, $2, 'Cap', 'c@x.io')", [a, tournamentId]);
    const match = await db.query<{ id: string }>(
      `insert into matches (tournament_id, phase, bracket, round, position, label, order_index,
         team_a_source, team_b_source, team_a_id, team_b_id, winner_id, status, sets_a)
       values ($1, 'bracket', 'final', 1, 1, 'Final', 1, '{}', '{}', $2, $3, $2, 'completed', 1) returning id`,
      [tournamentId, a, b],
    );
    await db.query(
      `insert into match_sets (match_id, tournament_id, set_number, score_a, score_b, reported_by, reported_by_team_id, reported_by_user_id)
       values ($1, $2, 1, 25, 20, 'organizer', $3, $4)`,
      [match.rows[0].id, tournamentId, a, SANDBOX_2],
    );
    await db.query("update tournaments set status = 'completed', champion_team_id = $1 where id = $2", [a, tournamentId]);

    await db.query("delete from auth.users where id = $1", [SANDBOX_2]);

    for (const table of ["tournaments", "teams", "team_private", "matches", "match_sets"]) {
      const { rows: left } = await db.query(`select 1 from ${table} where ${table === "tournaments" ? "id" : "tournament_id"} = $1`, [tournamentId]);
      expect(left, table).toHaveLength(0);
    }
    expect((await db.query("select 1 from organizer_profiles where id = $1", [SANDBOX_2])).rows).toHaveLength(0);
  });
});
