export const dynamic = "force-dynamic";

/** For uptime checks and the deploy script: answers once the app is running. Says nothing about its configuration. */
export function GET() {
  return Response.json({ ok: true });
}
