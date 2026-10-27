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
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-extrabold">{isLogin ? "Log in" : "Create an account"}</h1>
        <p className="text-ink-muted">
          {safeNextPath(next) === "/dashboard/tournaments/new" ? "to create your tournament." : "to manage your tournaments."}
        </p>
      </div>
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
        {!isLogin && <p className="mt-1 text-xs text-ink-subtle">At least 8 characters.</p>}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="text-sm text-emerald-300">
          {message}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Please wait…" : isLogin ? "Log in" : "Create account"}
      </button>
      <p className="text-center text-sm text-ink-muted">
        {isLogin ? (
          <>
            New organizer?{" "}
            <Link href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"} className="link">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"} className="link">
              Log in
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
