import { computeStandings } from "@/lib/standings";
import type { TournamentView } from "@/lib/view";

function signed(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

/** Pool standings, one table per pool. Renders nothing for formats without pools. */
export function StandingsTable({ view }: { view: TournamentView }) {
  const pools = [...new Set(view.teams.map((t) => t.pool).filter((p): p is string => Boolean(p)))].sort();
  if (pools.length === 0) return null;
  const names = new Map(view.teams.map((t) => [t.id, t.name]));

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {pools.map((pool) => {
        const teams = view.teams.filter((t) => t.pool === pool).map((t) => ({ id: t.id, seed: t.seed ?? Number.MAX_SAFE_INTEGER }));
        const rows = computeStandings(
          teams,
          view.matches.filter((m) => m.phase === "pool" && m.pool === pool),
        );
        return (
          <div key={pool} className="card overflow-x-auto p-0">
            <table className="w-full text-sm">
              <caption className="px-4 pt-3 text-left font-semibold">Pool {pool}</caption>
              <thead className="text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-2 py-2 text-left">
                    #
                  </th>
                  <th scope="col" className="py-2 text-left">
                    Team
                  </th>
                  <th scope="col" className="px-2 py-2 text-center">
                    <abbr title="Matches won – lost">W–L</abbr>
                  </th>
                  <th scope="col" className="px-2 py-2 text-center">
                    <abbr title="Set difference">Sets</abbr>
                  </th>
                  <th scope="col" className="px-2 py-2 text-center">
                    <abbr title="Point difference">Pts</abbr>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.teamId} className="border-t border-slate-100">
                    <td className="px-2 py-2 text-slate-500">{row.rank}</td>
                    <td className="py-2 font-medium">{names.get(row.teamId)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">
                      {row.wins}–{row.losses}
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums">{signed(row.setsWon - row.setsLost)}</td>
                    <td className="px-2 py-2 text-center tabular-nums">{signed(row.pointsFor - row.pointsAgainst)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      })}
      <p className="text-xs text-slate-500 md:col-span-2">
        Ranked by matches won, then set difference, point difference, head-to-head (two-way ties) and seed.
      </p>
    </div>
  );
}
