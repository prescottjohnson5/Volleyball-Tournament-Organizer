import { describe, expect, it } from "vitest";
import {
  createRuleset,
  describeRuleset,
  pointsToWinSet,
  summarizeSets,
  validateMatchSets,
  validateSetScore,
} from "./ruleset";

const indoor = createRuleset("indoor");
const outdoor = createRuleset("outdoor");

describe("createRuleset", () => {
  it("uses environment presets and defaults", () => {
    expect(indoor).toMatchObject({ bestOf: 3, setsToWin: 2, pointsPerSet: 25, finalSetPoints: 15, winBy: 2, cap: null });
    expect(outdoor).toMatchObject({ pointsPerSet: 21, finalSetPoints: 15 });
    expect(createRuleset("indoor", { bestOf: 5 }).setsToWin).toBe(3);
  });

  it("rejects invalid options", () => {
    expect(() => createRuleset("indoor", { bestOf: 2 as 3 })).toThrow();
    expect(() => createRuleset("indoor", { winBy: 0 })).toThrow();
    expect(() => createRuleset("indoor", { cap: 20 })).toThrow();
  });
});

describe("pointsToWinSet", () => {
  it("shortens only the deciding set", () => {
    expect([1, 2, 3].map((n) => pointsToWinSet(indoor, n))).toEqual([25, 25, 15]);
    expect([1, 2, 3].map((n) => pointsToWinSet(outdoor, n))).toEqual([21, 21, 15]);
    const bo5 = createRuleset("indoor", { bestOf: 5 });
    expect([1, 2, 3, 4, 5].map((n) => pointsToWinSet(bo5, n))).toEqual([25, 25, 25, 25, 15]);
  });

  it("plays a single-set match to the full target", () => {
    expect(pointsToWinSet(createRuleset("indoor", { bestOf: 1 }), 1)).toBe(25);
  });
});

describe("validateSetScore", () => {
  it.each([
    [1, 25, 0],
    [1, 25, 23],
    [1, 26, 24],
    [1, 40, 38],
    [1, 23, 25],
    [3, 15, 13],
    [3, 17, 15],
  ])("accepts indoor set %i at %i-%i", (setNumber, a, b) => {
    expect(validateSetScore(indoor, setNumber, { a, b }).ok).toBe(true);
  });

  it.each([
    [1, 25, 24, "won by 2"],
    [1, 24, 22, "at least 25"],
    [1, 27, 20, "ended earlier"],
    [1, 25, 25, "tie"],
    [3, 25, 20, "ended earlier"],
    [1, -1, 25, "whole numbers"],
    [1, 25.5, 20, "whole numbers"],
    [4, 25, 20, "between 1 and 3"],
  ])("rejects indoor set %i at %i-%i (%s)", (setNumber, a, b, message) => {
    const result = validateSetScore(indoor, setNumber, { a, b });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  it("uses outdoor targets", () => {
    expect(validateSetScore(outdoor, 1, { a: 21, b: 19 }).ok).toBe(true);
    expect(validateSetScore(outdoor, 1, { a: 25, b: 19 }).ok).toBe(false);
  });

  it("reports the winning side", () => {
    expect(validateSetScore(indoor, 1, { a: 18, b: 25 })).toEqual({ ok: true, winner: "b" });
  });

  it("honours a winBy of 1 and an optional cap", () => {
    const winByOne = createRuleset("indoor", { winBy: 1 });
    expect(validateSetScore(winByOne, 1, { a: 25, b: 24 }).ok).toBe(true);
    const capped = createRuleset("indoor", { cap: 27 });
    expect(validateSetScore(capped, 1, { a: 27, b: 26 }).ok).toBe(true);
    expect(validateSetScore(capped, 1, { a: 28, b: 26 }).ok).toBe(false);
    expect(validateSetScore(capped, 1, { a: 26, b: 24 }).ok).toBe(true);
  });
});

describe("validateMatchSets", () => {
  it("accepts a split match and summarizes it", () => {
    const result = validateMatchSets(indoor, [
      { a: 25, b: 20 },
      { a: 22, b: 25 },
      { a: 15, b: 12 },
    ]);
    expect(result).toEqual({ ok: true, summary: { setsA: 2, setsB: 1, winner: "a" } });
  });

  it("accepts a partially played match", () => {
    expect(validateMatchSets(indoor, [{ a: 25, b: 20 }])).toEqual({
      ok: true,
      summary: { setsA: 1, setsB: 0, winner: null },
    });
  });

  it("rejects sets after the match is decided", () => {
    const result = validateMatchSets(indoor, [
      { a: 25, b: 20 },
      { a: 25, b: 20 },
      { a: 15, b: 10 },
    ]);
    expect(result.ok).toBe(false);
  });

  it("validates each set with its own target", () => {
    const result = validateMatchSets(indoor, [
      { a: 25, b: 20 },
      { a: 20, b: 25 },
      { a: 25, b: 20 },
    ]);
    expect(result.ok).toBe(false);
  });
});

describe("summarizeSets and describeRuleset", () => {
  it("counts sets won", () => {
    expect(summarizeSets(indoor, [{ a: 25, b: 20 }, { a: 20, b: 25 }])).toEqual({ setsA: 1, setsB: 1, winner: null });
  });

  it("describes the rules for people", () => {
    expect(describeRuleset(indoor)).toBe("Best of 3 · sets to 25 · deciding set to 15 · win by 2 · no cap");
    expect(describeRuleset(createRuleset("outdoor", { bestOf: 1 }))).toBe("One set · sets to 21 · win by 2 · no cap");
  });
});
