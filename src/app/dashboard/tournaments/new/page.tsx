import { BackLink } from "@/components/BackLink";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerTournaments } from "@/lib/data/dashboard";
import { isPaymentsEnabled } from "@/lib/env";
import { SANDBOX_MAX_TEAMS, SANDBOX_MAX_TOURNAMENTS, SANDBOX_ONE_TOURNAMENT_MESSAGE } from "@/lib/sandbox";
import { TournamentForm } from "../TournamentForm";

export default async function NewTournamentPage() {
  const organizer = await requireOrganizer("/dashboard/tournaments/new");
  const sandboxFull = organizer.isSandbox && (await listOrganizerTournaments(organizer.id)).length >= SANDBOX_MAX_TOURNAMENTS;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <BackLink href="/">Home</BackLink>
      <div className="space-y-1">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Create a tournament</h1>
        <p className="text-ink-muted">You can change everything until the tournament starts.</p>
      </div>
      {sandboxFull ? (
        <p className="empty-state">{SANDBOX_ONE_TOURNAMENT_MESSAGE}</p>
      ) : (
        <TournamentForm
          mode="create"
          showFee={isPaymentsEnabled() && !organizer.isSandbox}
          maxTeamsLimit={organizer.isSandbox ? SANDBOX_MAX_TEAMS : undefined}
        />
      )}
    </div>
  );
}
