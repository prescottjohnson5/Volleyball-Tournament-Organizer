import { schedule, type DraftMatch } from "@/lib/bracket/schedule";
import { buildSingleElimination } from "@/lib/bracket/single-elimination";
import type { SlotSource } from "@/lib/bracket/types";
import type { FormatPlan, TournamentFormat } from "./types";

const winnerOf = (match: DraftMatch): SlotSource => ({ type: "winner", matchId: match.id });
const loserOf = (match: DraftMatch): SlotSource => ({ type: "loser", matchId: match.id });

function byRound(matches: readonly DraftMatch[]): DraftMatch[][] {
  const rounds: DraftMatch[][] = [];
  for (const m of matches) (rounds[m.round - 1] ??= []).push(m);
  return rounds;
}

/**
 * Double elimination: a team is out after its second loss.
 *
 * Winners bracket: a standard seeded bracket (byes for the top seeds).
 * Losers bracket, for k winners rounds: round 1 pairs the winners-round-1 losers; then for each
 * winners round j ≥ 2 there is a "drop" round where the losers of winners round j join, followed
 * (except after the winners final) by a round that halves the field. Drop-ins are reversed on
 * alternate rounds so teams are less likely to meet the same opponent twice.
 * Grand final: winners champion (slot A) vs losers champion (slot B). If the losers champion wins,
 * both teams have one loss and a reset match decides it.
 */
export const doubleEliminationFormat: TournamentFormat = {
  id: "double_elim",
  name: "Double elimination",
  description: "Every team plays until it loses twice. Includes a grand final reset if needed.",
  minTeams: 3,

  createInitialPlan(teams, _options, ids): FormatPlan {
    if (teams.length < this.minTeams) throw new Error(`Double elimination needs at least ${this.minTeams} teams`);

    const winners = buildSingleElimination(teams, {
      ids,
      phase: "bracket",
      bracket: "winners",
      label: (round, position, total) => (round === total ? "Winners Final" : `Winners R${round} · Match ${position}`),
    });
    const winnerRounds = byRound(winners);
    const k = winnerRounds.length;
    const losers: DraftMatch[] = [];
    const totalLoserRounds = 2 * (k - 1);

    const addLosersRound = (round: number, pairs: Array<[SlotSource, SlotSource]>): DraftMatch[] => {
      const created = pairs.map(([teamA, teamB], i): DraftMatch => ({
        id: ids(),
        phase: "bracket",
        bracket: "losers",
        round,
        position: i + 1,
        pool: null,
        label: round === totalLoserRounds ? "Losers Final" : `Losers R${round} · Match ${i + 1}`,
        teamA,
        teamB,
        resetOf: null,
      }));
      losers.push(...created);
      return created;
    };

    let previous: DraftMatch[] = [];
    if (k >= 2) {
      const firstRound = winnerRounds[0];
      let round = 1;
      previous = addLosersRound(
        round,
        Array.from({ length: firstRound.length / 2 }, (_, i): [SlotSource, SlotSource] => [
          loserOf(firstRound[2 * i]),
          loserOf(firstRound[2 * i + 1]),
        ]),
      );
      for (let j = 2; j <= k; j++) {
        const dropping = winnerRounds[j - 1];
        const reverse = j % 2 === 0;
        round++;
        previous = addLosersRound(
          round,
          previous.map((match, i): [SlotSource, SlotSource] => [
            winnerOf(match),
            loserOf(dropping[reverse ? dropping.length - 1 - i : i]),
          ]),
        );
        if (j < k) {
          round++;
          const field = previous;
          previous = addLosersRound(
            round,
            Array.from({ length: field.length / 2 }, (_, i): [SlotSource, SlotSource] => [
              winnerOf(field[2 * i]),
              winnerOf(field[2 * i + 1]),
            ]),
          );
        }
      }
    }

    const winnersFinal = winnerRounds[k - 1][0];
    const grandFinal: DraftMatch = {
      id: ids(),
      phase: "bracket",
      bracket: "final",
      round: 1,
      position: 1,
      pool: null,
      label: "Grand Final",
      teamA: winnerOf(winnersFinal),
      teamB: k >= 2 ? winnerOf(previous[0]) : loserOf(winnersFinal),
      resetOf: null,
    };
    const reset: DraftMatch = {
      id: ids(),
      phase: "bracket",
      bracket: "final",
      round: 2,
      position: 1,
      pool: null,
      label: "Grand Final (if necessary)",
      teamA: winnerOf(grandFinal),
      teamB: loserOf(grandFinal),
      resetOf: grandFinal.id,
    };

    return { matches: schedule([...winners, ...losers, grandFinal, reset]), pools: {} };
  },

  createFollowUpMatches() {
    return [];
  },

  champion(state) {
    const reset = state.matches.find((m) => m.resetOf !== null);
    if (!reset) return null;
    if (reset.status === "completed") return reset.winnerId;
    if (reset.status === "not_needed") return state.matches.find((m) => m.id === reset.resetOf)?.winnerId ?? null;
    return null;
  },
};
