"use client";

import { TrophyIcon } from "@/components/Icons";
import type { TournamentView, ViewMatch } from "@/lib/view";
import { MatchCard } from "./MatchCard";
import { OverrideScores, type SaveMatchSets } from "./OverrideScores";

/** The organizer's match list, with a score editor on every playable match. `onSave` decides where scores go. */
export function MatchManager({ view, onSave }: { view: TournamentView; onSave: SaveMatchSets }) {
  const teams = new Map(view.teams.map((t) => [t.id, t]));
  const active = view.matches.filter((m) => m.status === "in_progress" || m.status === "ready");
  const completed = view.matches.filter((m) => m.status === "completed").reverse();
  const waiting = view.matches.filter((m) => m.status === "pending");
  const champion = view.tournament.championTeamId ? teams.get(view.tournament.championTeamId) : null;

  const card = (match: ViewMatch) => (
    <MatchCard key={match.id} match={match} teams={teams}>
      <OverrideScores match={match} view={view} onSave={onSave} />
    </MatchCard>
  );

  return (
    <div className="space-y-4">
      {champion && (
        <p className="flex items-center gap-3 rounded-2xl border border-sun/40 px-4 py-3 font-bold" role="status">
          <TrophyIcon className="h-5 w-5 shrink-0 text-sun" />
          <span>
            <span className="text-ink-muted">Champion:</span> {champion.name}
          </span>
        </p>
      )}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-ink-muted">In progress and up next ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-ink-subtle">Nothing to play right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{active.map(card)}</div>
        )}
      </div>

      {completed.length > 0 && (
        <details open={active.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Completed ({completed.length}): edit any score</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">{completed.map(card)}</div>
        </details>
      )}

      {waiting.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-ink-muted">Waiting for earlier results ({waiting.length})</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {waiting.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} compact />
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
