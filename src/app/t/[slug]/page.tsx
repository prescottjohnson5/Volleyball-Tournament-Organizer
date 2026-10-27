import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SetupNotice } from "@/components/SetupNotice";
import { SandboxBanner } from "@/components/SandboxBanner";
import { LiveTournament } from "@/components/tournament/LiveTournament";
import { getPublicTournament, getTournamentView } from "@/lib/data/public";
import { missingEnv } from "@/lib/env";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  if (missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]).length > 0) return {};
  const tournament = await getPublicTournament((await params).slug);
  if (!tournament) return {};
  const description = `Live results for ${tournament.name}`;
  return { title: tournament.name, description, openGraph: { title: tournament.name, description } };
}

/** Public, read-only tournament page. No account needed; updates live over Supabase Realtime. */
export default async function PublicTournamentPage({ params }: Props) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;

  const { slug } = await params;
  const view = await getTournamentView(slug);
  if (!view) notFound();

  return (
    <div className="space-y-4">
      {view.tournament.isSandbox && <SandboxBanner />}
      {view.tournament.status === "registration" && (
        <div className="card flex flex-wrap items-center justify-between gap-3 border-teal/60 bg-teal/10">
          <p className="text-sm text-ink">
            Registration is open: {view.teams.length} of {view.tournament.maxTeams} teams so far.
          </p>
          <Link href={`/t/${slug}/register`} className="btn-primary">
            Register a team
          </Link>
        </div>
      )}
      <LiveTournament initialView={view} />
    </div>
  );
}
