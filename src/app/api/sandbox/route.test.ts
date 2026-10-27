import { AuthApiError } from "@supabase/supabase-js";
import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";

const mocks = vi.hoisted(() => ({
  getOrganizer: vi.fn(async () => null as unknown),
  enforceRateLimit: vi.fn(),
  signInAnonymously: vi.fn(async () => ({ data: { user: { id: "anon-1" } }, error: null as unknown })),
  upsert: vi.fn<(row: unknown) => Promise<{ error: unknown }>>(async () => ({ error: null })),
  deleteUser: vi.fn(async () => ({ error: null })),
}));

vi.mock("@/lib/auth", () => ({ getOrganizer: mocks.getOrganizer }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { signInAnonymously: mocks.signInAnonymously } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({ upsert: mocks.upsert }),
    auth: { admin: { deleteUser: mocks.deleteUser } },
  }),
}));

afterEach(() => vi.clearAllMocks());

describe("POST /api/sandbox", async () => {
  const { POST } = await import("./route");
  const call = () => POST(new Request("http://localhost/api/sandbox", { method: "POST" }));

  it("signs the visitor in anonymously and creates a sandbox organizer", async () => {
    const response = await call();
    expect(response.status).toBe(201);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "sandbox");
    expect(mocks.upsert).toHaveBeenCalledWith({ id: "anon-1", is_sandbox: true });
  });

  it("keeps an existing session instead of creating another user", async () => {
    mocks.getOrganizer.mockResolvedValueOnce({ id: "org-1", email: "o@example.com", isSandbox: false });
    expect((await call()).status).toBe(200);
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("is rate limited", async () => {
    mocks.enforceRateLimit.mockRejectedValueOnce(new HttpError(429, "Too many attempts"));
    expect((await call()).status).toBe(429);
    expect(mocks.signInAnonymously).not.toHaveBeenCalled();
  });

  it("explains when anonymous sign-ins are switched off in Supabase", async () => {
    mocks.signInAnonymously.mockResolvedValueOnce({
      data: { user: null } as never,
      error: new AuthApiError("Anonymous sign-ins are disabled", 422, "anonymous_provider_disabled"),
    });
    const response = await call();
    expect(response.status).toBe(503);
    expect((await response.json()).error).toMatch(/sandbox is not switched on/);
  });

  it("removes the anonymous user if the sandbox profile cannot be saved", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mocks.upsert.mockResolvedValueOnce({ error: new Error("db down") });
    expect((await call()).status).toBe(500);
    expect(mocks.deleteUser).toHaveBeenCalledWith("anon-1");
    spy.mockRestore();
  });
});
