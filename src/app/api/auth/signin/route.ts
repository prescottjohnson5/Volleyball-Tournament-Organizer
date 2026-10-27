import { authErrorToHttp, signInSchema } from "@/lib/auth-errors";
import { readJson, route } from "@/lib/http";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** Signs an organizer in with email and password; the session is set as cookies on this response. */
export const POST = route(async (request: Request) => {
  const { email, password } = signInSchema.parse(await readJson(request));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw authErrorToHttp(error);
  return Response.json({ signedIn: true });
});
