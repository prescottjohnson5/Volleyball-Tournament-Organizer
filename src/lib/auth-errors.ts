import { isAuthError } from "@supabase/supabase-js";
import { z } from "zod";
import { HttpError } from "@/lib/http";

/** Email and password for sign-up. */
export const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().max(254).pipe(z.email("Enter a valid email address")),
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
});

/** Sign-in only checks the password is present: older accounts may predate the length rule. */
export const signInSchema = credentialsSchema.extend({ password: z.string().min(1, "Enter your password").max(72) });

const FRIENDLY: Record<string, [number, string]> = {
  invalid_credentials: [401, "Wrong email or password."],
  user_already_exists: [409, "An account with this email already exists. Sign in instead."],
  email_exists: [409, "An account with this email already exists. Sign in instead."],
  email_not_confirmed: [403, "This email address has not been confirmed yet. Use the link in the confirmation email, then sign in."],
  signup_disabled: [403, "New organizer sign-ups are turned off on this site."],
  anonymous_provider_disabled: [503, "The sandbox is not switched on for this site yet. Create a free account instead."],
  over_request_rate_limit: [429, "Too many attempts. Please wait a few minutes and try again."],
  over_email_send_rate_limit: [429, "Too many attempts. Please wait a few minutes and try again."],
};

/**
 * Turns a Supabase Auth error into a message for the person signing in. Client errors (4xx) are
 * safe to show; anything else is rethrown and becomes a generic 500.
 */
export function authErrorToHttp(error: unknown): unknown {
  if (!isAuthError(error)) return error;
  const friendly = error.code ? FRIENDLY[error.code] : undefined;
  if (friendly) return new HttpError(...friendly);
  if (error.status === 429) return new HttpError(429, "Too many attempts. Please wait a few minutes and try again.");
  if (error.status && error.status >= 400 && error.status < 500) return new HttpError(error.status, error.message);
  return error;
}
