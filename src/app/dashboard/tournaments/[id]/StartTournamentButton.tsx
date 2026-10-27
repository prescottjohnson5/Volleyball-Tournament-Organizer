"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartTournamentButton({
  tournamentId,
  paidTeams,
  minTeams,
  paidRegistration,
}: {
  tournamentId: string;
  paidTeams: number;
  minTeams: number;
  paidRegistration: boolean;
}) {
  const [teams, inOrder] = paidRegistration ? ["paid teams", "in the order they paid"] : ["registered teams", "in the order they registered"];
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enough = paidTeams >= minTeams;

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tournaments/${tournamentId}/start`, { method: "POST" });
    setBusy(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      setError(result.error ?? "Could not start the tournament.");
      setConfirming(false);
      return;
    }
    router.refresh();
  }

  return (
    <div className="card space-y-3">
      <h2 className="font-semibold">Start the tournament</h2>
      <p className="text-sm text-ink-muted">
        Starting closes registration, seeds the {paidTeams} {teams} {inOrder} and generates the schedule. This
        cannot be undone.
      </p>
      {!enough && <p className="text-sm text-sun-100">At least {minTeams} {teams} are needed.</p>}
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-primary" onClick={start} disabled={busy}>
            {busy ? "Starting…" : `Yes, start with ${paidTeams} teams`}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn-primary" onClick={() => setConfirming(true)} disabled={!enough}>
          Start tournament
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
