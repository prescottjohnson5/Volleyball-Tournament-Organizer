import type { LiveStatus } from "./useLiveTournament";

const STYLES: Record<LiveStatus, { text: string; dot: string }> = {
  live: { text: "Live updates on", dot: "bg-green-500" },
  connecting: { text: "Connecting…", dot: "bg-sun" },
  offline: { text: "Reconnecting (refreshing every 15s)", dot: "bg-ink-faint" },
};

export function LiveIndicator({ status }: { status: LiveStatus }) {
  const s = STYLES[status];
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted" role="status" aria-live="polite">
      <span aria-hidden className={`h-2 w-2 rounded-full ${s.dot} ${status === "live" ? "animate-pulse" : ""}`} />
      {s.text}
    </span>
  );
}
