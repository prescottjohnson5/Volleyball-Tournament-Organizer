import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TournamentRow } from "@/lib/supabase/database.types";

const tournament = { id: "t1", slug: "spring-open", registration_fee_cents: 2500 } as TournamentRow;

const registration = vi.hoisted(() => ({
  getOpenTournament: vi.fn(),
  registerWithoutPayment: vi.fn(),
  startPaidRegistration: vi.fn(),
}));
const stripe = vi.hoisted(() => ({ getStripe: vi.fn() }));

vi.mock("@/lib/registration/server", () => registration);
vi.mock("@/lib/stripe/client", () => stripe);
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));

const body = { teamName: "Net Ninjas", captainName: "Sam", captainEmail: "sam@example.com" };
const call = async () => {
  const { POST } = await import("./route");
  return POST(new Request("http://localhost/api/register/spring-open", { method: "POST", body: JSON.stringify(body) }), {
    params: Promise.resolve({ slug: "spring-open" }),
  });
};

beforeEach(() => {
  registration.getOpenTournament.mockResolvedValue(tournament);
  registration.registerWithoutPayment.mockResolvedValue({ teamName: "Net Ninjas", token: "tok" });
  registration.startPaidRegistration.mockResolvedValue("https://checkout.stripe.com/c/pay/cs_test_1");
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("POST /api/register/[slug] with payments off", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", ""));

  it("confirms the team at once and returns the captain token, even if the tournament has a fee", async () => {
    const response = await call();
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ status: "registered", teamName: "Net Ninjas", token: "tok" });
    expect(registration.registerWithoutPayment).toHaveBeenCalledWith({}, tournament, body);
  });

  it("never touches Stripe", async () => {
    await call();
    expect(registration.startPaidRegistration).not.toHaveBeenCalled();
    expect(stripe.getStripe).not.toHaveBeenCalled();
  });
});

describe("POST /api/register/[slug] with payments on", () => {
  beforeEach(() => vi.stubEnv("PAYMENTS_ENABLED", "true"));

  it("sends paid tournaments to Stripe Checkout", async () => {
    const response = await call();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ url: "https://checkout.stripe.com/c/pay/cs_test_1" });
    expect(registration.registerWithoutPayment).not.toHaveBeenCalled();
  });

  it("registers free tournaments without Stripe", async () => {
    registration.getOpenTournament.mockResolvedValue({ ...tournament, registration_fee_cents: 0 });
    expect((await call()).status).toBe(201);
    expect(registration.startPaidRegistration).not.toHaveBeenCalled();
  });
});
