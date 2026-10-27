import type { MatchStatus } from "@/lib/supabase/database.types";
import type { ViewMatch, ViewTeam } from "@/lib/view";

const STATUS_STYLES: Record<MatchStatus, { label: string; className: string }> = {
  in_progress: { label: "Live", className: "bg-red-500/20 text-red-200" },
  completed: { label: "Final", className: "bg-steel/50 text-ink-muted" },
  ready: { label: "Up next", className: "bg-teal/20 text-teal-300" },
  pending: { label: "Waiting", className: "bg-white/5 text-ink-subtle" },
  bye: { label: "Bye", className: "bg-white/5 text-ink-subtle" },
  not_needed: { label: "Not needed", className: "bg-white/5 text-ink-subtle" },
};

export function StatusBadge({ status }: { status: MatchStatus }) {
  const style = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${style.className}`}>
      {status === "in_progress" && <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />}
      {style.label}
    </span>
  );
}

function teamLabel(id: string | null, match: ViewMatch, teams: ReadonlyMap<string, ViewTeam>): string {
  if (id) return teams.get(id)?.name ?? "Unknown team";
  return match.status === "bye" ? "Bye" : "TBD";
}

export function reporterText(match: ViewMatch, teams: ReadonlyMap<string, ViewTeam>): string[] {
  return match.sets.map((set) => {
    const who =
      set.reportedBy === "organizer"
        ? "the organizer"
        : `${set.reportedByTeamId ? (teams.get(set.reportedByTeamId)?.name ?? "a") : "a"} captain`;
    return `Set ${set.setNumber}: ${set.a}–${set.b}, reported by ${who}`;
  });
}

/**
 * One match: both teams, sets won (e.g. 1–1) and the final score of each completed set.
 * `children` renders below the card (used for score entry forms).
 */
export function MatchCard({
  match,
  teams,
  highlightTeamId,
  compact = false,
  children,
}: {
  match: ViewMatch;
  teams: ReadonlyMap<string, ViewTeam>;
  highlightTeamId?: string;
  compact?: boolean;
  children?: React.ReactNode;
}) {
  const rows = [
    { id: match.teamAId, setsWon: match.setsA, side: "a" as const },
    { id: match.teamBId, setsWon: match.setsB, side: "b" as const },
  ];
  const decided = match.status === "completed";
  const hasScores = match.sets.length > 0;

  return (
    <article className={`card ${compact ? "p-3" : ""} ${match.status === "in_progress" ? "border-red-400/70" : ""}`} aria-label={match.label}>
      <header className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold tracking-wide text-ink-subtle uppercase">{match.label}</h3>
        <StatusBadge status={match.status} />
      </header>
      <table className="w-full text-sm">
        <caption className="sr-only">
          {teamLabel(match.teamAId, match, teams)} versus {teamLabel(match.teamBId, match, teams)}
        </caption>
        <tbody>
          {rows.map((row) => {
            const isWinner = decided && row.id !== null && row.id === match.winnerId;
            const isHighlighted = highlightTeamId !== undefined && row.id === highlightTeamId;
            return (
              <tr key={row.side} className={isWinner ? "font-bold" : decided ? "text-ink-subtle" : ""}>
                <th scope="row" className={`truncate py-1 pr-2 text-left font-[inherit] ${isHighlighted ? "text-teal-300" : ""}`}>
                  {teamLabel(row.id, match, teams)}
                </th>
                {match.sets.map((set) => {
                  const own = row.side === "a" ? set.a : set.b;
                  const other = row.side === "a" ? set.b : set.a;
                  return (
                    <td key={set.setNumber} className={`w-8 text-center tabular-nums ${own > other ? "text-ink" : "text-ink-faint"}`}>
                      {own}
                    </td>
                  );
                })}
                <td className="w-8 text-right text-base tabular-nums">{hasScores || decided ? row.setsWon : ""}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {hasScores && (
        <p className="mt-1 text-xs text-ink-subtle">
          Sets {match.setsA}–{match.setsB}
        </p>
      )}
      {!compact && hasScores && (
        <details className="mt-1 text-xs text-ink-subtle">
          <summary className="cursor-pointer">Who reported</summary>
          <ul className="mt-1 space-y-0.5">
            {reporterText(match, teams).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </details>
      )}
      {children}
    </article>
  );
}
