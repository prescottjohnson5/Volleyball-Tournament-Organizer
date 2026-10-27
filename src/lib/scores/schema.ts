import { z } from "zod";

const score = z.number().int().min(0).max(99);

/** One set reported by a captain. */
export const captainSetSchema = z.object({
  setNumber: z.number().int().min(1).max(5),
  scoreA: score,
  scoreB: score,
});

/** The organizer's full replacement of a match's sets (empty list clears the match). */
export const overrideSetsSchema = z.object({
  sets: z.array(z.object({ a: score, b: score })).max(5),
});

/** Extracts the captain token from "Authorization: Bearer <token>". */
export function bearerToken(header: string | null): string | null {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match ? match[1] : null;
}
