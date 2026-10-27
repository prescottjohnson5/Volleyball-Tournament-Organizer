import { createHash, timingSafeEqual } from "node:crypto";
import { SANDBOX_TTL_HOURS } from "@/lib/sandbox";

/** Storage operations the cleanup needs; injected so the logic is unit tested without Supabase. */
export interface CleanupDeps {
  /** Deletes sandbox tournaments created before `cutoff` (teams, matches and sets cascade). */
  deleteSandboxTournaments(cutoff: Date): Promise<number>;
  /** Sandbox organizers created before `cutoff`, at most `limit`. */
  listExpiredSandboxOrganizers(cutoff: Date, limit: number): Promise<string[]>;
  /** Deletes the auth user; their profile and anything left cascades. */
  deleteUser(id: string): Promise<void>;
  /** Deletes rate-limit counters for windows that started before `cutoff`. */
  deleteRateLimitsBefore(cutoff: Date): Promise<number>;
}

export type CleanupResult = {
  cutoff: string;
  tournamentsDeleted: number;
  usersDeleted: number;
  usersFailed: number;
  /** True when the user batch was full: the next run deletes the rest. */
  moreUsersRemaining: boolean;
  rateLimitRowsDeleted: number;
};

export const USER_BATCH = 500;
const CONCURRENCY = 10;

/** Deletes sandbox data older than SANDBOX_TTL_HOURS, plus old rate-limit counters. */
export async function cleanupSandbox(deps: CleanupDeps, now = new Date()): Promise<CleanupResult> {
  const cutoff = new Date(now.getTime() - SANDBOX_TTL_HOURS * 60 * 60 * 1000);
  const tournamentsDeleted = await deps.deleteSandboxTournaments(cutoff);

  const ids = await deps.listExpiredSandboxOrganizers(cutoff, USER_BATCH);
  let usersDeleted = 0;
  let usersFailed = 0;
  for (let i = 0; i < ids.length; i += CONCURRENCY) {
    const results = await Promise.allSettled(ids.slice(i, i + CONCURRENCY).map((id) => deps.deleteUser(id)));
    for (const result of results) {
      if (result.status === "fulfilled") usersDeleted++;
      else {
        usersFailed++;
        console.error("Could not delete sandbox user:", result.reason instanceof Error ? result.reason.message : result.reason);
      }
    }
  }

  const rateLimitRowsDeleted = await deps.deleteRateLimitsBefore(cutoff);
  return {
    cutoff: cutoff.toISOString(),
    tournamentsDeleted,
    usersDeleted,
    usersFailed,
    moreUsersRemaining: ids.length === USER_BATCH,
    rateLimitRowsDeleted,
  };
}

/** Constant-time check of `Authorization: Bearer <secret>`. */
export function isAuthorizedCronRequest(authorization: string | null, secret: string): boolean {
  if (!authorization) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`));
}
