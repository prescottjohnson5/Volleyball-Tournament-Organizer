import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import type { Database } from "@/lib/supabase/database.types";
import { listPublicTournaments } from "./public";

/** Records every query-builder call and resolves with `rows` when awaited. */
function fakeDb(rows: unknown[]) {
  const calls: [string, ...unknown[]][] = [];
  const builder: Record<string, unknown> = {};
  for (const method of ["select", "eq", "ilike", "order", "limit"]) {
    builder[method] = (...args: unknown[]) => {
      calls.push([method, ...args]);
      return builder;
    };
  }
  builder.then = (resolve: (value: unknown) => void) => resolve({ data: rows, error: null });
  const db = {
    from: (table: string) => {
      calls.push(["from", table]);
      return builder;
    },
  } as unknown as SupabaseClient<Database>;
  return { db, calls };
}

const row = (name: string, status: string, event_date: string) => ({ id: name, slug: name, name, status, event_date, location: "Gym" });

describe("listPublicTournaments", () => {
  it("never lists sandbox tournaments and caps the list", async () => {
    const { db, calls } = fakeDb([]);
    await listPublicTournaments("", db);
    expect(calls).toContainEqual(["eq", "is_sandbox", false]);
    expect(calls).toContainEqual(["limit", 50]);
    expect(calls.some(([method]) => method === "ilike")).toBe(false);
  });

  it("searches names literally, escaping wildcards", async () => {
    const { db, calls } = fakeDb([]);
    await listPublicTournaments("100%", db);
    expect(calls).toContainEqual(["ilike", "name", "%100\\%%"]);
  });

  it("returns live tournaments before upcoming and finished ones", async () => {
    const { db } = fakeDb([row("Done", "completed", "2026-05-01"), row("Soon", "registration", "2026-08-01"), row("Live", "in_progress", "2026-06-01")]);
    const result = await listPublicTournaments("", db);
    expect(result.map((t) => t.name)).toEqual(["Live", "Soon", "Done"]);
  });
});
