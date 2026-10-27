import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { CleanupDeps } from "./cleanup";

/** Supabase-backed cleanup operations (service role). */
export function createCleanupDeps(db = createSupabaseAdminClient()): CleanupDeps {
  return {
    async deleteSandboxTournaments(cutoff) {
      const { count, error } = await db
        .from("tournaments")
        .delete({ count: "exact" })
        .eq("is_sandbox", true)
        .lt("created_at", cutoff.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    async listExpiredSandboxOrganizers(cutoff, limit) {
      const { data, error } = await db
        .from("organizer_profiles")
        .select("id")
        .eq("is_sandbox", true)
        .lt("created_at", cutoff.toISOString())
        .order("created_at")
        .limit(limit);
      if (error) throw error;
      return data.map((row) => row.id);
    },
    async deleteUser(id) {
      const { error } = await db.auth.admin.deleteUser(id);
      // Already gone (for example deleted by hand): nothing left to do.
      if (error && error.status !== 404) throw error;
    },
    async deleteRateLimitsBefore(cutoff) {
      const { count, error } = await db.from("rate_limits").delete({ count: "exact" }).lt("window_start", cutoff.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
  };
}
