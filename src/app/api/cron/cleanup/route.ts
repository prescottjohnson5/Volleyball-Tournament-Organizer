import { createCleanupDeps } from "@/lib/cleanup/cleanup-deps";
import { cleanupSandbox, isAuthorizedCronRequest } from "@/lib/cleanup/cleanup";
import { getCronSecret } from "@/lib/env";
import { HttpError, route } from "@/lib/http";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Daily cleanup (see vercel.json): deletes sandbox users and tournaments older than 24 hours and
 * old rate-limit counters. Requires `Authorization: Bearer <CRON_SECRET>`, which Vercel Cron sends
 * automatically when the CRON_SECRET environment variable is set. Without CRON_SECRET it answers 503.
 */
export const GET = route(async (request: Request) => {
  const secret = getCronSecret();
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) throw new HttpError(401, "Unauthorized.");
  return Response.json(await cleanupSandbox(createCleanupDeps()));
});
