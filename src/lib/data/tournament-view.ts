import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TournamentRow } from "@/lib/supabase/database.types";
import { viewFromRows, type TournamentView } from "@/lib/view";

type Db = SupabaseClient<Database>;

/** Loads everything a tournament page shows. Works with any client (server or browser), under RLS. */
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

export async function loadTournamentViewById(db: Db, tournamentId: string): Promise<TournamentView | null> {
  const { data, error } = await db.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
  if (error) throw error;
  return data ? loadTournamentView(db, data) : null;
}
