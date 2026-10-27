import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  organizer: { id: "org-1", email: null as string | null, isSandbox: true },
  existing: 0,
  insert: vi.fn<(row: Record<string, unknown>) => { error: { code: string; message: string } | null }>(() => ({ error: null })),
}));

vi.mock("@/lib/tournaments/server", () => ({ requireOrganizerForApi: async () => mocks.organizer }));
vi.mock("@/lib/supabase/admin", () => ({
  createSupabaseAdminClient: () => ({
    from: () => ({
      select: () => ({ eq: async () => ({ count: mocks.existing, error: null }) }),
      insert: (row: Record<string, unknown>) => ({
        select: () => ({
          single: async () => {
            const { error } = mocks.insert(row);
            return error ? { data: null, error } : { data: { id: "t-1", slug: "cup-abc" }, error: null };
          },
        }),
      }),
    }),
  }),
}));

const body = {
  name: "Sandbox Cup",
  eventDate: "2026-07-01",
  location: "Gym",
  environment: "indoor",
  format: "double_elim",
  bestOf: 3,
  maxTeams: 8,
  registrationFeeCents: 2500,
};

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  mocks.existing = 0;
  mocks.organizer.isSandbox = true;
});

describe("POST /api/tournaments", async () => {
  const { POST } = await import("./route");
  const call = (overrides: object = {}) =>
    POST(new Request("http://localhost/api/tournaments", { method: "POST", body: JSON.stringify({ ...body, ...overrides }) }));

  it("creates a free sandbox tournament even when payments are on", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    expect((await call()).status).toBe(201);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ is_sandbox: true, registration_fee_cents: 0, max_teams: 8 });
  });

  it("refuses more than 8 teams for a sandbox organizer", async () => {
    const response = await call({ maxTeams: 9 });
    expect(response.status).toBe(422);
    expect((await response.json()).error).toMatch(/at most 8 teams/);
  });

  it("refuses a second sandbox tournament", async () => {
    mocks.existing = 1;
    const response = await call();
    expect(response.status).toBe(409);
    expect(mocks.insert).not.toHaveBeenCalled();
  });

  it("turns the database's one-per-sandbox guard into the same message", async () => {
    mocks.insert.mockReturnValueOnce({
      error: { code: "23505", message: 'duplicate key value violates unique constraint "tournaments_one_per_sandbox_organizer"' },
    });
    const response = await call();
    expect(response.status).toBe(409);
    expect((await response.json()).error).toMatch(/one tournament/);
  });

  it("keeps the fee for regular organizers when payments are on", async () => {
    vi.stubEnv("PAYMENTS_ENABLED", "true");
    mocks.organizer.isSandbox = false;
    mocks.existing = 5;
    expect((await call({ maxTeams: 32 })).status).toBe(201);
    expect(mocks.insert.mock.calls[0][0]).toMatchObject({ is_sandbox: false, registration_fee_cents: 2500 });
  });
});
