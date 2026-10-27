import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { hashCaptainToken, isWellFormedToken } from "@/lib/captain-token";
import { HttpError } from "@/lib/http";
import type { Database, MatchRow, MatchSetRow, TeamRow, TournamentRow } from "@/lib/supabase/database.types";
import { commitTournamentChanges, withVersionRetry } from "@/lib/tournament/commit";
import { planScoreEdit, type ScoreEdit } from "@/lib/tournament/progress";

type Db = SupabaseClient<Database>;

export interface Snapshot {
  tournament: TournamentRow;
  teams: TeamRow[];
  matches: MatchRow[];
  sets: MatchSetRow[];
}

export async function loadSnapshot(db: Db, tournamentId: string): Promise<Snapshot> {
  const [tournament, teams, matches, sets] = await Promise.all([
    db.from("tournaments").select("*").eq("id", tournamentId).single(),
    db.from("teams").select("*").eq("tournament_id", tournamentId).eq("payment_status", "paid"),
    db.from("matches").select("*").eq("tournament_id", tournamentId),
    db.from("match_sets").select("*").eq("tournament_id", tournamentId),
  ]);
  for (const result of [tournament, teams, matches, sets]) if (result.error) throw result.error;
  return { tournament: tournament.data!, teams: teams.data!, matches: matches.data!, sets: sets.data! };
}

/**
 * Reads the latest state, lets the caller authorize and build the edit against it, then commits.
 * On a version conflict (someone else wrote first) the whole cycle runs again on fresh data.
 */
export async function applyScoreEdit(
  db: Db,
  tournamentId: string,
  buildEdit: (snapshot: Snapshot) => ScoreEdit,
): Promise<void> {
  await withVersionRetry(async () => {
    const snapshot = await loadSnapshot(db, tournamentId);
    if (snapshot.tournament.status === "registration") throw new HttpError(409, "This tournament has not started yet.");
    const edit = buildEdit(snapshot);
    const { changes } = planScoreEdit(
      {
        tournament: snapshot.tournament,
        teams: snapshot.teams.map((t) => ({ id: t.id, seed: t.seed ?? Number.MAX_SAFE_INTEGER, pool: t.pool })),
        matches: snapshot.matches,
        sets: snapshot.sets,
      },
      edit,
      () => crypto.randomUUID(),
      new Date(),
    );
    await commitTournamentChanges(db, tournamentId, snapshot.tournament.version, changes);
  });
}

export interface CaptainContext {
  team: TeamRow;
  tournament: TournamentRow;
}

/** Resolves a captain link token to its paid team, or null. Only the token's hash is compared. */
export async function findCaptainByToken(db: Db, token: string): Promise<CaptainContext | null> {
  if (!isWellFormedToken(token)) return null;
  const { data: secret, error } = await db
    .from("team_private")
    .select("team_id")
    .eq("captain_token_hash", hashCaptainToken(token))
    .maybeSingle();
  if (error) throw error;
  if (!secret) return null;

  const { data: team, error: teamError } = await db.from("teams").select("*").eq("id", secret.team_id).eq("payment_status", "paid").maybeSingle();
  if (teamError) throw teamError;
  if (!team) return null;
  const { data: tournament, error: tournamentError } = await db.from("tournaments").select("*").eq("id", team.tournament_id).single();
  if (tournamentError) throw tournamentError;
  return { team, tournament };
}
