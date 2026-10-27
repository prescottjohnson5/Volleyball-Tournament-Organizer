import { generateCaptainToken, hashCaptainToken } from "@/lib/captain-token";
import { HttpError, route } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOwnedTournament, parseId, requireOrganizerForApi } from "@/lib/tournaments/server";

type Context = { params: Promise<{ id: string; teamId: string }> };

/** Issues a new captain link for a paid team. The previous link stops working immediately. */
export const POST = route(async (_request: Request, { params }: Context) => {
  const organizer = await requireOrganizerForApi();
  const { id: rawId, teamId: rawTeamId } = await params;
  const id = parseId(rawId, "tournament");
  const teamId = parseId(rawTeamId, "team");
  const db = createSupabaseAdminClient();
  await getOwnedTournament(db, id, organizer.id);

  const { data: team, error } = await db.from("teams").select("id, payment_status").eq("id", teamId).eq("tournament_id", id).maybeSingle();
  if (error) throw error;
  if (!team) throw new HttpError(404, "Team not found in this tournament.");
  if (team.payment_status !== "paid") throw new HttpError(409, "Only paid teams have a captain link.");

  const token = generateCaptainToken();
  const { error: updateError } = await db
    .from("team_private")
    .update({ captain_token_hash: hashCaptainToken(token), captain_token_created_at: new Date().toISOString() })
    .eq("team_id", teamId);
  if (updateError) throw updateError;
  return Response.json({ token });
});
