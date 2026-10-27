import { z } from "zod";
import { allMatchesDecided } from "@/lib/bracket/engine";
import { schedule, type DraftMatch } from "@/lib/bracket/schedule";
import { bracketSize, seedPositions } from "@/lib/bracket/seeding";
import { buildSingleElimination } from "@/lib/bracket/single-elimination";
import type { IdFactory, MatchSpec, SeededTeam } from "@/lib/bracket/types";
import { computeStandings, type StandingRow } from "@/lib/standings";
import type { FormatPlan, FormatState, TournamentFormat } from "./types";

export const poolOptionsSchema = z.object({
  /** Target number of teams per pool. Actual pools may be one smaller or larger. */
  poolSize: z.number().int().min(3).max(6).default(4),
  /** How many teams from each pool reach the playoff bracket. */
  advancePerPool: z.number().int().min(1).max(4).default(2),
});

export type PoolOptions = z.infer<typeof poolOptionsSchema>;

const POOL_LABELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Number of pools: close to the target size, and never a pool smaller than 3 teams. */
export function poolCount(teamCount: number, poolSize: number): number {
  return Math.max(1, Math.min(Math.round(teamCount / poolSize), Math.floor(teamCount / 3)));
}

/** Snake seeding: 1→A, 2→B, 3→C, 4→C, 5→B, 6→A, ... keeps pools balanced. */
export function assignPools(teams: readonly SeededTeam[], count: number): Map<string, SeededTeam[]> {
  const pools = new Map<string, SeededTeam[]>();
  for (let p = 0; p < count; p++) pools.set(POOL_LABELS[p], []);
  [...teams]
    .sort((x, y) => x.seed - y.seed)
    .forEach((team, i) => {
      const lap = Math.floor(i / count);
      const offset = i % count;
      const index = lap % 2 === 0 ? offset : count - 1 - offset;
      pools.get(POOL_LABELS[index])!.push(team);
    });
  return pools;
}

/**
 * Round-robin pairings with the circle method. With an odd number of teams one team sits out
 * each round (no match is created for the bye).
 */
export function roundRobin(teamIds: readonly string[]): Array<{ round: number; a: string; b: string }> {
  const slots: Array<string | null> = [...teamIds];
  if (slots.length % 2 === 1) slots.push(null);
  const rounds = slots.length - 1;
  const half = slots.length / 2;
  const pairings: Array<{ round: number; a: string; b: string }> = [];
  for (let round = 1; round <= rounds; round++) {
    for (let i = 0; i < half; i++) {
      const a = slots[i];
      const b = slots[slots.length - 1 - i];
      if (a && b) pairings.push(round % 2 === 0 ? { round, a: b, b: a } : { round, a, b });
    }
    // Keep the first slot fixed and rotate the rest clockwise.
    slots.splice(1, 0, slots.pop()!);
  }
  return pairings;
}

/** Teams advancing per pool, adjusted so the playoff bracket has at least two teams. */
export function effectiveAdvance(pools: number, options: PoolOptions): number {
  return pools === 1 ? Math.max(2, options.advancePerPool) : options.advancePerPool;
}

type Qualifier = { teamId: string; pool: string; tier: number };

/** Number of first-round matches between two teams from the same pool. */
function samePoolOpeners(order: readonly Qualifier[]): number {
  const positions = seedPositions(bracketSize(order.length));
  let count = 0;
  for (let i = 0; i < positions.length; i += 2) {
    const a = order[positions[i] - 1];
    const b = order[positions[i + 1] - 1];
    if (a && b && a.pool === b.pool) count++;
  }
  return count;
}

/**
 * Playoff seeds: all pool winners first, then all runners-up, and so on. Within the same pool
 * finish, better records seed higher (wins, set difference, point difference, original seed).
 * Then seeds are swapped within a finishing tier, where possible, so teams from the same pool
 * do not meet in the first playoff round.
 */
