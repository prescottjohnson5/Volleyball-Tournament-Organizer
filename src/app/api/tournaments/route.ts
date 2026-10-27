import { isPaymentsEnabled } from "@/lib/env";
import { HttpError, readJson, route } from "@/lib/http";
import { SANDBOX_MAX_TOURNAMENTS, SANDBOX_ONE_TOURNAMENT_MESSAGE } from "@/lib/sandbox";
import { createTournamentSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseTournamentInput, toTournamentColumns } from "@/lib/tournaments/schema";
import { requireOrganizerForApi } from "@/lib/tournaments/server";

const UNIQUE_VIOLATION = "23505";

/** Create a tournament for the signed-in organizer. Sandbox organizers get one free tournament. */
export const POST = route(async (request: Request) => {
  const organizer = await requireOrganizerForApi();
  const sandbox = organizer.isSandbox;
  const input = parseTournamentInput(await readJson(request), { withFee: isPaymentsEnabled(), sandbox });
  const db = createSupabaseAdminClient();

  if (sandbox) {
    const { count, error } = await db.from("tournaments").select("id", { count: "exact", head: true }).eq("organizer_id", organizer.id);
    if (error) throw error;
    if ((count ?? 0) >= SANDBOX_MAX_TOURNAMENTS) throw new HttpError(409, SANDBOX_ONE_TOURNAMENT_MESSAGE);
  }

  // The slug has a random suffix; retry in the unlikely case it collides.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("tournaments")
      .insert({
        registration_fee_cents: 0,
        ...toTournamentColumns(input),
        organizer_id: organizer.id,
        slug: createTournamentSlug(input.name),
        is_sandbox: sandbox,
      })
      .select("id, slug")
      .single();
    if (!error) return Response.json(data, { status: 201 });
    if (error.code !== UNIQUE_VIOLATION) throw error;
    // Two requests raced past the count check above; the database allows only one.
    if (error.message.includes("tournaments_one_per_sandbox_organizer")) throw new HttpError(409, SANDBOX_ONE_TOURNAMENT_MESSAGE);
  }
  throw new Error("Could not generate a unique tournament slug");
});
