/**
 * The single source of truth for volleyball scoring rules. No other module may hardcode
 * point targets: ask this module instead.
 */

export type Environment = "indoor" | "outdoor";
export type BestOf = 1 | 3 | 5;
export type Side = "a" | "b";

/** Points needed to win a regular set and the deciding (final) set, per environment. */
export const ENVIRONMENT_PRESETS: Record<Environment, { pointsPerSet: number; finalSetPoints: number }> = {
  indoor: { pointsPerSet: 25, finalSetPoints: 15 },
  outdoor: { pointsPerSet: 21, finalSetPoints: 15 },
};

export const DEFAULT_BEST_OF: BestOf = 3;
export const DEFAULT_WIN_BY = 2;
export const BEST_OF_OPTIONS: readonly BestOf[] = [1, 3, 5];

export interface Ruleset {
  environment: Environment;
  bestOf: BestOf;
  /** Sets needed to win the match (majority of bestOf). */
  setsToWin: number;
  pointsPerSet: number;
  /** Target for the deciding set. Only used when bestOf > 1. */
  finalSetPoints: number;
  /** Minimum winning margin once the target is reached. */
  winBy: number;
  /** Optional hard cap: first to this score wins even with a 1-point lead. Null = no cap. */
  cap: number | null;
}

export interface SetScore {
  a: number;
  b: number;
}

export function createRuleset(
  environment: Environment,
  options: { bestOf?: BestOf; winBy?: number; cap?: number | null } = {},
): Ruleset {
  const bestOf = options.bestOf ?? DEFAULT_BEST_OF;
  if (!BEST_OF_OPTIONS.includes(bestOf)) throw new Error(`bestOf must be one of ${BEST_OF_OPTIONS.join(", ")}`);
  const winBy = options.winBy ?? DEFAULT_WIN_BY;
  if (!Number.isInteger(winBy) || winBy < 1) throw new Error("winBy must be a positive integer");
  const preset = ENVIRONMENT_PRESETS[environment];
  const cap = options.cap ?? null;
  if (cap !== null && cap <= preset.pointsPerSet) throw new Error("cap must be higher than the set target");
  return {
    environment,
    bestOf,
    setsToWin: Math.floor(bestOf / 2) + 1,
    pointsPerSet: preset.pointsPerSet,
    finalSetPoints: preset.finalSetPoints,
    winBy,
    cap,
  };
}

/** True when this set number is the deciding set of a multi-set match. */
export function isDecidingSet(rules: Ruleset, setNumber: number): boolean {
  return rules.bestOf > 1 && setNumber === rules.bestOf;
}

/** Points needed to win the given set (1-based). */
export function pointsToWinSet(rules: Ruleset, setNumber: number): number {
  return isDecidingSet(rules, setNumber) ? rules.finalSetPoints : rules.pointsPerSet;
}

export type SetValidation = { ok: true; winner: Side } | { ok: false; error: string };

/**
 * Checks that a final set score is possible under the rules. A set ends the moment one team has
 * reached the target with the required lead, so 25-23 and 27-25 are valid but 27-20 is not
 * (the set would have ended at 25-20).
 */
export function validateSetScore(rules: Ruleset, setNumber: number, score: SetScore): SetValidation {
  const { a, b } = score;
  if (!Number.isInteger(setNumber) || setNumber < 1 || setNumber > rules.bestOf) {
    return { ok: false, error: `Set number must be between 1 and ${rules.bestOf}.` };
  }
  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { ok: false, error: "Scores must be whole numbers of 0 or more." };
  }
  if (a === b) return { ok: false, error: "A set cannot end in a tie." };

  const target = pointsToWinSet(rules, setNumber);
  const winner: Side = a > b ? "a" : "b";
  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const margin = high - low;

  if (rules.cap !== null && high === rules.cap && low === rules.cap - 1) return { ok: true, winner };
  if (rules.cap !== null && high > rules.cap) {
    return { ok: false, error: `Set ${setNumber} is capped at ${rules.cap} points.` };
  }
  if (high < target) {
    return { ok: false, error: `Set ${setNumber} is played to ${target}; the winner needs at least ${target} points.` };
  }
  if (margin < rules.winBy) {
    return { ok: false, error: `Set ${setNumber} must be won by ${rules.winBy} points.` };
  }
  if (high > target && margin !== rules.winBy) {
    return {
      ok: false,
      error: `Set ${setNumber} would have ended earlier: past ${target} points a set ends as soon as one team leads by ${rules.winBy}.`,
    };
  }
  return { ok: true, winner };
}

export interface MatchSummary {
  setsA: number;
  setsB: number;
  /** Winning side once a team has won setsToWin sets. */
  winner: Side | null;
}

/** Counts sets won. Assumes each set is valid; use validateMatchSets for untrusted input. */
export function summarizeSets(rules: Ruleset, sets: readonly SetScore[]): MatchSummary {
  let setsA = 0;
  let setsB = 0;
  for (const set of sets) {
    if (set.a > set.b) setsA++;
    else if (set.b > set.a) setsB++;
  }
  const winner = setsA >= rules.setsToWin ? "a" : setsB >= rules.setsToWin ? "b" : null;
  return { setsA, setsB, winner };
}

export type MatchValidation = { ok: true; summary: MatchSummary } | { ok: false; error: string };

/** Validates a full ordered list of set scores for one match. */
export function validateMatchSets(rules: Ruleset, sets: readonly SetScore[]): MatchValidation {
  if (sets.length > rules.bestOf) return { ok: false, error: `A best-of-${rules.bestOf} match has at most ${rules.bestOf} sets.` };
  let setsA = 0;
  let setsB = 0;
  for (let i = 0; i < sets.length; i++) {
    if (setsA >= rules.setsToWin || setsB >= rules.setsToWin) {
      return { ok: false, error: `The match was already decided before set ${i + 1}.` };
    }
    const result = validateSetScore(rules, i + 1, sets[i]);
    if (!result.ok) return result;
    if (result.winner === "a") setsA++;
    else setsB++;
  }
  return { ok: true, summary: summarizeSets(rules, sets) };
}

/** Human-readable rules, e.g. "Best of 3 · sets to 25 · deciding set to 15 · win by 2". */
export function describeRuleset(rules: Ruleset): string {
  const parts = [rules.bestOf === 1 ? "One set" : `Best of ${rules.bestOf}`, `sets to ${rules.pointsPerSet}`];
  if (rules.bestOf > 1) parts.push(`deciding set to ${rules.finalSetPoints}`);
  parts.push(`win by ${rules.winBy}`);
  parts.push(rules.cap === null ? "no cap" : `cap ${rules.cap}`);
  return parts.join(" · ");
}
