"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseDollarsToCents } from "@/lib/money";
import { ENVIRONMENT_PRESETS } from "@/lib/rules/ruleset";
import type { TournamentInput } from "@/lib/tournaments/schema";
import { FORMAT_LABELS } from "@/lib/tournaments/labels";

// showFee is false when payments are off: the fee field is hidden and no fee is sent.
// maxTeamsLimit is lower for sandbox organizers.
type Props = { showFee: boolean; maxTeamsLimit?: number } & (
  | { mode: "create"; initial?: undefined; tournamentId?: undefined }
  | { mode: "edit"; initial: TournamentInput; tournamentId: string }
);

export function TournamentForm({ mode, initial, tournamentId, showFee, maxTeamsLimit = 64 }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [environment, setEnvironment] = useState<TournamentInput["environment"]>(initial?.environment ?? "indoor");
  const [format, setFormat] = useState<TournamentInput["format"]>(initial?.format ?? "pool_to_single_elim");
  const [bestOf, setBestOf] = useState<TournamentInput["bestOf"]>(initial?.bestOf ?? 3);
  const [maxTeams, setMaxTeams] = useState(String(initial?.maxTeams ?? 8));
  const [fee, setFee] = useState(initial?.registrationFeeCents ? (initial.registrationFeeCents / 100).toFixed(2) : "25.00");
  const [poolSize, setPoolSize] = useState(initial?.poolOptions?.poolSize ?? 4);
  const [advancePerPool, setAdvancePerPool] = useState(initial?.poolOptions?.advancePerPool ?? 2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const registrationFeeCents = showFee ? parseDollarsToCents(fee) : undefined;
    if (registrationFeeCents === null) {
      setError("Enter the fee as a dollar amount, for example 25 or 25.00.");
      return;
    }
    const body: TournamentInput = {
      name,
      eventDate,
      location,
      environment,
      format,
      bestOf,
      maxTeams: Number(maxTeams),
      registrationFeeCents,
      poolOptions: format === "pool_to_single_elim" ? { poolSize, advancePerPool } : undefined,
    };

    setBusy(true);
    const response = await fetch(mode === "create" ? "/api/tournaments" : `/api/tournaments/${tournamentId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { id?: string; error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Could not save the tournament.");
      return;
    }
    router.push(`/dashboard/tournaments/${mode === "create" ? result.id : tournamentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4">
      <div>
        <label htmlFor="name" className="label">
          Tournament name
        </label>
        <input id="name" required minLength={3} maxLength={100} className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="eventDate" className="label">
            Date
          </label>
          <input id="eventDate" type="date" required className="input" value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="location" className="label">
            Location
          </label>
          <input id="location" required maxLength={200} className="input" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
      </div>

      <fieldset>
        <legend className="label">Setting</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["indoor", "outdoor"] as const).map((value) => (
            <label
              key={value}
              className={`btn-secondary cursor-pointer capitalize ${environment === value ? "border-brand-500 bg-brand-50 text-brand-700" : ""}`}
            >
              <input
                type="radio"
                name="environment"
                value={value}
                checked={environment === value}
                onChange={() => setEnvironment(value)}
                className="sr-only"
              />
              {value} (sets to {ENVIRONMENT_PRESETS[value].pointsPerSet})
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="format" className="label">
            Format
          </label>
          <select id="format" className="input" value={format} onChange={(e) => setFormat(e.target.value as TournamentInput["format"])}>
            {Object.entries(FORMAT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="bestOf" className="label">
            Match length
          </label>
          <select id="bestOf" className="input" value={bestOf} onChange={(e) => setBestOf(Number(e.target.value) as TournamentInput["bestOf"])}>
            <option value={1}>1 set</option>
            <option value={3}>Best of 3 sets</option>
            <option value={5}>Best of 5 sets</option>
          </select>
        </div>
      </div>

      {format === "pool_to_single_elim" && (
        <div className="grid gap-4 rounded-lg bg-slate-50 p-3 sm:grid-cols-2">
          <div>
            <label htmlFor="poolSize" className="label">
              Target pool size
            </label>
            <select id="poolSize" className="input" value={poolSize} onChange={(e) => setPoolSize(Number(e.target.value))}>
              {[3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>
                  {n} teams
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="advancePerPool" className="label">
              Teams advancing per pool
            </label>
            <select id="advancePerPool" className="input" value={advancePerPool} onChange={(e) => setAdvancePerPool(Number(e.target.value))}>
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  Top {n}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="maxTeams" className="label">
            Max teams
          </label>
          <input id="maxTeams" type="number" inputMode="numeric" min={3} max={maxTeamsLimit} required className="input" value={maxTeams} onChange={(e) => setMaxTeams(e.target.value)} />
        </div>
        {showFee && (
          <div>
            <label htmlFor="fee" className="label">
              Registration fee per team (USD)
            </label>
            <input id="fee" inputMode="decimal" required className="input" value={fee} onChange={(e) => setFee(e.target.value)} />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      <button type="submit" className="btn-primary w-full sm:w-auto" disabled={busy}>
        {busy ? "Saving…" : mode === "create" ? "Create tournament" : "Save changes"}
      </button>
    </form>
  );
}
