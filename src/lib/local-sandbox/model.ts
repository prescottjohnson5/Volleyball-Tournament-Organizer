import { z } from "zod";
import { resolveMatches } from "@/lib/bracket/engine";
import type { IdFactory, MatchSpec, ResolvedMatch } from "@/lib/bracket/types";
import { TEAM_NAMES } from "@/lib/demo/mock-tournament";
import { simulateTournament } from "@/lib/demo/simulate";
import { UserFacingError } from "@/lib/errors";
import { getFormat, type PlannedTeam } from "@/lib/formats";
import { poolOptionsSchema } from "@/lib/formats/pool-play";
import { createRuleset, type BestOf, type SetScore } from "@/lib/rules/ruleset";
import { applyScoreChange, TournamentRuleError } from "@/lib/tournament/progress";
import { slotSourceSchema } from "@/lib/tournament/rows";
import { tournamentInputSchema, type TournamentInput } from "@/lib/tournaments/schema";
import type { TournamentView, ViewMatch } from "@/lib/view";

/**
 * The browser sandbox: one practice tournament kept in the visitor's own browser (localStorage), run by
 * the same formats, score rules and bracket engine as real tournaments. It needs no account and no
 * database, and nothing in it is ever sent to the server, so it cannot touch real tournaments.
 *
 * Every function here is pure: it takes a sandbox and returns a new one, or throws a UserFacingError
 * whose message can be shown as is.
 */

export const LOCAL_SANDBOX_VERSION = 1;

const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  seed: z.number().int().nullable(),
  pool: z.string().nullable(),
});

const specSchema = z.object({
  id: z.string(),
  phase: z.enum(["pool", "bracket"]),
  bracket: z.enum(["pool", "winners", "losers", "final"]),
  round: z.number().int(),
  position: z.number().int(),
  pool: z.string().nullable(),
  label: z.string(),
  orderIndex: z.number(),
  teamA: slotSourceSchema,
  teamB: slotSourceSchema,
  resetOf: z.string().nullable(),
});

/** Validates what comes back from storage, which the visitor (or an older version of the app) may have changed. */
export const localSandboxSchema = z.object({
  version: z.literal(LOCAL_SANDBOX_VERSION),
  tournament: z.object({
    name: z.string(),
    eventDate: z.string(),
    location: z.string(),
    environment: z.enum(["indoor", "outdoor"]),
    format: z.enum(["pool_to_single_elim", "double_elim"]),
    bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    maxTeams: z.number().int().min(3).max(64),
    formatOptions: poolOptionsSchema.partial(),
    startedAt: z.string().nullable(),
    /** True for the ready-made sample tournament. */
    sample: z.boolean(),
  }),
  teams: z.array(teamSchema),
  specs: z.array(specSchema),
  sets: z.record(z.string(), z.array(z.object({ a: z.number().int(), b: z.number().int() }))),
  /** Next number for generated team and match ids. */
  nextId: z.number().int().positive(),
});

export type LocalSandbox = z.infer<typeof localSandboxSchema>;

/** Keeps only the stored match fields (formats add scheduling details such as `wave`), like a database round trip. */
function storedSpecs(specs: readonly MatchSpec[]): MatchSpec[] {
  return specs.map((spec) => specSchema.parse(spec));
}
export type SandboxTeam = LocalSandbox["teams"][number];

const MAX_TEAM_NAME = 60;

/** Runs `build` with an id factory that continues the sandbox's id sequence, then stores the next number. */
function withIds<T>(sandbox: LocalSandbox, prefix: string, build: (ids: IdFactory) => T): { result: T; nextId: number } {
  let next = sandbox.nextId;
  const result = build(() => `${prefix}${next++}`);
  return { result, nextId: next };
}

function started(sandbox: LocalSandbox): boolean {
  return sandbox.tournament.startedAt !== null;
}

function assertNotStarted(sandbox: LocalSandbox) {
  if (started(sandbox)) throw new UserFacingError("Teams cannot change once the tournament has started. Start over to change them.");
}

/** A new, empty sandbox tournament from the same input the real creation form sends. */
export function createLocalSandbox(raw: TournamentInput): LocalSandbox {
  const input = tournamentInputSchema.parse(raw);
  return {
    version: LOCAL_SANDBOX_VERSION,
    tournament: {
      name: input.name,
      eventDate: input.eventDate,
      location: input.location,
      environment: input.environment,
      format: input.format,
      bestOf: input.bestOf,
      maxTeams: input.maxTeams,
      formatOptions: input.format === "pool_to_single_elim" ? poolOptionsSchema.parse(input.poolOptions ?? {}) : {},
      startedAt: null,
      sample: false,
    },
    teams: [],
    specs: [],
    sets: {},
    nextId: 1,
  };
}

