import type { BracketSide } from "@/lib/supabase/database.types";
import type { TournamentView, ViewMatch } from "@/lib/view";
import { MatchCard } from "./MatchCard";

const SECTION_TITLES: Record<Exclude<BracketSide, "pool">, string> = {
  winners: "Winners bracket",
  losers: "Losers bracket",
  final: "Finals",
};

function Columns({ matches, view }: { matches: ViewMatch[]; view: TournamentView }) {
  const teams = new Map(view.teams.map((t) => [t.id, t]));
  const rounds = [...new Set(matches.map((m) => m.round))].sort((a, b) => a - b);
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <ol className="flex gap-3">
        {rounds.map((round) => {
          // Byes are resolved automatically; showing them would only add empty boxes.
          const inRound = matches.filter((m) => m.round === round && m.status !== "bye").sort((a, b) => a.position - b.position);
          if (inRound.length === 0) return null;
          return (
            <li key={round} className="flex w-64 shrink-0 flex-col justify-around gap-3">
              {inRound.map((match) => (
                <MatchCard key={match.id} match={match} teams={teams} compact />
              ))}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** The elimination bracket(s), one horizontally scrollable row of round columns per section. */
export function BracketView({ view }: { view: TournamentView }) {
  const bracketMatches = view.matches.filter((m) => m.phase === "bracket");
  if (bracketMatches.length === 0) {
    return (
      <p className="empty-state">
        {view.tournament.format === "pool_to_single_elim"
          ? "The playoff bracket is created automatically when every pool match is finished."
          : "The bracket appears when the organizer starts the tournament."}
      </p>
    );
  }
  const sections = (["winners", "losers", "final"] as const).filter((side) => bracketMatches.some((m) => m.bracket === side));
  const single = sections.length === 1;
  return (
    <div className="space-y-4">
      {sections.map((side) => (
        <section key={side} aria-label={single ? "Playoffs" : SECTION_TITLES[side]}>
          {!single && <h3 className="mb-2 text-sm font-semibold text-ink-muted">{SECTION_TITLES[side]}</h3>}
          <Columns matches={bracketMatches.filter((m) => m.bracket === side)} view={view} />
        </section>
      ))}
    </div>
  );
}
