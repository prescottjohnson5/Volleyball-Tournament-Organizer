import { resolveMatches } from "@/lib/bracket/engine";
import type { IdFactory, MatchSpec, ResolvedMatch, SeededTeam } from "@/lib/bracket/types";
import type { PlannedTeam, TournamentFormat } from "@/lib/formats";
import { pointsToWinSet, type Ruleset, type SetScore, type Side } from "@/lib/rules/ruleset";

/** Small seeded PRNG (mulberry32) so simulations are repeatable. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A realistic, rule-valid final score for one set. */
export function simulateSetScore(rules: Ruleset, setNumber: number, winner: Side, rng: () => number): SetScore {
  const target = pointsToWinSet(rules, setNumber);
  let high: number;
  let low: number;
  if (rng() < 0.2) {
    // Extended set: ends as soon as someone leads by winBy past the target.
    low = target - 1 + Math.floor(rng() * 4);
    high = low + rules.winBy;
  } else {
    high = target;
    low = Math.floor(rng() * (target - rules.winBy + 1));
  }
  return winner === "a" ? { a: high, b: low } : { a: low, b: high };
}

/** Set scores for a whole match won by `winner`, sometimes going the distance. */
export function simulateMatchSets(rules: Ruleset, winner: Side, rng: () => number): SetScore[] {
  const loser: Side = winner === "a" ? "b" : "a";
  const loserSets = Math.floor(rng() * rules.setsToWin);
  const order: Side[] = [];
  for (let i = 0; i < loserSets; i++) order.push(loser);
  for (let i = 0; i < rules.setsToWin - 1; i++) order.push(winner);
  // Shuffle everything except the final, deciding set, which the winner always takes.
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  order.push(winner);
  return order.map((side, i) => simulateSetScore(rules, i + 1, side, rng));
}

export interface SimulationInput {
  format: TournamentFormat;
  formatOptions?: unknown;
  rules: Ruleset;
  teams: readonly SeededTeam[];
  ids: IdFactory;
  seed?: number;
  /** Stop after this many matches have been played (default: play everything). */
  maxMatches?: number;
  /** After stopping, start this many ready matches (one set played) so they show as live. */
  inProgress?: number;
  /** Probability that the better seed wins (default 0.7). */
  favouriteWins?: number;
}

export interface SimulationResult {
  specs: MatchSpec[];
  sets: Map<string, SetScore[]>;
  teams: PlannedTeam[];
  matches: ResolvedMatch[];
  champion: string | null;
}

/** Plays a tournament forward with random but rule-valid scores. */
export function simulateTournament(input: SimulationInput): SimulationResult {
  const rng = createRng(input.seed ?? 1);
  const seedOf = new Map(input.teams.map((t) => [t.id, t.seed]));
  const plan = input.format.createInitialPlan(input.teams, input.formatOptions, input.ids);
  const teams: PlannedTeam[] = input.teams.map((t) => ({ ...t, pool: plan.pools[t.id] ?? null }));
  const specs: MatchSpec[] = [...plan.matches];
  const sets = new Map<string, SetScore[]>();
  const limit = input.maxMatches ?? Number.POSITIVE_INFINITY;
  let played = 0;
  let matches = resolveMatches(specs, sets, input.rules);

  for (;;) {
    const followUps = input.format.createFollowUpMatches({ teams, matches, rules: input.rules }, input.formatOptions, input.ids);
    if (followUps.length > 0) {
      specs.push(...followUps);
      matches = resolveMatches(specs, sets, input.rules);
      continue;
    }
    const ready = matches.filter((m) => m.status === "ready");
    if (ready.length === 0 || played >= limit) break;
    for (const match of ready) {
      if (played >= limit) break;
      const favourite: Side = seedOf.get(match.teamAId!)! < seedOf.get(match.teamBId!)! ? "a" : "b";
      const upset = rng() >= (input.favouriteWins ?? 0.7);
      const winner: Side = upset ? (favourite === "a" ? "b" : "a") : favourite;
      sets.set(match.id, simulateMatchSets(input.rules, winner, rng));
      played++;
    }
    matches = resolveMatches(specs, sets, input.rules);
  }

  if (input.inProgress) {
    for (const match of matches.filter((m) => m.status === "ready").slice(0, input.inProgress)) {
      sets.set(match.id, [simulateSetScore(input.rules, 1, rng() < 0.5 ? "a" : "b", rng)]);
    }
    matches = resolveMatches(specs, sets, input.rules);
  }

  return { specs, sets, teams, matches, champion: input.format.champion({ teams, matches, rules: input.rules }) };
}
