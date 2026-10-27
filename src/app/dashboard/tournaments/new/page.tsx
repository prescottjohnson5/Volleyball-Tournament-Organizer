import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerTournaments } from "@/lib/data/dashboard";
import { isPaymentsEnabled } from "@/lib/env";
import { SANDBOX_MAX_TEAMS, SANDBOX_MAX_TOURNAMENTS, SANDBOX_ONE_TOURNAMENT_MESSAGE } from "@/lib/sandbox";
import { TournamentForm } from "../TournamentForm";

export default async function NewTournamentPage() {
  const organizer = await requireOrganizer("/dashboard/tournaments/new");
  const sandboxFull = organizer.isSandbox && (await listOrganizerTournaments(organizer.id)).length >= SANDBOX_MAX_TOURNAMENTS;
  return (
    <>
      <Link href="/dashboard" className="text-sm text-brand-700 underline">
        ← All tournaments
      </Link>
      <h1 className="text-2xl font-bold">New tournament</h1>
      {sandboxFull ? (
        <p className="card text-slate-700">{SANDBOX_ONE_TOURNAMENT_MESSAGE}</p>
      ) : (
        <TournamentForm
          mode="create"
          showFee={isPaymentsEnabled() && !organizer.isSandbox}
          maxTeamsLimit={organizer.isSandbox ? SANDBOX_MAX_TEAMS : undefined}
        />
      )}
    </>
  );
}
