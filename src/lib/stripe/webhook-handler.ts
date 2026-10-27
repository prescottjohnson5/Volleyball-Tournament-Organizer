import type Stripe from "stripe";

/** Result of the confirm_team_payment database function. */
export type ConfirmResult = "confirmed" | "already_paid" | "needs_refund" | "already_refunded" | "not_found";

/** Side effects the handler needs. Injected so the logic is testable without Stripe or a database. */
export interface WebhookDeps {
  wasProcessed(eventId: string): Promise<boolean>;
  markProcessed(eventId: string, type: string): Promise<void>;
  confirmPayment(checkoutSessionId: string, paymentIntentId: string | null): Promise<ConfirmResult>;
  expireCheckout(checkoutSessionId: string): Promise<void>;
  /** Must be safe to call twice for the same payment (treat "already refunded" as success). */
  refundPayment(paymentIntentId: string, idempotencyKey: string): Promise<void>;
  syncConnectedAccount(account: Stripe.Account): Promise<void>;
}

export type WebhookOutcome =
  | "duplicate"
  | "confirmed"
  | "already_paid"
  | "refunded"
  | "not_found"
  | "unpaid"
  | "expired"
  | "account_synced"
  | "ignored";

function paymentIntentId(session: Stripe.Checkout.Session): string | null {
  const pi = session.payment_intent;
  if (!pi) return null;
  return typeof pi === "string" ? pi : pi.id;
}

async function handleCompletedSession(session: Stripe.Checkout.Session, deps: WebhookDeps): Promise<WebhookOutcome> {
  // Delayed payment methods complete the session before the money arrives; wait for async_payment_succeeded.
  if (session.payment_status !== "paid") return "unpaid";
  const pi = paymentIntentId(session);
  const result = await deps.confirmPayment(session.id, pi);
  if (result === "needs_refund" || result === "already_refunded") {
    // The tournament filled up or started while this captain was paying: give the money back.
    if (pi) await deps.refundPayment(pi, `refund-${session.id}`);
    return "refunded";
  }
  return result;
}

/**
 * Handles one verified Stripe event. Idempotent: replays of the same event id are skipped, and
 * every step is safe to repeat if Stripe retries after a partial failure (the event is only
 * marked processed after all side effects succeed).
 */
export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  if (await deps.wasProcessed(event.id)) return "duplicate";

  let outcome: WebhookOutcome;
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded":
      outcome = await handleCompletedSession(event.data.object, deps);
      break;
    case "checkout.session.expired":
    case "checkout.session.async_payment_failed":
      await deps.expireCheckout(event.data.object.id);
      outcome = "expired";
      break;
    case "account.updated":
      await deps.syncConnectedAccount(event.data.object);
      outcome = "account_synced";
      break;
    default:
      outcome = "ignored";
  }

  await deps.markProcessed(event.id, event.type);
  return outcome;
}
