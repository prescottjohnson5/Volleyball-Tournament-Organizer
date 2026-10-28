import { describe, expect, it } from "vitest";
import type { TournamentInput } from "@/lib/tournaments/schema";
import {
  addTeam,
  createLocalSandbox,
  createSampleSandbox,
  fillWithSampleTeams,
  localDate,
  localSandboxSchema,
  localSandboxView,
  removeTeam,
  saveMatchScores,
  startBlocker,
  startLocalSandbox,
  type LocalSandbox,
} from "./model";
import { readSandbox, STORAGE_KEY, writeSandbox } from "./storage";

const NOW = new Date(2026, 9, 28, 12, 0);

const INPUT: TournamentInput = {
  name: "Practice Cup",
  eventDate: "2026-11-01",
  location: "Rec Center",
  environment: "outdoor",
  format: "pool_to_single_elim",
  bestOf: 3,
  maxTeams: 8,
  poolOptions: { poolSize: 4, advancePerPool: 2 },
};

/** Team A wins in two sets, valid for outdoor best of 3. */
const A_WINS = [
  { a: 21, b: 15 },
  { a: 21, b: 18 },
];

/** Plays every playable match until nothing is left, and returns the final sandbox. */
function playOut(sandbox: LocalSandbox): LocalSandbox {
  let current = sandbox;
  for (let guard = 0; guard < 200; guard++) {
    const next = localSandboxView(current).matches.find((m) => m.status === "ready" || m.status === "in_progress");
    if (!next) return current;
    current = saveMatchScores(current, next.id, A_WINS);
  }
  throw new Error("Tournament never finished");
}

