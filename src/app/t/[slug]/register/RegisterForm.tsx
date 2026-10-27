"use client";

import { useState } from "react";

export function RegisterForm({ slug, feeLabel }: { slug: string; feeLabel: string }) {
  const [teamName, setTeamName] = useState("");
  const [captainName, setCaptainName] = useState("");
  const [captainEmail, setCaptainEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/register/${encodeURIComponent(slug)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teamName, captainName, captainEmail }),
    });
    const result = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!response.ok || !result.url) {
      setBusy(false);
      setError(result.error ?? "Could not start the payment. Please try again.");
      return;
    }
    window.location.assign(result.url);
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label htmlFor="teamName" className="label">
          Team name
        </label>
        <input id="teamName" required minLength={2} maxLength={60} className="input" value={teamName} onChange={(e) => setTeamName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="captainName" className="label">
          Your name (captain)
        </label>
        <input id="captainName" required maxLength={100} autoComplete="name" className="input" value={captainName} onChange={(e) => setCaptainName(e.target.value)} />
      </div>
      <div>
        <label htmlFor="captainEmail" className="label">
          Your email
        </label>
        <input
          id="captainEmail"
          type="email"
          required
          autoComplete="email"
          className="input"
          value={captainEmail}
          onChange={(e) => setCaptainEmail(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">Only the organizer can see this.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Opening secure checkout…" : `Pay ${feeLabel} and register`}
      </button>
      <p className="text-center text-xs text-slate-500">Payments are processed by Stripe (test mode). Your team is registered once payment is confirmed.</p>
    </form>
  );
}
