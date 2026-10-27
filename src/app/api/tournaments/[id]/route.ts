import { HttpError, readJson, route } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { toTournamentColumns, tournamentInputSchema } from "@/lib/tournaments/schema";
import { countPaidTeams, getOwnedTournament, parseId, requireOrganizerForApi } from "@/lib/tournaments/server";

type Context = { params: Promise<{ id: string }> };

/** Edit tournament details. Only allowed before the tournament starts. */
export const PATCH = route(async (request: Request, { params }: Context) => {
  const organizer = await requireOrganizerForApi();
  const id = parseId((await params).id, "tournament");
  const input = tournamentInputSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();

  const tournament = await getOwnedTournament(db, id, organizer.id);
  if (tournament.status !== "registration") {
    throw new HttpError(409, "A tournament can only be edited before it starts.");
  }
  const paid = await countPaidTeams(db, id);
  if (input.maxTeams < paid) {
    throw new HttpError(409, `${paid} teams have already paid, so max teams cannot be lower than ${paid}.`);
  }

  const { error } = await db.from("tournaments").update(toTournamentColumns(input)).eq("id", id);
  if (error) throw error;
  return Response.json({ ok: true });
});

/** Delete a tournament. Refused once any team has paid, so no payment is orphaned. */
export const DELETE = route(async (_request: Request, { params }: Context) => {
  const organizer = await requireOrganizerForApi();
  const id = parseId((await params).id, "tournament");
  const db = createSupabaseAdminClient();

  await getOwnedTournament(db, id, organizer.id);
  const paid = await countPaidTeams(db, id);
  if (paid > 0) {
    throw new HttpError(409, "Teams have already paid for this tournament, so it cannot be deleted.");
  }

  const { error } = await db.from("tournaments").delete().eq("id", id);
  if (error) throw error;
  return Response.json({ ok: true });
});
