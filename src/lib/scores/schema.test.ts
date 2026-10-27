import { describe, expect, it } from "vitest";
import { bearerToken, captainSetSchema, overrideSetsSchema } from "./schema";

describe("score schemas", () => {
  it("accepts a captain's set and rejects nonsense", () => {
    expect(captainSetSchema.parse({ setNumber: 1, scoreA: 25, scoreB: 20 })).toEqual({ setNumber: 1, scoreA: 25, scoreB: 20 });
    expect(captainSetSchema.safeParse({ setNumber: 0, scoreA: 25, scoreB: 20 }).success).toBe(false);
    expect(captainSetSchema.safeParse({ setNumber: 1, scoreA: -1, scoreB: 20 }).success).toBe(false);
    expect(captainSetSchema.safeParse({ setNumber: 1, scoreA: "25", scoreB: 20 }).success).toBe(false);
  });

  it("allows the organizer to clear a match", () => {
    expect(overrideSetsSchema.parse({ sets: [] })).toEqual({ sets: [] });
    expect(overrideSetsSchema.safeParse({ sets: Array(6).fill({ a: 25, b: 0 }) }).success).toBe(false);
  });
});

describe("bearerToken", () => {
  it("reads the token from the Authorization header", () => {
    expect(bearerToken("Bearer abc_123")).toBe("abc_123");
    expect(bearerToken("bearer abc")).toBe("abc");
    expect(bearerToken("Basic abc")).toBeNull();
    expect(bearerToken(null)).toBeNull();
  });
});
