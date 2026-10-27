import { describe, expect, it } from "vitest";
import { UserFacingError } from "@/lib/errors";
import { buildCaptainEdit, buildOrganizerOverride } from "./edits";

const context = {
  tournament: { status: "in_progress" as const },
  matches: [{ id: "m1", team_a_id: "home", team_b_id: "away" }],
  sets: [{ match_id: "m1", set_number: 1 }],
};

function statusOf(fn: () => unknown): number | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof UserFacingError ? error.status : undefined;
  }
  return undefined;
}

describe("buildCaptainEdit", () => {
  it("appends the next set and records which captain reported it", () => {
    expect(buildCaptainEdit(context, "away", "m1", { setNumber: 2, scoreA: 20, scoreB: 25 })).toEqual({
      matchId: "m1",
      append: [{ set_number: 2, score_a: 20, score_b: 25, reported_by: "captain", reported_by_team_id: "away", reported_by_user_id: null }],
    });
  });

  it("refuses captains of other teams", () => {
    expect(statusOf(() => buildCaptainEdit(context, "stranger", "m1", { setNumber: 2, scoreA: 25, scoreB: 20 }))).toBe(403);
  });

  it("reports a conflict when the set was already reported", () => {
    expect(statusOf(() => buildCaptainEdit(context, "home", "m1", { setNumber: 1, scoreA: 25, scoreB: 20 }))).toBe(409);
  });

  it("requires sets in order", () => {
    expect(() => buildCaptainEdit(context, "home", "m1", { setNumber: 3, scoreA: 25, scoreB: 20 })).toThrow(/set 2 first/);
  });

  it("only accepts reports while the tournament is running", () => {
    expect(statusOf(() => buildCaptainEdit({ ...context, tournament: { status: "completed" } }, "home", "m1", { setNumber: 2, scoreA: 25, scoreB: 20 }))).toBe(409);
    expect(statusOf(() => buildCaptainEdit({ ...context, tournament: { status: "registration" } }, "home", "m1", { setNumber: 2, scoreA: 25, scoreB: 20 }))).toBe(409);
    expect(statusOf(() => buildCaptainEdit(context, "home", "nope", { setNumber: 1, scoreA: 25, scoreB: 20 }))).toBe(404);
  });
});

describe("buildOrganizerOverride", () => {
  it("replaces all sets with organizer attribution", () => {
    const edit = buildOrganizerOverride(context, "m1", [{ a: 25, b: 20 }, { a: 25, b: 18 }], "org-1");
    expect(edit.replace).toEqual([
      { set_number: 1, score_a: 25, score_b: 20, reported_by: "organizer", reported_by_team_id: null, reported_by_user_id: "org-1" },
      { set_number: 2, score_a: 25, score_b: 18, reported_by: "organizer", reported_by_team_id: null, reported_by_user_id: "org-1" },
    ]);
  });

  it("can clear a match", () => {
    expect(buildOrganizerOverride(context, "m1", [], "org-1").replace).toEqual([]);
  });
});
