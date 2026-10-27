"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteTournamentButton({ tournamentId }: { tournamentId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onDelete() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tournaments/${tournamentId}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) {
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      setError(result.error ?? "Could not delete the tournament.");
      setConfirming(false);
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-slate-700">Delete this tournament permanently?</span>
          <button type="button" className="btn-danger" onClick={onDelete} disabled={busy}>
            {busy ? "Deleting…" : "Yes, delete"}
          </button>
          <button type="button" className="btn-secondary" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      ) : (
        <button type="button" className="btn-secondary text-red-700" onClick={() => setConfirming(true)}>
          Delete tournament
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
