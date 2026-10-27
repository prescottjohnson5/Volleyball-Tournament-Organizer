import type { IdFactory, MatchSpec, ResolvedMatch, SeededTeam } from "@/lib/bracket/types";
import type { Ruleset } from "@/lib/rules/ruleset";
import type { FormatId } from "@/lib/supabase/database.types";

export type { FormatId };

export interface PlannedTeam extends SeededTeam {
  pool: string | null;
}

/** What a format produces when the tournament starts. */
export interface FormatPlan {
  matches: MatchSpec[];
  /** Pool label per team id (pool formats only). */
  pools: Record<string, string>;
}

/** Everything a format may look at after results come in. */
export interface FormatState {
  teams: readonly PlannedTeam[];
  matches: readonly ResolvedMatch[];
  rules: Ruleset;
}

/**
 * The contract every tournament format implements. Formats are pure: they turn seeded teams into
 * match structure and never touch the database, so a new format is one new module plus one
 * registry entry.
 */
export interface TournamentFormat {
  id: FormatId;
  name: string;
  description: string;
  minTeams: number;
  /** Matches to create when the organizer starts the tournament. */
  createInitialPlan(teams: readonly SeededTeam[], options: unknown, ids: IdFactory): FormatPlan;
  /**
   * Matches that can only be created once earlier results are known (for example the playoff
   * bracket after pool play). Called after every result; returns [] when nothing new is due.
   */
  createFollowUpMatches(state: FormatState, options: unknown, ids: IdFactory): MatchSpec[];
  /** The winning team id once the tournament is decided, else null. */
  champion(state: FormatState): string | null;
}
