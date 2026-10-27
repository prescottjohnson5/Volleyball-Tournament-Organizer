import { describe, expect, it, vi } from "vitest";
import { VersionConflictError, withVersionRetry } from "./commit";

describe("withVersionRetry", () => {
  it("retries version conflicts and returns the first success", async () => {
    const attempt = vi.fn().mockRejectedValueOnce(new VersionConflictError()).mockResolvedValueOnce("ok");
    await expect(withVersionRetry(attempt)).resolves.toBe("ok");
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  it("gives up after the retry budget", async () => {
    const attempt = vi.fn().mockRejectedValue(new VersionConflictError());
    await expect(withVersionRetry(attempt, 2)).rejects.toBeInstanceOf(VersionConflictError);
    expect(attempt).toHaveBeenCalledTimes(3);
  });

  it("does not retry other errors", async () => {
    const attempt = vi.fn().mockRejectedValue(new Error("boom"));
    await expect(withVersionRetry(attempt)).rejects.toThrow("boom");
    expect(attempt).toHaveBeenCalledTimes(1);
  });
});
