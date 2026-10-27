import { z } from "zod";
import type { MatchSpec, ResolvedMatch, SlotSource } from "@/lib/bracket/types";
import { createRuleset, type BestOf, type Ruleset, type SetScore } from "@/lib/rules/ruleset";
import type { Json, MatchRow, MatchSetRow, Reporter, TournamentRow } from "@/lib/supabase/database.types";

const slotSourceSchema: z.ZodType<SlotSource> = z.discriminatedUnion("type", [
  z.object({ type: z.literal("team"), teamId: z.string() }),
  z.object({ type: z.literal("bye") }),
  z.object({ type: z.literal("winner"), matchId: z.string() }),
  z.object({ type: z.literal("loser"), matchId: z.string() }),
]);

export function rulesetFor(tournament: Pick<TournamentRow, "environment" | "best_of">): Ruleset {
  return createRuleset(tournament.environment, { bestOf: tournament.best_of as BestOf });
}

export function rowToSpec(row: MatchRow): MatchSpec {
  return {
    id: row.id,
    phase: row.phase,
    bracket: row.bracket,
    round: row.round,
    position: row.position,
    pool: row.pool,
    label: row.label,
    orderIndex: row.order_index,
    teamA: slotSourceSchema.parse(row.team_a_source),
    teamB: slotSourceSchema.parse(row.team_b_source),
    resetOf: row.reset_of_match_id,
  };
}

/** Set scores per match id, ordered by set number. */
export function setsByMatch(rows: readonly Pick<MatchSetRow, "match_id" | "set_number" | "score_a" | "score_b">[]): Map<string, SetScore[]> {
  const map = new Map<string, SetScore[]>();
  for (const row of [...rows].sort((x, y) => x.set_number - y.set_number)) {
    const list = map.get(row.match_id) ?? [];
    list.push({ a: row.score_a, b: row.score_b });
    map.set(row.match_id, list);
  }
  return map;
}

/** Shape expected by commit_tournament_changes for a new match. */
export function specToNewMatch(spec: MatchSpec) {
  return {
    id: spec.id,
    phase: spec.phase,
    bracket: spec.bracket,
    round: spec.round,
    position: spec.position,
    pool: spec.pool,
    label: spec.label,
    order_index: spec.orderIndex,
    team_a_source: spec.teamA as unknown as Json,
    team_b_source: spec.teamB as unknown as Json,
    reset_of_match_id: spec.resetOf,
  };
}

export type MatchUpdate = Pick<MatchRow, "id" | "team_a_id" | "team_b_id" | "winner_id" | "status" | "sets_a" | "sets_b">;

export function toMatchUpdate(match: ResolvedMatch): MatchUpdate {
  return {
    id: match.id,
    team_a_id: match.teamAId,
    team_b_id: match.teamBId,
    winner_id: match.winnerId,
    status: match.status,
    sets_a: match.setsA,
    sets_b: match.setsB,
  };
}

export function sameDerivedState(row: MatchUpdate, update: MatchUpdate): boolean {
  return (
    row.team_a_id === update.team_a_id &&
    row.team_b_id === update.team_b_id &&
    row.winner_id === update.winner_id &&
    row.status === update.status &&
    row.sets_a === update.sets_a &&
    row.sets_b === update.sets_b
  );
}

export interface SetRecord {
  set_number: number;
  score_a: number;
  score_b: number;
  reported_by: Reporter;
  reported_by_team_id: string | null;
  reported_by_user_id: string | null;
  reported_at?: string;
}

/** The JSON payload for the commit_tournament_changes database function. */
export interface CommitChanges {
  tournament?: Partial<Pick<TournamentRow, "status" | "champion_team_id" | "started_at" | "completed_at">>;
  teams?: Array<{ id: string; seed: number; pool: string | null }>;
  new_matches?: ReturnType<typeof specToNewMatch>[];
  set_replacements?: Array<{ match_id: string; sets: SetRecord[] }>;
  set_inserts?: Array<SetRecord & { match_id: string }>;
  match_updates?: MatchUpdate[];
}
