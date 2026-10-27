"use client";

import Link from "next/link";
import { LiveIndicator } from "@/components/tournament/LiveIndicator";
import { MatchCard } from "@/components/tournament/MatchCard";
import { useLiveTournament } from "@/components/tournament/useLiveTournament";
import type { TournamentView } from "@/lib/view";
import { ReportSetForm } from "./ReportSetForm";

export function CaptainPanel({ initialView, teamId, token }: { initialView: TournamentView; teamId: string; token: string }) {
  const { view, status, refresh } = useLiveTournament(initialView);
  const teams = new Map(view.teams.map((t) => [t.id, t]));
  const team = teams.get(teamId);
  const mine = view.matches.filter((m) => m.teamAId === teamId || m.teamBId === teamId);
  const playable = mine.filter((m) => m.status === "ready" || m.status === "in_progress");
  const played = mine.filter((m) => m.status === "completed").reverse();
  const waiting = view.matches.filter(
    (m) => m.status === "pending" && (m.teamAId === teamId || m.teamBId === teamId),
  );
  const champion = view.tournament.championTeamId;

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <p className="text-sm font-medium text-brand-700">Captain page · keep this link private</p>
        <h1 className="text-2xl font-bold">{team?.name ?? "Your team"}</h1>
        <p className="text-slate-600">{view.tournament.name}</p>
        <LiveIndicator status={status} />
      </header>

      {view.tournament.status === "registration" && (
        <p className="card text-slate-700">The tournament has not started yet. Your matches appear here when the organizer starts it.</p>
      )}
      {champion && (
        <p className="card bg-accent-400/30 text-center font-semibold">
          {champion === teamId ? "🏆 Your team won the tournament!" : `🏆 Champion: ${teams.get(champion)?.name}`}
        </p>
      )}

      {view.tournament.status === "in_progress" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Report scores</h2>
          {playable.length === 0 ? (
            <p className="text-sm text-slate-600">
              {waiting.length > 0 ? "Your next match is waiting for other results." : "No match to report right now."}
            </p>
          ) : (
            playable.map((match) => (
              <MatchCard key={match.id} match={match} teams={teams} highlightTeamId={teamId}>
                <ReportSetForm match={match} view={view} teamId={teamId} token={token} onReported={refresh} />
              </MatchCard>
            ))
          )}
          <p className="text-xs text-slate-500">
            Report each set when it ends. If a score is wrong, ask the organizer to correct it.
          </p>
        </section>
      )}

      {waiting.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Coming up</h2>
          {waiting.map((match) => (
            <MatchCard key={match.id} match={match} teams={teams} highlightTeamId={teamId} compact />
          ))}
        </section>
      )}

      {played.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Played</h2>
          {played.map((match) => (
            <MatchCard key={match.id} match={match} teams={teams} highlightTeamId={teamId} />
          ))}
        </section>
      )}

      <Link href={`/t/${view.tournament.slug}`} className="btn-secondary w-full">
        Full tournament: standings and bracket
      </Link>
    </div>
  );
}
