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

/** A configuration problem. Its message names the variable and says how to fix it, never the value. */
export class EnvError extends Error {
  constructor(
    public readonly variable: EnvName,
    message: string,
  ) {
    super(message);
    this.name = "EnvError";
  }
}

export class MissingEnvError extends EnvError {
  constructor(variable: EnvName) {
    super(
      variable,
      `Missing environment variable ${variable}. Add it to .env.local (see SETUP_STEPS.md) and restart the dev server.`,
    );
    this.name = "MissingEnvError";
  }
}

/** A variable is set but cannot be right, for example a dashboard link instead of the API URL. */
export class InvalidEnvError extends EnvError {
  constructor(
    variable: EnvName,
    public readonly problem: string,
  ) {
    super(variable, `${variable} looks wrong: ${problem} Fix it in .env.local (see SETUP_STEPS.md) and restart the server.`);
    this.name = "InvalidEnvError";
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

const SUPABASE_URL_EXAMPLE = "https://abcdefghijklmnop.supabase.co";

/**
 * The Supabase API base URL, e.g. https://abcd.supabase.co. A trailing slash or a copied "/rest/v1"
 * endpoint is trimmed (supabase-js adds those paths itself). Anything else that cannot be the API URL
 * throws here, because otherwise it only fails later with a confusing 404 deep inside a request.
 */
export function normalizeSupabaseUrl(value: string, appUrl?: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new InvalidEnvError("NEXT_PUBLIC_SUPABASE_URL", `it is not a web address. It should look like ${SUPABASE_URL_EXAMPLE}.`);
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new InvalidEnvError("NEXT_PUBLIC_SUPABASE_URL", `it must start with https://, like ${SUPABASE_URL_EXAMPLE}.`);
  }
  if (url.hostname === "supabase.com" || url.hostname.endsWith(".supabase.com")) {
    throw new InvalidEnvError(
      "NEXT_PUBLIC_SUPABASE_URL",
      `that is the Supabase dashboard address. Use the Project URL from Project Settings → Data API instead; it looks like ${SUPABASE_URL_EXAMPLE}.`,
    );
  }
  const appOrigin = appUrl ? originOf(appUrl) : null;
  if (url.origin === appOrigin || (isLocalHost(url.hostname) && url.port === "3000")) {
    throw new InvalidEnvError(
      "NEXT_PUBLIC_SUPABASE_URL",
      `it points at this app (${url.origin}), not at Supabase. Use the Project URL from Project Settings → Data API, like ${SUPABASE_URL_EXAMPLE}.`,
    );
  }
  const path = url.pathname.replace(/\/+$/, "").replace(/\/(rest|auth)\/v1$/, "");
  if (path || url.search || url.hash) {
    throw new InvalidEnvError(
      "NEXT_PUBLIC_SUPABASE_URL",
      `it should be only the project address with nothing after it, like ${SUPABASE_URL_EXAMPLE}.`,
    );
  }
  return url.origin;
}

function originOf(value: string): string | null {
  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function isLocalHost(hostname: string): boolean {
  return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]";
}

/**
 * Whether a Supabase key is the public (anon / publishable) one or the secret (service role) one.
 * Handles the newer sb_publishable_ / sb_secret_ keys and the older JWT keys, whose payload names the
 * role. Null when the key is in neither format.
 */
export function supabaseKeyKind(key: string): "public" | "secret" | null {
  if (key.startsWith("sb_publishable_")) return "public";
  if (key.startsWith("sb_secret_")) return "secret";
  const payload = key.split(".")[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")));
    if (json?.role === "anon") return "public";
    if (json?.role === "service_role") return "secret";
  } catch {
    // Not a JWT.
  }
  return null;
}

function supabaseUrl(): string {
  return normalizeSupabaseUrl(required("NEXT_PUBLIC_SUPABASE_URL"), read("NEXT_PUBLIC_APP_URL"));
}

function supabaseAnonKey(): string {
  const key = required("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  if (supabaseKeyKind(key) === "secret") {
    throw new InvalidEnvError(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      "this is the secret service-role key. Use the anon (publishable) key here. The secret key belongs only in SUPABASE_SERVICE_ROLE_KEY, because NEXT_PUBLIC_ values are sent to every browser.",
    );
  }
  return key;
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  return { url: supabaseUrl(), anonKey: supabaseAnonKey() };
}

export function getSupabaseServiceRoleKey(): string {
  const key = required("SUPABASE_SERVICE_ROLE_KEY");
  if (supabaseKeyKind(key) === "public") {
    throw new InvalidEnvError(
      "SUPABASE_SERVICE_ROLE_KEY",
      "this is the public anon key. Use the service_role (secret) key from Project Settings → API Keys.",
    );
  }
  return key;
}

/** The variables every Supabase-backed page needs. */
export const SUPABASE_PUBLIC_VARS = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"] as const satisfies readonly EnvName[];
/** The public variables plus the server-only service role key, for pages and routes that write. */
export const SUPABASE_SERVER_VARS = [...SUPABASE_PUBLIC_VARS, "SUPABASE_SERVICE_ROLE_KEY"] as const satisfies readonly EnvName[];

export type EnvProblem = { name: EnvName; problem: string };

const CHECKS: Partial<Record<EnvName, () => unknown>> = {
  NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  SUPABASE_SERVICE_ROLE_KEY: getSupabaseServiceRoleKey,
  NEXT_PUBLIC_APP_URL: () => {
    const value = required("NEXT_PUBLIC_APP_URL");
    if (!/^https?:\/\/[^/]/.test(value) || !originOf(value)) {
      throw new InvalidEnvError("NEXT_PUBLIC_APP_URL", "it should be the address of this site, like https://example.com.");
    }
  },
  CRON_SECRET: () => getCronSecret(),
};

/**
 * Each variable in `names` that is missing or cannot be right, with a plain-English reason (never the
 * value). Pages use this to show a setup notice instead of failing halfway through a request.
 */
export function envProblems(names: readonly EnvName[]): EnvProblem[] {
  const problems: EnvProblem[] = [];
  for (const name of names) {
    if (!read(name)) {
      problems.push({ name, problem: "Not set." });
      continue;
    }
    try {
      CHECKS[name]?.();
    } catch (error) {
      if (error instanceof InvalidEnvError) problems.push({ name, problem: error.problem.charAt(0).toUpperCase() + error.problem.slice(1) });
      else if (error instanceof Error) problems.push({ name, problem: error.message });
    }
  }
  return problems;
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
