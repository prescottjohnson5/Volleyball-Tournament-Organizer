import type { TournamentStatus } from "@/lib/supabase/database.types";
import { STATUS_LABELS } from "@/lib/tournaments/labels";

const STYLES: Record<TournamentStatus, string> = {
  registration: "bg-sun/15 text-sun-100",
  in_progress: "bg-teal/20 text-teal-300",
  completed: "bg-white/5 text-ink-subtle",
};

export function TournamentStatusBadge({ status }: { status: TournamentStatus }) {
  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}
