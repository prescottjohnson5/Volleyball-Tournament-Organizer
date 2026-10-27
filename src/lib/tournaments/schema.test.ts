import { describe, expect, it } from "vitest";
import { parseTournamentInput, toTournamentColumns, tournamentInputSchema, type TournamentInput } from "./schema";

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

describe("parseTournamentInput", () => {
  it("requires a fee of at least $1 when fees are collected", () => {
    expect(parseTournamentInput(valid, { withFee: true }).registrationFeeCents).toBe(4000);
    expect(() => parseTournamentInput({ ...valid, registrationFeeCents: undefined }, { withFee: true })).toThrow(/registration fee/);
  });

  it("drops the fee when payments are off, so it is never written", () => {
    const input = parseTournamentInput(valid, { withFee: false });
    expect(input.registrationFeeCents).toBeUndefined();
    expect(toTournamentColumns(input)).not.toHaveProperty("registration_fee_cents");
    expect(parseTournamentInput({ ...valid, registrationFeeCents: undefined }, { withFee: false }).name).toBe("Summer Slam");
  });
});

describe("parseTournamentInput for sandbox organizers", () => {
  it("caps teams at 8 and never keeps a fee", () => {
    expect(() => parseTournamentInput(valid, { withFee: false, sandbox: true })).toThrow(/at most 8 teams/);
    const input = parseTournamentInput({ ...valid, maxTeams: 8 }, { withFee: true, sandbox: true });
    expect(input.maxTeams).toBe(8);
    expect(input.registrationFeeCents).toBeUndefined();
  });
});
