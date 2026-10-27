"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function StartTournamentButton({ tournamentId, paidTeams, minTeams }: { tournamentId: string; paidTeams: number; minTeams: number }) {
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
    <div className="card space-y-2 border-brand-100 bg-brand-50">
      <h2 className="font-semibold">Start the tournament</h2>
      <p className="text-sm text-slate-700">
        Starting closes registration, seeds the {paidTeams} paid teams in the order they paid and generates the schedule. This
        cannot be undone.
      </p>
      {!enough && <p className="text-sm text-amber-800">At least {minTeams} paid teams are needed.</p>}
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
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
