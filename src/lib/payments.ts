import "server-only";
import { isPaymentsEnabled } from "@/lib/env";
import type { TournamentRow } from "@/lib/supabase/database.types";

/**
 * Whether registering for this tournament goes through Stripe Checkout. With payments turned off,
 * or for a tournament without a fee (sandbox tournaments), registration is free and immediate.
 */
export function collectsFees(tournament: Pick<TournamentRow, "registration_fee_cents">): boolean {
  return isPaymentsEnabled() && tournament.registration_fee_cents > 0;
}
