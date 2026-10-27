import { describe, expect, it, vi } from "vitest";
import { HttpError, toErrorResponse } from "@/lib/http";
import { clientIp, enforceRateLimit, rateLimitMessage, RATE_LIMITS, secondsUntilReset } from "./rate-limit";

const request = (headers: Record<string, string> = { "x-forwarded-for": "203.0.113.7, 10.0.0.1" }) =>
  new Request("http://localhost/api/register/x", { method: "POST", headers });

describe("clientIp", () => {
  it("uses the first x-forwarded-for entry, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.2" }))).toBe("198.51.100.2");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("secondsUntilReset", () => {
  it("counts down to the end of the epoch-aligned window", () => {
    expect(secondsUntilReset(new Date("2026-01-01T00:00:00Z"), 600)).toBe(600);
    expect(secondsUntilReset(new Date("2026-01-01T00:09:30Z"), 600)).toBe(30);
  });
});

describe("rateLimitMessage", () => {
  it("rounds up to whole minutes", () => {
    expect(rateLimitMessage(30)).toMatch(/wait a minute/);
    expect(rateLimitMessage(601)).toMatch(/about 11 minutes/);
  });
});

describe("enforceRateLimit", () => {
  it("allows requests up to the limit", async () => {
    const count = vi.fn(async () => RATE_LIMITS.register.limit);
    await expect(enforceRateLimit(request(), "register", { count })).resolves.toBeUndefined();
  });

  it("keys the counter by limit name and a hash of the IP, never the raw IP", async () => {
    const count = vi.fn(async () => 1);
    await enforceRateLimit(request(), "signUp", { count });
    const [key, windowSeconds] = count.mock.calls[0] as unknown as [string, number];
    expect(key).toMatch(/^signUp:[0-9a-f]{32}$/);
    expect(key).not.toContain("203.0.113.7");
    expect(windowSeconds).toBe(RATE_LIMITS.signUp.windowSeconds);
  });

  it("rejects with a friendly 429 and Retry-After once over the limit", async () => {
    const count = vi.fn(async () => RATE_LIMITS.register.limit + 1);
    const error = await enforceRateLimit(request(), "register", { count, now: new Date("2026-01-01T00:05:00Z") }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(HttpError);
    const response = toErrorResponse(error);
    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect((await response.json()).error).toBe("Too many attempts from your network. Please wait about 5 minutes and try again.");
  });

  it("lets the request through if the counter fails", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const count = vi.fn(async () => {
      throw new Error("db down");
    });
    await expect(enforceRateLimit(request(), "register", { count })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
