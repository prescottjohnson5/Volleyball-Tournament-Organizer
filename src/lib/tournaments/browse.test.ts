import { describe, expect, it } from "vitest";
import { escapeLikePattern, matchesSearch, normalizeSearch, sortForBrowsing, type TournamentListItem } from "./browse";

function item(name: string, status: TournamentListItem["status"], eventDate: string): TournamentListItem {
  return { id: name, slug: name.toLowerCase(), name, status, event_date: eventDate, location: "Gym" };
}

describe("normalizeSearch", () => {
  it("trims, collapses spaces and caps the length", () => {
    expect(normalizeSearch("  Beach   Classic ")).toBe("Beach Classic");
    expect(normalizeSearch("x".repeat(300))).toHaveLength(100);
  });

  it("treats a missing or repeated parameter sensibly", () => {
    expect(normalizeSearch(undefined)).toBe("");
    expect(normalizeSearch(["first", "second"])).toBe("first");
  });
});

describe("escapeLikePattern", () => {
  it("escapes wildcards so they match literally", () => {
    expect(escapeLikePattern("100%_fun\\")).toBe("100\\%\\_fun\\\\");
    expect(escapeLikePattern("Spring Open")).toBe("Spring Open");
  });
});

describe("matchesSearch", () => {
  it("matches any part of the name, ignoring case", () => {
    expect(matchesSearch({ name: "Summer Beach Bash" }, "beach")).toBe(true);
    expect(matchesSearch({ name: "Summer Beach Bash" }, "indoor")).toBe(false);
    expect(matchesSearch({ name: "Anything" }, "")).toBe(true);
  });
});

describe("sortForBrowsing", () => {
  it("lists live, then upcoming (soonest first), then finished (latest first)", () => {
    const sorted = sortForBrowsing([
      item("Old final", "completed", "2026-01-10"),
      item("Later signup", "registration", "2026-09-01"),
      item("Live now", "in_progress", "2026-06-01"),
      item("Recent final", "completed", "2026-05-01"),
      item("Sooner signup", "registration", "2026-07-01"),
    ]);
    expect(sorted.map((t) => t.name)).toEqual(["Live now", "Sooner signup", "Later signup", "Recent final", "Old final"]);
  });

  it("does not change the input", () => {
    const input = [item("B", "completed", "2026-01-01"), item("A", "in_progress", "2026-01-01")];
    sortForBrowsing(input);
    expect(input.map((t) => t.name)).toEqual(["B", "A"]);
  });
});
