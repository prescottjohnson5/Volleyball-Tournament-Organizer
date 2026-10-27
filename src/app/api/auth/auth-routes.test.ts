import { afterEach, describe, expect, it, vi } from "vitest";
import { HttpError } from "@/lib/http";

const rateLimit = vi.hoisted(() => ({ enforceRateLimit: vi.fn() }));
const supabase = vi.hoisted(() => ({
  auth: {
    signUp: vi.fn(async () => ({ data: { session: { access_token: "x" } }, error: null })),
    signInWithPassword: vi.fn(async () => ({ data: {}, error: null })),
  },
}));
vi.mock("@/lib/rate-limit", () => rateLimit);
vi.mock("@/lib/supabase/server", () => ({ createSupabaseServerClient: async () => supabase }));

afterEach(() => vi.clearAllMocks());

const post = (path: string, body: unknown) => new Request(`http://localhost${path}`, { method: "POST", body: JSON.stringify(body) });
const credentials = { email: "org@example.com", password: "correct horse" };

describe("POST /api/auth/signup", async () => {
  const { POST } = await import("./signup/route");

  it("signs the organizer in straight away when Supabase returns a session", async () => {
    const response = await POST(post("/api/auth/signup", credentials));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ signedIn: true });
    expect(rateLimit.enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "signUp");
  });

  it("reports signedIn: false if the project still requires email confirmation", async () => {
    supabase.auth.signUp.mockResolvedValueOnce({ data: { session: null }, error: null } as never);
    expect(await (await POST(post("/api/auth/signup", credentials))).json()).toEqual({ signedIn: false });
  });

  it("is rate limited before Supabase is called", async () => {
    rateLimit.enforceRateLimit.mockRejectedValueOnce(new HttpError(429, "Too many attempts"));
    expect((await POST(post("/api/auth/signup", credentials))).status).toBe(429);
    expect(supabase.auth.signUp).not.toHaveBeenCalled();
  });
});

describe("POST /api/auth/signin", async () => {
  const { POST } = await import("./signin/route");

  it("signs in and is rate limited", async () => {
    expect((await POST(post("/api/auth/signin", credentials))).status).toBe(200);
    expect(rateLimit.enforceRateLimit).toHaveBeenCalledWith(expect.any(Request), "signIn");
    rateLimit.enforceRateLimit.mockRejectedValueOnce(new HttpError(429, "Too many attempts"));
    expect((await POST(post("/api/auth/signin", credentials))).status).toBe(429);
    expect(supabase.auth.signInWithPassword).toHaveBeenCalledTimes(1);
  });
});
