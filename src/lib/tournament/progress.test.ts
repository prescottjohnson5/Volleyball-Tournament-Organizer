import { describe, expect, it } from "vitest";
import type { MatchRow, MatchSetRow } from "@/lib/supabase/database.types";
import { counterIds } from "@/test/ids";
import { planScoreEdit, planTournamentStart, seedByRegistration, TournamentRuleError, type TournamentForProgress } from "./progress";
import type { CommitChanges, SetRecord } from "./rows";

const NOW = new Date("2026-07-01T10:00:00Z");

function tournament(overrides: Partial<TournamentForProgress> = {}): TournamentForProgress {
  return {
    id: "tour",
    format: "double_elim",
    format_options: {},
    environment: "indoor",
    best_of: 3,
    status: "registration",
    champion_team_id: null,
    ...overrides,
  };
}

function paidTeams(n: number) {
  return Array.from({ length: n }, (_, i) => ({
    id: `t${i + 1}`,
    paid_at: `2026-06-01T00:00:${String(10 + i).padStart(2, "0")}Z`,
    created_at: "2026-05-01T00:00:00Z",
  }));
}

/** Applies a commit payload to in-memory rows, mirroring commit_tournament_changes. */
function apply(rows: { matches: MatchRow[]; sets: MatchSetRow[] }, changes: CommitChanges) {
  const matches = [...rows.matches];
  for (const m of changes.new_matches ?? []) {
    matches.push({
      ...m,
      tournament_id: "tour",
      team_a_id: null,
      team_b_id: null,
      winner_id: null,
      status: "pending",
      sets_a: 0,
      sets_b: 0,
      created_at: "",
      updated_at: "",
    } as MatchRow);
  }
  let sets = [...rows.sets];
  const toRow = (matchId: string, r: SetRecord): MatchSetRow => ({ ...r, id: `${matchId}-${r.set_number}`, match_id: matchId, tournament_id: "tour", reported_at: "" });
  for (const rep of changes.set_replacements ?? []) {
    sets = sets.filter((s) => s.match_id !== rep.match_id).concat(rep.sets.map((r) => toRow(rep.match_id, r)));
  }
  for (const ins of changes.set_inserts ?? []) sets.push(toRow(ins.match_id, ins));
  for (const u of changes.match_updates ?? []) {
    const i = matches.findIndex((m) => m.id === u.id);
    matches[i] = { ...matches[i], ...u };
  }
  return { matches, sets };
}

const organizerSet = (n: number, a: number, b: number): SetRecord => ({
  set_number: n,
  score_a: a,
  score_b: b,
  reported_by: "organizer",
  reported_by_team_id: null,
  reported_by_user_id: "org",
});

function started(n = 4, overrides: Partial<TournamentForProgress> = {}) {
  const t = tournament(overrides);
  const changes = planTournamentStart(t, paidTeams(n), counterIds(), NOW);
  const teams = changes.teams!.map((x) => ({ id: x.id, seed: x.seed, pool: x.pool }));
  return { t: { ...t, status: "in_progress" as const }, teams, rows: apply({ matches: [], sets: [] }, changes), changes };
}

describe("seedByRegistration", () => {
  it("seeds the first team to pay as 1", () => {
    const seeds = seedByRegistration([
      { id: "late", paid_at: "2026-06-02T00:00:00Z", created_at: "2026-05-01T00:00:00Z" },
      { id: "early", paid_at: "2026-06-01T00:00:00Z", created_at: "2026-05-02T00:00:00Z" },
    ]);
    expect(seeds).toEqual([
      { id: "early", seed: 1 },
      { id: "late", seed: 2 },
    ]);
  });
});

describe("planTournamentStart", () => {
  it("returns status, seeds, matches and resolved byes", () => {
    const { changes } = started(5);
    expect(changes.tournament).toEqual({ status: "in_progress", started_at: NOW.toISOString() });
    expect(changes.teams).toHaveLength(5);
    expect(changes.new_matches!.length).toBe(changes.match_updates!.length);
    expect(changes.match_updates!.filter((u) => u.status === "bye").length).toBeGreaterThan(0);
  });

  it("refuses to start twice or with too few teams", () => {
    expect(() => planTournamentStart(tournament({ status: "in_progress" }), paidTeams(4), counterIds(), NOW)).toThrow(TournamentRuleError);
    expect(() => planTournamentStart(tournament(), paidTeams(2), counterIds(), NOW)).toThrow(/at least 3/);
  });
});

