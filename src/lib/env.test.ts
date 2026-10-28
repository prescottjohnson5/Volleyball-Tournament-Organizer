import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAppUrl,
  getCronSecret,
  getPlatformFeePercent,
  getStripeSecretKey,
  getStripeWebhookSecrets,
  envProblems,
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  InvalidEnvError,
  isPaymentsEnabled,
  MissingEnvError,
  missingEnv,
  normalizeSupabaseUrl,
  supabaseKeyKind,
} from "./env";

/** A JWT-shaped key with the given role, built at runtime so no key-like string sits in the source. */
function legacyKey(role: string): string {
  const part = (value: object) => btoa(JSON.stringify(value)).replace(/=+$/, "");
  return [part({ alg: "HS256", typ: "JWT" }), part({ iss: "supabase", role }), "signature"].join(".");
}

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

  it("requires a long enough CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(() => getCronSecret()).toThrow(/CRON_SECRET/);
    vi.stubEnv("CRON_SECRET", "short");
    expect(() => getCronSecret()).toThrow(/at least 16/);
    vi.stubEnv("CRON_SECRET", "a-long-enough-random-secret");
    expect(getCronSecret()).toBe("a-long-enough-random-secret");
  });

  it("accepts the Supabase project URL and trims a copied /rest/v1 endpoint or trailing slash", () => {
    expect(normalizeSupabaseUrl("https://abcd.supabase.co")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("https://abcd.supabase.co/rest/v1/")).toBe("https://abcd.supabase.co");
    expect(normalizeSupabaseUrl("http://127.0.0.1:54321")).toBe("http://127.0.0.1:54321");
  });

  it("rejects URLs that cannot be the Supabase API with an explanation", () => {
    expect(() => normalizeSupabaseUrl("abcd.supabase.co")).toThrow(/not a web address/);
    expect(() => normalizeSupabaseUrl("https://supabase.com/dashboard/project/abcd")).toThrow(/dashboard address/);
    expect(() => normalizeSupabaseUrl("http://localhost:3000")).toThrow(/points at this app/);
    expect(() => normalizeSupabaseUrl("https://myapp.click", "https://myapp.click")).toThrow(/points at this app/);
    expect(() => normalizeSupabaseUrl("https://abcd.supabase.co/storage/v1")).toThrow(/nothing after it/);
    expect(() => normalizeSupabaseUrl("ftp://abcd.supabase.co")).toThrow(InvalidEnvError);
  });

  it("tells public and secret Supabase keys apart", () => {
    expect(supabaseKeyKind("sb_publishable_abc")).toBe("public");
    expect(supabaseKeyKind("sb_secret_abc")).toBe("secret");
    expect(supabaseKeyKind(legacyKey("anon"))).toBe("public");
    expect(supabaseKeyKind(legacyKey("service_role"))).toBe("secret");
    expect(supabaseKeyKind("not-a-key")).toBeNull();
  });

  it("refuses a secret key in the public anon variable and the anon key as the service role key", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://abcd.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", legacyKey("service_role"));
    expect(() => getSupabasePublicEnv()).toThrow(/secret service-role key/);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_abc");
    expect(getSupabasePublicEnv()).toEqual({ url: "https://abcd.supabase.co", anonKey: "sb_publishable_abc" });
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", legacyKey("anon"));
    expect(() => getSupabaseServiceRoleKey()).toThrow(/public anon key/);
  });

  it("lists missing and wrong variables without their values", () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.com/dashboard/project/abcd");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");
    vi.stubEnv("CRON_SECRET", "a-long-enough-random-secret");
    const problems = envProblems(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "CRON_SECRET"]);
    expect(problems.map((p) => p.name)).toEqual(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
    expect(problems[0].problem).toMatch(/^That is the Supabase dashboard address/);
    expect(problems[1].problem).toBe("Not set.");
    expect(JSON.stringify(problems)).not.toContain("project/abcd");
  });
});
