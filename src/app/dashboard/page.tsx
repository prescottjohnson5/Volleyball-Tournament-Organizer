import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { SetupNotice } from "@/components/SetupNotice";
import { TournamentList } from "@/components/tournament/TournamentList";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerTournaments } from "@/lib/data/dashboard";
import { isPaymentsEnabled } from "@/lib/env";
import { SANDBOX_MAX_TOURNAMENTS } from "@/lib/sandbox";
import { getPayoutState } from "@/lib/stripe/payout-state";
import { ConnectPanel } from "./ConnectPanel";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ connect?: string }> }) {
  const organizer = await requireOrganizer();
  const [tournaments, payouts, { connect }] = await Promise.all([
    listOrganizerTournaments(organizer.id),
    isPaymentsEnabled() && !organizer.isSandbox ? getPayoutState(organizer.id) : null,
    searchParams,
  ]);

  return (
    <>
      {!payouts ? null : payouts.available ? (
        <ConnectPanel
          status={payouts.status}
          feePercent={payouts.feePercent}
          notice={
            connect === "error"
              ? "Stripe could not create a new setup link. Try again."
              : connect === "return" && payouts.status !== "ready"
                ? "Stripe has not finished verifying your details yet. If you skipped a step, continue setup."
                : undefined
          }
        />
      ) : (
        <SetupNotice problems={[{ name: "STRIPE_SECRET_KEY", problem: "Not set. It is needed because PAYMENTS_ENABLED is true." }]} />
      )}
      <BackLink href="/">Home</BackLink>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold sm:text-4xl">Your tournaments</h1>
          <p className="text-sm text-ink-muted">
            {organizer.isSandbox ? (
              <>
                Sandbox organizer.{" "}
                <Link href="/signup" className="link">
                  Create a free account
                </Link>{" "}
                to keep your tournaments (sandbox data is not moved over).
              </>
            ) : (
              <>Signed in as {organizer.email ?? "organizer"}</>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <form action="/auth/signout" method="post">
            <button type="submit" className="text-sm font-bold text-ink-subtle hover:text-ink">
              Sign out
            </button>
          </form>
          {!(organizer.isSandbox && tournaments.length >= SANDBOX_MAX_TOURNAMENTS) && (
            <Link href="/dashboard/tournaments/new" className="btn-primary">
              New tournament
            </Link>
          )}
        </div>
      </div>

      {tournaments.length === 0 ? (
        <p className="empty-state">No tournaments yet. Create one to get a registration link and QR code.</p>
      ) : (
        <TournamentList items={tournaments} hrefFor={(t) => `/dashboard/tournaments/${t.id}`} />
      )}
    </>
  );
}
