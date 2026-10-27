import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { isPaymentsEnabled } from "@/lib/env";
import { TournamentForm } from "../TournamentForm";

export default async function NewTournamentPage() {
  await requireOrganizer("/dashboard/tournaments/new");
  return (
    <>
      <Link href="/dashboard" className="text-sm text-brand-700 underline">
        ← All tournaments
      </Link>
      <h1 className="text-2xl font-bold">New tournament</h1>
      <TournamentForm mode="create" showFee={isPaymentsEnabled()} />
    </>
  );
}
