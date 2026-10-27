import "server-only";
import Stripe from "stripe";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./client";
import type { ConfirmResult, WebhookDeps } from "./webhook-handler";

const CONFIRM_RESULTS: readonly ConfirmResult[] = ["confirmed", "already_paid", "needs_refund", "already_refunded", "not_found"];

/** Production implementations of the webhook side effects (service-role Supabase + Stripe). */
export function createWebhookDeps(): WebhookDeps {
  const db = createSupabaseAdminClient();
  const stripe = getStripe();

  return {
    async wasProcessed(eventId) {
      const { data, error } = await db.from("stripe_events").select("id").eq("id", eventId).maybeSingle();
      if (error) throw error;
      return data !== null;
    },

    async markProcessed(eventId, type) {
      const { error } = await db.from("stripe_events").upsert({ id: eventId, type }, { onConflict: "id", ignoreDuplicates: true });
      if (error) throw error;
    },

    async confirmPayment(checkoutSessionId, paymentIntentId) {
      const { data, error } = await db.rpc("confirm_team_payment", {
        p_checkout_session_id: checkoutSessionId,
        p_payment_intent_id: paymentIntentId ?? "",
      });
      if (error) throw error;
      if (!CONFIRM_RESULTS.includes(data as ConfirmResult)) throw new Error(`Unexpected confirm result: ${data}`);
      return data as ConfirmResult;
    },

    async expireCheckout(checkoutSessionId) {
      const { error } = await db
        .from("teams")
        .update({ payment_status: "expired" })
        .eq("stripe_checkout_session_id", checkoutSessionId)
        .eq("payment_status", "pending");
      if (error) throw error;
    },

    async refundPayment(paymentIntentId, idempotencyKey) {
      const intent = await stripe.paymentIntents.retrieve(paymentIntentId);
      // Destination charges: also pull the money back from the organizer and return the platform fee.
      const isDestinationCharge = Boolean(intent.transfer_data?.destination);
      try {
        await stripe.refunds.create(
          {
            payment_intent: paymentIntentId,
            reason: "requested_by_customer",
            ...(isDestinationCharge ? { reverse_transfer: true, refund_application_fee: true } : {}),
          },
          { idempotencyKey },
        );
      } catch (error) {
        if (error instanceof Stripe.errors.StripeError && error.code === "charge_already_refunded") return;
        throw error;
      }
    },

    async syncConnectedAccount(account) {
      const { error } = await db
        .from("organizer_profiles")
        .update({ stripe_charges_enabled: account.charges_enabled ?? false, stripe_details_submitted: account.details_submitted ?? false })
        .eq("stripe_account_id", account.id);
      if (error) throw error;
    },
  };
}
