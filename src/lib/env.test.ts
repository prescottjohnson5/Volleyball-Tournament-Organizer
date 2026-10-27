import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppUrl,
  getPlatformFeePercent,
  getStripeSecretKey,
  getStripeWebhookSecrets,
  getSupabasePublicEnv,
  isPaymentsEnabled,
  MissingEnvError,
  missingEnv,
} from "./env";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("env", () => {
  it("names the missing variable", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
    expect(() => getSupabasePublicEnv()).toThrow(MissingEnvError);
    expect(() => getSupabasePublicEnv()).toThrow(/NEXT_PUBLIC_SUPABASE_URL/);
  });

  it("treats whitespace-only values as missing", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "   ");
    vi.stubEnv("STRIPE_SECRET_KEY", "x");
    expect(missingEnv(["STRIPE_WEBHOOK_SECRET", "STRIPE_SECRET_KEY"])).toEqual(["STRIPE_WEBHOOK_SECRET"]);
  });

  it("rejects live Stripe keys", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
    expect(() => getStripeSecretKey()).toThrow(/test-mode/);
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_abc");
    expect(getStripeSecretKey()).toBe("sk_test_abc");
  });

  it("accepts one or several comma-separated webhook secrets", () => {
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_a");
    expect(getStripeWebhookSecrets()).toEqual(["whsec_a"]);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_a, whsec_b");
    expect(getStripeWebhookSecrets()).toEqual(["whsec_a", "whsec_b"]);
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", " , ");
    expect(() => getStripeWebhookSecrets()).toThrow(MissingEnvError);
  });

  it("prefers NEXT_PUBLIC_APP_URL and strips trailing slashes", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://example.com/");
    expect(getAppUrl("http://localhost:3000")).toBe("https://example.com");
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    expect(getAppUrl("http://localhost:3000")).toBe("http://localhost:3000");
    expect(() => getAppUrl()).toThrow(/NEXT_PUBLIC_APP_URL/);
  });

  it("parses the optional platform fee", () => {
    vi.stubEnv("STRIPE_PLATFORM_FEE_PERCENT", "");
    expect(getPlatformFeePercent()).toBe(0);
    vi.stubEnv("STRIPE_PLATFORM_FEE_PERCENT", "2.5");
    expect(getPlatformFeePercent()).toBe(2.5);
    vi.stubEnv("STRIPE_PLATFORM_FEE_PERCENT", "abc");
    expect(() => getPlatformFeePercent()).toThrow();
  });

  it("keeps payments off unless PAYMENTS_ENABLED is true", () => {
    vi.stubEnv("PAYMENTS_ENABLED", "");
    expect(isPaymentsEnabled()).toBe(false);
    vi.stubEnv("PAYMENTS_ENABLED", "yes");
    expect(isPaymentsEnabled()).toBe(false);
    vi.stubEnv("PAYMENTS_ENABLED", "false");
    expect(isPaymentsEnabled()).toBe(false);
    vi.stubEnv("PAYMENTS_ENABLED", " TRUE ");
    expect(isPaymentsEnabled()).toBe(true);
  });
});
