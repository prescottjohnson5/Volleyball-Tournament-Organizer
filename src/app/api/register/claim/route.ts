import { z } from "zod";
import { generateCaptainToken, hashCaptainToken } from "@/lib/captain-token";
import { HttpError, readJson, route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

const claimSchema = z.object({ sessionId: z.string().regex(/^cs_[A-Za-z0-9_]+$/, "Invalid checkout session") });

/**
 * Polled by the registration success page. Once the webhook has confirmed payment, hands out the
 * captain token exactly once (only its hash is stored). The Checkout Session id acts as a one-time
 * claim ticket: it is long, random and only known to the paying captain's browser.
 */
export const POST = route(async (request: Request) => {
  await enforceRateLimit(request, "claimCaptainLink");
  const { sessionId } = claimSchema.parse(await readJson(request));
  const db = createSupabaseAdminClient();

  const { data: team, error } = await db
    .from("teams")
    .select("id, name, payment_status, tournament_id")
    .eq("stripe_checkout_session_id", sessionId)
    .maybeSingle();
  if (error) throw error;
  if (!team) throw new HttpError(404, "Registration not found.");

  if (team.payment_status !== "paid") {
    return Response.json({ status: team.payment_status, teamName: team.name });
  }

  const token = generateCaptainToken();
  const { data: claimed, error: claimError } = await db
    .from("team_private")
    .update({ captain_token_hash: hashCaptainToken(token), captain_token_created_at: new Date().toISOString() })
    .eq("team_id", team.id)
    .is("captain_token_hash", null)
    .select("team_id");
  if (claimError) throw claimError;

  if (claimed.length === 0) {
    return Response.json({ status: "paid", teamName: team.name, alreadyClaimed: true });
  }
  return Response.json({ status: "paid", teamName: team.name, token });
});
