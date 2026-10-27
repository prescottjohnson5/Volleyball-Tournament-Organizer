import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateCaptainToken, hashCaptainToken } from "@/lib/captain-token";
import { getPlatformFeePercent } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { getStripe } from "@/lib/stripe/client";
import { getPayoutAccount, stripeErrorToHttp } from "@/lib/stripe/connect";
import type { Database, TournamentRow } from "@/lib/supabase/database.types";
import { countPaidTeams } from "@/lib/tournaments/server";
import { buildCheckoutParams } from "./checkout";
import type { RegistrationInput } from "./schema";

type Db = SupabaseClient<Database>;

/** Loads a tournament that is still taking registrations, or throws a message for the captain. */
export async function getOpenTournament(db: Db, slug: string): Promise<TournamentRow> {
  const { data: tournament, error } = await db.from("tournaments").select("*").eq("slug", slug).maybeSingle();
  if (error) throw error;
  if (!tournament) throw new HttpError(404, "Tournament not found.");
  if (tournament.status !== "registration") throw new HttpError(409, "Registration for this tournament is closed.");
  if ((await countPaidTeams(db, tournament.id)) >= tournament.max_teams) {
    throw new HttpError(409, "This tournament is full.");
  }
  return tournament;
}

const freeResultSchema = z.object({
  status: z.enum(["registered", "not_found", "closed", "full", "name_taken"]),
});

const FREE_REGISTRATION_ERRORS = {
  not_found: [404, "Tournament not found."],
  closed: [409, "Registration for this tournament is closed."],
  full: [409, "Sorry, this tournament just filled up."],
  name_taken: [409, "A team with that name is already registered. Please pick another name."],
} as const;

/**
 * Registers a team with no payment step. The team is confirmed in the same transaction that checks
 * capacity, and the captain token is returned so the page can show the captain link right away.
 */
export async function registerWithoutPayment(
  db: Db,
  tournament: Pick<TournamentRow, "id">,
  input: RegistrationInput,
): Promise<{ teamName: string; token: string }> {
  const token = generateCaptainToken();
  const { data, error } = await db.rpc("register_free_team", {
    p_tournament_id: tournament.id,
    p_team_name: input.teamName,
    p_captain_name: input.captainName,
    p_captain_email: input.captainEmail,
    p_captain_token_hash: hashCaptainToken(token),
  });
  if (error) throw error;
  const { status } = freeResultSchema.parse(data);
  if (status !== "registered") {
    const [code, message] = FREE_REGISTRATION_ERRORS[status];
    throw new HttpError(code, message);
  }
  return { teamName: input.teamName, token };
}

/**
 * Starts a paid registration: records the team as pending and returns a Stripe Checkout URL.
 * The team only counts as registered once the webhook confirms payment.
 */
export async function startPaidRegistration(db: Db, tournament: TournamentRow, input: RegistrationInput, appUrl: string): Promise<string> {
  const stripe = getStripe();
  // Destination charge: the fee goes to the organizer's Stripe Express account.
  const payoutAccount = await getPayoutAccount(db, tournament.organizer_id);
  if (!payoutAccount) {
    throw new HttpError(409, "The organizer has not finished setting up payments yet. Please try again later.");
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
        appUrl,
        now: new Date(),
        destination: { accountId: payoutAccount, feePercent: getPlatformFeePercent() },
      }),
      { idempotencyKey: `checkout-${team.id}` },
    );

    const { error: sessionError } = await db.from("teams").update({ stripe_checkout_session_id: session.id }).eq("id", team.id);
    if (sessionError) throw sessionError;
    if (!session.url) throw new Error("Stripe did not return a Checkout URL");
    return session.url;
  } catch (cause) {
    // Do not leave a half-created registration behind (team_private cascades).
    await db.from("teams").delete().eq("id", team.id);
    throw stripeErrorToHttp(cause);
  }
}
