import type { FormatId, PaymentStatus, TournamentStatus } from "@/lib/supabase/database.types";

export const FORMAT_LABELS: Record<FormatId, string> = {
  pool_to_single_elim: "Pool play → single elimination",
  double_elim: "Double elimination",
};

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  registration: "Registration open",
  in_progress: "In progress",
  completed: "Completed",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  pending: "Awaiting payment",
  paid: "Paid",
  expired: "Checkout expired",
  refunded: "Refunded",
};

export function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate}T12:00:00Z`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}
