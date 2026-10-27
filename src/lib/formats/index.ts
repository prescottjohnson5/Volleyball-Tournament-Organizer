import type { FormatId } from "@/lib/supabase/database.types";
import { doubleEliminationFormat } from "./double-elimination";
import { poolPlayFormat } from "./pool-play";
import type { TournamentFormat } from "./types";

/** Every available format. Adding a format = one module implementing TournamentFormat + one entry here. */
export const FORMATS: Record<FormatId, TournamentFormat> = {
  pool_to_single_elim: poolPlayFormat,
  double_elim: doubleEliminationFormat,
};

export function getFormat(id: FormatId): TournamentFormat {
  const format = FORMATS[id];
  if (!format) throw new Error(`Unknown tournament format: ${id}`);
  return format;
}

export type { FormatPlan, FormatState, PlannedTeam, TournamentFormat } from "./types";
