import "server-only";
import {
  envProblems,
  getSupabasePublicEnv,
  getSupabaseServiceRoleKey,
  isPaymentsEnabled,
  SUPABASE_SERVER_VARS,
  type EnvName,
} from "@/lib/env";

export type CheckStatus = "ok" | "warn" | "fail";

/** One line of the setup check. `detail` says what to do about a problem and never contains a secret. */
export interface SetupCheck {
  label: string;
  status: CheckStatus;
  detail: string;
}

type Fetch = typeof fetch;
type Reply = { status: number; body: { code?: string; message?: string; [key: string]: unknown } } | { networkError: string };

const TIMEOUT_MS = 6000;

/** Every table and column the app reads, with the migration that creates it. */
export const SCHEMA_CHECKS = [
  { migration: "0001_schema.sql", table: "organizer_profiles", select: "id" },
  { migration: "0001_schema.sql", table: "tournaments", select: "id" },
  { migration: "0001_schema.sql", table: "teams", select: "id" },
  { migration: "0001_schema.sql", table: "team_private", select: "team_id" },
  { migration: "0001_schema.sql", table: "matches", select: "id" },
  { migration: "0001_schema.sql", table: "match_sets", select: "id" },
  { migration: "0001_schema.sql", table: "stripe_events", select: "id" },
  { migration: "0006_rate_limits.sql", table: "rate_limits", select: "key" },
  { migration: "0007_sandbox.sql", table: "tournaments", select: "is_sandbox" },
  { migration: "0007_sandbox.sql", table: "organizer_profiles", select: "is_sandbox" },
] as const;

