import "server-only";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/** isSandbox: signed in through "Try it" (a Supabase anonymous sign-in); their data is deleted daily. */
export type Organizer = { id: string; email: string | null; isSandbox: boolean };

/** The signed-in organizer, verified against Supabase Auth, or null. */
export async function getOrganizer(): Promise<Organizer | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) return null;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;
  return { id: data.claims.sub, email, isSandbox: data.claims.is_anonymous === true };
}

/** For pages: redirects to /login when nobody is signed in. */
export async function requireOrganizer(nextPath = "/dashboard"): Promise<Organizer> {
  const organizer = await getOrganizer();
  if (!organizer) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return organizer;
}
