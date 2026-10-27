/**
 * Typed access to environment variables. Every reader names the missing variable so a fresh
 * checkout without `.env.local` fails with an actionable message instead of a stack trace.
 *
 * NEXT_PUBLIC_* values must be read with static `process.env.NAME` expressions so Next.js can
 * inline them into the browser bundle.
 */

export const ENV_READERS = {
  NEXT_PUBLIC_SUPABASE_URL: () => process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: () => process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: () => process.env.SUPABASE_SERVICE_ROLE_KEY,
  STRIPE_SECRET_KEY: () => process.env.STRIPE_SECRET_KEY,
  STRIPE_WEBHOOK_SECRET: () => process.env.STRIPE_WEBHOOK_SECRET,
  NEXT_PUBLIC_APP_URL: () => process.env.NEXT_PUBLIC_APP_URL,
  STRIPE_PLATFORM_FEE_PERCENT: () => process.env.STRIPE_PLATFORM_FEE_PERCENT,
  PAYMENTS_ENABLED: () => process.env.PAYMENTS_ENABLED,
  CRON_SECRET: () => process.env.CRON_SECRET,
} as const;

export type EnvName = keyof typeof ENV_READERS;

export class MissingEnvError extends Error {
  constructor(public readonly variable: EnvName) {
    super(
      `Missing environment variable ${variable}. Add it to .env.local (see SETUP_STEPS.md) and restart the dev server.`,
    );
    this.name = "MissingEnvError";
  }
}

function read(name: EnvName): string | undefined {
  const value = ENV_READERS[name]()?.trim();
  return value ? value : undefined;
}

function required(name: EnvName): string {
  const value = read(name);
  if (!value) throw new MissingEnvError(name);
  return value;
}

/** Returns the subset of `names` that are not set. Useful for rendering a setup notice. */
export function missingEnv(names: readonly EnvName[]): EnvName[] {
  return names.filter((name) => !read(name));
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  return {
    url: required("NEXT_PUBLIC_SUPABASE_URL"),
    anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  };
}

export function getSupabaseServiceRoleKey(): string {
  return required("SUPABASE_SERVICE_ROLE_KEY");
}

/** Stripe secret key. Only test-mode keys are accepted: real-money payments are out of scope. */
export function getStripeSecretKey(): string {
  const key = required("STRIPE_SECRET_KEY");
  if (!/^(sk|rk)_test_/.test(key)) {
    throw new Error("STRIPE_SECRET_KEY must be a Stripe test-mode key (it starts with sk_test_).");
  }
  return key;
}

/**
 * Webhook signing secrets. Several may be given, comma-separated: in production the platform
 * endpoint and the Connect endpoint each have their own secret.
 */
export function getStripeWebhookSecrets(): string[] {
  const secrets = required("STRIPE_WEBHOOK_SECRET")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (secrets.length === 0) throw new MissingEnvError("STRIPE_WEBHOOK_SECRET");
  return secrets;
}

/**
 * Public base URL used in links, QR codes and Stripe redirects. Falls back to the request origin
 * so local development works before NEXT_PUBLIC_APP_URL is set.
 */
export function getAppUrl(fallbackOrigin?: string): string {
  const value = read("NEXT_PUBLIC_APP_URL") ?? fallbackOrigin;
  if (!value) throw new MissingEnvError("NEXT_PUBLIC_APP_URL");
  return value.replace(/\/+$/, "");
}

/** Optional platform fee as a percentage of the registration fee (0 when unset). */
export function getPlatformFeePercent(): number {
  const raw = read("STRIPE_PLATFORM_FEE_PERCENT");
  if (!raw) return 0;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 0 || value > 50) {
    throw new Error("STRIPE_PLATFORM_FEE_PERCENT must be a number between 0 and 50.");
  }
  return value;
}

/**
 * Payments are off unless PAYMENTS_ENABLED is exactly "true". When off, the app needs no Stripe
 * keys and never calls Stripe: registration is free and confirmed immediately.
 */
export function isPaymentsEnabled(): boolean {
  return read("PAYMENTS_ENABLED")?.toLowerCase() === "true";
}

/** Shared secret for /api/cron/cleanup. Vercel Cron sends it as `Authorization: Bearer <secret>`. */
export function getCronSecret(): string {
  const secret = required("CRON_SECRET");
  if (secret.length < 16) throw new Error("CRON_SECRET must be at least 16 characters long.");
  return secret;
}
