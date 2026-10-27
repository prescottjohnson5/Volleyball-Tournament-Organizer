import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Captain links look like /captain/<token>. The token is 32 random bytes (256 bits), so it cannot
 * be guessed; only its SHA-256 hash is stored, so a database leak does not reveal working links.
 * A fast hash is fine here because the input is random, not a human-chosen password.
 */
export function generateCaptainToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCaptainToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** Rejects obviously malformed tokens before touching the database. */
export function isWellFormedToken(token: string): boolean {
  return /^[A-Za-z0-9_-]{43}$/.test(token);
}

export function tokenMatchesHash(token: string, hash: string): boolean {
  const actual = Buffer.from(hashCaptainToken(token), "hex");
  const expected = Buffer.from(hash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
