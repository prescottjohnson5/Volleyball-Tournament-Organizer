import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps same-site paths", () => {
    expect(safeNextPath("/dashboard/tournaments/abc")).toBe("/dashboard/tournaments/abc");
  });

  it.each([null, undefined, "", "https://evil.example", "//evil.example", "/\\evil.example"])(
    "falls back to /dashboard for %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/dashboard");
    },
  );
});
