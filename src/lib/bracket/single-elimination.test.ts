import { describe, expect, it } from "vitest";
import { createRuleset } from "@/lib/rules/ruleset";
import { counterIds, seededTeams } from "@/test/ids";
import { resolveMatches } from "./engine";
import { schedule } from "./schedule";
import { bracketSize, seedPositions } from "./seeding";
import { buildSingleElimination, knockoutLabel } from "./single-elimination";

const rules = createRuleset("indoor");

describe("seeding", () => {
  it("rounds team counts up to a power of two", () => {
    expect([1, 2, 3, 4, 5, 8, 9, 16, 17].map(bracketSize)).toEqual([2, 2, 4, 4, 8, 8, 16, 16, 32]);
  });

  it("produces standard bracket order", () => {
    expect(seedPositions(2)).toEqual([1, 2]);
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
    expect(() => seedPositions(6)).toThrow();
  });

  it("pairs seeds that sum to size + 1 in round 1", () => {
    const order = seedPositions(16);
    for (let i = 0; i < order.length; i += 2) expect(order[i] + order[i + 1]).toBe(17);
  });
});

describe("buildSingleElimination", () => {
  const build = (n: number) => buildSingleElimination(seededTeams(n), { ids: counterIds(), phase: "bracket", bracket: "winners" });

  it.each([2, 3, 4, 5, 6, 7, 8, 11, 16, 17])("builds a complete bracket for %i teams", (n) => {
    const matches = build(n);
    const size = bracketSize(n);
    expect(matches).toHaveLength(size - 1);
    const firstRound = matches.filter((m) => m.round === 1);
    const byes = firstRound.filter((m) => m.teamA.type === "bye" || m.teamB.type === "bye");
    expect(byes).toHaveLength(size - n);
    // Never bye vs bye in round 1.
    expect(firstRound.some((m) => m.teamA.type === "bye" && m.teamB.type === "bye")).toBe(false);
  });

  it("gives byes to the top seeds", () => {
    const firstRound = build(5).filter((m) => m.round === 1);
    const byeTeams = firstRound
      .filter((m) => m.teamB.type === "bye" || m.teamA.type === "bye")
      .map((m) => (m.teamA.type === "team" ? m.teamA.teamId : m.teamB.type === "team" ? m.teamB.teamId : null));
    expect(byeTeams.sort()).toEqual(["t1", "t2", "t3"]);
  });

  it("labels rounds from the final backwards", () => {
    expect(build(8).map((m) => m.label)).toEqual([
      "Quarterfinal 1",
      "Quarterfinal 2",
      "Quarterfinal 3",
      "Quarterfinal 4",
      "Semifinal 1",
      "Semifinal 2",
      "Final",
    ]);
    expect(knockoutLabel(1, 3, 5)).toBe("Round of 32 · Match 3");
  });

  it("lets the top seed reach the final against seed 2 when favourites win", () => {
    const specs = schedule(build(6));
    // Lower team id = better seed: make every match go to the better seed.
    const sets = new Map<string, { a: number; b: number }[]>();
    let resolved = resolveMatches(specs, sets, rules);
    for (let guard = 0; guard < 10; guard++) {
      const ready = resolved.filter((m) => m.status === "ready");
      if (ready.length === 0) break;
      for (const m of ready) {
        const aBetter = Number(m.teamAId!.slice(1)) < Number(m.teamBId!.slice(1));
        sets.set(m.id, aBetter ? [{ a: 25, b: 10 }, { a: 25, b: 10 }] : [{ a: 10, b: 25 }, { a: 10, b: 25 }]);
      }
      resolved = resolveMatches(specs, sets, rules);
    }
    const final = resolved.find((m) => m.label === "Final")!;
    expect([final.teamAId, final.teamBId].sort()).toEqual(["t1", "t2"]);
    expect(final.winnerId).toBe("t1");
  });
});

describe("schedule", () => {
  it("orders matches so every source is played first", () => {
    const specs = schedule(buildSingleElimination(seededTeams(8), { ids: counterIds(), phase: "bracket", bracket: "winners" }));
    const order = new Map(specs.map((m) => [m.id, m.orderIndex]));
    for (const m of specs) {
      for (const s of [m.teamA, m.teamB]) {
        if (s.type === "winner" || s.type === "loser") expect(order.get(s.matchId)!).toBeLessThan(m.orderIndex);
      }
    }
    expect(specs.map((m) => m.wave)).toEqual([1, 1, 1, 1, 2, 2, 3]);
  });

  it("starts after earlier waves and indexes", () => {
    const specs = schedule(buildSingleElimination(seededTeams(4), { ids: counterIds(), phase: "bracket", bracket: "winners" }), 10, 3);
    expect(specs.map((m) => m.orderIndex)).toEqual([10, 11, 12]);
    expect(specs.map((m) => m.wave)).toEqual([4, 4, 5]);
  });
});
