import type { OrganizerProfileRow } from "@/lib/supabase/database.types";

export type ConnectStatus = "not_started" | "incomplete" | "ready";

/** Where an organizer is in Stripe Express onboarding. Registration needs "ready". */
export function connectStatus(
  profile: Pick<OrganizerProfileRow, "stripe_account_id" | "stripe_charges_enabled"> | null,
): ConnectStatus {
  if (!profile?.stripe_account_id) return "not_started";
  return profile.stripe_charges_enabled ? "ready" : "incomplete";
}