async function get(fetchFn: Fetch, url: string, key: string): Promise<Reply> {
  try {
    const response = await fetchFn(url, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const body = (await response.json().catch(() => ({}))) as Extract<Reply, { status: number }>["body"];
    return { status: response.status, body: body ?? {} };
  } catch (error) {
    return { networkError: error instanceof Error && error.name === "TimeoutError" ? "it did not answer within 6 seconds" : "the request failed" };
  }
}

function rejectedKey(reply: Reply): boolean {
  return "status" in reply && (reply.status === 401 || reply.status === 403);
}

function missingObject(reply: Reply): boolean {
  // PGRST205: table not in the schema cache. 42P01: undefined table. 42703: undefined column.
  return "status" in reply && ["PGRST205", "42P01", "42703"].includes(reply.body.code ?? "");
}

/** Checks the Supabase connection piece by piece, so the page can say exactly which step is wrong. */
export async function runSetupChecks({ requestOrigin, fetchFn = fetch }: { requestOrigin: string; fetchFn?: Fetch }): Promise<SetupCheck[]> {
  const checks: SetupCheck[] = [];
  const required: EnvName[] = [...SUPABASE_SERVER_VARS];
  if (isPaymentsEnabled()) required.push("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET");

  const problems = envProblems(required);
  for (const { name, problem } of problems) checks.push({ label: name, status: "fail", detail: problem });
  if (problems.length === 0) checks.push({ label: "Settings", status: "ok", detail: "Every required variable is set and looks right." });

  const cron = envProblems(["CRON_SECRET"])[0];
  if (cron) {
    checks.push({ label: "CRON_SECRET", status: "warn", detail: `${cron.problem} Optional: without it the daily cleanup of online sandbox data is off.` });
  }

  const appUrlProblem = envProblems(["NEXT_PUBLIC_APP_URL"])[0];
  if (appUrlProblem?.problem === "Not set.") {
    checks.push({
      label: "NEXT_PUBLIC_APP_URL",
      status: "warn",
      detail: `Not set, so links and QR codes use the address the visitor opened (${requestOrigin}). Fine locally; on the live server set it to the site address, like https://yourdomain.click.`,
    });
  } else if (appUrlProblem) {
    checks.push({ label: "NEXT_PUBLIC_APP_URL", status: "fail", detail: appUrlProblem.problem });
  } else {
    const appOrigin = new URL(process.env.NEXT_PUBLIC_APP_URL!.trim()).origin;
    if (appOrigin !== requestOrigin) {
      checks.push({
        label: "NEXT_PUBLIC_APP_URL",
        status: "warn",
        detail: `It is ${appOrigin}, but you opened this page at ${requestOrigin}. Sign-up links, QR codes and emails will point at ${appOrigin}. Change it if this is the live site, then rebuild.`,
      });
    }
  }

  if (problems.some((p) => (SUPABASE_SERVER_VARS as readonly string[]).includes(p.name))) {
    checks.push({ label: "Supabase connection", status: "fail", detail: "Not tested until the Supabase settings above are fixed." });
    return checks;
  }

  const { url, anonKey } = getSupabasePublicEnv();
  const serviceKey = getSupabaseServiceRoleKey();
  const host = new URL(url).host;

  const auth = await get(fetchFn, `${url}/auth/v1/settings`, anonKey);
  if ("networkError" in auth) {
    checks.push({
      label: "Supabase connection",
      status: "fail",
      detail: `Could not reach ${host}: ${auth.networkError}. Check NEXT_PUBLIC_SUPABASE_URL, and that the project is not paused (free projects pause after a week without use; restore it from the Supabase dashboard).`,
    });
    return checks;
  }
  if (rejectedKey(auth)) {
    checks.push({ label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "fail", detail: `Supabase at ${host} rejected this key. Copy the anon (publishable) key of this project again.` });
    return checks;
  }
  if (auth.status !== 200) {
    checks.push({
      label: "Supabase connection",
      status: "fail",
      detail: `${host} answered with HTTP ${auth.status}, so it does not look like a Supabase project. Use the Project URL from Project Settings → Data API.`,
    });
    return checks;
  }
  checks.push({ label: "Supabase connection", status: "ok", detail: `Connected to ${host}; the anon key was accepted.` });

  const external = (auth.body.external ?? {}) as Record<string, unknown>;
  if (external.anonymous_users === false) {
    checks.push({
      label: "Anonymous sign-ins",
      status: "warn",
      detail: "Off. Only the optional online sandbox needs them (Authentication → Sign In / Providers → Allow anonymous sign-ins). The browser sandbox works either way.",
    });
  } else if (external.anonymous_users === true) {
    checks.push({ label: "Anonymous sign-ins", status: "ok", detail: "On, so the online sandbox can start." });
  }

  const replies = await Promise.all(
    SCHEMA_CHECKS.map((check) => get(fetchFn, `${url}/rest/v1/${check.table}?select=${check.select}&limit=0`, serviceKey)),
  );
  if (replies.some(rejectedKey)) {
    checks.push({ label: "SUPABASE_SERVICE_ROLE_KEY", status: "fail", detail: `Supabase at ${host} rejected this key. Copy the service_role (secret) key of this project again.` });
    return checks;
  }

  const migrations = [...new Set(SCHEMA_CHECKS.map((check) => check.migration))];
  for (const migration of migrations) {
    const missing: string[] = [];
    const errors: string[] = [];
    SCHEMA_CHECKS.forEach((check, i) => {
      if (check.migration !== migration) return;
      const reply = replies[i];
      const name = check.select === "is_sandbox" ? `${check.table}.is_sandbox` : check.table;
      if (missingObject(reply)) missing.push(name);
      else if ("networkError" in reply) errors.push(`${name}: ${reply.networkError}`);
      else if (reply.status !== 200) errors.push(`${name}: ${reply.body.message ?? `HTTP ${reply.status}`}`);
    });
    if (missing.length > 0) {
      checks.push({
        label: `Migration ${migration}`,
        status: "fail",
        detail: `Missing ${missing.join(", ")}. Open the SQL Editor in Supabase, paste the whole of supabase/migrations/${migration} and press Run, then run any later files you skipped, in order.`,
      });
    } else if (errors.length > 0) {
      checks.push({ label: `Migration ${migration}`, status: "fail", detail: `Could not check: ${errors.join("; ")}.` });
    } else {
      checks.push({ label: `Migration ${migration}`, status: "ok", detail: "Its tables and columns are there." });
    }
  }

  return checks;
}
