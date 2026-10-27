import { describe, expect, it } from "vitest";
import { buildCheckoutParams, CHECKOUT_LIFETIME_SECONDS } from "./checkout";
import { registrationSchema } from "./schema";

describe("registrationSchema", () => {
  it("trims names and normalises the email", () => {
    expect(registrationSchema.parse({ teamName: "  Sand Sharks ", captainName: " Alex ", captainEmail: " Alex@Example.COM " })).toEqual({
      teamName: "Sand Sharks",
      captainName: "Alex",
      captainEmail: "alex@example.com",
    });
  });

  it("rejects bad input", () => {
    expect(registrationSchema.safeParse({ teamName: "X", captainName: "A", captainEmail: "a@b.co" }).success).toBe(false);
    expect(registrationSchema.safeParse({ teamName: "Team", captainName: "A", captainEmail: "not-an-email" }).success).toBe(false);
  });
});

describe("buildCheckoutParams", () => {
  const base = {
    tournament: { id: "tour-1", slug: "summer-slam-ab12cd", name: "Summer Slam", registration_fee_cents: 4000, currency: "usd" },
    teamId: "team-1",
    teamName: "Sand Sharks",
    captainEmail: "alex@example.com",
    appUrl: "https://vto.example",
    now: new Date("2026-07-01T12:00:00Z"),
  };

  it("charges the registration fee on the platform account", () => {
    const params = buildCheckoutParams(base);
    expect(params.mode).toBe("payment");
    expect(params.line_items?.[0].price_data).toMatchObject({ currency: "usd", unit_amount: 4000 });
    expect(params.client_reference_id).toBe("team-1");
    expect(params.metadata).toEqual({ team_id: "team-1", tournament_id: "tour-1" });
    expect(params.payment_intent_data?.transfer_data).toBeUndefined();
    expect(params.success_url).toBe("https://vto.example/t/summer-slam-ab12cd/register/success?session_id={CHECKOUT_SESSION_ID}");
    expect(params.expires_at).toBe(Math.floor(base.now.getTime() / 1000) + CHECKOUT_LIFETIME_SECONDS);
  });

  it("uses a destination charge with an optional platform fee", () => {
    const params = buildCheckoutParams({ ...base, destination: { accountId: "acct_123", feePercent: 5 } });
    expect(params.payment_intent_data).toMatchObject({ transfer_data: { destination: "acct_123" }, application_fee_amount: 200 });
    const noFee = buildCheckoutParams({ ...base, destination: { accountId: "acct_123", feePercent: 0 } });
    expect(noFee.payment_intent_data?.application_fee_amount).toBeUndefined();
  });
});
