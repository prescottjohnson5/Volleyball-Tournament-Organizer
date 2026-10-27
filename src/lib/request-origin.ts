import "server-only";
import { headers } from "next/headers";
import { getAppUrl } from "@/lib/env";

/** Public base URL for links shown in server components: NEXT_PUBLIC_APP_URL, else the request host. */
export async function getPublicBaseUrl(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return getAppUrl(`${proto}://${host}`);
}
