import { readJson, route } from "@/lib/http";
import { buildOrganizerOverride } from "@/lib/scores/edits";
import { overrideSetsSchema } from "@/lib/scores/schema";
import { applyScoreEdit } from "@/lib/scores/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getOwnedTournament, parseId, requireOrganizerForApi } from "@/lib/tournaments/server";

type Context = { params: Promise<{ id: string; matchId: string }> };

/** The organizer replaces a match's sets (override or correction). An empty list clears the match. */
export const PUT = route(async (request: Request, { params }: Context) => {
  const organizer = await requireOrganizerForApi();
  const { id: rawId, matchId: rawMatchId } = await params;
  const id = parseId(rawId, "tournament");
  const matchId = parseId(rawMatchId, "match");
  const { sets } = overrideSetsSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();
  await getOwnedTournament(db, id, organizer.id);

  await applyScoreEdit(db, id, (snapshot) => buildOrganizerOverride(snapshot, matchId, sets, organizer.id));
  return Response.json({ ok: true });
});
