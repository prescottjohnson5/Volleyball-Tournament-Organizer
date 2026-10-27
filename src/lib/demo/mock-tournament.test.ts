import { describe, expect, it } from "vitest";
import { validateMatchSets, createRuleset } from "@/lib/rules/ruleset";
import { buildDemoTournament, DEFAULT_DEMO } from "./mock-tournament";

describe("buildDemoTournament", () => {
  it("shows a tournament in progress with live matches by default", () => {
    const view = buildDemoTournament(DEFAULT_DEMO);
    expect(view.teams).toHaveLength(DEFAULT_DEMO.teams);
    expect(view.matches.some((m) => m.status === "in_progress")).toBe(true);
    expect(view.tournament.championTeamId).toBeNull();
  });

  it.each(["pool_to_single_elim", "double_elim"] as const)("finishes %s with a champion at 100%%", (format) => {
    const view = buildDemoTournament({ ...DEFAULT_DEMO, format, progress: 100 });
    expect(view.tournament.status).toBe("completed");
    expect(view.teams.map((t) => t.id)).toContain(view.tournament.championTeamId);
  });

  it("only produces rule-valid scores", () => {
    const view = buildDemoTournament({ ...DEFAULT_DEMO, environment: "indoor", bestOf: 5, teams: 12, progress: 100 });
    const rules = createRuleset("indoor", { bestOf: 5 });
    for (const match of view.matches) expect(validateMatchSets(rules, match.sets).ok).toBe(true);
  });

  it("is deterministic", () => {
    expect(buildDemoTournament(DEFAULT_DEMO)).toEqual(buildDemoTournament(DEFAULT_DEMO));
  });
});
