import type { BracketSide, MatchPhase, MatchStatus } from "@/lib/supabase/database.types";
import type { SetScore } from "@/lib/rules/ruleset";

export type { BracketSide, MatchPhase, MatchStatus };

/** Where a match slot's team comes from. Stored as JSON on each match row. */
export type SlotSource =
  | { type: "team"; teamId: string }
  | { type: "bye" }
  | { type: "winner"; matchId: string }
  | { type: "loser"; matchId: string };

/** The fixed structure of a match, decided when the schedule is generated. */
export interface MatchSpec {
  id: string;
  phase: MatchPhase;
  bracket: BracketSide;
  /** Round within its bracket or pool (1-based). */
  round: number;
  /** Position within the round (1-based). */
  position: number;
  pool: string | null;
  label: string;
  /** Play order across the whole tournament. Every source match has a lower orderIndex. */
  orderIndex: number;
  teamA: SlotSource;
  teamB: SlotSource;
  /**
   * Double-elimination "if necessary" match: only played if the team in slot B of `resetOf`
   * (the losers-bracket champion) wins it. Then both teams play again.
   */
  resetOf: string | null;
}

/** A team with its seed (1 = strongest). */
export interface SeededTeam {
  id: string;
  seed: number;
}

export type IdFactory = () => string;

/** The resolved state of one slot. */
export type Slot = { kind: "team"; teamId: string } | { kind: "bye" } | { kind: "pending" };

/** A match with its teams, status and result derived from the structure and reported sets. */
export interface ResolvedMatch extends MatchSpec {
  slotA: Slot;
  slotB: Slot;
  teamAId: string | null;
  teamBId: string | null;
  status: MatchStatus;
  sets: SetScore[];
  setsA: number;
  setsB: number;
  winnerId: string | null;
  loserId: string | null;
  /** Who advances: a team, a bye (bye vs bye), or pending. */
  winnerSlot: Slot;
  loserSlot: Slot;
}
