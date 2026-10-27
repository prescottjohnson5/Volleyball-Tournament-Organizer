import { describe, expect, it } from "vitest";
import { createRuleset, type SetScore } from "@/lib/rules/ruleset";
import { allMatchesDecided, findInvalidatedMatches, resolveMatches } from "./engine";
import type { MatchSpec, SlotSource } from "./types";

const rules = createRuleset("indoor");
const A_WINS: SetScore[] = [
  { a: 25, b: 20 },
  { a: 25, b: 20 },
];
const B_WINS: SetScore[] = [
  { a: 20, b: 25 },
  { a: 20, b: 25 },
];

const team = (teamId: string): SlotSource => ({ type: "team", teamId });
const winner = (matchId: string): SlotSource => ({ type: "winner", matchId });
const loser = (matchId: string): SlotSource => ({ type: "loser", matchId });
const bye: SlotSource = { type: "bye" };

function spec(id: string, orderIndex: number, teamA: SlotSource, teamB: SlotSource, resetOf: string | null = null): MatchSpec {
  return { id, orderIndex, teamA, teamB, resetOf, phase: "bracket", bracket: "winners", round: 1, position: 1, pool: null, label: id };
}

function byId(matches: ReturnType<typeof resolveMatches>) {
  return Object.fromEntries(matches.map((m) => [m.id, m]));
}

// Three teams: seed 1 gets a bye, 2 plays 3, then a final.
const threeTeam = [
  spec("m1", 0, team("t1"), bye),
  spec("m2", 1, team("t2"), team("t3")),
  spec("m3", 2, winner("m1"), winner("m2")),
];

describe("resolveMatches", () => {
  it("auto-advances a team facing a bye and waits for undecided sources", () => {
    const m = byId(resolveMatches(threeTeam, new Map(), rules));
    expect(m.m1).toMatchObject({ status: "bye", winnerId: "t1", loserId: null });
    expect(m.m2).toMatchObject({ status: "ready", teamAId: "t2", teamBId: "t3" });
    expect(m.m3).toMatchObject({ status: "pending", teamAId: "t1", teamBId: null });
  });

  it("advances winners and marks partially played matches in progress", () => {
    const m = byId(resolveMatches(threeTeam, new Map([["m2", B_WINS]]), rules));
    expect(m.m2).toMatchObject({ status: "completed", winnerId: "t3", loserId: "t2", setsA: 0, setsB: 2 });
    expect(m.m3).toMatchObject({ status: "ready", teamAId: "t1", teamBId: "t3" });

    const partial = byId(resolveMatches(threeTeam, new Map([["m2", [{ a: 25, b: 10 }]]]), rules));
    expect(partial.m2).toMatchObject({ status: "in_progress", setsA: 1, setsB: 0, winnerId: null });
  });

  it("passes byes through chains (bye vs bye, then team vs that bye)", () => {
    const specs = [
      spec("x1", 0, bye, bye),
      spec("x2", 1, team("t9"), winner("x1")),
      spec("x3", 2, loser("x2"), team("t8")),
    ];
    const m = byId(resolveMatches(specs, new Map(), rules));
    expect(m.x1).toMatchObject({ status: "bye", winnerId: null });
    expect(m.x2).toMatchObject({ status: "bye", winnerId: "t9" });
    expect(m.x3).toMatchObject({ status: "bye", winnerId: "t8" });
  });

  it("skips the grand final reset when the undefeated team wins", () => {
    const specs = [spec("gf", 0, team("w"), team("l")), spec("gf2", 1, winner("gf"), loser("gf"), "gf")];
    const m = byId(resolveMatches(specs, new Map([["gf", A_WINS]]), rules));
    expect(m.gf2.status).toBe("not_needed");
  });

  it("plays the grand final reset when the losers-bracket team wins", () => {
    const specs = [spec("gf", 0, team("w"), team("l")), spec("gf2", 1, winner("gf"), loser("gf"), "gf")];
    const pending = byId(resolveMatches(specs, new Map(), rules));
    expect(pending.gf2.status).toBe("pending");
    const m = byId(resolveMatches(specs, new Map([["gf", B_WINS]]), rules));
    expect(m.gf2).toMatchObject({ status: "ready", teamAId: "w", teamBId: "l" });
  });

  it("returns matches in play order regardless of input order", () => {
    const shuffled = [threeTeam[2], threeTeam[0], threeTeam[1]];
    expect(resolveMatches(shuffled, new Map(), rules).map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
  });

  it("rejects a source that is played later", () => {
    const specs = [spec("a", 0, winner("b"), team("t1")), spec("b", 1, team("t2"), team("t3"))];
    expect(() => resolveMatches(specs, new Map(), rules)).toThrow(/earlier/);
  });
});

describe("findInvalidatedMatches", () => {
  it("flags later matches with scores whose teams would change", () => {
    const before = resolveMatches(threeTeam, new Map([["m2", B_WINS], ["m3", [{ a: 25, b: 20 }]]]), rules);
    const after = resolveMatches(threeTeam, new Map([["m2", A_WINS], ["m3", [{ a: 25, b: 20 }]]]), rules);
    expect(findInvalidatedMatches(before, after).map((m) => m.id)).toEqual(["m3"]);
  });

  it("allows an override that keeps the same winner", () => {
    const before = resolveMatches(threeTeam, new Map([["m2", B_WINS], ["m3", A_WINS]]), rules);
    const after = resolveMatches(threeTeam, new Map([["m2", [{ a: 20, b: 25 }, { a: 25, b: 20 }, { a: 10, b: 15 }]], ["m3", A_WINS]]), rules);
    expect(findInvalidatedMatches(before, after)).toEqual([]);
  });
});

describe("allMatchesDecided", () => {
  it("is true only when nothing is left to play", () => {
    expect(allMatchesDecided(resolveMatches(threeTeam, new Map([["m2", A_WINS]]), rules))).toBe(false);
    expect(allMatchesDecided(resolveMatches(threeTeam, new Map([["m2", A_WINS], ["m3", A_WINS]]), rules))).toBe(true);
  });
});
