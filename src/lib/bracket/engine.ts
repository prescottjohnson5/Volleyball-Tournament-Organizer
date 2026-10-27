import { summarizeSets, type Ruleset, type SetScore } from "@/lib/rules/ruleset";
import type { MatchSpec, ResolvedMatch, Slot, SlotSource } from "./types";

const PENDING: Slot = { kind: "pending" };
const BYE: Slot = { kind: "bye" };

function teamIdOf(slot: Slot): string | null {
  return slot.kind === "team" ? slot.teamId : null;
}

function resolveSource(source: SlotSource, resolved: Map<string, ResolvedMatch>): Slot {
  switch (source.type) {
    case "team":
      return { kind: "team", teamId: source.teamId };
    case "bye":
      return BYE;
    case "winner":
    case "loser": {
      const from = resolved.get(source.matchId);
      if (!from) throw new Error(`Match source ${source.matchId} must come earlier in play order`);
      return source.type === "winner" ? from.winnerSlot : from.loserSlot;
    }
  }
}

/**
 * Derives every match's teams, status and winner from the fixed bracket structure plus the set
 * scores reported so far. Pure and deterministic: the database stores the output as a cache,
 * so overrides and byes never need special "advance the winner" code paths.
 */
export function resolveMatches(
  specs: readonly MatchSpec[],
  setsByMatch: ReadonlyMap<string, readonly SetScore[]>,
  rules: Ruleset,
): ResolvedMatch[] {
  const ordered = [...specs].sort((x, y) => x.orderIndex - y.orderIndex);
  const resolved = new Map<string, ResolvedMatch>();

  for (const spec of ordered) {
    let slotA: Slot;
    let slotB: Slot;
    let notNeeded = false;

    if (spec.resetOf) {
      const first = resolved.get(spec.resetOf);
      if (!first) throw new Error(`Reset match ${spec.id} must come after ${spec.resetOf}`);
      if (first.status !== "completed") {
        slotA = PENDING;
        slotB = PENDING;
      } else if (first.winnerId === first.teamAId) {
        // The undefeated team won the first final: no reset needed.
        slotA = first.slotA;
        slotB = first.slotB;
        notNeeded = true;
      } else {
        slotA = first.slotA;
        slotB = first.slotB;
      }
    } else {
      slotA = resolveSource(spec.teamA, resolved);
      slotB = resolveSource(spec.teamB, resolved);
    }

    const sets = [...(setsByMatch.get(spec.id) ?? [])];
    let match: ResolvedMatch;

    const base = {
      ...spec,
      slotA,
      slotB,
      teamAId: teamIdOf(slotA),
      teamBId: teamIdOf(slotB),
      sets,
    };

    if (notNeeded) {
      match = { ...base, status: "not_needed", setsA: 0, setsB: 0, winnerId: null, loserId: null, winnerSlot: PENDING, loserSlot: PENDING };
    } else if (slotA.kind === "pending" || slotB.kind === "pending") {
      match = { ...base, status: "pending", setsA: 0, setsB: 0, winnerId: null, loserId: null, winnerSlot: PENDING, loserSlot: PENDING };
    } else if (slotA.kind === "bye" || slotB.kind === "bye") {
      // A team facing a bye advances automatically; bye vs bye passes a bye along.
      const winnerSlot = slotA.kind === "team" ? slotA : slotB;
      match = {
        ...base,
        status: "bye",
        setsA: 0,
        setsB: 0,
        winnerId: teamIdOf(winnerSlot),
        loserId: null,
        winnerSlot,
        loserSlot: BYE,
      };
    } else {
      const summary = summarizeSets(rules, sets);
      const status = summary.winner ? "completed" : sets.length > 0 ? "in_progress" : "ready";
      const winnerSlot = summary.winner === "a" ? slotA : summary.winner === "b" ? slotB : PENDING;
      const loserSlot = summary.winner === "a" ? slotB : summary.winner === "b" ? slotA : PENDING;
      match = {
        ...base,
        status,
        setsA: summary.setsA,
        setsB: summary.setsB,
        winnerId: teamIdOf(winnerSlot),
        loserId: teamIdOf(loserSlot),
        winnerSlot,
        loserSlot,
      };
    }
    resolved.set(spec.id, match);
  }

  return ordered.map((spec) => resolved.get(spec.id)!);
}

/**
 * Matches whose teams changed between two resolutions even though scores were already reported
 * for them. Used to refuse an override that would silently rewrite a later match's history.
 */
export function findInvalidatedMatches(before: readonly ResolvedMatch[], after: readonly ResolvedMatch[]): ResolvedMatch[] {
  const previous = new Map(before.map((m) => [m.id, m]));
  return after.filter((match) => {
    const old = previous.get(match.id);
    if (!old || old.sets.length === 0) return false;
    return old.teamAId !== match.teamAId || old.teamBId !== match.teamBId;
  });
}

/** True when every match is decided (completed, bye or not needed). */
export function allMatchesDecided(matches: readonly ResolvedMatch[]): boolean {
  return matches.every((m) => m.status === "completed" || m.status === "bye" || m.status === "not_needed");
}
