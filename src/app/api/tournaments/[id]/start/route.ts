import { route } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { commitTournamentChanges } from "@/lib/tournament/commit";
import { planTournamentStart } from "@/lib/tournament/progress";
import { getOwnedTournament, parseId, requireOrganizerForApi } from "@/lib/tournaments/server";

type Context = { params: Promise<{ id: string }> };

/** Closes registration, seeds paid teams and writes the generated schedule. */
export const POST = route(async (_request: Request, { params }: Context) => {
  const organizer = await requireOrganizerForApi();
  const id = parseId((await params).id, "tournament");
  const db = createSupabaseAdminClient();
  const tournament = await getOwnedTournament(db, id, organizer.id);

  const { data: teams, error } = await db
    .from("teams")
    .select("id, paid_at, created_at")
    .eq("tournament_id", id)
    .eq("payment_status", "paid");
  if (error) throw error;

  const changes = planTournamentStart(tournament, teams, () => crypto.randomUUID(), new Date());
  await commitTournamentChanges(db, id, tournament.version, changes);
  return Response.json({ ok: true, matches: changes.new_matches?.length ?? 0 });
});
