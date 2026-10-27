import type { BracketSide, MatchSpec } from "./types";

/** A match before it has a place in the play order. */
export type DraftMatch = Omit<MatchSpec, "orderIndex">;

const BRACKET_PRIORITY: Record<BracketSide, number> = { pool: 0, winners: 1, losers: 2, final: 3 };

function dependencies(match: DraftMatch): string[] {
  const ids: string[] = [];
  for (const source of [match.teamA, match.teamB]) {
    if (source.type === "winner" || source.type === "loser") ids.push(source.matchId);
  }
  if (match.resetOf) ids.push(match.resetOf);
  return ids;
}

/**
 * Generates the schedule: groups matches into waves that can be played in parallel and assigns
 * each match its global play order. A match's wave is one more than the latest wave feeding it,
 * and pool matches never come before their pool round. Within a wave, pools come first, then
 * winners, losers and finals, then by round and position.
 *
 * @param earlierWaves highest wave already used by previously scheduled matches (e.g. pools
 *   before their playoff bracket), so new matches are scheduled after them.
 */
export function schedule(drafts: readonly DraftMatch[], startIndex = 0, earlierWaves = 0): Array<MatchSpec & { wave: number }> {
  const byId = new Map(drafts.map((d) => [d.id, d]));
  const waves = new Map<string, number>();

  function waveOf(id: string, stack: Set<string>): number {
    const known = waves.get(id);
    if (known !== undefined) return known;
    const match = byId.get(id);
    if (!match) return earlierWaves; // scheduled earlier (outside this batch)
    if (stack.has(id)) throw new Error(`Circular match dependency at ${id}`);
    stack.add(id);
    const floor = earlierWaves + (match.phase === "pool" ? match.round : 1);
    const fromSources = dependencies(match).map((dep) => waveOf(dep, stack) + 1);
    const wave = Math.max(floor, ...fromSources);
    stack.delete(id);
    waves.set(id, wave);
    return wave;
  }

  for (const draft of drafts) waveOf(draft.id, new Set());

  return [...drafts]
    .map((d) => ({ ...d, wave: waves.get(d.id)! }))
    .sort(
      (x, y) =>
        x.wave - y.wave ||
        BRACKET_PRIORITY[x.bracket] - BRACKET_PRIORITY[y.bracket] ||
        (x.pool ?? "").localeCompare(y.pool ?? "") ||
        x.round - y.round ||
        x.position - y.position,
    )
    .map((d, i) => ({ ...d, orderIndex: startIndex + i }));
}
