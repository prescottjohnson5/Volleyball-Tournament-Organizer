import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { HttpError } from "@/lib/http";
import type { Database, Json } from "@/lib/supabase/database.types";
import type { CommitChanges } from "./rows";

type Db = SupabaseClient<Database>;

export class VersionConflictError extends HttpError {
  constructor() {
    super(409, "Someone else updated this tournament at the same moment. Please try again.");
    this.name = "VersionConflictError";
  }
}

/** Writes a batch of changes atomically, failing if the tournament changed since it was read. */
export async function commitTournamentChanges(db: Db, tournamentId: string, expectedVersion: number, changes: CommitChanges): Promise<number> {
  const { data, error } = await db.rpc("commit_tournament_changes", {
    p_tournament_id: tournamentId,
    p_expected_version: expectedVersion,
    p_changes: changes as unknown as Json,
  });
  if (error) {
    if (error.message.includes("version_conflict")) throw new VersionConflictError();
    throw error;
  }
  return data;
}

/**
 * Runs read → plan → commit, retrying from a fresh read when another write got there first.
 * Score reports are small and fast, so a couple of retries resolve almost every collision.
 */
export async function withVersionRetry<T>(attempt: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await attempt();
    } catch (error) {
      if (!(error instanceof VersionConflictError) || i >= retries) throw error;
    }
  }
}
