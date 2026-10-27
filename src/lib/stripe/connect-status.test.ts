import { describe, expect, it } from "vitest";
import { connectStatus } from "./connect-status";

describe("connectStatus", () => {
  it("tracks onboarding progress", () => {
    expect(connectStatus(null)).toBe("not_started");
    expect(connectStatus({ stripe_account_id: null, stripe_charges_enabled: false })).toBe("not_started");
    expect(connectStatus({ stripe_account_id: "acct_1", stripe_charges_enabled: false })).toBe("incomplete");
    expect(connectStatus({ stripe_account_id: "acct_1", stripe_charges_enabled: true })).toBe("ready");
  });
});
