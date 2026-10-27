"use client";

import type { TournamentView } from "@/lib/view";
import { TournamentHeader, TournamentSections } from "./TournamentSections";
import { LiveIndicator } from "./LiveIndicator";
import { useLiveTournament } from "./useLiveTournament";

/** The public tournament page body, updating in real time. */
export function LiveTournament({ initialView, callToAction }: { initialView: TournamentView; callToAction?: React.ReactNode }) {
  const { view, status } = useLiveTournament(initialView);
  return (
    <div className="space-y-6">
      <TournamentHeader view={view} liveIndicator={<LiveIndicator status={status} />} />
      {callToAction}
      <TournamentSections view={view} />
    </div>
  );
}
