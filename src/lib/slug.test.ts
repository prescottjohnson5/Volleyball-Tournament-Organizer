import { describe, expect, it } from "vitest";
import { createTournamentSlug } from "./slug";

describe("createTournamentSlug", () => {
  it("makes a readable, URL-safe slug with a random suffix", () => {
    const slug = createTournamentSlug("Summer Slam 2026!");
    expect(slug).toMatch(/^summer-slam-2026-[a-z2-9]{6}$/);
  });

  it("strips accents and falls back when nothing readable is left", () => {
    expect(createTournamentSlug("Coupe d'Été")).toMatch(/^coupe-d-ete-[a-z2-9]{6}$/);
    expect(createTournamentSlug("!!!")).toMatch(/^tournament-[a-z2-9]{6}$/);
  });

  it("matches the database slug constraint", () => {
    const slug = createTournamentSlug("x".repeat(200));
    expect(slug).toMatch(/^[a-z0-9-]{3,80}$/);
  });

  it("produces different slugs for the same name", () => {
    expect(createTournamentSlug("Cup")).not.toBe(createTournamentSlug("Cup"));
  });
});
