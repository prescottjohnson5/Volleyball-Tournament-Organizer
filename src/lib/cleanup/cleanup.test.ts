import { describe, expect, it, vi } from "vitest";
import { cleanupSandbox, isAuthorizedCronRequest, USER_BATCH, type CleanupDeps } from "./cleanup";

function fakeDeps(userIds: string[] = ["u1", "u2"]): CleanupDeps {
  return {
    deleteSandboxTournaments: vi.fn(async () => 3),
    listExpiredSandboxOrganizers: vi.fn(async () => userIds),
    deleteUser: vi.fn(async () => {}),
    deleteRateLimitsBefore: vi.fn(async () => 40),
  };
}

const now = new Date("2026-10-27T04:00:00Z");

describe("cleanupSandbox", () => {
  it("deletes sandbox data older than 24 hours and old rate-limit rows", async () => {
    const deps = fakeDeps();
    const result = await cleanupSandbox(deps, now);
    const cutoff = new Date("2026-10-26T04:00:00Z");
    expect(deps.deleteSandboxTournaments).toHaveBeenCalledWith(cutoff);
    expect(deps.listExpiredSandboxOrganizers).toHaveBeenCalledWith(cutoff, USER_BATCH);
    expect(deps.deleteRateLimitsBefore).toHaveBeenCalledWith(cutoff);
    expect(result).toEqual({
      cutoff: "2026-10-26T04:00:00.000Z",
      tournamentsDeleted: 3,
      usersDeleted: 2,
      usersFailed: 0,
      moreUsersRemaining: false,
      rateLimitRowsDeleted: 40,
    });
  });

  it("keeps going when one user cannot be deleted", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const deps = fakeDeps(["u1", "u2", "u3"]);
    vi.mocked(deps.deleteUser).mockRejectedValueOnce(new Error("auth down"));
    const result = await cleanupSandbox(deps, now);
    expect(result).toMatchObject({ usersDeleted: 2, usersFailed: 1 });
    expect(deps.deleteRateLimitsBefore).toHaveBeenCalled();
    spy.mockRestore();
  });

  it("reports when a full batch means more users remain", async () => {
    const ids = Array.from({ length: USER_BATCH }, (_, i) => `u${i}`);
    expect((await cleanupSandbox(fakeDeps(ids), now)).moreUsersRemaining).toBe(true);
  });
});

describe("isAuthorizedCronRequest", () => {
  const secret = "a-long-enough-random-secret";
  it("accepts only the exact bearer secret", () => {
    expect(isAuthorizedCronRequest(`Bearer ${secret}`, secret)).toBe(true);
    expect(isAuthorizedCronRequest(secret, secret)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${secret}x`, secret)).toBe(false);
    expect(isAuthorizedCronRequest(null, secret)).toBe(false);
  });
});
