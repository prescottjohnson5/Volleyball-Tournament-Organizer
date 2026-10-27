import { describe, expect, it } from "vitest";
import { generateCaptainToken, hashCaptainToken, isWellFormedToken, tokenMatchesHash } from "./captain-token";

describe("captain tokens", () => {
  it("are 256-bit URL-safe strings that differ every time", () => {
    const a = generateCaptainToken();
    const b = generateCaptainToken();
    expect(a).not.toBe(b);
    expect(isWellFormedToken(a)).toBe(true);
    expect(Buffer.from(a, "base64url")).toHaveLength(32);
  });

  it("hash deterministically to hex and never equal the token", () => {
    const token = generateCaptainToken();
    const hash = hashCaptainToken(token);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hashCaptainToken(token)).toBe(hash);
    expect(hash).not.toContain(token);
  });

  it("verifies tokens against stored hashes", () => {
    const token = generateCaptainToken();
    expect(tokenMatchesHash(token, hashCaptainToken(token))).toBe(true);
    expect(tokenMatchesHash(generateCaptainToken(), hashCaptainToken(token))).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(isWellFormedToken("short")).toBe(false);
    expect(isWellFormedToken("a".repeat(42) + "/")).toBe(false);
  });
});
