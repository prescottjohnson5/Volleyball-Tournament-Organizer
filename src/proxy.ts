import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envProblems, getSupabasePublicEnv, SUPABASE_SERVER_VARS } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";

/**
 * Refreshes the organizer's Supabase session cookie and keeps signed-out visitors out of
 * /dashboard. Public pages (tournament view, registration, captain links) do not run this.
 */
export async function proxy(request: NextRequest) {
  // Without a working Supabase configuration nobody can sign in. Send dashboard visitors to the log-in
  // page, which explains this and offers the browser sandbox instead.
  if (envProblems(SUPABASE_SERVER_VARS).length > 0) {
    return request.nextUrl.pathname.startsWith("/dashboard") ? redirectToLogin(request) : NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });
  const { url, anonKey } = getSupabasePublicEnv();

  const supabase = createServerClient<Database>(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // getClaims() validates the JWT; do not trust getSession() on the server.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  if (!signedIn && request.nextUrl.pathname.startsWith("/dashboard")) return redirectToLogin(request);

  return response;
}

function redirectToLogin(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(request.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup", "/auth/:path*"],
};
