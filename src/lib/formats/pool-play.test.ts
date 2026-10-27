import { describe, expect, it } from "vitest";
import { resolveMatches } from "@/lib/bracket/engine";
import { createRuleset } from "@/lib/rules/ruleset";
import { counterIds, seededTeams } from "@/test/ids";
import { assignPools, effectiveAdvance, playoffSeeds, poolCount, poolPlayFormat, roundRobin } from "./pool-play";

const rules = createRuleset("outdoor");

describe("poolCount", () => {
  it.each([
    [3, 4, 1],
    [5, 4, 1],
    [6, 4, 2],
    [8, 4, 2],
    [10, 4, 3],
    [12, 4, 3],
    [8, 3, 2],
    [16, 4, 4],
  ])("%i teams with target size %i → %i pools", (teams, size, pools) => {
    expect(poolCount(teams, size)).toBe(pools);
  });
});

describe("assignPools", () => {
  it("snakes seeds across pools", () => {
    const pools = assignPools(seededTeams(8), 2);
    expect(pools.get("A")!.map((t) => t.id)).toEqual(["t1", "t4", "t5", "t8"]);
    expect(pools.get("B")!.map((t) => t.id)).toEqual(["t2", "t3", "t6", "t7"]);
  });

  it("keeps pool sizes within one of each other", () => {
    const sizes = [...assignPools(seededTeams(11), 3).values()].map((p) => p.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });
});

describe("roundRobin", () => {
  it.each([2, 3, 4, 5, 6])("pairs every team once with %i teams", (n) => {
    const ids = Array.from({ length: n }, (_, i) => `t${i + 1}`);
    const pairings = roundRobin(ids);
    expect(pairings).toHaveLength((n * (n - 1)) / 2);
    const keys = new Set(pairings.map((p) => [p.a, p.b].sort().join("-")));
    expect(keys.size).toBe(pairings.length);
    // Nobody plays twice in a round.
    const rounds = new Map<number, string[]>();
    for (const p of pairings) rounds.set(p.round, [...(rounds.get(p.round) ?? []), p.a, p.b]);
    for (const teams of rounds.values()) expect(new Set(teams).size).toBe(teams.length);
  });

  it("gives one team a rest each round when the count is odd", () => {
    const rounds = new Set(roundRobin(["a", "b", "c", "d", "e"]).map((p) => p.round));
    expect(rounds.size).toBe(5);
  });
});

describe("poolPlayFormat", () => {
  it("creates pools and round-robin matches in play order", () => {
    const plan = poolPlayFormat.createInitialPlan(seededTeams(8), { poolSize: 4, advancePerPool: 2 }, counterIds());
    expect(plan.matches).toHaveLength(12);
    expect(new Set(Object.values(plan.pools))).toEqual(new Set(["A", "B"]));
    expect(plan.matches[0].label).toBe("Pool A · Round 1");
    // Pool rounds are interleaved across pools.
    expect(plan.matches.slice(0, 4).map((m) => m.round)).toEqual([1, 1, 1, 1]);
    expect(plan.matches.map((m) => m.orderIndex)).toEqual([...Array(12).keys()]);
  });

  it("seeds the playoff bracket only after every pool match is decided", () => {
    const ids = counterIds();
    const teams = seededTeams(8);
    const plan = poolPlayFormat.createInitialPlan(teams, {}, ids);
    const planned = teams.map((t) => ({ ...t, pool: plan.pools[t.id] }));
    const sets = new Map(plan.matches.slice(0, 11).map((m) => [m.id, [{ a: 21, b: 10 }, { a: 21, b: 10 }]]));

    const partial = resolveMatches(plan.matches, sets, rules);
    expect(poolPlayFormat.createFollowUpMatches({ teams: planned, matches: partial, rules }, {}, ids)).toEqual([]);

    sets.set(plan.matches[11].id, [{ a: 21, b: 10 }, { a: 21, b: 10 }]);
    const done = resolveMatches(plan.matches, sets, rules);
    const playoffs = poolPlayFormat.createFollowUpMatches({ teams: planned, matches: done, rules }, {}, ids);
    expect(playoffs.map((m) => m.label)).toEqual(["Semifinal 1", "Semifinal 2", "Final"]);
    expect(playoffs[0].orderIndex).toBe(12);

    // Pool winners are seeds 1 and 2 and cannot meet before the final.
    const semis = playoffs.slice(0, 2).map((m) => [m.teamA, m.teamB].map((s) => (s.type === "team" ? plan.pools[s.teamId] : null)));
    for (const [a, b] of semis) expect(a).not.toBe(b);
  });

  it("swaps playoff seeds so pool-mates do not meet in the first round", () => {
    const row = (teamId: string, seed: number, wins: number) => ({
      teamId,
      seed,
      wins,
      played: 3,
      losses: 3 - wins,
      setsWon: wins * 2,
      setsLost: (3 - wins) * 2,
      pointsFor: 0,
      pointsAgainst: 0,
      rank: 0,
    });
    // By record the runners-up order is b2, a2, which would pair a1 with a2 and b1 with b2.
    const standings = new Map([
      ["A", [row("a1", 1, 3), row("a2", 4, 1)]],
      ["B", [row("b1", 2, 2), row("b2", 3, 2)]],
    ]);
    expect(playoffSeeds(standings, 2).map((s) => s.id)).toEqual(["a1", "b1", "a2", "b2"]);
  });

  it("guarantees a two-team final with a single pool", () => {
    expect(effectiveAdvance(1, { poolSize: 4, advancePerPool: 1 })).toBe(2);
    expect(effectiveAdvance(3, { poolSize: 4, advancePerPool: 1 })).toBe(1);
  });

  it("rejects too few teams and invalid options", () => {
    expect(() => poolPlayFormat.createInitialPlan(seededTeams(2), {}, counterIds())).toThrow();
    expect(() => poolPlayFormat.createInitialPlan(seededTeams(8), { poolSize: 9 }, counterIds())).toThrow();
  });
});
