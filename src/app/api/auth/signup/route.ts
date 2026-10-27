import { authErrorToHttp, credentialsSchema } from "@/lib/auth-errors";
import { getAppUrl } from "@/lib/env";
import { readJson, route } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Creates an organizer account. With "Confirm email" turned off in Supabase (the recommended
 * setup), Supabase returns a session and the organizer is signed in by this response's cookies.
 * If a project does require confirmation, `signedIn` is false and the page says so.
 */
export const POST = route(async (request: Request) => {
  const { email, password } = credentialsSchema.parse(await readJson(request));
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${getAppUrl(new URL(request.url).origin)}/auth/callback?next=/dashboard` },
  });
  if (error) throw authErrorToHttp(error);
  return Response.json({ signedIn: Boolean(data.session) }, { status: 201 });
});
