import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { MissingEnvError } from "@/lib/env";
import { UserFacingError } from "@/lib/errors";

/** An error whose message is safe to show to the caller. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    /** Extra response headers, such as Retry-After. */
    public readonly headers: Record<string, string> = {},
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, ...(details ? { details } : {}) }, { status });
}

/** Converts thrown errors into JSON responses with the right status and no internal details. */
export function toErrorResponse(error: unknown) {
  if (error instanceof HttpError) {
    const response = jsonError(error.status, error.message);
    for (const [name, value] of Object.entries(error.headers)) response.headers.set(name, value);
    return response;
  }
  if (error instanceof MissingEnvError) return jsonError(503, error.message);
  if (error instanceof UserFacingError) return jsonError(error.status, error.message);
  if (error instanceof ZodError) {
    const first = error.issues[0];
    const field = first?.path.join(".");
    return jsonError(400, field ? `${field}: ${first.message}` : (first?.message ?? "Invalid input"), error.issues);
  }
  console.error("Unhandled route error:", error instanceof Error ? error.message : error);
  return jsonError(500, "Something went wrong. Please try again.");
}

/** Wraps a route handler so every failure becomes a clean JSON error response. */
export function route<Args extends unknown[]>(handler: (...args: Args) => Promise<Response>) {
  return async (...args: Args): Promise<Response> => {
    try {
      return await handler(...args);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new HttpError(400, "Request body must be JSON");
  }
}