describe("local sandbox", () => {
  it("starts as an empty tournament in registration, marked as a sandbox", () => {
    const view = localSandboxView(createLocalSandbox(INPUT));
    expect(view.tournament).toMatchObject({ name: "Practice Cup", status: "registration", isSandbox: true, maxTeams: 8 });
    expect(view.teams).toEqual([]);
    expect(view.matches).toEqual([]);
  });

  it("adds and removes teams with clear messages for mistakes", () => {
    let sandbox = addTeam(createLocalSandbox({ ...INPUT, maxTeams: 3 }), "  Sand   Sharks ");
    expect(sandbox.teams.map((t) => t.name)).toEqual(["Sand Sharks"]);
    expect(() => addTeam(sandbox, " ")).toThrow("Enter a team name.");
    expect(() => addTeam(sandbox, "sand sharks")).toThrow(/already a team called/);
    expect(() => addTeam(sandbox, "x".repeat(61))).toThrow(/at most 60/);
    sandbox = addTeam(addTeam(sandbox, "Net Ninjas"), "Block Party");
    expect(() => addTeam(sandbox, "One Too Many")).toThrow(/allows 3 teams/);
    sandbox = removeTeam(sandbox, sandbox.teams[0].id);
    expect(sandbox.teams.map((t) => t.name)).toEqual(["Net Ninjas", "Block Party"]);
    expect(new Set(addTeam(sandbox, "Sand Sharks").teams.map((t) => t.id)).size).toBe(3);
  });

  it("fills open spots with unique sample names, even past the list of names", () => {
    const sandbox = fillWithSampleTeams(addTeam(createLocalSandbox({ ...INPUT, maxTeams: 40 }), "Sand Sharks"));
    const names = sandbox.teams.map((t) => t.name.toLowerCase());
    expect(names).toHaveLength(40);
    expect(new Set(names).size).toBe(40);
    expect(() => fillWithSampleTeams(sandbox)).toThrow(/already full/);
  });

  it("needs enough teams to start, then locks the team list", () => {
    const two = addTeam(addTeam(createLocalSandbox(INPUT), "A"), "B");
    expect(startBlocker(two)).toMatch(/at least 3 teams \(you have 2\)/);
    expect(() => startLocalSandbox(two, NOW)).toThrow(/at least 3 teams/);

    const started = startLocalSandbox(fillWithSampleTeams(two), NOW);
    const view = localSandboxView(started);
    expect(view.tournament.status).toBe("in_progress");
    expect(view.teams.map((t) => t.seed)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(new Set(view.teams.map((t) => t.pool))).toEqual(new Set(["A", "B"]));
    expect(view.matches.filter((m) => m.phase === "pool")).toHaveLength(12);
    expect(() => addTeam(started, "Late Team")).toThrow(/cannot change once the tournament has started/);
    expect(startBlocker(started)).toMatch(/already started/);
  });

  it("refuses impossible scores with the volleyball rule that was broken", () => {
    const started = startLocalSandbox(fillWithSampleTeams(createLocalSandbox(INPUT)), NOW);
    const match = localSandboxView(started).matches[0];
    expect(() => saveMatchScores(started, match.id, [{ a: 21, b: 20 }])).toThrow(/won by 2/);
    expect(() => saveMatchScores(started, match.id, [{ a: 25, b: 10 }])).toThrow(/would have ended earlier/);
    expect(() => saveMatchScores(createLocalSandbox(INPUT), "m1", A_WINS)).toThrow(/Start the tournament/);
  });

  it("builds the playoffs once pools finish, locks pool results, and crowns a champion", () => {
    let sandbox = startLocalSandbox(fillWithSampleTeams(createLocalSandbox(INPUT)), NOW);
    for (const match of localSandboxView(sandbox).matches.filter((m) => m.phase === "pool")) {
      sandbox = saveMatchScores(sandbox, match.id, A_WINS);
    }
    const afterPools = localSandboxView(sandbox);
    const bracket = afterPools.matches.filter((m) => m.phase === "bracket");
    expect(bracket.length).toBeGreaterThan(0);
    expect(bracket.some((m) => m.status === "ready")).toBe(true);
    const poolMatch = afterPools.matches.find((m) => m.phase === "pool")!;
    expect(() => saveMatchScores(sandbox, poolMatch.id, [])).toThrow(/locked once the playoff bracket/);

    const finished = localSandboxView(playOut(sandbox));
    expect(finished.tournament.status).toBe("completed");
    expect(finished.teams.some((t) => t.id === finished.tournament.championTeamId)).toBe(true);
  });

  it("plays a double-elimination sandbox to a champion", () => {
    const sandbox = startLocalSandbox(fillWithSampleTeams(createLocalSandbox({ ...INPUT, format: "double_elim", maxTeams: 6 })), NOW);
    const finished = localSandboxView(playOut(sandbox));
    expect(finished.tournament.status).toBe("completed");
    expect(finished.tournament.championTeamId).not.toBeNull();
  });

  it("clears a match when saved with no sets, reopening a finished tournament", () => {
    const finished = playOut(startLocalSandbox(fillWithSampleTeams(createLocalSandbox({ ...INPUT, format: "double_elim", maxTeams: 4 })), NOW));
    const last = localSandboxView(finished).matches.filter((m) => m.status === "completed").at(-1)!;
    const reopened = localSandboxView(saveMatchScores(finished, last.id, []));
    expect(reopened.tournament.status).toBe("in_progress");
    expect(reopened.tournament.championTeamId).toBeNull();
  });

  it("offers a sample tournament part-way through pool play", () => {
    const sample = createSampleSandbox(NOW);
    expect(localSandboxSchema.safeParse(sample).success).toBe(true);
    const view = localSandboxView(sample);
    expect(sample.tournament).toMatchObject({ sample: true, eventDate: localDate(NOW), name: "Sample Beach Classic" });
    expect(view.teams).toHaveLength(8);
    expect(view.matches.filter((m) => m.status === "completed")).toHaveLength(9);
    expect(view.matches.filter((m) => m.status === "in_progress")).toHaveLength(1);
    expect(view.matches.some((m) => m.phase === "bracket")).toBe(false);

    const finished = localSandboxView(playOut(sample));
    expect(finished.matches.some((m) => m.phase === "bracket")).toBe(true);
    expect(finished.tournament.status).toBe("completed");
  });
});

/** A Map-backed Storage, optionally refusing writes like a full or blocked localStorage. */
function memoryStorage({ refuseWrites = false } = {}): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => {
      if (refuseWrites) throw new DOMException("Quota exceeded", "QuotaExceededError");
      data.set(key, value);
    },
  };
}

describe("sandbox storage", () => {
  it("saves, reads back and removes the sandbox", () => {
    const storage = memoryStorage();
    const sample = createSampleSandbox(NOW);
    expect(readSandbox(storage)).toEqual({ sandbox: null, problem: null });
    expect(writeSandbox(storage, sample)).toBe(true);
    expect(readSandbox(storage)).toEqual({ sandbox: sample, problem: null });
    expect(writeSandbox(storage, null)).toBe(true);
    expect(storage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("reports saved data it cannot use instead of crashing", () => {
    const storage = memoryStorage();
    storage.setItem(STORAGE_KEY, "{not json");
    expect(readSandbox(storage)).toEqual({ sandbox: null, problem: "unreadable" });
    storage.setItem(STORAGE_KEY, JSON.stringify({ ...createSampleSandbox(NOW), version: 99 }));
    expect(readSandbox(storage).problem).toBe("unreadable");
  });

  it("returns false when the browser will not store anything", () => {
    expect(writeSandbox(null, createSampleSandbox(NOW))).toBe(false);
    expect(readSandbox(null)).toEqual({ sandbox: null, problem: null });
    expect(writeSandbox(memoryStorage({ refuseWrites: true }), createSampleSandbox(NOW))).toBe(false);
  });
});
