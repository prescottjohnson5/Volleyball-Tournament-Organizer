"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { loadTournamentViewById } from "@/lib/data/tournament-view";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { TournamentView } from "@/lib/view";

export type LiveStatus = "connecting" | "live" | "offline";

const DEBOUNCE_MS = 250;
const FALLBACK_POLL_MS = 15_000;

/**
 * Keeps a tournament view up to date without reloading the page. Subscribes to Supabase Realtime
 * Postgres Changes for the tournament's rows and refetches the (small) view when anything changes.
 * Refetching instead of patching state from payloads keeps one code path and handles deletes and
 * derived fields for free. Falls back to polling if the Realtime connection drops.
 */
export function useLiveTournament(initial: TournamentView): { view: TournamentView; status: LiveStatus; refresh: () => void } {
  const [view, setView] = useState(initial);
  const [status, setStatus] = useState<LiveStatus>("connecting");
  const tournamentId = initial.tournament.id;
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const refreshNow = useCallback(async () => {
    try {
      const next = await loadTournamentViewById(getSupabaseBrowserClient(), tournamentId);
      if (next) setView(next);
    } catch {
      setStatus("offline");
    }
  }, [tournamentId]);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = setTimeout(refreshNow, DEBOUNCE_MS);
  }, [refreshNow]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const byTournament = `tournament_id=eq.${tournamentId}`;
    const channel = supabase
      .channel(`tournament:${tournamentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "matches", filter: byTournament }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "match_sets", filter: byTournament }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "teams", filter: byTournament }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "tournaments", filter: `id=eq.${tournamentId}` }, refresh)
      .subscribe((state) => {
        if (state === "SUBSCRIBED") {
          setStatus("live");
          refresh(); // catch anything that changed between the server render and subscribing
        } else if (state === "CHANNEL_ERROR" || state === "TIMED_OUT" || state === "CLOSED") {
          setStatus("offline");
        }
      });

    const onVisible = () => {
      if (document.visibilityState === "visible") refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [tournamentId, refresh]);

  useEffect(() => {
    if (status !== "offline") return;
    const interval = setInterval(refreshNow, FALLBACK_POLL_MS);
    return () => clearInterval(interval);
  }, [status, refreshNow]);

  return { view, status, refresh };
}
