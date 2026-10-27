import { HttpError, readJson, route } from "@/lib/http";
import { buildCaptainEdit } from "@/lib/scores/edits";
import { bearerToken, captainSetSchema } from "@/lib/scores/schema";
import { applyScoreEdit, findCaptainByToken } from "@/lib/scores/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseId } from "@/lib/tournaments/server";

type Context = { params: Promise<{ matchId: string }> };

/** A captain reports one completed set. Auth: `Authorization: Bearer <captain token>`. */
export const POST = route(async (request: Request, { params }: Context) => {
  const token = bearerToken(request.headers.get("authorization"));
  if (!token) throw new HttpError(401, "Missing captain link token.");
  const matchId = parseId((await params).matchId, "match");
  const input = captainSetSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();

  const captain = await findCaptainByToken(db, token);
  if (!captain) throw new HttpError(401, "This captain link is not valid. Ask the organizer for a new one.");

  await applyScoreEdit(db, captain.tournament.id, (snapshot) => buildCaptainEdit(snapshot, captain.team.id, matchId, input));
  return Response.json({ ok: true });
});
