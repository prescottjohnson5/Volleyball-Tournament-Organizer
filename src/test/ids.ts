import type { IdFactory, SeededTeam } from "@/lib/bracket/types";

/** Deterministic id factory for tests: m1, m2, m3, ... */
export function counterIds(prefix = "m"): IdFactory {
  let n = 0;
  return () => `${prefix}${++n}`;
}

/** Teams t1..tN seeded 1..N. */
export function seededTeams(count: number): SeededTeam[] {
  return Array.from({ length: count }, (_, i) => ({ id: `t${i + 1}`, seed: i + 1 }));
}
