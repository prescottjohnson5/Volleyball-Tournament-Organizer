"use client";

import { useState } from "react";
import { createRuleset, pointsToWinSet, validateMatchSets, type BestOf } from "@/lib/rules/ruleset";
import type { TournamentView, ViewMatch } from "@/lib/view";

type Row = { a: string; b: string };

/** Organizer score editor: replaces every set of a match. Saving an empty list clears the match. */
export function OverrideScores({ match, view, onSaved }: { match: ViewMatch; view: TournamentView; onSaved: () => void }) {
  const rules = createRuleset(view.tournament.environment, { bestOf: view.tournament.bestOf as BestOf });
  const initialRows = (): Row[] => match.sets.map((s) => ({ a: String(s.a), b: String(s.b) }));
  const [editing, setEditing] = useState(false);
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (id: string | null) => view.teams.find((t) => t.id === id)?.name ?? "TBD";

  if (!editing) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-medium text-brand-700 underline"
        onClick={() => {
          setRows(match.sets.length > 0 ? initialRows() : [{ a: "", b: "" }]);
          setError(null);
          setEditing(true);
        }}
      >
        {match.sets.length > 0 ? "Edit score" : "Enter score"}
      </button>
    );
  }

  async function save(sets: { a: number; b: number }[]) {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/tournaments/${view.tournament.id}/matches/${match.id}/sets`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sets }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Could not save the score.");
      return;
    }
    setEditing(false);
    onSaved();
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sets = rows.filter((r) => r.a !== "" || r.b !== "").map((r) => ({ a: Number(r.a), b: Number(r.b) }));
    const check = validateMatchSets(rules, sets);
    if (!check.ok) {
      setError(check.error);
      return;
    }
    void save(sets);
  }

  const update = (index: number, side: keyof Row, value: string) =>
    setRows((current) => current.map((row, i) => (i === index ? { ...row, [side]: value } : row)));

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-2 border-t border-slate-100 pt-3">
      <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2 text-sm">
        <span />
        <span className="truncate font-medium">{name(match.teamAId)}</span>
        <span className="truncate font-medium">{name(match.teamBId)}</span>
        {rows.map((row, i) => (
          <div key={i} className="contents">
            <span className="text-xs text-slate-500">
              Set {i + 1} <span className="text-slate-400">(to {pointsToWinSet(rules, i + 1)})</span>
            </span>
            <input
              aria-label={`Set ${i + 1} ${name(match.teamAId)}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              className="input min-h-9 py-1 text-center"
              value={row.a}
              onChange={(e) => update(i, "a", e.target.value)}
            />
            <input
              aria-label={`Set ${i + 1} ${name(match.teamBId)}`}
              type="number"
              inputMode="numeric"
              min={0}
              max={99}
              className="input min-h-9 py-1 text-center"
              value={row.b}
              onChange={(e) => update(i, "b", e.target.value)}
            />
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {rows.length < rules.bestOf && (
          <button type="button" className="text-brand-700 underline" onClick={() => setRows([...rows, { a: "", b: "" }])}>
            Add set
          </button>
        )}
        {rows.length > 0 && (
          <button type="button" className="text-slate-600 underline" onClick={() => setRows(rows.slice(0, -1))}>
            Remove last set
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary min-h-9 py-1" disabled={busy}>
          {busy ? "Saving…" : "Save score"}
        </button>
        <button type="button" className="btn-secondary min-h-9 py-1" onClick={() => setEditing(false)} disabled={busy}>
          Cancel
        </button>
        {match.sets.length > 0 && (
          <button type="button" className="btn-secondary min-h-9 py-1 text-red-700" onClick={() => void save([])} disabled={busy}>
            Clear all sets
          </button>
        )}
      </div>
    </form>
  );
}
