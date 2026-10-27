import type Stripe from "stripe";
import { getStripeWebhookSecrets, MissingEnvError } from "@/lib/env";
import { jsonError } from "@/lib/http";
import { notFoundUnlessPaymentsEnabled } from "@/lib/payments";
import { getStripe } from "@/lib/stripe/client";
import { createWebhookDeps } from "@/lib/stripe/webhook-deps";
import { handleStripeEvent } from "@/lib/stripe/webhook-handler";

/**
 * Stripe webhook endpoint. Verifies the signature against the raw body, then hands the event to
 * the idempotent handler. A 5xx response makes Stripe retry later, which is what we want when
 * the database is briefly unavailable. Returns 404 while payments are turned off.
 */
export async function POST(request: Request) {
  const disabled = notFoundUnlessPaymentsEnabled();
  if (disabled) return disabled;
  const signature = request.headers.get("stripe-signature");
  if (!signature) return jsonError(400, "Missing Stripe-Signature header.");
  const payload = await request.text();

  let event: Stripe.Event | undefined;
  try {
    const stripe = getStripe();
    for (const secret of getStripeWebhookSecrets()) {
      try {
        event = stripe.webhooks.constructEvent(payload, signature, secret);
        break;
      } catch {
        // Try the next configured secret (platform vs Connect endpoint).
      }
    }
  } catch (error) {
    if (error instanceof MissingEnvError) return jsonError(503, error.message);
    throw error;
  }
  if (!event) return jsonError(400, "Invalid Stripe signature.");

  try {
    const outcome = await handleStripeEvent(event, createWebhookDeps());
    return Response.json({ received: true, outcome });
  } catch (error) {
    // Log identifiers only: event payloads contain customer details.
    console.error(`Stripe webhook ${event.id} (${event.type}) failed:`, error instanceof Error ? error.message : error);
    if (error instanceof MissingEnvError) return jsonError(503, error.message);
    return jsonError(500, "Webhook processing failed.");
  }
}
