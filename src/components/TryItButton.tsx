"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";

/** Starts a sandbox session (no account needed), then opens `next` (the organizer dashboard by default). */
export function TryItButton({
  label = "Try it for real",
  className = "btn-primary",
  next,
}: {
  label?: string;
  className?: string;
  next?: string;
}) {
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
    router.push(safeNextPath(next));
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <button type="button" className={className} onClick={start} disabled={busy}>
        {busy ? "Setting up your sandbox…" : label}
      </button>
      {error && (
        <p role="alert" className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
    </div>
  );
}
