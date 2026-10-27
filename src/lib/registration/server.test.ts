import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { hashCaptainToken } from "@/lib/captain-token";
import { HttpError } from "@/lib/http";
import type { Database } from "@/lib/supabase/database.types";
import { registerWithoutPayment } from "./server";

const input = { teamName: "Net Ninjas", captainName: "Sam", captainEmail: "sam@example.com" };

function fakeDb(data: unknown) {
  const rpc = vi.fn(async () => ({ data, error: null }));
  return { db: { rpc } as unknown as SupabaseClient<Database>, rpc };
}

describe("registerWithoutPayment", () => {
  it("returns a fresh token and stores only its hash", async () => {
    const { db, rpc } = fakeDb({ status: "registered", team_id: "team-1" });
    const result = await registerWithoutPayment(db, { id: "t1" }, input);
    expect(result.teamName).toBe("Net Ninjas");
    expect(result.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(rpc).toHaveBeenCalledWith("register_free_team", {
      p_tournament_id: "t1",
      p_team_name: "Net Ninjas",
      p_captain_name: "Sam",
      p_captain_email: "sam@example.com",
      p_captain_token_hash: hashCaptainToken(result.token),
    });
  });

  it.each([
    ["full", 409, /filled up/],
    ["closed", 409, /closed/],
    ["name_taken", 409, /already registered/],
    ["not_found", 404, /not found/],
  ])("turns %s into a friendly %i error", async (status, code, message) => {
    const { db } = fakeDb({ status });
    const error = await registerWithoutPayment(db, { id: "t1" }, input).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    expect((error as HttpError).status).toBe(code);
    expect((error as HttpError).message).toMatch(message);
  });
});
