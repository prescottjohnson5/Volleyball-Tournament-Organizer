import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { TeamPrivateRow, TeamRow, TournamentRow } from "@/lib/supabase/database.types";

export type TournamentSummary = TournamentRow & { paidTeams: number };

/** Tournaments the organizer owns, newest event first, with paid team counts. Reads under RLS. */
export async function listOrganizerTournaments(organizerId: string): Promise<TournamentSummary[]> {
  const supabase = await createSupabaseServerClient();
  const { data: tournaments, error } = await supabase
    .from("tournaments")
    .select("*")
    .eq("organizer_id", organizerId)
    .order("event_date", { ascending: false });
  if (error) throw error;
  if (tournaments.length === 0) return [];

  const { data: teams, error: teamsError } = await supabase
    .from("teams")
    .select("tournament_id")
    .eq("payment_status", "paid")
    .in(
      "tournament_id",
      tournaments.map((t) => t.id),
    );
  if (teamsError) throw teamsError;

  const counts = new Map<string, number>();
  for (const team of teams) counts.set(team.tournament_id, (counts.get(team.tournament_id) ?? 0) + 1);
  return tournaments.map((t) => ({ ...t, paidTeams: counts.get(t.id) ?? 0 }));
}

export type DashboardTeam = TeamRow & { captain: Pick<TeamPrivateRow, "captain_name" | "captain_email"> | null };

/** One tournament with every team (any payment state) and captain details, or null if not theirs. */
export async function getOrganizerTournament(
  tournamentId: string,
  organizerId: string,
): Promise<{ tournament: TournamentRow; teams: DashboardTeam[] } | null> {
  const supabase = await createSupabaseServerClient();
  const { data: tournament, error } = await supabase.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
  if (error) throw error;
  if (!tournament || tournament.organizer_id !== organizerId) return null;

  const [{ data: teams, error: teamsError }, { data: captains, error: captainsError }] = await Promise.all([
    supabase.from("teams").select("*").eq("tournament_id", tournamentId).order("created_at"),
    supabase.from("team_private").select("team_id, captain_name, captain_email").eq("tournament_id", tournamentId),
  ]);
  if (teamsError) throw teamsError;
  if (captainsError) throw captainsError;

  const byTeam = new Map(captains.map((c) => [c.team_id, c]));
  return {
    tournament,
    teams: teams.map((team) => {
      const captain = byTeam.get(team.id);
      return {
        ...team,
        captain: captain ? { captain_name: captain.captain_name, captain_email: captain.captain_email } : null,
      };
    }),
  };
}
