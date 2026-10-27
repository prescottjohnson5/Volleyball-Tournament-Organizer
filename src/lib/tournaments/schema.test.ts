import { describe, expect, it } from "vitest";
import { toTournamentColumns, tournamentInputSchema, type TournamentInput } from "./schema";

const valid: TournamentInput = {
  name: "Summer Slam",
  eventDate: "2026-07-01",
  location: "Ocean Beach",
  environment: "outdoor",
  format: "pool_to_single_elim",
  bestOf: 3,
  maxTeams: 12,
  registrationFeeCents: 4000,
  poolOptions: { poolSize: 4, advancePerPool: 2 },
};

describe("tournamentInputSchema", () => {
  it("accepts a valid tournament", () => {
    expect(tournamentInputSchema.parse(valid)).toEqual(valid);
  });

  it("rejects impossible dates", () => {
    expect(tournamentInputSchema.safeParse({ ...valid, eventDate: "2026-02-30" }).success).toBe(false);
  });

  it("rejects even best-of values and tiny fees", () => {
    expect(tournamentInputSchema.safeParse({ ...valid, bestOf: 2 }).success).toBe(false);
    expect(tournamentInputSchema.safeParse({ ...valid, registrationFeeCents: 50 }).success).toBe(false);
  });

  it("trims text fields", () => {
    expect(tournamentInputSchema.parse({ ...valid, name: "  Cup Day  " }).name).toBe("Cup Day");
  });
});

describe("toTournamentColumns", () => {
  it("stores pool options only for the pool format", () => {
    expect(toTournamentColumns(valid).format_options).toEqual({ poolSize: 4, advancePerPool: 2 });
    expect(toTournamentColumns({ ...valid, format: "double_elim" }).format_options).toEqual({});
  });

  it("fills pool option defaults", () => {
    expect(toTournamentColumns({ ...valid, poolOptions: undefined }).format_options).toEqual({
      poolSize: 4,
      advancePerPool: 2,
    });
  });
});
