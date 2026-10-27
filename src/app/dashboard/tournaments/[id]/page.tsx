import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { requireOrganizer } from "@/lib/auth";
import { getOrganizerTournament } from "@/lib/data/dashboard";
import { isPaymentsEnabled } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { collectsFees } from "@/lib/payments";
import { SANDBOX_MAX_TEAMS } from "@/lib/sandbox";
import { FORMAT_LABELS, formatEventDate, PAYMENT_LABELS, STATUS_LABELS } from "@/lib/tournaments/labels";
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

  return (
    <>
      <Link href="/dashboard" className="text-sm text-brand-700 underline">
        ← All tournaments
      </Link>

      <section className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">{tournament.name}</h1>
          <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
            {STATUS_LABELS[tournament.status]}
          </span>
        </div>
        <p className="text-slate-600">
          {formatEventDate(tournament.event_date)} · {tournament.location} · <span className="capitalize">{tournament.environment}</span>
        </p>
        <p className="text-sm text-slate-600">
          {FORMAT_LABELS[tournament.format]} · best of {tournament.best_of}
          {paidRegistration && <> · {formatCents(tournament.registration_fee_cents, tournament.currency)} per team</>}
        </p>
      </section>

      {tournament.status === "registration" && paidRegistration && payouts.available && payouts.status !== "ready" && (
        <p className="card border-amber-300 bg-amber-50 text-sm text-amber-900">
          Captains cannot pay yet: <Link href="/dashboard" className="font-semibold underline">set up payouts</Link> first so
          registration fees can go to your Stripe account.
        </p>
      )}

      {tournament.status !== "registration" && (
        <OrganizerMatches initialView={await loadTournamentView(await createSupabaseServerClient(), tournament)} />
      )}

      <SharePanel slug={tournament.slug} baseUrl={await getPublicBaseUrl()} />

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">
          Teams <span className="text-slate-500">({paidTeams.length}/{tournament.max_teams} {paidRegistration ? "paid" : "registered"})</span>
        </h2>
        {paidTeams.length === 0 ? (
          <p className="text-sm text-slate-600">{paidRegistration ? "No paid teams yet." : "No teams registered yet."}</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {paidTeams.map((team) => (
              <li key={team.id} className="py-2">
                <p className="font-medium">
                  {team.seed !== null && <span className="mr-1 text-slate-400">#{team.seed}</span>}
                  {team.name}
                  {team.pool && <span className="ml-2 text-xs text-slate-500">Pool {team.pool}</span>}
                </p>
                {team.captain && (
                  <p className="text-sm text-slate-600">
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
            <summary className="cursor-pointer text-slate-600">{otherTeams.length} unpaid or cancelled checkouts</summary>
            <ul className="mt-2 space-y-1">
              {otherTeams.map((team) => (
                <li key={team.id} className="text-slate-600">
                  {team.name} — {PAYMENT_LABELS[team.payment_status]}
                </li>
              ))}
            </ul>
          </details>
        )}
      </section>

      {tournament.status === "registration" && (
        <StartTournamentButton tournamentId={tournament.id} paidTeams={paidTeams.length} paidRegistration={paidRegistration} minTeams={getFormat(tournament.format).minTeams} />
      )}

      {tournament.status === "registration" && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Edit details</h2>
          <TournamentForm
            mode="edit"
            showFee={isPaymentsEnabled() && !organizer.isSandbox}
            maxTeamsLimit={organizer.isSandbox ? SANDBOX_MAX_TEAMS : undefined}
            tournamentId={tournament.id}
            initial={toTournamentInput(tournament)}
          />
          <DeleteTournamentButton tournamentId={tournament.id} />
        </section>
      )}
    </>
  );
}
