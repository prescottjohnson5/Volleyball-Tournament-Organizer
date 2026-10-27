import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { Tabs, type TabItem } from "@/components/Tabs";
import { TournamentStatusBadge } from "@/components/tournament/TournamentStatusBadge";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { getOrganizerTournament } from "@/lib/data/dashboard";
import { isPaymentsEnabled } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { collectsFees } from "@/lib/payments";
import { SANDBOX_MAX_TEAMS } from "@/lib/sandbox";
import { FORMAT_LABELS, formatEventDate, PAYMENT_LABELS } from "@/lib/tournaments/labels";
import { toTournamentInput } from "@/lib/tournaments/schema";
import { getFormat } from "@/lib/formats";
import { loadTournamentView } from "@/lib/data/tournament-view";
import { getPublicBaseUrl } from "@/lib/request-origin";
import { getPayoutState } from "@/lib/stripe/payout-state";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { TournamentForm } from "../TournamentForm";
import { DeleteTournamentButton } from "./DeleteTournamentButton";
import { OrganizerMatches } from "./OrganizerMatches";
import { RegenerateCaptainLink } from "./RegenerateCaptainLink";
import { SharePanel } from "./SharePanel";
import { StartTournamentButton } from "./StartTournamentButton";

export default async function TournamentDashboardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const organizer = await requireOrganizer(`/dashboard/tournaments/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();
  const result = await getOrganizerTournament(id, organizer.id);
  if (!result) notFound();
  const { tournament, teams } = result;
  const paidRegistration = collectsFees(tournament);
  // Only look up payout status for paid registration (it may call Stripe).
  const payouts = paidRegistration ? await getPayoutState(organizer.id) : { available: false as const };
  const paidTeams = teams.filter((t) => t.payment_status === "paid");
  const otherTeams = teams.filter((t) => t.payment_status !== "paid");

  const registering = tournament.status === "registration";
  const countLabel = paidRegistration ? "paid" : "registered";

  const teamsTab = (
    <section className="space-y-3">
      <p className="text-sm text-ink-subtle">
        {paidTeams.length} of {tournament.max_teams} teams {countLabel}
      </p>
      {paidTeams.length === 0 ? (
        <p className="empty-state">
          {paidRegistration ? "No paid teams yet." : "No teams registered yet."} Share the registration link to get sign-ups.
        </p>
      ) : (
        <ul className="border-t border-line">
          {paidTeams.map((team) => (
            <li key={team.id} className="border-b border-line px-2 py-3">
              <p className="font-semibold">
                {team.seed !== null && <span className="mr-2 text-ink-faint">#{team.seed}</span>}
                {team.name}
                {team.pool && <span className="ml-2 text-xs text-ink-subtle">Pool {team.pool}</span>}
              </p>
              {team.captain && (
                <p className="text-sm text-ink-muted">
                  {team.captain.captain_name} · {team.captain.captain_email}
                </p>
              )}
              <RegenerateCaptainLink tournamentId={tournament.id} teamId={team.id} teamName={team.name} />
            </li>
          ))}
        </ul>
      )}
      {otherTeams.length > 0 && (
        <details className="text-sm">
          <summary className="cursor-pointer text-ink-muted">{otherTeams.length} unpaid or cancelled checkouts</summary>
          <ul className="mt-2 space-y-1">
            {otherTeams.map((team) => (
              <li key={team.id} className="text-ink-muted">
                {team.name} — {PAYMENT_LABELS[team.payment_status]}
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );

  const shareTab = <SharePanel slug={tournament.slug} baseUrl={await getPublicBaseUrl()} />;

  const tabs: TabItem[] = registering
    ? [
        { id: "share", label: "Share", content: shareTab },
        { id: "teams", label: `Teams (${paidTeams.length})`, content: teamsTab },
        {
          id: "settings",
          label: "Settings",
          content: (
            <div className="space-y-10">
              <TournamentForm
                mode="edit"
                showFee={isPaymentsEnabled() && !organizer.isSandbox}
                maxTeamsLimit={organizer.isSandbox ? SANDBOX_MAX_TEAMS : undefined}
                tournamentId={tournament.id}
                initial={toTournamentInput(tournament)}
              />
              <section className="space-y-2 border-t border-line pt-6">
                <h2 className="font-bold">Delete tournament</h2>
                <p className="text-sm text-ink-muted">Only possible before any team has registered.</p>
                <DeleteTournamentButton tournamentId={tournament.id} />
              </section>
            </div>
          ),
        },
      ]
    : [
        {
          id: "matches",
          label: "Matches",
          content: <OrganizerMatches initialView={await loadTournamentView(await createSupabaseServerClient(), tournament)} />,
        },
        { id: "teams", label: `Teams (${paidTeams.length})`, content: teamsTab },
        { id: "share", label: "Share", content: shareTab },
      ];

  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/dashboard">Your tournaments</BackLink>
        <Link href={`/t/${tournament.slug}`} className="btn-secondary min-h-9 py-1">
          Public page
        </Link>
      </div>

      <header className="space-y-3">
        <TournamentStatusBadge status={tournament.status} />
        <h1 className="text-3xl font-extrabold sm:text-4xl">{tournament.name}</h1>
        <div className="space-y-0.5">
          <p className="text-ink-muted">
            {formatEventDate(tournament.event_date)} · {tournament.location}
          </p>
          <p className="text-sm text-ink-subtle">
            <span className="capitalize">{tournament.environment}</span> · {FORMAT_LABELS[tournament.format]} · best of {tournament.best_of}
            {paidRegistration && <> · {formatCents(tournament.registration_fee_cents, tournament.currency)} per team</>}
          </p>
        </div>
      </header>

      {registering && paidRegistration && payouts.available && payouts.status !== "ready" && (
        <p className="notice text-sm">
          Captains cannot pay yet: <Link href="/dashboard" className="font-semibold underline">set up payouts</Link> first so
          registration fees can go to your Stripe account.
        </p>
      )}

      {registering && (
        <StartTournamentButton tournamentId={tournament.id} paidTeams={paidTeams.length} paidRegistration={paidRegistration} minTeams={getFormat(tournament.format).minTeams} />
      )}

      <Tabs label="Manage tournament" tabs={tabs} />
    </>
  );
}
