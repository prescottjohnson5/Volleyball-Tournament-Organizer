import { HttpError, route } from "@/lib/http";
import { notFoundUnlessPaymentsEnabled } from "@/lib/payments";
import { getStripe } from "@/lib/stripe/client";
import { getOrganizerProfile, stripeErrorToHttp } from "@/lib/stripe/connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizerForApi } from "@/lib/tournaments/server";

/** One-time link into the organizer's Stripe Express dashboard (balance and payouts). */
export const POST = route(async () => {
  const disabled = notFoundUnlessPaymentsEnabled();
  if (disabled) return disabled;
  const organizer = await requireOrganizerForApi();
  const profile = await getOrganizerProfile(createSupabaseAdminClient(), organizer.id);
  if (!profile?.stripe_account_id) throw new HttpError(409, "Set up payouts first.");
  try {
    const link = await getStripe().accounts.createLoginLink(profile.stripe_account_id);
    return Response.json({ url: link.url });
  } catch (error) {
    throw stripeErrorToHttp(error);
  }
});
