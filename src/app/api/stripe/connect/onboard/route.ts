import { getAppUrl } from "@/lib/env";
import { route } from "@/lib/http";
import { notFoundUnlessPaymentsEnabled } from "@/lib/payments";
import { getStripe } from "@/lib/stripe/client";
import { createOnboardingLink, getOrCreateConnectedAccount, stripeErrorToHttp } from "@/lib/stripe/connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { requireOrganizerForApi } from "@/lib/tournaments/server";

/** Creates (once) the organizer's Stripe Express account and returns an onboarding link. */
export const POST = route(async (request: Request) => {
  const disabled = notFoundUnlessPaymentsEnabled();
  if (disabled) return disabled;
  const organizer = await requireOrganizerForApi();
  try {
    const stripe = getStripe();
    const accountId = await getOrCreateConnectedAccount(createSupabaseAdminClient(), stripe, organizer);
    const url = await createOnboardingLink(stripe, accountId, getAppUrl(new URL(request.url).origin));
    return Response.json({ url });
  } catch (error) {
    throw stripeErrorToHttp(error);
  }
});
