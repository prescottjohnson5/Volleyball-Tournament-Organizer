import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { ChevronDownIcon } from "@/components/Icons";
import { TournamentHeader, TournamentSections } from "@/components/tournament/TournamentSections";
import { buildDemoTournament, DEFAULT_DEMO, type DemoOptions } from "@/lib/demo/mock-tournament";
import { BEST_OF_OPTIONS, type BestOf } from "@/lib/rules/ruleset";
import { FORMAT_LABELS } from "@/lib/tournaments/labels";

export const metadata: Metadata = { title: "Sample tournament" };

type Search = Promise<Record<string, string | string[] | undefined>>;

function pick<T extends string | number>(value: unknown, allowed: readonly T[], fallback: T): T {
  const match = allowed.find((option) => String(option) === value);
  return match ?? fallback;
}

function parseOptions(params: Record<string, string | string[] | undefined>): DemoOptions {
  const teams = Number(params.teams);
  const progress = Number(params.progress);
  return {
    format: pick(params.format, ["pool_to_single_elim", "double_elim"] as const, DEFAULT_DEMO.format),
    environment: pick(params.environment, ["indoor", "outdoor"] as const, DEFAULT_DEMO.environment),
    bestOf: pick(Number(params.bestOf), BEST_OF_OPTIONS, DEFAULT_DEMO.bestOf) as BestOf,
    teams: Number.isInteger(teams) && teams >= 3 && teams <= 32 ? teams : DEFAULT_DEMO.teams,
    progress: Number.isFinite(progress) ? Math.min(100, Math.max(0, progress)) : DEFAULT_DEMO.progress,
  };
}

/** The public tournament view filled with simulated data. Works without any keys. */
export default async function DemoPage({ searchParams }: { searchParams: Search }) {
  const options = parseOptions(await searchParams);
  const view = buildDemoTournament(options);

  return (
    <div className="space-y-6">
      <BackLink href="/tournaments">All tournaments</BackLink>
      <details className="group rounded-2xl border border-line">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm [&::-webkit-details-marker]:hidden">
          <span>
            <span className="font-bold">Sample tournament.</span>{" "}
            <span className="text-ink-muted">Simulated teams and scores, built by the same rules the real app uses.</span>
          </span>
          <span className="flex shrink-0 items-center gap-1 font-bold text-teal-300">
            Change
            <ChevronDownIcon className="h-4 w-4 transition-transform group-open:rotate-180" />
          </span>
        </summary>
        <form className="grid grid-cols-2 gap-3 border-t border-line p-4 text-sm sm:grid-cols-6" method="get">
          <label className="col-span-2">
            <span className="label">Format</span>
            <select name="format" defaultValue={options.format} className="input">
              {Object.entries(FORMAT_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Setting</span>
            <select name="environment" defaultValue={options.environment} className="input">
              <option value="indoor">Indoor</option>
              <option value="outdoor">Outdoor</option>
            </select>
          </label>
          <label>
            <span className="label">Match</span>
            <select name="bestOf" defaultValue={options.bestOf} className="input">
              {BEST_OF_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  Best of {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Teams</span>
            <input name="teams" type="number" min={3} max={32} defaultValue={options.teams} className="input" />
          </label>
          <label>
            <span className="label">Played %</span>
            <input name="progress" type="number" min={0} max={100} step={10} defaultValue={options.progress} className="input" />
          </label>
          <button type="submit" className="btn-primary col-span-2 sm:col-span-6 sm:justify-self-start">
            Show
          </button>
        </form>
      </details>
      <TournamentHeader view={view} />
      <TournamentSections view={view} />
    </div>
  );
}