describe("planScoreEdit", () => {
  it("records a set and marks the match in progress", () => {
    const { t, teams, rows } = started(4);
    const ready = rows.matches.find((m) => m.status === "ready")!;
    const { changes } = planScoreEdit({ tournament: t, teams, ...rows }, { matchId: ready.id, append: [organizerSet(1, 25, 20)] }, counterIds("x"), NOW);
    expect(changes.set_inserts).toHaveLength(1);
    expect(changes.match_updates).toEqual([expect.objectContaining({ id: ready.id, status: "in_progress", sets_a: 1 })]);
  });

  it("rejects invalid scores, pending matches and appends to decided matches", () => {
    const { t, teams, rows } = started(4);
    const snapshot = { tournament: t, teams, ...rows };
    const ready = rows.matches.find((m) => m.status === "ready")!;
    const pending = rows.matches.find((m) => m.status === "pending")!;
    expect(() => planScoreEdit(snapshot, { matchId: ready.id, append: [organizerSet(1, 25, 24)] }, counterIds(), NOW)).toThrow(/won by 2/);
    expect(() => planScoreEdit(snapshot, { matchId: pending.id, append: [organizerSet(1, 25, 20)] }, counterIds(), NOW)).toThrow(/both teams/);

    const done = apply(rows, planScoreEdit(snapshot, { matchId: ready.id, replace: [organizerSet(1, 25, 20), organizerSet(2, 25, 20)] }, counterIds(), NOW).changes);
    expect(() =>
      planScoreEdit({ tournament: t, teams, ...done }, { matchId: ready.id, append: [organizerSet(3, 15, 10)] }, counterIds(), NOW),
    ).toThrow(/already decided/);
  });

  it("refuses an override that changes who plays a later match with scores", () => {
    const { t, teams, rows } = started(4);
    let state = rows;
    const first = state.matches.find((m) => m.status === "ready")!;
    state = apply(state, planScoreEdit({ tournament: t, teams, ...state }, { matchId: first.id, replace: [organizerSet(1, 25, 20), organizerSet(2, 25, 20)] }, counterIds(), NOW).changes);
    const second = state.matches.find((m) => m.status === "ready")!;
    state = apply(state, planScoreEdit({ tournament: t, teams, ...state }, { matchId: second.id, replace: [organizerSet(1, 25, 20), organizerSet(2, 25, 20)] }, counterIds(), NOW).changes);
    // Winners final now has both teams; give it one set.
    const final = state.matches.find((m) => m.label === "Winners Final")!;
    state = apply(state, planScoreEdit({ tournament: t, teams, ...state }, { matchId: final.id, append: [organizerSet(1, 25, 20)] }, counterIds(), NOW).changes);

    const flip = [organizerSet(1, 20, 25), organizerSet(2, 20, 25)];
    expect(() => planScoreEdit({ tournament: t, teams, ...state }, { matchId: first.id, replace: flip }, counterIds(), NOW)).toThrow(/Winners Final/);
  });

  it("creates playoff matches when the last pool match is decided and locks pool scores", () => {
    const { t, teams, rows } = started(6, { format: "pool_to_single_elim", format_options: { poolSize: 3, advancePerPool: 2 } });
    let state = rows;
    const ids = counterIds("p");
    for (const match of rows.matches) {
      const { changes } = planScoreEdit({ tournament: t, teams, ...state }, { matchId: match.id, replace: [organizerSet(1, 25, 20), organizerSet(2, 25, 20)] }, ids, NOW);
      state = apply(state, changes);
    }
    const bracket = state.matches.filter((m) => m.phase === "bracket");
    expect(bracket.map((m) => m.label)).toEqual(["Semifinal 1", "Semifinal 2", "Final"]);
    expect(bracket.filter((m) => m.status === "ready")).toHaveLength(2);
    expect(() =>
      planScoreEdit({ tournament: t, teams, ...state }, { matchId: rows.matches[0].id, replace: [organizerSet(1, 20, 25), organizerSet(2, 20, 25)] }, ids, NOW),
    ).toThrow(/locked/);
  });

  it("completes the tournament and reopens it if an override undoes the champion", () => {
    const { t, teams, rows } = started(3);
    let state = rows;
    let tour: TournamentForProgress = t;
    const win = [organizerSet(1, 25, 20), organizerSet(2, 25, 20)];
    for (let guard = 0; guard < 20; guard++) {
      const ready = state.matches.find((m) => m.status === "ready");
      if (!ready) break;
      const { changes } = planScoreEdit({ tournament: tour, teams, ...state }, { matchId: ready.id, replace: win }, counterIds(), NOW);
      state = apply(state, changes);
      if (changes.tournament) tour = { ...tour, ...changes.tournament };
    }
    expect(tour.status).toBe("completed");
    expect(tour.champion_team_id).toBe("t1");

    const grandFinal = state.matches.find((m) => m.label === "Grand Final")!;
    const { changes } = planScoreEdit({ tournament: tour, teams, ...state }, { matchId: grandFinal.id, replace: [organizerSet(1, 20, 25), organizerSet(2, 20, 25)] }, counterIds(), NOW);
    expect(changes.tournament).toEqual({ status: "in_progress", champion_team_id: null, completed_at: null });
  });
});
