import type { ResolvedMatch, SeededTeam } from "@/lib/bracket/types";

export interface StandingRow {
  teamId: string;
  seed: number;
  played: number;
  wins: number;
  losses: number;
  setsWon: number;
  setsLost: number;
  pointsFor: number;
  pointsAgainst: number;
  rank: number;
}

type Totals = Omit<StandingRow, "rank">;

const primaryOrder = (x: Totals, y: Totals) =>
  y.wins - x.wins ||
  y.setsWon - y.setsLost - (x.setsWon - x.setsLost) ||
  y.pointsFor - y.pointsAgainst - (x.pointsFor - x.pointsAgainst);

/**
 * Pool standings from completed matches. Tiebreakers, in order:
 * 1. matches won, 2. set difference, 3. point difference,
 * 4. head-to-head result (only when exactly two teams are still tied), 5. seed.
 */
export function computeStandings(teams: readonly SeededTeam[], matches: readonly ResolvedMatch[]): StandingRow[] {
  const totals = new Map<string, Totals>(
    teams.map((t) => [
      t.id,
      { teamId: t.id, seed: t.seed, played: 0, wins: 0, losses: 0, setsWon: 0, setsLost: 0, pointsFor: 0, pointsAgainst: 0 },
    ]),
  );
  const headToHead = new Map<string, string>(); // "a|b" (sorted) -> winner id

  for (const match of matches) {
    if (match.status !== "completed" || !match.teamAId || !match.teamBId) continue;
    const a = totals.get(match.teamAId);
    const b = totals.get(match.teamBId);
    if (!a || !b) continue;
    a.played++;
    b.played++;
    a.setsWon += match.setsA;
    a.setsLost += match.setsB;
    b.setsWon += match.setsB;
    b.setsLost += match.setsA;
    for (const set of match.sets) {
      a.pointsFor += set.a;
      a.pointsAgainst += set.b;
      b.pointsFor += set.b;
      b.pointsAgainst += set.a;
    }
    if (match.winnerId === a.teamId) {
      a.wins++;
      b.losses++;
    } else {
      b.wins++;
      a.losses++;
    }
    headToHead.set([a.teamId, b.teamId].sort().join("|"), match.winnerId!);
  }

  const rows = [...totals.values()].sort((x, y) => primaryOrder(x, y) || x.seed - y.seed);

  // Resolve two-way ties by head-to-head.
  for (let i = 0; i < rows.length - 1; i++) {
    const tiedWithNext = primaryOrder(rows[i], rows[i + 1]) === 0;
    const tiedWithPrev = i > 0 && primaryOrder(rows[i - 1], rows[i]) === 0;
    const tiedAfter = i + 2 < rows.length && primaryOrder(rows[i + 1], rows[i + 2]) === 0;
    if (!tiedWithNext || tiedWithPrev || tiedAfter) continue;
    const winner = headToHead.get([rows[i].teamId, rows[i + 1].teamId].sort().join("|"));
    if (winner === rows[i + 1].teamId) [rows[i], rows[i + 1]] = [rows[i + 1], rows[i]];
  }

  return rows.map((row, i) => ({ ...row, rank: i + 1 }));
}
