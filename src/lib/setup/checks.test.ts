import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { runSetupChecks } from "./checks";

const URL_ = "https://abcd.supabase.co";
const ORIGIN = "http://localhost:3000";

function stubConfiguredEnv() {
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", URL_);
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "sb_publishable_test");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "sb_secret_test");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", ORIGIN);
  vi.stubEnv("CRON_SECRET", "a-long-enough-random-secret");
  vi.stubEnv("PAYMENTS_ENABLED", "");
}

type Route = (url: string, key: string) => { status: number; body?: unknown } | "network";

/** A fake fetch that answers like Supabase: the auth settings endpoint and PostgREST tables. */
function fakeFetch(route: Route): typeof fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = new Headers(init?.headers).get("apikey") ?? "";
    const answer = route(String(input), key);
    if (answer === "network") throw new TypeError("fetch failed");
    return new Response(JSON.stringify(answer.body ?? {}), { status: answer.status });
  }) as typeof fetch;
}

const healthy: Route = (url) => (url.includes("/auth/v1/settings") ? { status: 200, body: { external: { anonymous_users: true } } } : { status: 200, body: [] });

beforeEach(stubConfiguredEnv);
afterEach(() => vi.unstubAllEnvs());

describe("runSetupChecks", () => {
  it("reports every step as OK on a healthy project", async () => {
    const checks = await runSetupChecks({ requestOrigin: ORIGIN, fetchFn: fakeFetch(healthy) });
    expect(checks.every((c) => c.status === "ok")).toBe(true);
    expect(checks.map((c) => c.label)).toEqual([
      "Settings",
      "Supabase connection",
      "Anonymous sign-ins",
      "Migration 0001_schema.sql",
      "Migration 0006_rate_limits.sql",
      "Migration 0007_sandbox.sql",
    ]);
  });

  it("does not call Supabase while its settings are wrong", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://supabase.com/dashboard/project/abcd");
    const fetchFn = vi.fn();
    const checks = await runSetupChecks({ requestOrigin: ORIGIN, fetchFn });
    expect(fetchFn).not.toHaveBeenCalled();
    expect(checks[0]).toMatchObject({ label: "NEXT_PUBLIC_SUPABASE_URL", status: "fail" });
    expect(checks.at(-1)).toMatchObject({ label: "Supabase connection", status: "fail" });
  });

  it("explains an unreachable or paused project", async () => {
    const checks = await runSetupChecks({ requestOrigin: ORIGIN, fetchFn: fakeFetch(() => "network") });
    expect(checks.at(-1)).toMatchObject({ label: "Supabase connection", status: "fail" });
    expect(checks.at(-1)!.detail).toMatch(/paused/);
  });

  it("names the key Supabase rejected", async () => {
    const anonRejected = await runSetupChecks({ requestOrigin: ORIGIN, fetchFn: fakeFetch(() => ({ status: 401 })) });
    expect(anonRejected.at(-1)).toMatchObject({ label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", status: "fail" });

    const serviceRejected = await runSetupChecks({
      requestOrigin: ORIGIN,
      fetchFn: fakeFetch((url, key) => (key === "sb_secret_test" ? { status: 401 } : healthy(url, key))),
    });
    expect(serviceRejected.at(-1)).toMatchObject({ label: "SUPABASE_SERVICE_ROLE_KEY", status: "fail" });
  });

  it("says which migration to run for missing tables and columns", async () => {
    const checks = await runSetupChecks({
      requestOrigin: ORIGIN,
      fetchFn: fakeFetch((url, key) => {
        if (url.includes("/rest/v1/rate_limits")) return { status: 404, body: { code: "PGRST205" } };
        if (url.includes("select=is_sandbox")) return { status: 400, body: { code: "42703" } };
        return healthy(url, key);
      }),
    });
    const byLabel = Object.fromEntries(checks.map((c) => [c.label, c]));
    expect(byLabel["Migration 0001_schema.sql"].status).toBe("ok");
    expect(byLabel["Migration 0006_rate_limits.sql"]).toMatchObject({ status: "fail" });
    expect(byLabel["Migration 0006_rate_limits.sql"].detail).toMatch(/Missing rate_limits.*0006_rate_limits\.sql/);
    expect(byLabel["Migration 0007_sandbox.sql"].detail).toMatch(/tournaments\.is_sandbox, organizer_profiles\.is_sandbox/);
  });

  it("notes an app URL that differs from the address in use, and optional settings that are off", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const checks = await runSetupChecks({
      requestOrigin: "https://volley.click",
      fetchFn: fakeFetch((url, key) => (url.includes("/auth/v1/settings") ? { status: 200, body: { external: { anonymous_users: false } } } : healthy(url, key))),
    });
    const warnings = checks.filter((c) => c.status === "warn").map((c) => c.label);
    expect(warnings).toEqual(["CRON_SECRET", "NEXT_PUBLIC_APP_URL", "Anonymous sign-ins"]);
    expect(checks.some((c) => c.status === "fail")).toBe(false);
  });

  it("treats a missing app URL as a note, since links fall back to the address in use", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const checks = await runSetupChecks({ requestOrigin: ORIGIN, fetchFn: fakeFetch(healthy) });
    expect(checks.find((c) => c.label === "NEXT_PUBLIC_APP_URL")).toMatchObject({ status: "warn" });
    expect(checks.some((c) => c.status === "fail")).toBe(false);
  });
});