export function addTeam(sandbox: LocalSandbox, rawName: string): LocalSandbox {
  assertNotStarted(sandbox);
  const name = rawName.trim().replace(/\s+/g, " ");
  if (!name) throw new UserFacingError("Enter a team name.");
  if (name.length > MAX_TEAM_NAME) throw new UserFacingError(`Team names can be at most ${MAX_TEAM_NAME} characters.`);
  if (sandbox.teams.some((t) => t.name.toLowerCase() === name.toLowerCase())) {
    throw new UserFacingError(`There is already a team called “${name}”.`);
  }
  if (sandbox.teams.length >= sandbox.tournament.maxTeams) {
    throw new UserFacingError(`The tournament is full: it allows ${sandbox.tournament.maxTeams} teams.`);
  }
  return {
    ...sandbox,
    teams: [...sandbox.teams, { id: `t${sandbox.nextId}`, name, seed: null, pool: null }],
    nextId: sandbox.nextId + 1,
  };
}

export function removeTeam(sandbox: LocalSandbox, teamId: string): LocalSandbox {
  assertNotStarted(sandbox);
  return { ...sandbox, teams: sandbox.teams.filter((t) => t.id !== teamId) };
}

/** Fills every open spot with sample team names, so the visitor can start right away. */
export function fillWithSampleTeams(sandbox: LocalSandbox): LocalSandbox {
  assertNotStarted(sandbox);
  const open = sandbox.tournament.maxTeams - sandbox.teams.length;
  if (open <= 0) throw new UserFacingError("The tournament is already full.");
  const taken = new Set(sandbox.teams.map((t) => t.name.toLowerCase()));
  const names = TEAM_NAMES.filter((n) => !taken.has(n.toLowerCase()));
  for (let n = 1; names.length < open; n++) {
    if (!taken.has(`team ${n}`)) names.push(`Team ${n}`);
  }
  return names.slice(0, open).reduce(addTeam, sandbox);
}

function minTeamsMessage(sandbox: LocalSandbox): string | null {
  const format = getFormat(sandbox.tournament.format);
  const count = sandbox.teams.length;
  return count < format.minTeams ? `${format.name} needs at least ${format.minTeams} teams (you have ${count}).` : null;
}

/** Why the tournament cannot start yet, or null when it can. */
export function startBlocker(sandbox: LocalSandbox): string | null {
  if (started(sandbox)) return "The tournament has already started.";
  return minTeamsMessage(sandbox);
}

/** Seeds teams in the order they were added (like registration order) and generates the schedule. */
export function startLocalSandbox(sandbox: LocalSandbox, now: Date): LocalSandbox {
  const blocker = startBlocker(sandbox);
  if (blocker) throw new TournamentRuleError(blocker);
  const format = getFormat(sandbox.tournament.format);
  const seeded = sandbox.teams.map((t, i) => ({ id: t.id, seed: i + 1 }));
  const { result: plan, nextId } = withIds(sandbox, "m", (ids) => format.createInitialPlan(seeded, sandbox.tournament.formatOptions, ids));
  return {
    ...sandbox,
    tournament: { ...sandbox.tournament, startedAt: now.toISOString() },
    teams: sandbox.teams.map((t, i) => ({ ...t, seed: i + 1, pool: plan.pools[t.id] ?? null })),
    specs: storedSpecs(plan.matches),
    sets: {},
    nextId,
  };
}

function rulesOf(sandbox: LocalSandbox) {
  return createRuleset(sandbox.tournament.environment, { bestOf: sandbox.tournament.bestOf as BestOf });
}

function plannedTeams(sandbox: LocalSandbox): PlannedTeam[] {
  return sandbox.teams.map((t, i) => ({ id: t.id, seed: t.seed ?? i + 1, pool: t.pool }));
}

function setsMap(sandbox: LocalSandbox): Map<string, SetScore[]> {
  return new Map(Object.entries(sandbox.sets));
}

/**
 * Replaces every set of one match (an empty list clears it) and moves the tournament on: winners advance,
 * the playoff bracket appears once pools finish, and a champion is crowned. Uses the same rules as a real
 * organizer's score override, so the same mistakes are refused with the same messages.
 */
