import { getOrganizer } from "@/lib/auth";
import { authErrorToHttp } from "@/lib/auth-errors";
import { route } from "@/lib/http";
import { enforceRateLimit } from "@/lib/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * "Try it": signs the visitor in with a Supabase anonymous sign-in and creates a sandbox organizer,
 * so they can use the real app without an account. Sandbox data is deleted daily
 * (/api/cron/cleanup). Someone already signed in just keeps their session.
 */
export const POST = route(async (request: Request) => {
  if (await getOrganizer()) return Response.json({ ok: true });
  await enforceRateLimit(request, "sandbox");

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw authErrorToHttp(error);
  if (!data.user) throw new Error("Supabase returned no user for the anonymous sign-in");

  const admin = createSupabaseAdminClient();
  const { error: profileError } = await admin.from("organizer_profiles").upsert({ id: data.user.id, is_sandbox: true });
  if (profileError) {
    // Without a sandbox profile the cleanup job would never find this user, so remove it now.
    await admin.auth.admin.deleteUser(data.user.id);
    throw profileError;
  }
  return Response.json({ ok: true }, { status: 201 });
});
