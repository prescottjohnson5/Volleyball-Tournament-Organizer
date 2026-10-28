import { findInvalidatedMatches, resolveMatches } from "@/lib/bracket/engine";
import { UserFacingError } from "@/lib/errors";
import type { IdFactory, MatchSpec, ResolvedMatch, SeededTeam } from "@/lib/bracket/types";
import { getFormat, type PlannedTeam, type TournamentFormat } from "@/lib/formats";
import { validateMatchSets, type Ruleset, type SetScore } from "@/lib/rules/ruleset";
import type { MatchRow, MatchSetRow, TeamRow, TournamentRow } from "@/lib/supabase/database.types";
import {
  rowToSpec,
  rulesetFor,
  sameDerivedState,
  setsByMatch,
  specToNewMatch,
  toMatchUpdate,
  type CommitChanges,
  type SetRecord,
} from "./rows";

export type TournamentForProgress = Pick<
  TournamentRow,
  "id" | "format" | "format_options" | "environment" | "best_of" | "status" | "champion_team_id"
>;

export class TournamentRuleError extends UserFacingError {
  constructor(message: string) {
    super(message);
    this.name = "TournamentRuleError";
  }
}

/** Seeds paid teams in the order they paid (first to pay = seed 1). */
export function seedByRegistration(teams: readonly Pick<TeamRow, "id" | "paid_at" | "created_at">[]): SeededTeam[] {
  const time = (t: Pick<TeamRow, "paid_at" | "created_at">) => new Date(t.paid_at ?? t.created_at).getTime();
  return [...teams]
    .sort((x, y) => time(x) - time(y) || x.id.localeCompare(y.id))
    .map((t, i) => ({ id: t.id, seed: i + 1 }));
}

/**
 * Everything to write when the organizer starts the tournament: seeds, pools, the generated
 * schedule and the initial derived state (byes already resolved).
 */
export function planTournamentStart(
  tournament: TournamentForProgress,
  paidTeams: readonly Pick<TeamRow, "id" | "paid_at" | "created_at">[],
  ids: IdFactory,
  now: Date,
): CommitChanges {
  if (tournament.status !== "registration") throw new TournamentRuleError("This tournament has already started.");
  const format = getFormat(tournament.format);
  if (paidTeams.length < format.minTeams) {
    throw new TournamentRuleError(`${format.name} needs at least ${format.minTeams} paid teams (you have ${paidTeams.length}).`);
  }
  const seeded = seedByRegistration(paidTeams);
  const plan = format.createInitialPlan(seeded, tournament.format_options, ids);
  const resolved = resolveMatches(plan.matches, new Map(), rulesetFor(tournament));

  return {
    tournament: { status: "in_progress", started_at: now.toISOString() },
    teams: seeded.map((t) => ({ id: t.id, seed: t.seed, pool: plan.pools[t.id] ?? null })),
    new_matches: plan.matches.map(specToNewMatch),
    match_updates: resolved.map(toMatchUpdate),
  };
}

export interface ProgressSnapshot {
  tournament: TournamentForProgress;
  teams: readonly PlannedTeam[];
  matches: readonly MatchRow[];
  sets: readonly MatchSetRow[];
}

export interface ScoreEdit {
  matchId: string;
  /** Sets appended after the existing ones (captain reports). */
  append?: SetRecord[];
  /** Full replacement of the match's sets (organizer override). */
  replace?: SetRecord[];
}

/** Everything the score rules look at: the format, the teams and the schedule so far. */
export interface ScoreState {
  format: TournamentFormat;
  formatOptions: unknown;
  rules: Ruleset;
  teams: readonly PlannedTeam[];
  specs: readonly MatchSpec[];
  sets: ReadonlyMap<string, readonly SetScore[]>;
}

/**
 * The rule checks and recomputation behind every score change, shared by the server (planScoreEdit) and
 * the browser sandbox. `matchSets` is the full list of sets for the match after the change; `appending`
 * is true for a captain report, which may not touch a decided match. Returns every match (including any
 * follow-up matches now due, such as playoffs once pools finish) and the champion, if decided.
 */
