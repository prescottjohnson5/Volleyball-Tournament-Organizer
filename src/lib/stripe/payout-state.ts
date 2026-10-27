import "server-only";
import { getPlatformFeePercent, missingEnv } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./client";
import { getOrganizerProfile, syncAccountStatus } from "./connect";
import { connectStatus, type ConnectStatus } from "./connect-status";

export type PayoutState = { available: false } | { available: true; status: ConnectStatus; feePercent: number };

/**
 * The organizer's payout setup for the dashboard. An incomplete account is re-checked with Stripe
 * on each visit, so returning from onboarding updates the status even without a Connect webhook.
 */
export async function getPayoutState(organizerId: string): Promise<PayoutState> {
  if (missingEnv(["STRIPE_SECRET_KEY"]).length > 0) return { available: false };
  const db = createSupabaseAdminClient();
  const profile = await getOrganizerProfile(db, organizerId);
  let status = connectStatus(profile);
  if (status === "incomplete" && profile?.stripe_account_id) {
    try {
      const synced = await syncAccountStatus(db, getStripe(), profile.stripe_account_id);
      status = connectStatus({ stripe_account_id: profile.stripe_account_id, stripe_charges_enabled: synced.stripe_charges_enabled });
    } catch (error) {
      console.error("Could not sync Stripe account status:", error instanceof Error ? error.message : error);
    }
  }
  return { available: true, status, feePercent: getPlatformFeePercent() };
}
