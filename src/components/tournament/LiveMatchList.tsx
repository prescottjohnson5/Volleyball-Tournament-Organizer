import type { TournamentView } from "@/lib/view";
import { MatchCard } from "./MatchCard";

/** Live matches first (when there are any), then what is up next, then the latest results. */
export function LiveMatchList({ view }: { view: TournamentView }) {
  const teams = new Map(view.teams.map((t) => [t.id, t]));
  const live = view.matches.filter((m) => m.status === "in_progress");
  const upNext = view.matches.filter((m) => m.status === "ready");
  const results = view.matches.filter((m) => m.status === "completed").sort((a, b) => b.orderIndex - a.orderIndex);

  if (view.matches.length === 0) {
    return <p className="empty-state">Matches appear here when the organizer starts the tournament.</p>;
  }

  return (
    <div className="space-y-5">
      {live.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-muted">Live now ({live.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {live.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
        </div>
      )}
      {upNext.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-muted">Up next ({upNext.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {upNext.map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} compact />
            ))}
          </div>
        </div>
      )}
      {results.length > 0 && (
        <div>
          <h3 className="mb-2 text-sm font-semibold text-ink-muted">Results ({results.length})</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {results.slice(0, 6).map((m) => (
              <MatchCard key={m.id} match={m} teams={teams} />
            ))}
          </div>
          {results.length > 6 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-sm font-medium text-teal-300">Show {results.length - 6} earlier results</summary>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {results.slice(6).map((m) => (
                  <MatchCard key={m.id} match={m} teams={teams} />
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
