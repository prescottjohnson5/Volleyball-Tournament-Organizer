import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TournamentRow } from "@/lib/supabase/database.types";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import { viewFromRows, type TournamentView } from "@/lib/view";

type Db = SupabaseClient<Database>;

export async function getPublicTournament(slug: string, db: Db = createSupabasePublicClient()): Promise<TournamentRow | null> {
  const { data, error } = await db.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data;
}

export async function countPublicPaidTeams(tournamentId: string, db: Db = createSupabasePublicClient()): Promise<number> {
  const { count, error } = await db
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "paid");
  if (error) throw error;
  return count ?? 0;
}

/** Everything the public tournament page shows, read anonymously under RLS. */
export async function getTournamentView(slug: string, db: Db = createSupabasePublicClient()): Promise<TournamentView | null> {
  const tournament = await getPublicTournament(slug, db);
  if (!tournament) return null;
  return loadTournamentView(db, tournament);
}

export async function loadTournamentView(db: Db, tournament: TournamentRow): Promise<TournamentView> {
  const [teams, matches, sets] = await Promise.all([
    db.from("teams").select("*").eq("tournament_id", tournament.id).eq("payment_status", "paid").order("seed").order("paid_at"),
    db.from("matches").select("*").eq("tournament_id", tournament.id).order("order_index"),
    db.from("match_sets").select("*").eq("tournament_id", tournament.id),
  ]);
  if (teams.error) throw teams.error;
  if (matches.error) throw matches.error;
  if (sets.error) throw sets.error;
  return viewFromRows(tournament, teams.data, matches.data, sets.data);
}
