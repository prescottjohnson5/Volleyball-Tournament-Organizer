import { describe, expect, it } from "vitest";
import { formatCents, parseDollarsToCents, platformFeeCents } from "./money";

describe("parseDollarsToCents", () => {
  it.each([
    ["25", 2500],
    ["25.5", 2550],
    ["$25.05", 2505],
    [" 0.99 ", 99],
  ])("parses %s", (input, cents) => {
    expect(parseDollarsToCents(input)).toBe(cents);
  });

  it.each(["", "abc", "25.555", "-5", "1e3"])("rejects %s", (input) => {
    expect(parseDollarsToCents(input)).toBeNull();
  });
});

describe("formatCents", () => {
  it("formats US dollars", () => {
    expect(formatCents(2550)).toBe("$25.50");
  });
});

describe("platformFeeCents", () => {
  it("rounds down and handles zero", () => {
    expect(platformFeeCents(2599, 5)).toBe(129);
    expect(platformFeeCents(2500, 0)).toBe(0);
  });
});
