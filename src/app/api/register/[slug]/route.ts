import { getAppUrl } from "@/lib/env";
import { readJson, route } from "@/lib/http";
import { collectsFees } from "@/lib/payments";
import { registrationSchema } from "@/lib/registration/schema";
import { getOpenTournament, registerWithoutPayment, startPaidRegistration } from "@/lib/registration/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Context = { params: Promise<{ slug: string }> };

/**
 * Registers a team. Free tournaments (always, when payments are off) confirm the team at once and
 * return the captain token. Paid tournaments return a Stripe Checkout URL instead; the team only
 * counts once the webhook confirms payment.
 */
export const POST = route(async (request: Request, { params }: Context) => {
  const { slug } = await params;
  const input = registrationSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();
  const tournament = await getOpenTournament(db, slug);

  if (!collectsFees(tournament)) {
    const registration = await registerWithoutPayment(db, tournament, input);
    return Response.json({ status: "registered", ...registration }, { status: 201 });
  }
  const url = await startPaidRegistration(db, tournament, input, getAppUrl(new URL(request.url).origin));
  return Response.json({ url });
});
