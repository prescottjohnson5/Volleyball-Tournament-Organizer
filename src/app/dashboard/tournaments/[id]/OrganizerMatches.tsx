"use client";

import { LiveIndicator } from "@/components/tournament/LiveIndicator";
import { MatchManager } from "@/components/tournament/MatchManager";
import type { SaveMatchSets } from "@/components/tournament/OverrideScores";
import { useLiveTournament } from "@/components/tournament/useLiveTournament";
import type { TournamentView } from "@/lib/view";

/** Live match list for the organizer, with a score override on every playable match. */
export function OrganizerMatches({ initialView }: { initialView: TournamentView }) {
  const { view, status, refresh } = useLiveTournament(initialView);

  const save: SaveMatchSets = async (matchId, sets) => {
    const response = await fetch(`/api/tournaments/${view.tournament.id}/matches/${matchId}/sets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets }),
    }).catch(() => null);
    const result = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
    if (!response?.ok) return result?.error ?? "Could not save the score. Check your connection and try again.";
    refresh();
    return null;
  };

  return (
    <section className="space-y-4">
      <LiveIndicator status={status} />
      <MatchManager view={view} onSave={save} />
    </section>
  );
}
