"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronDownIcon } from "@/components/Icons";
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

type Field = "name" | "eventDate" | "location" | "maxTeams" | "fee";
type Errors = Partial<Record<Field, string>>;

const FORMAT_DESCRIPTIONS: Record<TournamentInput["format"], string> = {
  pool_to_single_elim: "Everyone plays a pool first, then the best teams play a knockout bracket.",
  double_elim: "One bracket from the start. A team is out after its second loss.",
};

export function TournamentForm({ mode, initial, tournamentId, showFee, maxTeamsLimit = 64 }: Props) {
  const router = useRouter();
  const [name, setName] = useState(initial?.name ?? "");
  const [eventDate, setEventDate] = useState(initial?.eventDate ?? "");
  const [location, setLocation] = useState(initial?.location ?? "");
  const [environment, setEnvironment] = useState<TournamentInput["environment"]>(initial?.environment ?? "indoor");
  const [format, setFormat] = useState<TournamentInput["format"]>(initial?.format ?? "pool_to_single_elim");
  const [bestOf, setBestOf] = useState<TournamentInput["bestOf"]>(initial?.bestOf ?? 3);
  const [maxTeams, setMaxTeams] = useState(String(Math.min(initial?.maxTeams ?? 8, maxTeamsLimit)));
  const [fee, setFee] = useState(initial?.registrationFeeCents ? (initial.registrationFeeCents / 100).toFixed(2) : "25.00");
  const [poolSize, setPoolSize] = useState(initial?.poolOptions?.poolSize ?? 4);
  const [advancePerPool, setAdvancePerPool] = useState(initial?.poolOptions?.advancePerPool ?? 2);
  const [busy, setBusy] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [error, setError] = useState<string | null>(null);

  function validate(): Errors {
    const found: Errors = {};
    if (name.trim().length < 3) found.name = "Enter a name of at least 3 characters.";
    if (!eventDate) found.eventDate = "Pick the date of the event.";
    if (!location.trim()) found.location = "Enter where the event takes place.";
    const teams = Number(maxTeams);
    if (!Number.isInteger(teams) || teams < 3 || teams > maxTeamsLimit) found.maxTeams = `Enter a whole number from 3 to ${maxTeamsLimit}.`;
    if (showFee && parseDollarsToCents(fee) === null) found.fee = "Enter the fee as a dollar amount, for example 25 or 25.00.";
    return found;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const found = validate();
    setErrors(found);
    const firstInvalid = (Object.keys(found) as Field[])[0];
    if (firstInvalid) {
      document.getElementById(firstInvalid)?.focus();
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
      registrationFeeCents: showFee ? (parseDollarsToCents(fee) ?? undefined) : undefined,
      poolOptions: format === "pool_to_single_elim" ? { poolSize, advancePerPool } : undefined,
    };

    setBusy(true);
    const response = await fetch(mode === "create" ? "/api/tournaments" : `/api/tournaments/${tournamentId}`, {
      method: mode === "create" ? "POST" : "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => null);
    const result = (await response?.json().catch(() => ({}))) as { id?: string; error?: string } | undefined;
    setBusy(false);
    if (!response?.ok) {
      setError(result?.error ?? "Could not save the tournament. Check your connection and try again.");
      return;
    }
    router.push(`/dashboard/tournaments/${mode === "create" ? result?.id : tournamentId}`);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-10">
      <p className="text-sm text-ink-subtle">
        Fields marked <Required /> are required.
      </p>

      <Section title="Details">
        <TextField id="name" label="Tournament name" error={errors.name}>
          <input
            id="name"
            required
            minLength={3}
            maxLength={100}
            placeholder="Summer Beach Classic"
            {...fieldProps("name", errors)}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </TextField>
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField id="eventDate" label="Date" error={errors.eventDate}>
            <input id="eventDate" type="date" required {...fieldProps("eventDate", errors)} value={eventDate} onChange={(e) => setEventDate(e.target.value)} />
          </TextField>
          <TextField id="location" label="Location" error={errors.location}>
            <input
              id="location"
              required
              maxLength={200}
              placeholder="Venue, city"
              {...fieldProps("location", errors)}
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            />
          </TextField>
        </div>
      </Section>

      <Section title="Format">
        <ChoiceCards
          legend="Setting"
          name="environment"
          value={environment}
          onChange={setEnvironment}
          columns="sm:grid-cols-2"
          options={(["indoor", "outdoor"] as const).map((value) => ({
            value,
            label: value === "indoor" ? "Indoor" : "Outdoor (beach)",
            description: `Sets to ${ENVIRONMENT_PRESETS[value].pointsPerSet}`,
          }))}
        />
        <ChoiceCards
          legend="How teams play"
          name="format"
          value={format}
          onChange={setFormat}
          columns="sm:grid-cols-2"
          options={(Object.keys(FORMAT_LABELS) as TournamentInput["format"][]).map((value) => ({
            value,
            label: FORMAT_LABELS[value],
            description: FORMAT_DESCRIPTIONS[value],
          }))}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField
            id="maxTeams"
            label="Maximum number of teams"
            hint={maxTeamsLimit < 64 ? `Sandbox tournaments can have up to ${maxTeamsLimit} teams.` : undefined}
            error={errors.maxTeams}
          >
            <input
              id="maxTeams"
              type="number"
              inputMode="numeric"
              min={3}
              max={maxTeamsLimit}
              required
              {...fieldProps("maxTeams", errors)}
              value={maxTeams}
              onChange={(e) => setMaxTeams(e.target.value)}
            />
          </TextField>
          {showFee && (
            <TextField id="fee" label="Registration fee per team (USD)" error={errors.fee}>
              <input id="fee" inputMode="decimal" required {...fieldProps("fee", errors)} value={fee} onChange={(e) => setFee(e.target.value)} />
            </TextField>
          )}
        </div>
      </Section>

      <details className="group rounded-2xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
          <span>
            More options
            <span className="mt-0.5 block text-sm font-normal text-ink-subtle">
              Match length{format === "pool_to_single_elim" ? " and pool settings" : ""}. The defaults suit most events.
            </span>
          </span>
          <ChevronDownIcon className="h-5 w-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180" />
        </summary>
        <div className="grid gap-5 border-t border-line px-4 py-5 sm:grid-cols-2">
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
          {format === "pool_to_single_elim" && (
            <>
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
            </>
          )}
        </div>
      </details>

      <div className="space-y-3 border-t border-line pt-6">
        {error && (
          <p role="alert" className="rounded-xl border border-red-400/50 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        {Object.keys(errors).length > 0 && (
          <p role="alert" className="text-sm text-red-300">
            Check the highlighted fields above.
          </p>
        )}
        <div className="flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center">
          {mode === "create" && (
            <Link href="/" className="btn-secondary sm:w-auto">
              Cancel
            </Link>
          )}
          <button type="submit" className="btn-primary sm:w-auto" disabled={busy}>
            {busy ? "Saving…" : mode === "create" ? "Create tournament" : "Save changes"}
          </button>
        </div>
      </div>
    </form>
  );
}

function fieldProps(field: Field, errors: Errors) {
  const invalid = Boolean(errors[field]);
  return {
    className: `input ${invalid ? "border-red-400" : ""}`,
    "aria-invalid": invalid || undefined,
    "aria-describedby": invalid ? `${field}-error` : undefined,
  };
}

function Required() {
  return (
    <span className="text-sun" aria-hidden>
      *
    </span>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-5">
      <h2 className="text-xl font-extrabold">{title}</h2>
      {children}
    </section>
  );
}

function TextField({ id, label, hint, error, children }: { id: Field; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="label">
        {label} <Required />
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="mt-1 text-sm text-red-300">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-ink-subtle">{hint}</p>
      )}
    </div>
  );
}

/** Radio buttons drawn as cards, so each choice can carry a one-line explanation. */
function ChoiceCards<T extends string>({
  legend,
  name,
  value,
  onChange,
  options,
  columns,
}: {
  legend: string;
  name: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; description: string }[];
  columns: string;
}) {
  return (
    <fieldset>
      <legend className="label">
        {legend} <Required />
      </legend>
      <div className={`grid gap-3 ${columns}`}>
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer gap-3 rounded-2xl border p-4 transition-colors has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-sun ${
                selected ? "border-teal bg-midnight" : "border-line hover:border-ink-faint"
              }`}
            >
              <input
                type="radio"
                name={name}
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
                className="mt-1 h-4 w-4 shrink-0 accent-teal"
              />
              <span>
                <span className="block font-bold">{option.label}</span>
                <span className="mt-0.5 block text-sm text-ink-muted">{option.description}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
