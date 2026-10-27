import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asRole, createTestDb } from "./test-db";

let db: PGlite;

const hit = (key: string, windowSeconds = 3600) =>
  asRole(db, "service_role", null, async () => {
    const { rows } = await db.query<{ hits: number }>("select rate_limit_hit($1, $2) as hits", [key, windowSeconds]);
    return rows[0].hits;
  });

beforeAll(async () => {
  db = await createTestDb();
});

describe("rate_limit_hit", () => {
  it("counts hits per key within a window", async () => {
    expect(await hit("register:ip-a")).toBe(1);
    expect(await hit("register:ip-a")).toBe(2);
    expect(await hit("register:ip-b")).toBe(1);
    expect(await hit("signup:ip-a")).toBe(1);
  });

  it("counts concurrent hits without losing any", async () => {
    const results = await Promise.all(Array.from({ length: 5 }, () => hit("burst:ip")));
    expect(results.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("is hidden from browser roles", async () => {
    await asRole(db, "anon", null, async () => {
      await expect(db.query("select * from rate_limits")).rejects.toThrow(/permission denied/);
      await expect(db.query("select rate_limit_hit('x', 60)")).rejects.toThrow(/permission denied/);
    });
  });
});
