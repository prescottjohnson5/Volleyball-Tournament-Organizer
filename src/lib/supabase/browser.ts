import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicEnv } from "@/lib/env";
import type { Database } from "./database.types";

let client: SupabaseClient<Database> | undefined;

/** Browser Supabase client (anon key, RLS applies). Used for sign-in and Realtime. */
export function getSupabaseBrowserClient(): SupabaseClient<Database> {
  if (!client) {
    const { url, anonKey } = getSupabasePublicEnv();
    client = createBrowserClient<Database>(url, anonKey);
  }
  return client;
}
