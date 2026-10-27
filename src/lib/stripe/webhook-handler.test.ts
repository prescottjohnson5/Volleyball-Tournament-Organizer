import type Stripe from "stripe";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleStripeEvent, type ConfirmResult, type WebhookDeps } from "./webhook-handler";

function event(type: string, object: Record<string, unknown>, id = "evt_1"): Stripe.Event {
  return { id, type, data: { object } } as unknown as Stripe.Event;
}

const paidSession = { id: "cs_1", payment_status: "paid", payment_intent: "pi_1" };

function fakeDeps(confirmResult: ConfirmResult = "confirmed") {
  const processed = new Set<string>();
  const deps = {
    wasProcessed: vi.fn(async (id: string) => processed.has(id)),
    markProcessed: vi.fn(async (id: string) => {
      processed.add(id);
    }),
    confirmPayment: vi.fn(async () => confirmResult),
    expireCheckout: vi.fn(async () => {}),
    refundPayment: vi.fn(async () => {}),
    syncConnectedAccount: vi.fn(async () => {}),
  } satisfies WebhookDeps;
  return deps;
}

let deps: ReturnType<typeof fakeDeps>;
beforeEach(() => {
  deps = fakeDeps();
});

describe("handleStripeEvent", () => {
  it("confirms a paid checkout and records the event", async () => {
    expect(await handleStripeEvent(event("checkout.session.completed", paidSession), deps)).toBe("confirmed");
    expect(deps.confirmPayment).toHaveBeenCalledWith("cs_1", "pi_1");
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_1", "checkout.session.completed");
  });

  it("skips an event it has already processed", async () => {
    await handleStripeEvent(event("checkout.session.completed", paidSession), deps);
    expect(await handleStripeEvent(event("checkout.session.completed", paidSession), deps)).toBe("duplicate");
    expect(deps.confirmPayment).toHaveBeenCalledTimes(1);
  });

  it("does not mark the event processed when a side effect fails, so Stripe retries it", async () => {
    deps.confirmPayment.mockRejectedValueOnce(new Error("db down"));
    await expect(handleStripeEvent(event("checkout.session.completed", paidSession), deps)).rejects.toThrow("db down");
    expect(deps.markProcessed).not.toHaveBeenCalled();
    expect(await handleStripeEvent(event("checkout.session.completed", paidSession), deps)).toBe("confirmed");
  });

  it("waits for async payments to succeed before confirming", async () => {
    const pending = { ...paidSession, payment_status: "unpaid" };
    expect(await handleStripeEvent(event("checkout.session.completed", pending), deps)).toBe("unpaid");
    expect(deps.confirmPayment).not.toHaveBeenCalled();
    expect(await handleStripeEvent(event("checkout.session.async_payment_succeeded", paidSession, "evt_2"), deps)).toBe("confirmed");
  });

  it.each(["needs_refund", "already_refunded"] as const)("refunds when the database says %s", async (result) => {
    deps = fakeDeps(result);
    expect(await handleStripeEvent(event("checkout.session.completed", paidSession), deps)).toBe("refunded");
    expect(deps.refundPayment).toHaveBeenCalledWith("pi_1", "refund-cs_1");
  });

  it("handles a payment intent object instead of an id", async () => {
    await handleStripeEvent(event("checkout.session.completed", { ...paidSession, payment_intent: { id: "pi_obj" } }), deps);
    expect(deps.confirmPayment).toHaveBeenCalledWith("cs_1", "pi_obj");
  });

  it("expires abandoned checkouts", async () => {
    expect(await handleStripeEvent(event("checkout.session.expired", { id: "cs_9" }), deps)).toBe("expired");
    expect(deps.expireCheckout).toHaveBeenCalledWith("cs_9");
  });

  it("syncs connected accounts and ignores unrelated events", async () => {
    expect(await handleStripeEvent(event("account.updated", { id: "acct_1" }), deps)).toBe("account_synced");
    expect(await handleStripeEvent(event("customer.created", {}, "evt_3"), deps)).toBe("ignored");
    expect(deps.markProcessed).toHaveBeenCalledWith("evt_3", "customer.created");
  });
});
