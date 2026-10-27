import type { Metadata } from "next";
import { SandboxBanner } from "@/components/SandboxBanner";
import { SetupNotice } from "@/components/SetupNotice";
import { loadTournamentView } from "@/lib/data/tournament-view";
import { missingEnv } from "@/lib/env";
import { findCaptainByToken } from "@/lib/scores/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { CaptainPanel } from "./CaptainPanel";

export const metadata: Metadata = { title: "Captain", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Private page for a team captain, reached through the secret link shown after payment. */
export default async function CaptainPage({ params }: { params: Promise<{ token: string }> }) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;

  const { token } = await params;
  const db = createSupabaseAdminClient();
  const captain = await findCaptainByToken(db, token);
  if (!captain) {
    return (
      <div className="card mx-auto max-w-lg space-y-2">
        <h1 className="text-xl font-bold">This captain link does not work</h1>
        <p className="text-ink-muted">
          It may have been replaced by a newer link. Ask the tournament organizer to send you a new captain link.
        </p>
      </div>
    );
  }

  const view = await loadTournamentView(db, captain.tournament);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      {view.tournament.isSandbox && <SandboxBanner />}
      <CaptainPanel initialView={view} teamId={captain.team.id} token={token} />
    </div>
  );
}
