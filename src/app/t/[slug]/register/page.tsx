import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { SandboxBanner } from "@/components/SandboxBanner";
import { SetupNotice } from "@/components/SetupNotice";
import { countPublicPaidTeams, getPublicTournament } from "@/lib/data/public";
import { missingEnv } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { collectsFees } from "@/lib/payments";
import { createRuleset, describeRuleset, type BestOf } from "@/lib/rules/ruleset";
import { getPayoutAccount } from "@/lib/stripe/connect";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { FORMAT_LABELS, formatEventDate } from "@/lib/tournaments/labels";
import { RegisterForm } from "./RegisterForm";

export const metadata: Metadata = { title: "Register a team" };
export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cancelled?: string }>;
}) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;

  const { slug } = await params;
  const { cancelled } = await searchParams;
  const tournament = await getPublicTournament(slug);
  if (!tournament) notFound();
  const registered = await countPublicPaidTeams(tournament.id);
  const spotsLeft = Math.max(0, tournament.max_teams - registered);
  const fee = collectsFees(tournament) ? formatCents(tournament.registration_fee_cents, tournament.currency) : null;
  const rules = createRuleset(tournament.environment, { bestOf: tournament.best_of as BestOf });
  const open = tournament.status === "registration" && spotsLeft > 0;
  // Payments go to the organizer's Stripe account, so paid registration waits until it is ready.
  const paymentsReady =
    !fee ||
    missingEnv(["SUPABASE_SERVICE_ROLE_KEY"]).length > 0 ||
    (await getPayoutAccount(createSupabaseAdminClient(), tournament.organizer_id)) !== null;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <BackLink href={`/t/${tournament.slug}`}>Tournament page</BackLink>
      {tournament.is_sandbox && <SandboxBanner />}
      <header className="space-y-1">
        <p className="text-sm font-semibold text-teal-300">Register a team</p>
        <h1 className="text-3xl font-extrabold">{tournament.name}</h1>
        <p className="text-ink-muted">
          {formatEventDate(tournament.event_date)} · {tournament.location}
        </p>
        <p className="text-sm text-ink-muted">
          <span className="capitalize">{tournament.environment}</span> · {FORMAT_LABELS[tournament.format]} · {describeRuleset(rules)}
        </p>
      </header>

      <div className={`grid gap-3 text-center ${fee ? "grid-cols-2" : "grid-cols-1"}`}>
        {fee && (
          <div className="card">
            <p className="text-2xl font-bold">{fee}</p>
            <p className="text-xs text-ink-subtle">per team</p>
          </div>
        )}
        <div className="card">
          <p className="text-2xl font-bold">{spotsLeft}</p>
          <p className="text-xs text-ink-subtle">of {tournament.max_teams} spots left</p>
        </div>
      </div>

      {cancelled && (
        <p className="notice text-sm" role="status">
          Checkout was cancelled. Nothing was charged and your team is not registered yet.
        </p>
      )}

      {open && !paymentsReady ? (
        <p className="card text-ink-muted">Registration opens as soon as the organizer finishes setting up payments. Check back soon.</p>
      ) : open ? (
        <RegisterForm slug={tournament.slug} feeLabel={fee} />
      ) : (
        <p className="card text-ink-muted">
          {tournament.status === "registration" ? "This tournament is full." : "Registration for this tournament is closed."}
        </p>
      )}

    </div>
  );
}
