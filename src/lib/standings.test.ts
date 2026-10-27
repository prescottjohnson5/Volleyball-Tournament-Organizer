import { describe, expect, it } from "vitest";
import { resolveMatches } from "@/lib/bracket/engine";
import type { MatchSpec } from "@/lib/bracket/types";
import { createRuleset, type SetScore } from "@/lib/rules/ruleset";
import { seededTeams } from "@/test/ids";
import { computeStandings } from "./standings";

const rules = createRuleset("indoor");

function match(id: string, a: string, b: string, index: number): MatchSpec {
  return {
    id,
    phase: "pool",
    bracket: "pool",
    round: 1,
    position: 1,
    pool: "A",
    label: id,
    orderIndex: index,
    teamA: { type: "team", teamId: a },
    teamB: { type: "team", teamId: b },
    resetOf: null,
  };
}

function standings(teamCount: number, games: Array<[string, string, SetScore[]]>) {
  const specs = games.map(([a, b], i) => match(`g${i}`, a, b, i));
  const sets = new Map(games.map(([, , s], i) => [`g${i}`, s]));
  return computeStandings(seededTeams(teamCount), resolveMatches(specs, sets, rules));
}

const win = (a: number, b: number): SetScore => ({ a, b });

describe("computeStandings", () => {
  it("ranks by wins and records sets and points", () => {
    const rows = standings(3, [
      ["t1", "t2", [win(25, 20), win(25, 20)]],
      ["t2", "t3", [win(25, 10), win(25, 10)]],
      ["t1", "t3", [win(25, 23), win(25, 23)]],
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(["t1", "t2", "t3"]);
    expect(rows[0]).toMatchObject({ played: 2, wins: 2, losses: 0, setsWon: 4, setsLost: 0, pointsFor: 100, pointsAgainst: 86, rank: 1 });
  });

  it("breaks equal wins on set difference, then point difference", () => {
    // Everyone 1-1. t3 lost a set less; t1 and t2 tie on sets, t2 has better points.
    const rows = standings(3, [
      ["t1", "t2", [win(25, 20), win(20, 25), win(15, 13)]],
      ["t2", "t3", [win(25, 10), win(25, 10)]],
      ["t3", "t1", [win(25, 23), win(25, 23)]],
    ]);
    // Set diff: t1 2-3=-1, t2 3-2=+1, t3 2-2=0 → t2, t3, t1
    expect(rows.map((r) => r.teamId)).toEqual(["t2", "t3", "t1"]);
  });

  it("uses head-to-head for a two-way tie, even against seed order", () => {
    // Everyone has 1 win. t3 and t4 both finish with sets 2-2 and points 93-93; t4 beat t3.
    const rows = standings(4, [
      ["t3", "t4", [win(20, 25), win(23, 25)]],
      ["t3", "t1", [win(25, 20), win(25, 23)]],
      ["t1", "t4", [win(25, 20), win(25, 23)]],
      ["t2", "t1", [win(25, 0), win(25, 0)]],
    ]);
    expect(rows.map((r) => r.teamId)).toEqual(["t2", "t4", "t3", "t1"]);
  });

  it("falls back to seed and ignores unfinished matches", () => {
    const rows = standings(3, [["t2", "t3", [win(25, 10)]]]);
    expect(rows.map((r) => r.teamId)).toEqual(["t1", "t2", "t3"]);
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });
});