export function applyScoreChange(
  state: ScoreState,
  matchId: string,
  matchSets: readonly SetScore[],
  { appending }: { appending: boolean },
  ids: IdFactory,
): { sets: Map<string, SetScore[]>; newSpecs: MatchSpec[]; matches: ResolvedMatch[]; champion: string | null } {
  const { format, formatOptions, rules, teams } = state;
  const specs = [...state.specs];
  const newSets = new Map<string, SetScore[]>([...state.sets].map(([id, list]) => [id, [...list]]));
  newSets.set(matchId, [...matchSets]);

  const before = resolveMatches(specs, state.sets, rules);
  const target = before.find((m) => m.id === matchId);
  if (!target) throw new TournamentRuleError("Match not found.");
  if (!["ready", "in_progress", "completed"].includes(target.status)) {
    throw new TournamentRuleError("Scores can only be entered once both teams are known.");
  }
  if (appending && target.status === "completed") {
    throw new TournamentRuleError("This match is already decided. Ask the organizer to correct it.");
  }
  if (target.phase === "pool" && specs.some((s) => s.phase === "bracket")) {
    throw new TournamentRuleError("Pool results are locked once the playoff bracket has been created.");
  }
  const validation = validateMatchSets(rules, matchSets);
  if (!validation.ok) throw new TournamentRuleError(validation.error);

  let after = resolveMatches(specs, newSets, rules);

  const invalidated = findInvalidatedMatches(before, after);
  if (invalidated.length > 0) {
    throw new TournamentRuleError(
      `This change would alter who plays in ${invalidated.map((m) => m.label).join(", ")}, which already has scores. Clear those scores first.`,
    );
  }

  const newSpecs: MatchSpec[] = [];
  for (;;) {
    const followUps = format.createFollowUpMatches({ teams, matches: after, rules }, formatOptions, ids);
    if (followUps.length === 0) break;
    newSpecs.push(...followUps);
    specs.push(...followUps);
    after = resolveMatches(specs, newSets, rules);
  }

  return { sets: newSets, newSpecs, matches: after, champion: format.champion({ teams, matches: after, rules }) };
}

/**
 * Applies a score edit and recomputes the whole tournament: derived match state, follow-up
 * matches (e.g. playoffs once pools finish) and completion. Throws TournamentRuleError when the
 * edit would change the teams of a later match that already has scores.
 */
export function planScoreEdit(snapshot: ProgressSnapshot, edit: ScoreEdit, ids: IdFactory, now: Date): {
  changes: CommitChanges;
  matches: ResolvedMatch[];
} {
  const oldSets = setsByMatch(snapshot.sets);
  const toScores = (records: SetRecord[]): SetScore[] => records.map((r) => ({ a: r.score_a, b: r.score_b }));
  const matchSets = edit.replace
    ? toScores(edit.replace)
    : [...(oldSets.get(edit.matchId) ?? []), ...toScores(edit.append ?? [])];

  const { newSpecs, matches: after, champion } = applyScoreChange(
    {
      format: getFormat(snapshot.tournament.format),
      formatOptions: snapshot.tournament.format_options,
      rules: rulesetFor(snapshot.tournament),
      teams: snapshot.teams,
      specs: snapshot.matches.map(rowToSpec),
      sets: oldSets,
    },
    edit.matchId,
    matchSets,
    { appending: Boolean(edit.append) },
    ids,
  );

  const existing = new Map(snapshot.matches.map((m) => [m.id, m]));
  const newIds = new Set(newSpecs.map((s) => s.id));
  const matchUpdates = after
    .map(toMatchUpdate)
    .filter((update) => newIds.has(update.id) || !sameDerivedState(existing.get(update.id)!, update));

  const changes: CommitChanges = { match_updates: matchUpdates };
  if (newSpecs.length > 0) changes.new_matches = newSpecs.map(specToNewMatch);
  if (edit.replace) changes.set_replacements = [{ match_id: edit.matchId, sets: edit.replace }];
  if (edit.append) changes.set_inserts = edit.append.map((record) => ({ ...record, match_id: edit.matchId }));

  if (champion && snapshot.tournament.champion_team_id !== champion) {
    changes.tournament = { status: "completed", champion_team_id: champion, completed_at: now.toISOString() };
  } else if (!champion && snapshot.tournament.status === "completed") {
    // An override reopened a decided tournament.
    changes.tournament = { status: "in_progress", champion_team_id: null, completed_at: null };
  }

  return { changes, matches: after };
}
