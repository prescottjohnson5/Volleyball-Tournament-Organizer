import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const deps = vi.hoisted(() => ({
  deleteSandboxTournaments: vi.fn(async () => 1),
  listExpiredSandboxOrganizers: vi.fn(async () => ["u1"]),
  deleteUser: vi.fn(async () => {}),
  deleteRateLimitsBefore: vi.fn(async () => 0),
}));
vi.mock("@/lib/cleanup/cleanup-deps", () => ({ createCleanupDeps: () => deps }));

const SECRET = "a-long-enough-random-secret";
const get = (authorization?: string) =>
  new Request("http://localhost/api/cron/cleanup", { headers: authorization ? { authorization } : {} });

beforeEach(() => vi.stubEnv("CRON_SECRET", SECRET));
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

describe("GET /api/cron/cleanup", async () => {
  const { GET } = await import("./route");

  it("runs the cleanup with the right secret", async () => {
    const response = await GET(get(`Bearer ${SECRET}`));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ tournamentsDeleted: 1, usersDeleted: 1 });
  });

  it("rejects missing or wrong secrets without deleting anything", async () => {
    expect((await GET(get())).status).toBe(401);
    expect((await GET(get("Bearer wrong-secret-of-some-length"))).status).toBe(401);
    expect(deps.deleteSandboxTournaments).not.toHaveBeenCalled();
  });

  it("refuses to run at all when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const response = await GET(get("Bearer "));
    expect(response.status).toBe(503);
    expect((await response.json()).error).toContain("CRON_SECRET");
    expect(deps.deleteSandboxTournaments).not.toHaveBeenCalled();
  });
});
