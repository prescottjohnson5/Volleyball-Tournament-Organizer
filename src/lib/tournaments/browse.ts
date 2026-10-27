import type { TournamentRow } from "@/lib/supabase/database.types";

/** What the "View a tournament" list needs for each row. */
export type TournamentListItem = Pick<TournamentRow, "id" | "slug" | "name" | "event_date" | "location" | "status">;

export const BROWSE_LIMIT = 50;
const MAX_SEARCH_LENGTH = 100;

/** Trims the search box value and caps its length. Returns "" for no search. */
export function normalizeSearch(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return (value ?? "").trim().replace(/\s+/g, " ").slice(0, MAX_SEARCH_LENGTH);
}

/** Escapes the LIKE wildcards (% and _) and the escape character, so a search matches literally. */
export function escapeLikePattern(term: string): string {
  return term.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Case-insensitive name match, the same test the database applies with ILIKE. */
export function matchesSearch(item: Pick<TournamentListItem, "name">, query: string): boolean {
  return query === "" || item.name.toLowerCase().includes(query.toLowerCase());
}

const STATUS_ORDER: Record<TournamentListItem["status"], number> = { in_progress: 0, registration: 1, completed: 2 };

/**
 * Order for browsing: live tournaments first, then upcoming ones (soonest first), then finished ones
 * (most recent first). Ties fall back to the name so the order is stable.
 */
export function sortForBrowsing<T extends TournamentListItem>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => {
    const byStatus = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    if (byStatus !== 0) return byStatus;
    const byDate = a.status === "completed" ? b.event_date.localeCompare(a.event_date) : a.event_date.localeCompare(b.event_date);
    return byDate !== 0 ? byDate : a.name.localeCompare(b.name);
  });
}
