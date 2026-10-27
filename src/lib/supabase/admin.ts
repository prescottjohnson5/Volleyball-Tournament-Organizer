import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv, getSupabaseServiceRoleKey } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Service-role client. Bypasses Row Level Security, so it is only used inside server routes
 * after the caller has been authorized (organizer session or captain token).
 * The `server-only` import makes the build fail if this module is ever bundled for the browser.
 */
export function createSupabaseAdminClient(): SupabaseClient<Database> {
  const { url } = getSupabasePublicEnv();
  return createClient<Database>(url, getSupabaseServiceRoleKey(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