export function saveMatchScores(sandbox: LocalSandbox, matchId: string, sets: readonly SetScore[]): LocalSandbox {
  if (!started(sandbox)) throw new TournamentRuleError("Start the tournament before entering scores.");
  const { result, nextId } = withIds(sandbox, "m", (ids) =>
    applyScoreChange(
      {
        format: getFormat(sandbox.tournament.format),
        formatOptions: sandbox.tournament.formatOptions,
        rules: rulesOf(sandbox),
        teams: plannedTeams(sandbox),
        specs: sandbox.specs,
        sets: setsMap(sandbox),
      },
      matchId,
      sets,
      { appending: false },
      ids,
    ),
  );
  return {
    ...sandbox,
    specs: [...sandbox.specs, ...storedSpecs(result.newSpecs)],
    sets: Object.fromEntries([...result.sets].filter(([, list]) => list.length > 0)),
    nextId,
  };
}

function resolved(sandbox: LocalSandbox): ResolvedMatch[] {
  return sandbox.specs.length > 0 ? resolveMatches(sandbox.specs, setsMap(sandbox), rulesOf(sandbox)) : [];
}

function viewMatch(match: ResolvedMatch): ViewMatch {
  return {
    id: match.id,
    label: match.label,
    phase: match.phase,
    bracket: match.bracket,
    round: match.round,
    position: match.position,
    pool: match.pool,
    orderIndex: match.orderIndex,
    status: match.status,
    teamAId: match.teamAId,
    teamBId: match.teamBId,
    winnerId: match.winnerId,
    setsA: match.setsA,
    setsB: match.setsB,
    sets: match.sets.map((s, i) => ({ setNumber: i + 1, a: s.a, b: s.b, reportedBy: "organizer", reportedByTeamId: null })),
  };
}

/** The sandbox as the read-only view every tournament page renders. */
export function localSandboxView(sandbox: LocalSandbox): TournamentView {
  const t = sandbox.tournament;
  const matches = resolved(sandbox);
  const champion = started(sandbox)
    ? getFormat(t.format).champion({ teams: plannedTeams(sandbox), matches, rules: rulesOf(sandbox) })
    : null;
  return {
    tournament: {
      id: "sandbox",
      slug: "sandbox",
      name: t.name,
      eventDate: t.eventDate,
      location: t.location,
      environment: t.environment,
      format: t.format,
      bestOf: t.bestOf,
      maxTeams: t.maxTeams,
      status: !started(sandbox) ? "registration" : champion ? "completed" : "in_progress",
      championTeamId: champion,
      isSandbox: true,
    },
    teams: sandbox.teams.map((team) => ({ id: team.id, name: team.name, seed: team.seed, pool: team.pool })),
    matches: [...matches].sort((x, y) => x.orderIndex - y.orderIndex).map(viewMatch),
  };
}

/** Today's date (YYYY-MM-DD) in the visitor's time zone. */
export function localDate(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * A ready-made beach tournament with eight teams, part-way through pool play: most pool matches have
 * results, one is live and a couple are still to play, so entering the last scores builds the playoffs.
 */
export function createSampleSandbox(now: Date): LocalSandbox {
  const empty = createLocalSandbox({
    name: "Sample Beach Classic",
    eventDate: localDate(now),
    location: "Ocean Beach, Courts 1–4",
    environment: "outdoor",
    format: "pool_to_single_elim",
    bestOf: 3,
    maxTeams: 8,
    poolOptions: { poolSize: 4, advancePerPool: 2 },
  });
  const withTeams = fillWithSampleTeams(empty);
  const sandbox = { ...withTeams, tournament: { ...withTeams.tournament, sample: true } };
  const seeded = sandbox.teams.map((t, i) => ({ id: t.id, seed: i + 1 }));
  const { result: simulation, nextId } = withIds(sandbox, "m", (ids) =>
    simulateTournament({
      format: getFormat(sandbox.tournament.format),
      formatOptions: sandbox.tournament.formatOptions,
      rules: rulesOf(sandbox),
      teams: seeded,
      ids,
      seed: 11,
      maxMatches: 9,
      inProgress: 1,
    }),
  );
  return {
    ...sandbox,
    tournament: { ...sandbox.tournament, startedAt: now.toISOString() },
    teams: simulation.teams.map((t) => ({ id: t.id, name: sandbox.teams.find((s) => s.id === t.id)!.name, seed: t.seed, pool: t.pool })),
    specs: storedSpecs(simulation.specs),
    sets: Object.fromEntries(simulation.sets),
    nextId,
  };
}
