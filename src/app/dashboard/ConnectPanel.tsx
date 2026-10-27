"use client";

import { useState } from "react";
import type { ConnectStatus } from "@/lib/stripe/connect-status";

const COPY: Record<ConnectStatus, { title: string; body: string; action: string }> = {
  not_started: {
    title: "Set up payouts",
    body: "Registration fees go straight to your own Stripe account. Connect one (test mode) before captains can pay.",
    action: "Set up payouts with Stripe",
  },
  incomplete: {
    title: "Finish payout setup",
    body: "Stripe needs a few more details before your account can accept registration payments.",
    action: "Continue Stripe setup",
  },
  ready: {
    title: "Payouts ready",
    body: "Registration fees are paid into your Stripe account.",
    action: "Open Stripe Express dashboard",
  },
};

export function ConnectPanel({ status, feePercent, notice }: { status: ConnectStatus; feePercent: number; notice?: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const copy = COPY[status];

  async function go() {
    setBusy(true);
    setError(null);
    const response = await fetch(status === "ready" ? "/api/stripe/connect/login-link" : "/api/stripe/connect/onboard", { method: "POST" });
    const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setBusy(false);
      setError(result.error ?? "Could not reach Stripe. Please try again.");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <section className={`card space-y-2 ${status === "ready" ? "" : "border-sun/40 bg-sun/10"}`}>
      <h2 className="font-semibold">
        {status === "ready" ? "✅ " : ""}
        {copy.title}
      </h2>
      <p className="text-sm text-ink-muted">{copy.body}</p>
      {feePercent > 0 && <p className="text-xs text-ink-muted">A {feePercent}% platform fee is deducted from each registration.</p>}
      {notice && <p className="text-sm text-sun-100">{notice}</p>}
      <button type="button" className={status === "ready" ? "btn-secondary" : "btn-primary"} onClick={go} disabled={busy}>
        {busy ? "Opening Stripe…" : copy.action}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
