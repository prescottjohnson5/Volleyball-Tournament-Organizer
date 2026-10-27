import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { getOrganizer, type Organizer } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import type { Database, TournamentRow } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/** For API routes: the signed-in organizer, or a 401. */
export async function requireOrganizerForApi(): Promise<Organizer> {
  const organizer = await getOrganizer();
  if (!organizer) throw new HttpError(401, "Sign in as an organizer first.");
  return organizer;
}

export function parseId(value: string, what = "id"): string {
  const result = z.uuid().safeParse(value);
  if (!result.success) throw new HttpError(404, `Unknown ${what}.`);
  return result.data;
}

/** Loads a tournament and checks the caller organizes it (404 if missing, 403 if not theirs). */
export async function getOwnedTournament(db: Db, tournamentId: string, organizerId: string): Promise<TournamentRow> {
  const { data, error } = await db.from("tournaments").select("*").eq("id", tournamentId).maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "Tournament not found.");
  if (data.organizer_id !== organizerId) throw new HttpError(403, "You do not organize this tournament.");
  return data;
}

export async function countPaidTeams(db: Db, tournamentId: string): Promise<number> {
  const { count, error } = await db
    .from("teams")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", tournamentId)
    .eq("payment_status", "paid");
  if (error) throw error;
  return count ?? 0;
}
