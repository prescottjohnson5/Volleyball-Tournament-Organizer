import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47];

function call(slug: string, query = "") {
  return GET(new Request(`http://localhost:3000/t/${slug}/qr${query}`), { params: Promise.resolve({ slug }) });
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /t/[slug]/qr", () => {
  it("returns a PNG without needing any keys", async () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    const response = await call("summer-slam-ab12cd");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/png");
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect([...bytes.slice(0, 4)]).toEqual(PNG_SIGNATURE);
    expect(response.headers.get("content-disposition")).toBeNull();
  });

  it("offers a download with ?download=1", async () => {
    const response = await call("summer-slam-ab12cd", "?download=1");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="summer-slam-ab12cd-registration-qr.png"');
  });

  it("rejects slugs that could not exist", async () => {
    expect((await call("Bad Slug!")).status).toBe(404);
  });
});
