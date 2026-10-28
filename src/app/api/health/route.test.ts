import { describe, expect, it } from "vitest";
import { GET } from "./route";

describe("GET /api/health", () => {
  it("answers ok without revealing configuration", async () => {
    const response = GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });
});
