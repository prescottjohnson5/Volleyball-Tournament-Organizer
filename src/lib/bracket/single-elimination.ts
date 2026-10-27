import type { DraftMatch } from "./schedule";
import { bracketSize, seedPositions } from "./seeding";
import type { BracketSide, IdFactory, MatchPhase, SeededTeam, SlotSource } from "./types";

export interface SingleEliminationOptions {
  ids: IdFactory;
  phase: MatchPhase;
  bracket: BracketSide;
  /** Label for a match, given its round, position and the total number of rounds. */
  label?: (round: number, position: number, totalRounds: number) => string;
}

/** "Final", "Semifinal 2", "Quarterfinal 1", "Round of 16 · Match 3". */
export function knockoutLabel(round: number, position: number, totalRounds: number): string {
  const remaining = totalRounds - round;
  if (remaining === 0) return "Final";
  if (remaining === 1) return `Semifinal ${position}`;
  if (remaining === 2) return `Quarterfinal ${position}`;
  return `Round of ${2 ** (remaining + 1)} · Match ${position}`;
}

/**
 * Builds a single-elimination bracket. Teams are placed by seed in standard bracket order and
 * missing seeds become byes for the top seeds. Returns matches round by round; the last one is
 * the final.
 */
export function buildSingleElimination(teams: readonly SeededTeam[], options: SingleEliminationOptions): DraftMatch[] {
  if (teams.length < 2) throw new Error("A bracket needs at least 2 teams");
  const sorted = [...teams].sort((x, y) => x.seed - y.seed);
  const size = bracketSize(sorted.length);
  const totalRounds = Math.log2(size);
  const label = options.label ?? knockoutLabel;
  const slotFor = (seed: number): SlotSource => (seed <= sorted.length ? { type: "team", teamId: sorted[seed - 1].id } : { type: "bye" });

  const matches: DraftMatch[] = [];
  let previous: DraftMatch[] = [];
  const positions = seedPositions(size);

  for (let round = 1; round <= totalRounds; round++) {
    const count = size / 2 ** round;
    const current: DraftMatch[] = [];
    for (let i = 0; i < count; i++) {
      const teamA: SlotSource = round === 1 ? slotFor(positions[2 * i]) : { type: "winner", matchId: previous[2 * i].id };
      const teamB: SlotSource = round === 1 ? slotFor(positions[2 * i + 1]) : { type: "winner", matchId: previous[2 * i + 1].id };
      current.push({
        id: options.ids(),
        phase: options.phase,
        bracket: options.bracket,
        round,
        position: i + 1,
        pool: null,
        label: label(round, i + 1, totalRounds),
        teamA,
        teamB,
        resetOf: null,
      });
    }
    matches.push(...current);
    previous = current;
  }
  return matches;
}
