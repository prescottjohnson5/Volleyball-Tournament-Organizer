import { isPaymentsEnabled } from "@/lib/env";
import { readJson, route } from "@/lib/http";
import { createTournamentSlug } from "@/lib/slug";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { parseTournamentInput, toTournamentColumns } from "@/lib/tournaments/schema";
import { requireOrganizerForApi } from "@/lib/tournaments/server";

const UNIQUE_VIOLATION = "23505";

/** Create a tournament for the signed-in organizer. */
export const POST = route(async (request: Request) => {
  const organizer = await requireOrganizerForApi();
  const input = parseTournamentInput(await readJson(request), { withFee: isPaymentsEnabled() });
  const db = createSupabaseAdminClient();

  // The slug has a random suffix; retry in the unlikely case it collides.
  for (let attempt = 0; attempt < 3; attempt++) {
    const { data, error } = await db
      .from("tournaments")
      .insert({ registration_fee_cents: 0, ...toTournamentColumns(input), organizer_id: organizer.id, slug: createTournamentSlug(input.name) })
      .select("id, slug")
      .single();
    if (!error) return Response.json(data, { status: 201 });
    if (error.code !== UNIQUE_VIOLATION) throw error;
  }
  throw new Error("Could not generate a unique tournament slug");
});
