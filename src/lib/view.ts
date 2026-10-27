import type { ResolvedMatch } from "@/lib/bracket/types";
import type { SimulationResult } from "@/lib/demo/simulate";
import type {
  BracketSide,
  Environment,
  FormatId,
  MatchPhase,
  MatchRow,
  MatchSetRow,
  MatchStatus,
  Reporter,
  TeamRow,
  TournamentRow,
  TournamentStatus,
} from "@/lib/supabase/database.types";

/** Read-only view of a tournament, shared by the public page, captain page and demo. */
export interface ViewTeam {
  id: string;
  name: string;
  seed: number | null;
  pool: string | null;
}

export interface ViewSet {
  setNumber: number;
  a: number;
  b: number;
  reportedBy: Reporter;
  reportedByTeamId: string | null;
}

export interface ViewMatch {
  id: string;
  label: string;
  phase: MatchPhase;
  bracket: BracketSide;
  round: number;
  position: number;
  pool: string | null;
  orderIndex: number;
  status: MatchStatus;
  teamAId: string | null;
  teamBId: string | null;
  winnerId: string | null;
  setsA: number;
  setsB: number;
  sets: ViewSet[];
}

export interface TournamentView {
  tournament: {
    id: string;
    slug: string;
    name: string;
    eventDate: string;
    location: string;
    environment: Environment;
    format: FormatId;
    bestOf: number;
    maxTeams: number;
    status: TournamentStatus;
    championTeamId: string | null;
  };
  teams: ViewTeam[];
  matches: ViewMatch[];
}

export function viewFromRows(
  tournament: TournamentRow,
  teams: readonly TeamRow[],
  matches: readonly MatchRow[],
  sets: readonly MatchSetRow[],
): TournamentView {
  const setsFor = new Map<string, ViewSet[]>();
  for (const s of [...sets].sort((x, y) => x.set_number - y.set_number)) {
    const list = setsFor.get(s.match_id) ?? [];
    list.push({ setNumber: s.set_number, a: s.score_a, b: s.score_b, reportedBy: s.reported_by, reportedByTeamId: s.reported_by_team_id });
    setsFor.set(s.match_id, list);
  }
  return {
    tournament: {
      id: tournament.id,
      slug: tournament.slug,
      name: tournament.name,
      eventDate: tournament.event_date,
      location: tournament.location,
      environment: tournament.environment,
      format: tournament.format,
      bestOf: tournament.best_of,
      maxTeams: tournament.max_teams,
      status: tournament.status,
      championTeamId: tournament.champion_team_id,
    },
    teams: teams.map((t) => ({ id: t.id, name: t.name, seed: t.seed, pool: t.pool })),
    matches: [...matches]
      .sort((x, y) => x.order_index - y.order_index)
      .map((m) => ({
        id: m.id,
        label: m.label,
        phase: m.phase,
        bracket: m.bracket,
        round: m.round,
        position: m.position,
        pool: m.pool,
        orderIndex: m.order_index,
        status: m.status,
        teamAId: m.team_a_id,
        teamBId: m.team_b_id,
        winnerId: m.winner_id,
        setsA: m.sets_a,
        setsB: m.sets_b,
        sets: setsFor.get(m.id) ?? [],
      })),
  };
}

function viewMatch(match: ResolvedMatch): ViewMatch {
  return {
    id: match.id,
    label: match.label,
    phase: match.phase,
    bracket: match.bracket,
    round: match.round,
    position: match.position,
    pool: match.pool,
    orderIndex: match.orderIndex,
    status: match.status,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    winnerId: match.winnerId,
    setsA: match.setsA,
    setsB: match.setsB,
    sets: match.sets.map((s, i) => ({
      setNumber: i + 1,
      a: s.a,
      b: s.b,
      // Demo data: alternate who reported, to show both kinds of attribution.
      reportedBy: i % 3 === 2 ? "organizer" : "captain",
      reportedByTeamId: i % 3 === 2 ? null : i % 2 === 0 ? match.teamAId : match.teamBId,
    })),
  };
}

export function viewFromSimulation(
  result: SimulationResult,
  names: ReadonlyMap<string, string>,
  tournament: TournamentView["tournament"],
): TournamentView {
  return {
    tournament: { ...tournament, championTeamId: result.champion, status: result.champion ? "completed" : "in_progress" },
    teams: result.teams.map((t) => ({ id: t.id, name: names.get(t.id) ?? t.id, seed: t.seed, pool: t.pool })),
    matches: result.matches.map(viewMatch),
  };
}
