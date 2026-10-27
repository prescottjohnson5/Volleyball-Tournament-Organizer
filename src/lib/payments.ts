import "server-only";
import { isPaymentsEnabled } from "@/lib/env";
import { jsonError } from "@/lib/http";
import type { TournamentRow } from "@/lib/supabase/database.types";

/**
 * Whether registering for this tournament goes through Stripe Checkout. With payments turned off,
 * or for a tournament without a fee (sandbox tournaments), registration is free and immediate.
 */
export function collectsFees(tournament: Pick<TournamentRow, "registration_fee_cents">): boolean {
  return isPaymentsEnabled() && tournament.registration_fee_cents > 0;
}

/** Stripe endpoints answer 404 while payments are off, exactly as if they did not exist. */
export function notFoundUnlessPaymentsEnabled(): Response | null {
  return isPaymentsEnabled() ? null : jsonError(404, "Not found.");
}
