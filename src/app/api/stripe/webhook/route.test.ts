import Stripe from "stripe";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookDeps } from "@/lib/stripe/webhook-handler";

const fakeDeps: WebhookDeps = {
  wasProcessed: vi.fn(async () => false),
  markProcessed: vi.fn(async () => {}),
  confirmPayment: vi.fn(async () => "confirmed" as const),
  expireCheckout: vi.fn(async () => {}),
  refundPayment: vi.fn(async () => {}),
  syncConnectedAccount: vi.fn(async () => {}),
};

vi.mock("@/lib/stripe/webhook-deps", () => ({ createWebhookDeps: () => fakeDeps }));

const SECRET = "whsec_test";
const payload = JSON.stringify({
  id: "evt_test",
  object: "event",
  type: "checkout.session.completed",
  data: { object: { id: "cs_test", payment_status: "paid", payment_intent: "pi_test" } },
});

function post(body: string, signature?: string) {
  return new Request("http://localhost/api/stripe/webhook", {
    method: "POST",
    body,
    headers: signature ? { "stripe-signature": signature } : {},
  });
}

beforeEach(() => {
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", SECRET);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/stripe/webhook", async () => {
  const { POST } = await import("./route");
  const sign = (body: string, secret = SECRET) => new Stripe("sk_test_dummy").webhooks.generateTestHeaderString({ payload: body, secret });

  it("rejects requests without a signature", async () => {
    expect((await POST(post(payload))).status).toBe(400);
  });

  it("rejects a signature made with the wrong secret", async () => {
    expect((await POST(post(payload, sign(payload, "whsec_other")))).status).toBe(400);
  });

  it("rejects a tampered body", async () => {
    const signature = sign(payload);
    expect((await POST(post(payload.replace("cs_test", "cs_evil"), signature))).status).toBe(400);
  });

  it("processes a correctly signed event", async () => {
    const response = await POST(post(payload, sign(payload)));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, outcome: "confirmed" });
    expect(fakeDeps.confirmPayment).toHaveBeenCalledWith("cs_test", "pi_test");
  });

  it("accepts events signed with any of several configured secrets", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", `whsec_platform,${SECRET}`);
    expect((await POST(post(payload, sign(payload)))).status).toBe(200);
  });

  it("returns 500 so Stripe retries when processing fails", async () => {
    vi.mocked(fakeDeps.confirmPayment).mockRejectedValueOnce(new Error("db down"));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await POST(post(payload, sign(payload)))).status).toBe(500);
    spy.mockRestore();
  });

  it("names the missing secret when it is not configured", async () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    const response = await POST(post(payload, sign(payload)));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("STRIPE_WEBHOOK_SECRET");
  });
});
