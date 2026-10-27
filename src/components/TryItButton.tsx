"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/** Starts a sandbox session (no account needed) and opens the organizer dashboard. */
export function TryItButton({ label = "Try it for real", className = "btn-primary" }: { label?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/sandbox", { method: "POST" }).catch(() => null);
    if (!response?.ok) {
      const result = (await response?.json().catch(() => ({}))) as { error?: string } | undefined;
      setBusy(false);
      setError(result?.error ?? "Could not start the sandbox. Check your connection and try again.");
      return;
    }
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button type="button" className={className} onClick={start} disabled={busy}>
        {busy ? "Setting up your sandbox…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
