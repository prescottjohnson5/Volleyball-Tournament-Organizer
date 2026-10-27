import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { MissingEnvError } from "./env";
import { HttpError, route, toErrorResponse } from "./http";

describe("toErrorResponse", () => {
  it("passes through HttpError status and message", async () => {
    const res = toErrorResponse(new HttpError(403, "Not your tournament"));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "Not your tournament" });
  });

  it("maps missing env vars to 503 naming the variable", async () => {
    const res = toErrorResponse(new MissingEnvError("STRIPE_SECRET_KEY"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toContain("STRIPE_SECRET_KEY");
  });

  it("maps validation errors to 400 with the field name", async () => {
    const result = z.object({ name: z.string().min(3) }).safeParse({ name: "x" });
    const res = toErrorResponse(result.error);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toMatch(/^name:/);
  });

  it("hides unexpected errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = toErrorResponse(new Error("db password is hunter2"));
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("hunter2");
    spy.mockRestore();
  });
});

describe("route", () => {
  it("returns the handler response or a JSON error", async () => {
    const ok = route(async () => Response.json({ ok: true }));
    expect((await ok()).status).toBe(200);
    const failing = route(async () => {
      throw new HttpError(404, "Not found");
    });
    expect((await failing()).status).toBe(404);
  });
});
