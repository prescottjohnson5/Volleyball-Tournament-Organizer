"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CaptainLinkCard } from "@/components/CaptainLinkCard";

type State =
  | { kind: "checking" }
  | { kind: "pending"; attempts: number }
  | { kind: "ready"; token: string; teamName: string }
  | { kind: "already_claimed"; teamName: string }
  | { kind: "refunded"; teamName: string }
  | { kind: "expired" }
  | { kind: "error"; message: string };

const POLL_MS = 2000;
const MAX_ATTEMPTS = 45;
const storageKey = (sessionId: string) => `vto-captain-link:${sessionId}`;

function readStored(sessionId: string): { token: string; teamName: string } | null {
  try {
    const raw = window.localStorage.getItem(storageKey(sessionId));
    return raw ? (JSON.parse(raw) as { token: string; teamName: string }) : null;
  } catch {
    return null;
  }
}

function store(sessionId: string, value: { token: string; teamName: string }) {
  try {
    window.localStorage.setItem(storageKey(sessionId), JSON.stringify(value));
  } catch {
    // Private browsing: the link is still shown, just not remembered.
  }
}

export function ClaimCaptainLink({ sessionId, slug }: { sessionId: string; slug: string }) {
  const [state, setState] = useState<State>({ kind: "checking" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function poll(attempt: number) {
      const stored = readStored(sessionId);
      if (stored) {
        setState({ kind: "ready", ...stored });
        return;
      }
      try {
        const response = await fetch("/api/register/claim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const result = (await response.json()) as {
          status?: string;
          teamName?: string;
          token?: string;
          alreadyClaimed?: boolean;
          error?: string;
        };
        if (cancelled) return;
        if (!response.ok) {
          setState({ kind: "error", message: result.error ?? "Could not check your registration." });
        } else if (result.status === "paid" && result.token) {
          const value = { token: result.token, teamName: result.teamName ?? "" };
          store(sessionId, value);
          setState({ kind: "ready", ...value });
        } else if (result.status === "paid") {
          setState({ kind: "already_claimed", teamName: result.teamName ?? "" });
        } else if (result.status === "refunded") {
          setState({ kind: "refunded", teamName: result.teamName ?? "" });
        } else if (result.status === "expired") {
          setState({ kind: "expired" });
        } else if (attempt >= MAX_ATTEMPTS) {
          setState({ kind: "error", message: "Payment confirmation is taking longer than expected. Refresh this page in a minute." });
        } else {
          setState({ kind: "pending", attempts: attempt });
          timer = setTimeout(() => poll(attempt + 1), POLL_MS);
        }
      } catch {
        if (!cancelled) setState({ kind: "error", message: "Network error. Refresh this page to try again." });
      }
    }

    poll(1);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [sessionId]);

  if (state.kind === "checking" || state.kind === "pending") {
    return (
      <div className="card space-y-2 text-center" role="status">
        <p className="text-lg font-semibold">Confirming your payment…</p>
        <p className="text-sm text-slate-600">This usually takes a few seconds. Please keep this page open.</p>
      </div>
    );
  }

  if (state.kind === "ready") return <CaptainLinkCard token={state.token} teamName={state.teamName} />;

  const messages: Record<Exclude<State["kind"], "checking" | "pending" | "ready">, string> = {
    already_claimed:
      "Your team is registered. The captain link was already shown in another browser. If you did not save it, ask the organizer for a new one.",
    refunded: "Sorry, the tournament filled up or closed while you were paying. Your payment has been refunded.",
    expired: "This checkout expired before payment was completed. Nothing was charged.",
    error: state.kind === "error" ? state.message : "",
  };
  return (
    <div className="card space-y-3">
      <p className="text-slate-800">{messages[state.kind]}</p>
      <Link href={`/t/${slug}`} className="btn-secondary">
        Go to the tournament page
      </Link>
    </div>
  );
}
