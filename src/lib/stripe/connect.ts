import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";
import type { Organizer } from "@/lib/auth";
import { HttpError } from "@/lib/http";
import type { Database, OrganizerProfileRow } from "@/lib/supabase/database.types";

type Db = SupabaseClient<Database>;

/** Stripe API errors carry messages meant for developers and organizers; surface them as 502s. */
export function stripeErrorToHttp(error: unknown): unknown {
  if (error instanceof Stripe.errors.StripeError) return new HttpError(502, `Stripe: ${error.message}`);
  return error;
}

export async function getOrganizerProfile(db: Db, organizerId: string): Promise<OrganizerProfileRow | null> {
  const { data, error } = await db.from("organizer_profiles").select("*").eq("id", organizerId).maybeSingle();
  if (error) throw error;
  return data;
}

/** The connected account that registration payments for this organizer go to, or null if not ready. */
export async function getPayoutAccount(db: Db, organizerId: string): Promise<string | null> {
  const profile = await getOrganizerProfile(db, organizerId);
  return profile?.stripe_account_id && profile.stripe_charges_enabled ? profile.stripe_account_id : null;
}

/**
 * Returns the organizer's Express account id, creating the account on first use. The Stripe
 * idempotency key means a double click cannot create two accounts.
 */
export async function getOrCreateConnectedAccount(db: Db, stripe: Stripe, organizer: Organizer): Promise<string> {
  const profile = await getOrganizerProfile(db, organizer.id);
  if (profile?.stripe_account_id) return profile.stripe_account_id;

  const account = await stripe.accounts.create(
    {
      type: "express",
      email: organizer.email ?? undefined,
      capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
      metadata: { organizer_id: organizer.id },
    },
    { idempotencyKey: `connect-account-${organizer.id}` },
  );

  const { error } = await db
    .from("organizer_profiles")
    .upsert({ id: organizer.id, stripe_account_id: account.id, stripe_charges_enabled: account.charges_enabled, stripe_details_submitted: account.details_submitted });
  if (error) throw error;
  return account.id;
}

/** A single-use Stripe-hosted onboarding link (they expire after a few minutes). */
export async function createOnboardingLink(stripe: Stripe, accountId: string, baseUrl: string): Promise<string> {
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${baseUrl}/api/stripe/connect/refresh`,
    return_url: `${baseUrl}/dashboard?connect=return`,
  });
  return link.url;
}

/** Pulls the account's current state from Stripe (used on return from onboarding). */
export async function syncAccountStatus(db: Db, stripe: Stripe, accountId: string): Promise<Pick<OrganizerProfileRow, "stripe_charges_enabled" | "stripe_details_submitted">> {
  const account = await stripe.accounts.retrieve(accountId);
  const status = { stripe_charges_enabled: account.charges_enabled ?? false, stripe_details_submitted: account.details_submitted ?? false };
  const { error } = await db.from("organizer_profiles").update(status).eq("stripe_account_id", accountId);
  if (error) throw error;
  return status;
}
