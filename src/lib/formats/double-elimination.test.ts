import { describe, expect, it } from "vitest";
import { resolveMatches } from "@/lib/bracket/engine";
import { createRuleset } from "@/lib/rules/ruleset";
import { counterIds, seededTeams } from "@/test/ids";
import { doubleEliminationFormat } from "./double-elimination";

const rules = createRuleset("indoor");

function plan(n: number) {
  return doubleEliminationFormat.createInitialPlan(seededTeams(n), {}, counterIds()).matches;
}

describe("doubleEliminationFormat structure", () => {
  it.each([
    // teams, winners matches, losers matches
    [4, 3, 2],
    [8, 7, 6],
    [16, 15, 14],
  ])("%i teams: %i winners and %i losers matches plus 2 finals", (n, winners, losers) => {
    const matches = plan(n);
    expect(matches.filter((m) => m.bracket === "winners")).toHaveLength(winners);
    expect(matches.filter((m) => m.bracket === "losers")).toHaveLength(losers);
    expect(matches.filter((m) => m.bracket === "final").map((m) => m.label)).toEqual(["Grand Final", "Grand Final (if necessary)"]);
  });

  it("drops every winners-bracket loser into the losers bracket exactly once", () => {
    const matches = plan(8);
    const dropped = matches.flatMap((m) => [m.teamA, m.teamB]).filter((s) => s.type === "loser").map((s) => (s.type === "loser" ? s.matchId : ""));
    const winnersIds = matches.filter((m) => m.bracket === "winners").map((m) => m.id);
    const grandFinal = matches.find((m) => m.label === "Grand Final")!;
    // Each winners match feeds one loser; the reset also references the grand final's loser.
    expect(dropped.filter((id) => winnersIds.includes(id)).sort()).toEqual([...winnersIds].sort());
    expect(dropped.filter((id) => id === grandFinal.id)).toHaveLength(1);
  });

  it("labels the last losers round as the losers final", () => {
    const losers = plan(8).filter((m) => m.bracket === "losers");
    expect(losers.at(-1)!.label).toBe("Losers Final");
    expect(Math.max(...losers.map((m) => m.round))).toBe(4);
  });

  it("schedules every match after the matches that feed it", () => {
    const matches = plan(12);
    const order = new Map(matches.map((m) => [m.id, m.orderIndex]));
    for (const m of matches) {
      for (const s of [m.teamA, m.teamB]) {
        if (s.type !== "team" && s.type !== "bye") expect(order.get(s.matchId)!).toBeLessThan(m.orderIndex);
      }
    }
  });
});

describe("doubleEliminationFormat byes", () => {
  it("resolves byes for 5 teams so only real matches are playable", () => {
    const matches = resolveMatches(plan(5), new Map(), rules);
    const ready = matches.filter((m) => m.status === "ready");
    // Seeds 1-3 have byes, so 4 v 5 is the only real first-round match and seeds 2 and 3
    // meet straight away in winners round 2. Seed 1 waits for the 4 v 5 winner.
    expect(ready.map((m) => [m.teamAId, m.teamBId].sort())).toEqual([
      ["t4", "t5"],
      ["t2", "t3"],
    ]);
    expect(matches.find((m) => m.bracket === "winners" && m.round === 2 && m.teamAId === "t1")!.status).toBe("pending");
    // Losers round 1 pairs three byes and one pending loser: no bye-vs-bye match is left pending forever.
    expect(matches.filter((m) => m.bracket === "losers" && m.round === 1).every((m) => m.status !== "ready")).toBe(true);
  });
});

describe("doubleEliminationFormat champion", () => {
  it("is decided by the grand final when the winners champion wins it", () => {
    const matches = plan(4);
    const sets = new Map<string, { a: number; b: number }[]>();
    const aWins = [{ a: 25, b: 10 }, { a: 25, b: 10 }];
    const bWins = [{ a: 10, b: 25 }, { a: 10, b: 25 }];
    let resolved = resolveMatches(matches, sets, rules);
    for (let guard = 0; guard < 10; guard++) {
      const ready = resolved.filter((m) => m.status === "ready");
      if (ready.length === 0) break;
      for (const m of ready) sets.set(m.id, aWins);
      resolved = resolveMatches(matches, sets, rules);
    }
    const state = { teams: [], matches: resolved, rules };
    expect(resolved.find((m) => m.resetOf)!.status).toBe("not_needed");
    expect(doubleEliminationFormat.champion(state)).toBe("t1");

    // Same bracket, but the losers champion wins the grand final: a reset is needed.
    const gf = matches.find((m) => m.label === "Grand Final")!;
    sets.set(gf.id, bWins);
    resolved = resolveMatches(matches, sets, rules);
    const reset = resolved.find((m) => m.resetOf)!;
    expect(reset.status).toBe("ready");
    expect(doubleEliminationFormat.champion({ teams: [], matches: resolved, rules })).toBeNull();
    sets.set(reset.id, bWins);
    resolved = resolveMatches(matches, sets, rules);
    expect(doubleEliminationFormat.champion({ teams: [], matches: resolved, rules })).toBe(reset.teamBId);
  });
});
