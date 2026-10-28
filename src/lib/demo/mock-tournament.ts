import { FORMATS } from "@/lib/formats";
import { createRuleset, type BestOf, type Environment } from "@/lib/rules/ruleset";
import type { FormatId } from "@/lib/supabase/database.types";
import { viewFromSimulation, type TournamentView } from "@/lib/view";
import { simulateTournament } from "./simulate";

/** Realistic team names for demo and sandbox data. */
export const TEAM_NAMES = [
  "Sand Sharks", "Net Ninjas", "Block Party", "Dig Deep", "Spike Force", "Set to Kill", "Ace Squad", "Bump Set Spike",
  "Kiss My Ace", "Sets on the Beach", "Hit Happens", "Serves You Right", "Pass Masters", "The Diggers", "Free Ballers", "Cloud Nine",
  "Tip Top", "Roof Raisers", "Side Out", "Pancake House", "Overpass", "Jump Float", "Pipe Dreams", "Quick Set",
  "Joust Do It", "Shank You", "Kong Block", "Swing Away", "Rally Cats", "Wipe Out", "Line Drive", "Short Court",
];

export interface DemoOptions {
  format: FormatId;
  environment: Environment;
  bestOf: BestOf;
  teams: number;
  /** Percentage of matches already played (0-100). */
  progress: number;
}

export const DEFAULT_DEMO: DemoOptions = { format: "pool_to_single_elim", environment: "outdoor", bestOf: 3, teams: 10, progress: 80 };

/** A realistic, deterministic tournament for the demo page. Needs no database. */
export function buildDemoTournament(options: DemoOptions): TournamentView {
  const format = FORMATS[options.format];
  const rules = createRuleset(options.environment, { bestOf: options.bestOf });
  const teams = Array.from({ length: options.teams }, (_, i) => ({ id: `demo-${i + 1}`, seed: i + 1 }));
  const names = new Map(teams.map((t, i) => [t.id, TEAM_NAMES[i % TEAM_NAMES.length]]));
  const run = (maxMatches?: number) => {
    let n = 0;
    return simulateTournament({
      format,
      formatOptions: { poolSize: 4, advancePerPool: 2 },
      rules,
      teams,
      ids: () => `demo-m${++n}`,
      seed: 7,
      maxMatches,
      inProgress: maxMatches === undefined ? 0 : 2,
    });
  };
  const total = run().matches.filter((m) => m.status === "completed").length;
  const result = options.progress >= 100 ? run() : run(Math.round((total * options.progress) / 100));

  return viewFromSimulation(result, names, {
    id: "demo",
    slug: "demo",
    name: "Demo Beach Classic",
    eventDate: "2026-07-18",
    location: "Ocean Beach, Court 1–4",
    environment: options.environment,
    format: options.format,
    bestOf: options.bestOf,
    maxTeams: 32,
    status: "in_progress",
    championTeamId: null,
    isSandbox: false,
  });
}
