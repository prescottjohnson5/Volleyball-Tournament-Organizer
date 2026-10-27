"use client";

import { useState } from "react";
import { createRuleset, pointsToWinSet, validateSetScore, type BestOf } from "@/lib/rules/ruleset";
import type { TournamentView, ViewMatch } from "@/lib/view";

/** Lets a captain report the next completed set of one match. */
export function ReportSetForm({
  match,
  view,
  teamId,
  token,
  onReported,
}: {
  match: ViewMatch;
  view: TournamentView;
  teamId: string;
  token: string;
  onReported: () => void;
}) {
  const [scoreA, setScoreA] = useState("");
  const [scoreB, setScoreB] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  const rules = createRuleset(view.tournament.environment, { bestOf: view.tournament.bestOf as BestOf });
  const setNumber = match.sets.length + 1;
  const target = pointsToWinSet(rules, setNumber);
  const name = (id: string | null) => view.teams.find((t) => t.id === id)?.name ?? "TBD";
  const you = (id: string | null) => (id === teamId ? " (you)" : "");

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSaved(null);
    const a = Number(scoreA);
    const b = Number(scoreB);
    const check = validateSetScore(rules, setNumber, { a, b });
    if (scoreA === "" || scoreB === "" || !check.ok) {
      setError(check.ok ? "Enter both scores." : check.error);
      return;
    }
    setBusy(true);
    const response = await fetch(`/api/captain/matches/${match.id}/sets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ setNumber, scoreA: a, scoreB: b }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setBusy(false);
    if (!response.ok) {
      setError(result.error ?? "Could not save the score.");
      onReported(); // someone else may have reported it; show the latest state
      return;
    }
    setScoreA("");
    setScoreB("");
    setSaved(`Set ${setNumber} saved: ${a}–${b}`);
    onReported();
  }

  return (
    <form onSubmit={onSubmit} className="mt-3 space-y-3 border-t border-slate-100 pt-3">
      <p className="text-sm font-semibold">
        Report set {setNumber} <span className="font-normal text-slate-500">(played to {target}, win by {rules.winBy})</span>
      </p>
      <div className="grid grid-cols-2 gap-3">
        <label>
          <span className="label truncate">
            {name(match.teamAId)}
            {you(match.teamAId)}
          </span>
          <input type="number" inputMode="numeric" min={0} max={99} required className="input text-center text-lg" value={scoreA} onChange={(e) => setScoreA(e.target.value)} />
        </label>
        <label>
          <span className="label truncate">
            {name(match.teamBId)}
            {you(match.teamBId)}
          </span>
          <input type="number" inputMode="numeric" min={0} max={99} required className="input text-center text-lg" value={scoreB} onChange={(e) => setScoreB(e.target.value)} />
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-sm text-green-700">
          {saved}
        </p>
      )}
      <button type="submit" className="btn-primary w-full" disabled={busy}>
        {busy ? "Saving…" : `Save set ${setNumber}`}
      </button>
    </form>
  );
}
