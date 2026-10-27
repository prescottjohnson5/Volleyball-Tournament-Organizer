import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { countPublicPaidTeams, getPublicTournament } from "@/lib/data/public";
import { missingEnv } from "@/lib/env";
import { formatCents } from "@/lib/money";
import { createRuleset, describeRuleset, type BestOf } from "@/lib/rules/ruleset";
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
  const paid = await countPublicPaidTeams(tournament.id);
  const spotsLeft = Math.max(0, tournament.max_teams - paid);
  const fee = formatCents(tournament.registration_fee_cents, tournament.currency);
  const rules = createRuleset(tournament.environment, { bestOf: tournament.best_of as BestOf });
  const open = tournament.status === "registration" && spotsLeft > 0;

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <header className="space-y-1">
        <p className="text-sm font-medium text-brand-700">Team registration</p>
        <h1 className="text-2xl font-bold">{tournament.name}</h1>
        <p className="text-slate-600">
          {formatEventDate(tournament.event_date)} · {tournament.location}
        </p>
        <p className="text-sm text-slate-600">
          <span className="capitalize">{tournament.environment}</span> · {FORMAT_LABELS[tournament.format]} · {describeRuleset(rules)}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="card">
          <p className="text-2xl font-bold">{fee}</p>
          <p className="text-xs text-slate-500">per team</p>
        </div>
        <div className="card">
          <p className="text-2xl font-bold">{spotsLeft}</p>
          <p className="text-xs text-slate-500">of {tournament.max_teams} spots left</p>
        </div>
      </div>

      {cancelled && (
        <p className="card border-amber-300 bg-amber-50 text-sm text-amber-900" role="status">
          Checkout was cancelled. Nothing was charged and your team is not registered yet.
        </p>
      )}

      {open ? (
        <RegisterForm slug={tournament.slug} feeLabel={fee} />
      ) : (
        <p className="card text-slate-700">
          {tournament.status === "registration" ? "This tournament is full." : "Registration for this tournament is closed."}
        </p>
      )}

      <p className="text-center text-sm">
        <Link href={`/t/${tournament.slug}`} className="text-brand-700 underline">
          View the tournament page
        </Link>
      </p>
    </div>
  );
}
