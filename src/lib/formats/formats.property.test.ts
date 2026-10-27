import { describe, expect, it } from "vitest";
import { allMatchesDecided } from "@/lib/bracket/engine";
import type { ResolvedMatch } from "@/lib/bracket/types";
import { simulateTournament } from "@/lib/demo/simulate";
import { createRuleset, validateMatchSets } from "@/lib/rules/ruleset";
import { counterIds, seededTeams } from "@/test/ids";
import { FORMATS } from "./index";

/**
 * Plays complete tournaments for every team count from 3 to 33 with several random seeds and
 * checks invariants that must hold for any bracket, including odd counts and byes.
 */
const TEAM_COUNTS = Array.from({ length: 31 }, (_, i) => i + 3);
const SEEDS = [1, 2, 3, 4];

function lossesByTeam(matches: readonly ResolvedMatch[]): Map<string, number> {
  const losses = new Map<string, number>();
  for (const m of matches) if (m.status === "completed") losses.set(m.loserId!, (losses.get(m.loserId!) ?? 0) + 1);
  return losses;
}

function checkCommonInvariants(matches: readonly ResolvedMatch[], rules: ReturnType<typeof createRuleset>) {
  expect(allMatchesDecided(matches)).toBe(true);
  for (const m of matches) {
    if (m.teamAId && m.teamBId) expect(m.teamAId).not.toBe(m.teamBId);
    if (m.status === "completed") expect(validateMatchSets(rules, m.sets).ok).toBe(true);
  }
}

describe.each(["indoor", "outdoor"] as const)("%s rules", (environment) => {
  const rules = createRuleset(environment, { bestOf: environment === "indoor" ? 5 : 3 });

  describe("double elimination", () => {
    it.each(TEAM_COUNTS)("finishes with %i teams: champion has ≤1 loss, everyone else exactly 2", (n) => {
      for (const seed of SEEDS) {
        const result = simulateTournament({ format: FORMATS.double_elim, rules, teams: seededTeams(n), ids: counterIds(), seed });
        checkCommonInvariants(result.matches, rules);
        expect(result.champion).not.toBeNull();
        const losses = lossesByTeam(result.matches);
        for (let t = 1; t <= n; t++) {
          const id = `t${t}`;
          if (id === result.champion) expect(losses.get(id) ?? 0).toBeLessThanOrEqual(1);
          else expect(losses.get(id)).toBe(2);
        }
      }
    });
  });

  describe("pool play → single elimination", () => {
    it.each(TEAM_COUNTS)("finishes with %i teams: full round robins, one bracket loss per eliminated qualifier", (n) => {
      for (const seed of SEEDS) {
        const result = simulateTournament({
          format: FORMATS.pool_to_single_elim,
          formatOptions: { poolSize: 4, advancePerPool: 2 },
          rules,
          teams: seededTeams(n),
          ids: counterIds(),
          seed,
        });
        checkCommonInvariants(result.matches, rules);
        expect(result.champion).not.toBeNull();

        // Every pair in a pool met exactly once.
        const poolMatches = result.matches.filter((m) => m.phase === "pool");
        for (const pool of new Set(result.teams.map((t) => t.pool))) {
          const size = result.teams.filter((t) => t.pool === pool).length;
          expect(poolMatches.filter((m) => m.pool === pool)).toHaveLength((size * (size - 1)) / 2);
        }

        // Bracket: champion never loses, every other qualifier loses exactly once.
        const bracket = result.matches.filter((m) => m.phase === "bracket");
        const qualifiers = new Set(bracket.flatMap((m) => [m.teamAId, m.teamBId]).filter(Boolean));
        const losses = lossesByTeam(bracket);
        for (const id of qualifiers) expect(losses.get(id!) ?? 0).toBe(id === result.champion ? 0 : 1);

        // With two qualifiers per pool and several pools, pool-mates never meet in playoff round 1.
        const poolOf = new Map(result.teams.map((t) => [t.id, t.pool]));
        if (new Set(poolOf.values()).size > 1) {
          for (const m of bracket.filter((b) => b.round === 1 && b.teamAId && b.teamBId)) {
            expect(poolOf.get(m.teamAId!)).not.toBe(poolOf.get(m.teamBId!));
          }
        }
      }
    });
  });
});
