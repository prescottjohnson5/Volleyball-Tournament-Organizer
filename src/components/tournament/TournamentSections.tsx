import { TrophyIcon } from "@/components/Icons";
import { Tabs } from "@/components/Tabs";
import { createRuleset, describeRuleset, type BestOf } from "@/lib/rules/ruleset";
import { FORMAT_LABELS, formatEventDate } from "@/lib/tournaments/labels";
import type { TournamentView } from "@/lib/view";
import { BracketView } from "./BracketView";
import { LiveMatchList } from "./LiveMatchList";
import { StandingsTable } from "./StandingsTable";
import { TournamentStatusBadge } from "./TournamentStatusBadge";

export function TournamentHeader({ view, liveIndicator }: { view: TournamentView; liveIndicator?: React.ReactNode }) {
  const t = view.tournament;
  const rules = createRuleset(t.environment, { bestOf: t.bestOf as BestOf });
  const champion = t.championTeamId ? view.teams.find((team) => team.id === t.championTeamId) : null;
  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <TournamentStatusBadge status={t.status} />
        {liveIndicator}
      </div>
      <h1 className="text-3xl font-extrabold sm:text-4xl">{t.name}</h1>
      <div className="space-y-0.5">
        <p className="text-ink-muted">
          {formatEventDate(t.eventDate)} · {t.location}
        </p>
        <p className="text-sm text-ink-subtle">
          <span className="capitalize">{t.environment}</span> · {FORMAT_LABELS[t.format]} · {describeRuleset(rules)}
        </p>
      </div>
      {champion && (
        <p className="flex items-center gap-3 rounded-2xl border border-sun/40 px-4 py-3 text-lg font-bold" role="status">
          <TrophyIcon className="h-6 w-6 shrink-0 text-sun" />
          <span>
            <span className="text-ink-muted">Champion:</span> {champion.name}
          </span>
        </p>
      )}
    </header>
  );
}

function TeamsList({ view }: { view: TournamentView }) {
  if (view.teams.length === 0) {
    return <p className="empty-state">No teams have registered yet.</p>;
  }
  return (
    <div className="space-y-2">
      <p className="text-sm text-ink-subtle">
        {view.teams.length} of {view.tournament.maxTeams} spots filled
      </p>
      <ol className="border-t border-line">
        {view.teams.map((team, index) => (
          <li key={team.id} className="flex items-center gap-3 border-b border-line px-2 py-3">
            <span className="w-7 shrink-0 text-sm text-ink-faint tabular-nums">{team.seed ?? index + 1}</span>
            <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
            {team.pool && <span className="shrink-0 text-sm text-ink-subtle">Pool {team.pool}</span>}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Matches, teams, standings and bracket, one tab at a time. */
export function TournamentSections({ view }: { view: TournamentView }) {
  const hasPools = view.teams.some((t) => t.pool);
  const started = view.matches.length > 0;
  const tabs = [
    { id: "matches", label: "Matches", content: <LiveMatchList view={view} /> },
    { id: "teams", label: `Teams (${view.teams.length})`, content: <TeamsList view={view} /> },
    ...(hasPools ? [{ id: "standings", label: "Standings", content: <StandingsTable view={view} /> }] : []),
    {
      id: "bracket",
      label: view.tournament.format === "double_elim" ? "Bracket" : "Playoffs",
      content: <BracketView view={view} />,
    },
  ];
  return <Tabs label="Tournament sections" tabs={tabs} defaultTab={started ? "matches" : "teams"} />;
}
