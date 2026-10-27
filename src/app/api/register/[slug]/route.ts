import { getAppUrl } from "@/lib/env";
import { HttpError, readJson, route } from "@/lib/http";
import { buildCheckoutParams } from "@/lib/registration/checkout";
import { registrationSchema } from "@/lib/registration/schema";
import { getStripe } from "@/lib/stripe/client";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { countPaidTeams } from "@/lib/tournaments/server";

type Context = { params: Promise<{ slug: string }> };

/**
 * Starts a registration: records the team as pending and returns a Stripe Checkout URL.
 * The team only counts as registered once the webhook confirms payment.
 */
export const POST = route(async (request: Request, { params }: Context) => {
  const { slug } = await params;
  const input = registrationSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();
  const stripe = getStripe();

  const { data: tournament, error } = await db.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!tournament) throw new HttpError(404, "Tournament not found.");
  if (tournament.status !== "registration") throw new HttpError(409, "Registration for this tournament is closed.");
  if ((await countPaidTeams(db, tournament.id)) >= tournament.max_teams) {
    throw new HttpError(409, "This tournament is full.");
  }

  const { data: sameName, error: nameError } = await db
    .from("teams")
    .select("id")
    .eq("tournament_id", tournament.id)
    .eq("payment_status", "paid")
    .ilike("name", input.teamName.replace(/[\\%_]/g, (c) => `\\${c}`));
  if (nameError) throw nameError;
  if (sameName.length > 0) throw new HttpError(409, "A team with that name is already registered. Please pick another name.");

  const { data: team, error: teamError } = await db
    .from("teams")
    .insert({ tournament_id: tournament.id, name: input.teamName })
    .select("id")
    .single();
  if (teamError) throw teamError;

  try {
    const { error: privateError } = await db.from("team_private").insert({
      team_id: team.id,
      tournament_id: tournament.id,
      captain_name: input.captainName,
      captain_email: input.captainEmail,
    });
    if (privateError) throw privateError;

    const session = await stripe.checkout.sessions.create(
      buildCheckoutParams({
        tournament,
        teamId: team.id,
        teamName: input.teamName,
        captainEmail: input.captainEmail,
        appUrl: getAppUrl(new URL(request.url).origin),
        now: new Date(),
      }),
      { idempotencyKey: `checkout-${team.id}` },
    );

    const { error: sessionError } = await db.from("teams").update({ stripe_checkout_session_id: session.id }).eq("id", team.id);
    if (sessionError) throw sessionError;
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return Response.json({ url: session.url });
  } catch (cause) {
    // Do not leave a half-created registration behind (team_private cascades).
    await db.from("teams").delete().eq("id", team.id);
    throw cause;
  }
});
