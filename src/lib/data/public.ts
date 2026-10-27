import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TournamentRow } from "@/lib/supabase/database.types";
import { createSupabasePublicClient } from "@/lib/supabase/public";
import type { TournamentView } from "@/lib/view";
import { loadTournamentView } from "./tournament-view";

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
