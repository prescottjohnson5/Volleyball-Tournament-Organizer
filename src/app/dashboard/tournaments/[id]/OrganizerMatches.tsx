"use client";

import Link from "next/link";
import { LiveIndicator } from "@/components/tournament/LiveIndicator";
import { MatchCard } from "@/components/tournament/MatchCard";
import { useLiveTournament } from "@/components/tournament/useLiveTournament";
import type { TournamentView, ViewMatch } from "@/lib/view";
import { OverrideScores } from "./OverrideScores";

/** Live match list for the organizer, with a score override on every playable match. */
export function OrganizerMatches({ initialView }: { initialView: TournamentView }) {
  const { view, status, refresh } = useLiveTournament(initialView);
  const teams = new Map(view.teams.map((t) => [t.id, t]));
  const active = view.matches.filter((m) => m.status === "in_progress" || m.status === "ready");
  const completed = view.matches.filter((m) => m.status === "completed").reverse();
  const waiting = view.matches.filter((m) => m.status === "pending");
  const champion = view.tournament.championTeamId ? teams.get(view.tournament.championTeamId) : null;

  const card = (match: ViewMatch) => (
    <MatchCard key={match.id} match={match} teams={teams}>
      <OverrideScores match={match} view={view} onSaved={refresh} />
    </MatchCard>
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Matches</h2>
        <div className="flex items-center gap-3">
          <LiveIndicator status={status} />
          <Link href={`/t/${view.tournament.slug}`} className="text-sm text-brand-700 underline">
            Public page
          </Link>
        </div>
      </div>
      {champion && <p className="card bg-accent-400/30 text-center font-semibold">🏆 Champion: {champion.name}</p>}

      <div>
        <h3 className="mb-2 text-sm font-semibold text-slate-700">In progress and up next ({active.length})</h3>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">Nothing to play right now.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">{active.map(card)}</div>
        )}
      </div>

      {completed.length > 0 && (
        <details open={active.length === 0}>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Completed ({completed.length}): edit any score</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">{completed.map(card)}</div>
        </details>
      )}

      {waiting.length > 0 && (
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-slate-700">Waiting for earlier results ({waiting.length})</summary>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            {waiting.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} compact />
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
