import { z } from "zod";
import { UserFacingError } from "@/lib/errors";
import { SANDBOX_MAX_TEAMS } from "@/lib/sandbox";
import { poolOptionsSchema } from "@/lib/formats/pool-play";
import type { Json, TournamentRow } from "@/lib/supabase/database.types";

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use the format YYYY-MM-DD")
  .refine((value) => {
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
  }, "Not a real calendar date");

/** What the organizer submits when creating or editing a tournament. */
export const tournamentInputSchema = z.object({
  name: z.string().trim().min(3, "Name must be at least 3 characters").max(100),
  eventDate: isoDate,
  location: z.string().trim().min(1, "Location is required").max(200),
  environment: z.enum(["indoor", "outdoor"]),
  format: z.enum(["pool_to_single_elim", "double_elim"]),
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  maxTeams: z.number().int().min(3, "At least 3 teams").max(64, "At most 64 teams"),
  registrationFeeCents: z
    .number()
    .int()
    .min(100, "The registration fee must be at least $1.00")
    .max(1_000_000, "The registration fee must be at most $10,000")
    .optional(),
  poolOptions: poolOptionsSchema.optional(),
});

export type TournamentInput = z.infer<typeof tournamentInputSchema>;

/**
 * Validates organizer input. The fee is only kept when fees are collected (payments on, and not a
 * sandbox organizer); otherwise it is dropped, so a new tournament is free and an edit leaves the
 * stored fee alone. Sandbox organizers are also limited to SANDBOX_MAX_TEAMS teams.
 */
export function parseTournamentInput(raw: unknown, { withFee, sandbox = false }: { withFee: boolean; sandbox?: boolean }): TournamentInput {
  const input = tournamentInputSchema.parse(raw);
  if (sandbox && input.maxTeams > SANDBOX_MAX_TEAMS) {
    throw new UserFacingError(`Sandbox tournaments can have at most ${SANDBOX_MAX_TEAMS} teams. Create a free account for bigger tournaments.`);
  }
  if (!withFee || sandbox) return { ...input, registrationFeeCents: undefined };
  if (input.registrationFeeCents === undefined) throw new UserFacingError("Enter a registration fee.", 400);
  return input;
}

/** Maps validated input to database columns (shared by create and update). A missing fee is not written. */
export function toTournamentColumns(input: TournamentInput) {
  const formatOptions: Json =
    input.format === "pool_to_single_elim" ? poolOptionsSchema.parse(input.poolOptions ?? {}) : {};
  return {
    name: input.name,
    event_date: input.eventDate,
    location: input.location,
    environment: input.environment,
    format: input.format,
    format_options: formatOptions,
    best_of: input.bestOf,
    max_teams: input.maxTeams,
    ...(input.registrationFeeCents === undefined ? {} : { registration_fee_cents: input.registrationFeeCents }),
  } satisfies Partial<TournamentRow>;
}

/** Inverse of toTournamentColumns, used to pre-fill the edit form. */
export function toTournamentInput(row: TournamentRow): TournamentInput {
  const poolOptions = poolOptionsSchema.safeParse(row.format_options);
  return {
    name: row.name,
    eventDate: row.event_date,
    location: row.location,
    environment: row.environment,
    format: row.format,
    bestOf: row.best_of as 1 | 3 | 5,
    maxTeams: row.max_teams,
    registrationFeeCents: row.registration_fee_cents,
    poolOptions: poolOptions.success ? poolOptions.data : undefined,
  };
}
