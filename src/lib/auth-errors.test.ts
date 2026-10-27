import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { HttpError } from "@/lib/http";
import { authErrorToHttp, credentialsSchema } from "./auth-errors";

describe("authErrorToHttp", () => {
  it("gives known errors a friendly message", () => {
    const error = authErrorToHttp(new AuthApiError("User already registered", 422, "user_already_exists"));
    expect(error).toEqual(new HttpError(409, "An account with this email already exists. Sign in instead."));
    expect((authErrorToHttp(new AuthApiError("Invalid login credentials", 400, "invalid_credentials")) as HttpError).status).toBe(401);
  });

  it("maps Supabase's own rate limits to 429", () => {
    expect((authErrorToHttp(new AuthApiError("slow down", 429, undefined)) as HttpError).status).toBe(429);
  });

  it("passes other client errors through and leaves server errors alone", () => {
    const weak = authErrorToHttp(new AuthApiError("Password is too weak", 422, "weak_password"));
    expect(weak).toEqual(new HttpError(422, "Password is too weak"));
    const outage = new AuthApiError("upstream", 500, undefined);
    expect(authErrorToHttp(outage)).toBe(outage);
    const plain = new Error("boom");
    expect(authErrorToHttp(plain)).toBe(plain);
  });
});

describe("credentialsSchema", () => {
  it("normalises the email and enforces the password length", () => {
    expect(credentialsSchema.parse({ email: " Org@Example.com ", password: "12345678" }).email).toBe("org@example.com");
    expect(credentialsSchema.safeParse({ email: "org@example.com", password: "short" }).success).toBe(false);
  });
});
