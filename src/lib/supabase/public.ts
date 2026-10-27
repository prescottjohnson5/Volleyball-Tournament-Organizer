import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Anonymous client with no session, for public pages. Unlike the cookie-based server client, a
 * signed-in organizer browsing a public page still sees exactly what every visitor sees.
 */
export function createSupabasePublicClient(): SupabaseClient<Database> {
  const { url, anonKey } = getSupabasePublicEnv();
  return createClient<Database>(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}
