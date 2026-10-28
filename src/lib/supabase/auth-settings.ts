import "server-only";
import { envProblems, getSupabasePublicEnv, SUPABASE_SERVER_VARS } from "@/lib/env";

/**
 * Whether the online sandbox can start: Supabase is configured and anonymous sign-ins are on. Read from
 * the public Auth settings endpoint and cached for five minutes, so pages can hide a button that would
 * only fail. False whenever it cannot be confirmed.
 */
export async function onlineSandboxAvailable(): Promise<boolean> {
  if (envProblems(SUPABASE_SERVER_VARS).length > 0) return false;
  const { url, anonKey } = getSupabasePublicEnv();
  try {
    const response = await fetch(`${url}/auth/v1/settings`, {
      headers: { apikey: anonKey },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!response.ok) return false;
    const settings = (await response.json()) as { external?: { anonymous_users?: boolean } };
    return settings.external?.anonymous_users === true;
  } catch {
    return false;
  }
}
