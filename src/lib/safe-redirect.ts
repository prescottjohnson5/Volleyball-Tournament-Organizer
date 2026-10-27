/** Only allow same-site relative redirects after sign-in (prevents open redirects). */
export function safeNextPath(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "/dashboard";
  return next;
}
