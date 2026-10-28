import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { SetupNotice } from "@/components/SetupNotice";
import { SandboxBanner } from "@/components/SandboxBanner";
import { LiveTournament } from "@/components/tournament/LiveTournament";
import { getOrganizer } from "@/lib/auth";
import { getPublicTournament } from "@/lib/data/public";
import { loadTournamentView } from "@/lib/data/tournament-view";
import { envProblems, SUPABASE_PUBLIC_VARS } from "@/lib/env";
import { createSupabasePublicClient } from "@/lib/supabase/public";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (envProblems(SUPABASE_PUBLIC_VARS).length > 0) return {};
  const tournament = await getPublicTournament((await params).slug);
  if (!tournament) return {};
  const description = `Live results for ${tournament.name}`;
  return { title: tournament.name, description, openGraph: { title: tournament.name, description } };
}

/** Public, read-only tournament page. No account needed; updates live over Supabase Realtime. */
export default async function PublicTournamentPage({ params }: Props) {
  const missing = envProblems(SUPABASE_PUBLIC_VARS);
  if (missing.length > 0) return <SetupNotice problems={missing} />;

  const { slug } = await params;
  const db = createSupabasePublicClient();
  const tournament = await getPublicTournament(slug, db);
  if (!tournament) notFound();
  const [view, organizer] = await Promise.all([loadTournamentView(db, tournament), getOrganizer()]);
  // Only the tournament's own organizer sees the way into its management page.
  const isOwner = organizer?.id === tournament.organizer_id;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <BackLink href="/tournaments">All tournaments</BackLink>
        {isOwner && (
          <Link href={`/dashboard/tournaments/${tournament.id}`} className="btn-secondary min-h-9 py-1">
            Manage
          </Link>
        )}
      </div>
      {view.tournament.isSandbox && <SandboxBanner />}
      <LiveTournament
        initialView={view}
        callToAction={
          view.tournament.status === "registration" && view.teams.length < view.tournament.maxTeams ? (
            <Link href={`/t/${slug}/register`} className="btn-primary w-full sm:w-auto">
              Register a team
            </Link>
          ) : null
        }
      />
    </div>
  );
}
