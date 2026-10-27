import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "./test-db";

const ORG_A = "00000000-0000-0000-0000-00000000000a";
const ORG_B = "00000000-0000-0000-0000-00000000000b";
const T_A = "10000000-0000-0000-0000-00000000000a";
const T_B = "10000000-0000-0000-0000-00000000000b";

let db: PGlite;

async function addTeam(
  tournamentId: string,
  name: string,
  status: "pending" | "paid",
  session: string,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into teams (tournament_id, name, payment_status, stripe_checkout_session_id)
     values ($1, $2, $3, $4) returning id`,
    [tournamentId, name, status, session],
  );
  const id = rows[0].id;
  await db.query(
    `insert into team_private (team_id, tournament_id, captain_name, captain_email) values ($1, $2, 'Cap', 'c@x.io')`,
    [id, tournamentId],
  );
  return id;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query("insert into auth.users (id) values ($1), ($2)", [ORG_A, ORG_B]);
  const insertTournament = `insert into tournaments
    (id, organizer_id, slug, name, event_date, location, environment, format, max_teams, registration_fee_cents)
    values ($1, $2, $3, $4, '2026-07-01', 'Beach', 'outdoor', 'double_elim', $5, 2500)`;
  await db.query(insertTournament, [T_A, ORG_A, "summer-slam", "Summer Slam", 3]);
  await db.query(insertTournament, [T_B, ORG_B, "winter-cup", "Winter Cup", 8]);
  await addTeam(T_A, "Paid Team", "paid", "cs_paid");
  await addTeam(T_A, "Pending Team", "pending", "cs_pending");
  await addTeam(T_B, "Other Org Team", "pending", "cs_other");
});

describe("migrations", () => {
  it("are safe to re-run for the Realtime step", async () => {
    const { readFileSync } = await import("node:fs");
    const path = await import("node:path");
    const sql = readFileSync(path.resolve(__dirname, "../../../supabase/migrations/0004_realtime.sql"), "utf8");
    await expect(db.exec(sql)).resolves.toBeDefined();
  });
});

describe("row level security", () => {
  it("lets anonymous visitors read tournaments and only paid teams", async () => {
    await asRole(db, "anon", null, async () => {
      const tournaments = await db.query("select id from tournaments");
      expect(tournaments.rows).toHaveLength(2);
      const teams = await db.query<{ name: string }>("select name from teams");
      expect(teams.rows.map((r) => r.name)).toEqual(["Paid Team"]);
    });
  });

  it("hides captain details from anonymous visitors", async () => {
    await asRole(db, "anon", null, async () => {
      const rows = await db.query("select * from team_private");
      expect(rows.rows).toHaveLength(0);
    });
  });

  it("blocks writes from browser roles", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(db.query("update tournaments set name = 'Hacked'")).rejects.toThrow(/permission denied/);
    });
    await asRole(db, "authenticated", ORG_A, async () => {
      await expect(
        db.query("insert into match_sets (match_id, tournament_id, set_number, score_a, score_b, reported_by) values (gen_random_uuid(), $1, 1, 25, 0, 'captain')", [T_A]),
      ).rejects.toThrow(/permission denied/);
    });
  });

  it("shows organizers every team and captain detail in their own tournaments only", async () => {
    await asRole(db, "authenticated", ORG_A, async () => {
      const teams = await db.query<{ name: string }>("select name from teams order by name");
      expect(teams.rows.map((r) => r.name)).toEqual(["Paid Team", "Pending Team"]);
      const privateRows = await db.query<{ tournament_id: string }>("select tournament_id from team_private");
      expect(privateRows.rows.every((r) => r.tournament_id === T_A)).toBe(true);
      expect(privateRows.rows).toHaveLength(2);
    });
  });

  it("does not let browser roles call the write functions", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(db.query("select confirm_team_payment('cs_pending', 'pi_1')")).rejects.toThrow(/permission denied/);
    });
  });
});

describe("confirm_team_payment", () => {
  it("confirms once and is idempotent on replay", async () => {
    await asRole(db, "service_role", null, async () => {
      const first = await db.query<{ r: string }>("select confirm_team_payment('cs_pending', 'pi_1') as r");
      expect(first.rows[0].r).toBe("confirmed");
      const replay = await db.query<{ r: string }>("select confirm_team_payment('cs_pending', 'pi_1') as r");
      expect(replay.rows[0].r).toBe("already_paid");
      const missing = await db.query<{ r: string }>("select confirm_team_payment('cs_nope', 'pi_x') as r");
      expect(missing.rows[0].r).toBe("not_found");
    });
  });

  it("suffixes a duplicate team name instead of failing", async () => {
    await addTeam(T_A, "paid team", "pending", "cs_dup");
    await asRole(db, "service_role", null, async () => {
      const result = await db.query<{ r: string }>("select confirm_team_payment('cs_dup', 'pi_2') as r");
      expect(result.rows[0].r).toBe("confirmed");
    });
    const { rows } = await db.query<{ name: string }>("select name from teams where stripe_checkout_session_id = 'cs_dup'");
    expect(rows[0].name).toBe("paid team (2)");
  });

  it("marks the team for refund when the tournament is already full", async () => {
    // Tournament A allows 3 teams and now has 3 paid.
    await addTeam(T_A, "Too Late", "pending", "cs_late");
    await asRole(db, "service_role", null, async () => {
      const result = await db.query<{ r: string }>("select confirm_team_payment('cs_late', 'pi_3') as r");
      expect(result.rows[0].r).toBe("needs_refund");
      const replay = await db.query<{ r: string }>("select confirm_team_payment('cs_late', 'pi_3') as r");
      expect(replay.rows[0].r).toBe("already_refunded");
    });
  });
});

describe("commit_tournament_changes", () => {
  const matchId = "20000000-0000-0000-0000-000000000001";

  it("applies matches, sets and updates atomically and bumps the version", async () => {
    const changes = {
      tournament: { status: "in_progress", started_at: "2026-07-01T09:00:00Z" },
      new_matches: [
        {
          id: matchId,
          phase: "bracket",
          bracket: "winners",
          round: 1,
          position: 1,
          pool: null,
          label: "Winners R1 M1",
          order_index: 0,
          team_a_source: { type: "bye" },
          team_b_source: { type: "bye" },
          reset_of_match_id: null,
        },
      ],
      set_inserts: [
        { match_id: matchId, set_number: 1, score_a: 21, score_b: 15, reported_by: "organizer", reported_by_user_id: ORG_B },
      ],
      match_updates: [{ id: matchId, status: "in_progress", sets_a: 1, sets_b: 0 }],
    };
    await asRole(db, "service_role", null, async () => {
      const result = await db.query<{ v: number }>("select commit_tournament_changes($1, 0, $2) as v", [T_B, changes]);
      expect(result.rows[0].v).toBe(1);
    });
    const match = await db.query<{ status: string; sets_a: number }>("select status, sets_a from matches where id = $1", [matchId]);
    expect(match.rows[0]).toEqual({ status: "in_progress", sets_a: 1 });
    const tournament = await db.query<{ status: string }>("select status from tournaments where id = $1", [T_B]);
    expect(tournament.rows[0].status).toBe("in_progress");
  });

  it("rejects a stale version and writes nothing", async () => {
    const changes = {
      set_replacements: [{ match_id: matchId, sets: [] }],
    };
    await asRole(db, "service_role", null, async () => {
      await expect(db.query("select commit_tournament_changes($1, 0, $2)", [T_B, changes])).rejects.toThrow(
        /version_conflict/,
      );
    });
    const sets = await db.query("select * from match_sets where match_id = $1", [matchId]);
    expect(sets.rows).toHaveLength(1);
  });

  it("replaces a match's sets", async () => {
    const changes = {
      set_replacements: [
        {
          match_id: matchId,
          sets: [
            { set_number: 1, score_a: 15, score_b: 21, reported_by: "organizer" },
            { set_number: 2, score_a: 21, score_b: 19, reported_by: "organizer" },
          ],
        },
      ],
    };
    await asRole(db, "service_role", null, async () => {
      await db.query("select commit_tournament_changes($1, 1, $2)", [T_B, changes]);
    });
    const sets = await db.query<{ score_a: number }>("select score_a from match_sets where match_id = $1 order by set_number", [matchId]);
    expect(sets.rows.map((r) => r.score_a)).toEqual([15, 21]);
  });
});
