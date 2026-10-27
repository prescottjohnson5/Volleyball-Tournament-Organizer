"use client";

import { useState } from "react";

/** Issues a new captain link for a team and shows it once, so the organizer can pass it on. */
export function RegenerateCaptainLink({ tournamentId, teamId, teamName }: { tournamentId: string; teamId: string; teamName: string }) {
  const [link, setLink] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function regenerate() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tournaments/${tournamentId}/teams/${teamId}/captain-link`, { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as { token?: string; error?: string };
    setBusy(false);
    setConfirming(false);
    if (!response.ok || !result.token) {
      setError(result.error ?? "Could not create a new link.");
      return;
    }
    setLink(`${window.location.origin}/captain/${result.token}`);
  }

  if (link) {
    return (
      <div className="mt-2 space-y-1 rounded-lg bg-surface-raised p-2">
        <p className="text-xs text-ink-muted">New captain link for {teamName} (shown once; the old link no longer works):</p>
        <p className="font-mono text-xs break-all">{link}</p>
        <button type="button" className="btn-secondary min-h-9 py-1" onClick={() => navigator.clipboard.writeText(link)}>
          Copy
        </button>
      </div>
    );
  }

  return (
    <div className="mt-1">
      {confirming ? (
        <span className="flex flex-wrap items-center gap-2 text-xs">
          Replace {teamName}&apos;s captain link?
          <button type="button" className="link" onClick={regenerate} disabled={busy}>
            {busy ? "Working…" : "Yes, new link"}
          </button>
          <button type="button" className="text-ink-subtle underline underline-offset-2 hover:text-ink" onClick={() => setConfirming(false)}>
            Cancel
          </button>
        </span>
      ) : (
        <button type="button" className="text-xs link" onClick={() => setConfirming(true)}>
          New captain link
        </button>
      )}
      {error && (
        <p role="alert" className="text-xs text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}
