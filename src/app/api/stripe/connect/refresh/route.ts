import { NextResponse } from "next/server";
import { getOrganizer } from "@/lib/auth";
import { getAppUrl } from "@/lib/env";
import { getStripe } from "@/lib/stripe/client";
import { createOnboardingLink, getOrganizerProfile } from "@/lib/stripe/connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/**
 * Stripe sends the organizer here when an onboarding link has expired or was already used.
 * Issue a fresh link and send them straight back to Stripe.
 */
export async function GET(request: Request) {
  const baseUrl = getAppUrl(new URL(request.url).origin);
  const organizer = await getOrganizer();
  if (!organizer) return NextResponse.redirect(`${baseUrl}/login?next=/dashboard`);

  const profile = await getOrganizerProfile(createSupabaseAdminClient(), organizer.id);
  if (!profile?.stripe_account_id) return NextResponse.redirect(`${baseUrl}/dashboard`);
  try {
    return NextResponse.redirect(await createOnboardingLink(getStripe(), profile.stripe_account_id, baseUrl));
  } catch {
    return NextResponse.redirect(`${baseUrl}/dashboard?connect=error`);
  }
}
