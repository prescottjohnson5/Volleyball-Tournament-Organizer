import "server-only";
import { createHash } from "node:crypto";
import { EnvError } from "@/lib/env";
import { HttpError } from "@/lib/http";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

type Limit = { limit: number; windowSeconds: number };

/**
 * Per-IP limits for public routes and sign-up related actions. Generous enough that a real person
 * never meets them, tight enough to stop scripted abuse of the free sandbox and registration forms.
 */
export const RATE_LIMITS = {
  register: { limit: 10, windowSeconds: 10 * 60 },
  // The registration success page polls this every 2 seconds for up to 90 seconds.
  claimCaptainLink: { limit: 120, windowSeconds: 10 * 60 },
  reportScore: { limit: 60, windowSeconds: 10 * 60 },
  signUp: { limit: 5, windowSeconds: 60 * 60 },
  signIn: { limit: 10, windowSeconds: 15 * 60 },
  sandbox: { limit: 5, windowSeconds: 60 * 60 },
} as const satisfies Record<string, Limit>;

export type RateLimitName = keyof typeof RATE_LIMITS;

/** Counts one hit for `key` in a window and returns the hits so far in that window. */
export type HitCounter = (key: string, windowSeconds: number) => Promise<number>;

/**
 * The caller's IP address. On Vercel, x-forwarded-for is set by the platform (a client-sent value
 * is not trusted), and its first entry is the client.
 */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || headers.get("x-real-ip")?.trim() || "unknown";
}

/** Seconds until the fixed window that contains `now` ends (windows are aligned to the epoch). */
export function secondsUntilReset(now: Date, windowSeconds: number): number {
  const elapsed = Math.floor(now.getTime() / 1000) % windowSeconds;
  return windowSeconds - elapsed;
}

export function rateLimitMessage(retryAfterSeconds: number): string {
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  return `Too many attempts from your network. Please wait ${minutes === 1 ? "a minute" : `about ${minutes} minutes`} and try again.`;
}

const countInDatabase: HitCounter = async (key, windowSeconds) => {
  const { data, error } = await createSupabaseAdminClient().rpc("rate_limit_hit", { p_key: key, p_window_seconds: windowSeconds });
  if (error) throw error;
  return data;
};

/**
 * Throws a 429 with a friendly message and Retry-After when the caller's IP is over the limit.
 * The IP is stored only as a hash. If the counter itself fails, the request is allowed (and the
 * error logged): a rate-limit outage should not take the site down.
 */
export async function enforceRateLimit(
  request: Request,
  name: RateLimitName,
  { count = countInDatabase, now = new Date() }: { count?: HitCounter; now?: Date } = {},
): Promise<void> {
  const { limit, windowSeconds } = RATE_LIMITS[name];
  const ipHash = createHash("sha256").update(clientIp(request.headers)).digest("hex").slice(0, 32);

  let hits: number;
  try {
    hits = await count(`${name}:${ipHash}`, windowSeconds);
  } catch (error) {
    if (error instanceof EnvError) throw error;
    console.error(`Rate limit check failed for ${name}:`, error instanceof Error ? error.message : error);
    return;
  }

  if (hits > limit) {
    const retryAfter = secondsUntilReset(now, windowSeconds);
    throw new HttpError(429, rateLimitMessage(retryAfter), { "Retry-After": String(retryAfter) });
  }
}
