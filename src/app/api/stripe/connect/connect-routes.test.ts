import { afterEach, describe, expect, it, vi } from "vitest";

const stripe = vi.hoisted(() => ({ getStripe: vi.fn(() => ({})) }));
const auth = vi.hoisted(() => ({ getOrganizer: vi.fn(async () => null) }));
vi.mock("@/lib/stripe/client", () => stripe);
vi.mock("@/lib/auth", () => auth);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

const routes = {
  onboard: async () => (await import("./onboard/route")).POST(new Request("http://localhost/api/stripe/connect/onboard", { method: "POST" })),
  loginLink: async () => (await import("./login-link/route")).POST(),
  refresh: async () => (await import("./refresh/route")).GET(new Request("http://localhost/api/stripe/connect/refresh")),
};

describe("Stripe Connect routes", () => {
  it.each(Object.entries(routes))("%s returns 404 and never calls Stripe when payments are off", async (_name, call) => {
    vi.stubEnv("PAYMENTS_ENABLED", "");
    expect((await call()).status).toBe(404);
    expect(stripe.getStripe).not.toHaveBeenCalled();
    expect(auth.getOrganizer).not.toHaveBeenCalled();
  });

  it.each(Object.entries(routes))("%s is reachable when payments are on", async (_name, call) => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    const response = await call();
    // Nobody is signed in, so the route answers as it does today: 401, or a redirect to sign in.
    expect([401, 307]).toContain(response.status);
  });
});
