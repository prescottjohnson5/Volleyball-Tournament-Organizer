import { createRuleset, describeRuleset, type BestOf } from "@/lib/rules/ruleset";
import { FORMAT_LABELS, formatEventDate, STATUS_LABELS } from "@/lib/tournaments/labels";
import type { TournamentView } from "@/lib/view";
import { BracketView } from "./BracketView";
import { LiveMatchList } from "./LiveMatchList";
import { StandingsTable } from "./StandingsTable";

export function TournamentHeader({ view, liveIndicator }: { view: TournamentView; liveIndicator?: React.ReactNode }) {
  const t = view.tournament;
  const rules = createRuleset(t.environment, { bestOf: t.bestOf as BestOf });
  const champion = t.championTeamId ? view.teams.find((team) => team.id === t.championTeamId) : null;
  return (
    <header className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-2xl font-bold">{t.name}</h1>
        <span className="rounded-full bg-teal/20 px-2.5 py-0.5 text-xs font-semibold text-teal-300">{STATUS_LABELS[t.status]}</span>
        {liveIndicator}
      </div>
      <p className="text-ink-muted">
        {formatEventDate(t.eventDate)} · {t.location}
      </p>
      <p className="text-sm text-ink-muted">
        <span className="capitalize">{t.environment}</span> · {FORMAT_LABELS[t.format]} · {describeRuleset(rules)}
      </p>
      {champion && (
        <p className="rounded-xl bg-sun/15 text-sun p-3 text-center text-lg font-bold" role="status">
          🏆 Champion: {champion.name}
        </p>
      )}
    </header>
  );
}

/** Live matches, standings and bracket, stacked for phones with quick links between them. */
export function TournamentSections({ view }: { view: TournamentView }) {
  const hasPools = view.teams.some((t) => t.pool);
  return (
    <div className="space-y-6">
      <nav aria-label="Sections" className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-midnight-900/95 px-4 py-2 backdrop-blur">
        <a href="#matches" className="btn-secondary min-h-9 py-1">
          Matches
        </a>
        {hasPools && (
          <a href="#standings" className="btn-secondary min-h-9 py-1">
            Standings
          </a>
        )}
        <a href="#bracket" className="btn-secondary min-h-9 py-1">
          Bracket
        </a>
      </nav>
      <section id="matches" className="scroll-mt-16 space-y-2">
        <h2 className="text-lg font-semibold">Matches</h2>
        <LiveMatchList view={view} />
      </section>
      {hasPools && (
        <section id="standings" className="scroll-mt-16 space-y-2">
          <h2 className="text-lg font-semibold">Pool standings</h2>
          <StandingsTable view={view} />
        </section>
      )}
      <section id="bracket" className="scroll-mt-16 space-y-2">
        <h2 className="text-lg font-semibold">{view.tournament.format === "double_elim" ? "Bracket" : "Playoff bracket"}</h2>
        <BracketView view={view} />
      </section>
    </div>
  );
}
