"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { safeNextPath } from "@/lib/safe-redirect";

type Mode = "login" | "signup";

export function AuthForm({ mode, next }: { mode: Mode; next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setMessage(null);
    const destination = safeNextPath(next);

    // Server routes sign in and set the session cookie on their response.
    const response = await fetch(mode === "login" ? "/api/auth/signin" : "/api/auth/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }).catch(() => null);
    const result = (await response?.json().catch(() => ({}))) as { signedIn?: boolean; error?: string } | undefined;
    setBusy(false);
    if (!response?.ok) {
      setError(result?.error ?? "Could not reach the server. Check your connection and try again.");
      return;
    }
    if (result?.signedIn) {
      router.replace(destination);
      router.refresh();
      return;
    }
    // Only happens if the Supabase project still has "Confirm email" switched on.
    setMessage("Account created. This site requires email confirmation: open the link we sent you, then sign in.");
  }

  const isLogin = mode === "login";

  return (
    <form onSubmit={onSubmit} className="card mx-auto max-w-sm space-y-4">
      <h1 className="text-xl font-bold">{isLogin ? "Organizer sign in" : "Create an organizer account"}</h1>
      <div>
        <label htmlFor="email" className="label">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          required
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div>
        <label htmlFor="password" className="label">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete={isLogin ? "current-password" : "new-password"}
          minLength={8}
          required
          className="input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {!isLogin && <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-green-700">
          {message}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : isLogin ? "Sign in" : "Create account"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {isLogin ? (
          <>
            New organizer?{" "}
            <Link href="/signup" className="font-medium text-brand-700 underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand-700 underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