export function playoffSeeds(standingsByPool: ReadonlyMap<string, StandingRow[]>, advance: number): SeededTeam[] {
  const order: Qualifier[] = [];
  for (let rank = 1; rank <= advance; rank++) {
    const tier = [...standingsByPool.entries()]
      .map(([pool, rows]) => ({ pool, row: rows[rank - 1] }))
      .filter((entry): entry is { pool: string; row: StandingRow } => Boolean(entry.row))
      .sort(
        ({ row: x }, { row: y }) =>
          y.wins - x.wins ||
          y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
          y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst) ||
          x.seed - y.seed,
      );
    for (const { pool, row } of tier) order.push({ teamId: row.teamId, pool, tier: rank });
  }

  // Greedy repair: try every same-tier swap and keep the first one that reduces conflicts.
  let conflicts = samePoolOpeners(order);
  while (conflicts > 0) {
    let improved = false;
    search: for (let i = order.length - 1; i > 0; i--) {
      for (let j = i - 1; j >= 0; j--) {
        if (order[i].tier !== order[j].tier) continue;
        [order[i], order[j]] = [order[j], order[i]];
        const after = samePoolOpeners(order);
        if (after < conflicts) {
          conflicts = after;
          improved = true;
          break search;
        }
        [order[i], order[j]] = [order[j], order[i]];
      }
    }
    if (!improved) break;
  }

  return order.map((q, i) => ({ id: q.teamId, seed: i + 1 }));
}

export const poolPlayFormat: TournamentFormat = {
  id: "pool_to_single_elim",
  name: "Pool play → single elimination",
  description: "Round-robin pools, then the top teams from each pool play a knockout bracket.",
  minTeams: 3,

  createInitialPlan(teams, rawOptions, ids): FormatPlan {
    if (teams.length < this.minTeams) throw new Error(`Pool play needs at least ${this.minTeams} teams`);
    const options = poolOptionsSchema.parse(rawOptions ?? {});
    const pools = assignPools(teams, poolCount(teams.length, options.poolSize));
    const drafts: DraftMatch[] = [];
    const poolOf: Record<string, string> = {};

    for (const [label, members] of pools) {
      for (const team of members) poolOf[team.id] = label;
      const positions = new Map<number, number>();
      for (const pairing of roundRobin(members.map((t) => t.id))) {
        const position = (positions.get(pairing.round) ?? 0) + 1;
        positions.set(pairing.round, position);
        drafts.push({
          id: ids(),
          phase: "pool",
          bracket: "pool",
          round: pairing.round,
          position,
          pool: label,
          label: `Pool ${label} · Round ${pairing.round}`,
          teamA: { type: "team", teamId: pairing.a },
          teamB: { type: "team", teamId: pairing.b },
          resetOf: null,
        });
      }
    }
    return { matches: schedule(drafts), pools: poolOf };
  },

  createFollowUpMatches(state: FormatState, rawOptions, ids: IdFactory): MatchSpec[] {
    if (state.matches.some((m) => m.phase === "bracket")) return [];
    const poolMatches = state.matches.filter((m) => m.phase === "pool");
    if (poolMatches.length === 0 || !allMatchesDecided(poolMatches)) return [];

    const options = poolOptionsSchema.parse(rawOptions ?? {});
    const labels = [...new Set(state.teams.map((t) => t.pool).filter((p): p is string => Boolean(p)))].sort();
    const standingsByPool = new Map(
      labels.map((label) => [
        label,
        computeStandings(
          state.teams.filter((t) => t.pool === label),
          poolMatches.filter((m) => m.pool === label),
        ),
      ]),
    );
    const qualifiers = playoffSeeds(standingsByPool, effectiveAdvance(labels.length, options));
    const drafts = buildSingleElimination(qualifiers, { ids, phase: "bracket", bracket: "winners" });
    const lastIndex = Math.max(...state.matches.map((m) => m.orderIndex));
    const lastPoolRound = Math.max(...poolMatches.map((m) => m.round));
    return schedule(drafts, lastIndex + 1, lastPoolRound);
  },

  champion(state) {
    const bracket = state.matches.filter((m) => m.phase === "bracket");
    if (bracket.length === 0) return null;
    const final = bracket.reduce((latest, m) => (m.round > latest.round ? m : latest));
    return final.status === "completed" || final.status === "bye" ? final.winnerId : null;
  },
};
