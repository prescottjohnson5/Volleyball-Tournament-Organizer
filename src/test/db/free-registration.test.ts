import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "./test-db";

const ORG = "00000000-0000-0000-0000-00000000000a";
const T_OPEN = "10000000-0000-0000-0000-000000000001";
const T_STARTED = "10000000-0000-0000-0000-000000000002";

let db: PGlite;

async function register(tournamentId: string, name: string, hash = `hash-${name}`) {
  const { rows } = await asRole(db, "service_role", null, () =>
    db.query<{ result: { status: string; team_id?: string } }>(
      "select register_free_team($1, $2, 'Cap', 'cap@example.com', $3) as result",
      [tournamentId, name, hash],
    ),
  );
  return rows[0].result;
}

beforeAll(async () => {
  db = await createTestDb();
  await db.query("insert into auth.users (id) values ($1)", [ORG]);
  const insert = `insert into tournaments
    (id, organizer_id, slug, name, event_date, location, environment, format, max_teams, registration_fee_cents, status)
    values ($1, $2, $3, $4, '2026-07-01', 'Gym', 'indoor', 'double_elim', 3, 0, $5)`;
  await db.query(insert, [T_OPEN, ORG, "free-open", "Free Open", "registration"]);
  await db.query(insert, [T_STARTED, ORG, "free-started", "Free Started", "in_progress"]);
});

describe("register_free_team", () => {
  it("allows a tournament with no registration fee", async () => {
    const { rows } = await db.query<{ registration_fee_cents: number }>("select registration_fee_cents from tournaments where id = $1", [T_OPEN]);
    expect(rows[0].registration_fee_cents).toBe(0);
  });

  it("confirms the team immediately and stores only the token hash", async () => {
    const result = await register(T_OPEN, "Spikers", "abc123");
    expect(result.status).toBe("registered");
    const team = await db.query<{ payment_status: string; paid_at: Date | null; stripe_checkout_session_id: string | null }>(
      "select payment_status, paid_at, stripe_checkout_session_id from teams where id = $1",
      [result.team_id],
    );
    expect(team.rows[0]).toMatchObject({ payment_status: "paid", stripe_checkout_session_id: null });
    expect(team.rows[0].paid_at).not.toBeNull();
    const priv = await db.query<{ captain_token_hash: string }>("select captain_token_hash from team_private where team_id = $1", [result.team_id]);
    expect(priv.rows[0].captain_token_hash).toBe("abc123");
  });

  it("makes the team publicly visible right away", async () => {
    await asRole(db, "anon", null, async () => {
      const { rows } = await db.query<{ name: string }>("select name from teams where tournament_id = $1", [T_OPEN]);
      expect(rows.map((r) => r.name)).toContain("Spikers");
    });
  });

  it("rejects a duplicate name regardless of case", async () => {
    expect((await register(T_OPEN, "SPIKERS")).status).toBe("name_taken");
  });

  it("stops at max_teams", async () => {
    expect((await register(T_OPEN, "Blockers")).status).toBe("registered");
    expect((await register(T_OPEN, "Diggers")).status).toBe("registered");
    expect((await register(T_OPEN, "Setters")).status).toBe("full");
  });

  it("refuses started and unknown tournaments", async () => {
    expect((await register(T_STARTED, "Late Team")).status).toBe("closed");
    expect((await register("10000000-0000-0000-0000-0000000000ff", "Ghost Team")).status).toBe("not_found");
  });

  it("can only be called with the service role", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(db.query("select register_free_team($1, 'Sneaky', 'C', 'c@x.io', 'h')", [T_OPEN])).rejects.toThrow(/permission denied/);
    });
  });
});
