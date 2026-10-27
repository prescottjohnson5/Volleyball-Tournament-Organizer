/**
 * Limits for sandbox organizers (visitors who pressed "Try it"). The same limits are enforced by
 * the database (supabase/migrations/0007_sandbox.sql).
 */
export const SANDBOX_MAX_TOURNAMENTS = 1;
export const SANDBOX_MAX_TEAMS = 8;
/** Sandbox users and their data are deleted by the daily cleanup once they are this old. */
export const SANDBOX_TTL_HOURS = 24;

export const SANDBOX_ONE_TOURNAMENT_MESSAGE =
  "The sandbox allows one tournament. Delete it to start over, or create a free account to run more.";
