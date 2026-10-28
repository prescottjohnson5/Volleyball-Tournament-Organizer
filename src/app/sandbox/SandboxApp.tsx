"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ZodError } from "zod";
import { TournamentForm } from "@/app/dashboard/tournaments/TournamentForm";
import { BackLink } from "@/components/BackLink";
import { ArrowRightIcon, PlusSquareIcon, TrophyIcon } from "@/components/Icons";
import { TryItButton } from "@/components/TryItButton";
import { setLocalSandbox, useLocalSandbox } from "@/components/sandbox/useLocalSandbox";
import { MatchManager } from "@/components/tournament/MatchManager";
import type { SaveMatchSets } from "@/components/tournament/OverrideScores";
import { TournamentHeader, TournamentSections } from "@/components/tournament/TournamentSections";
import { UserFacingError } from "@/lib/errors";
import {
  addTeam,
  createLocalSandbox,
  createSampleSandbox,
  fillWithSampleTeams,
  localSandboxView,
  removeTeam,
  saveMatchScores,
  startBlocker,
  startLocalSandbox,
  type LocalSandbox,
} from "@/lib/local-sandbox/model";

type Props = { showForm: boolean; accountsAvailable: boolean; onlineSandboxAvailable: boolean };

function errorMessage(error: unknown): string {
  if (error instanceof UserFacingError) return error.message;
  if (error instanceof ZodError) return error.issues[0]?.message ?? "Check the details and try again.";
  return "Something went wrong. Please try again.";
}

/** Applies a change to the sandbox and saves it, or returns the reason it was refused. */
function apply(change: () => LocalSandbox): string | null {
  try {
    setLocalSandbox(change());
    return null;
  } catch (error) {
    return errorMessage(error);
  }
}

export function SandboxApp(props: Props) {
  const snapshot = useLocalSandbox();

  if (!snapshot) {
    return <div className="h-64 animate-pulse rounded-3xl bg-surface" aria-label="Loading the sandbox" />;
  }

  return (
    <div className="space-y-6">
      <BackLink href="/">Home</BackLink>
      {!snapshot.persistent && (
        <p className="notice text-sm text-sun-100" role="status">
          Your browser is not letting this site save data (private browsing can do this), so the sandbox disappears when you leave
          or refresh this page.
        </p>
      )}
      {snapshot.notice && (
        <p className="notice text-sm text-sun-100" role="status">
          {snapshot.notice}
        </p>
      )}
      {snapshot.sandbox ? <SandboxTournament sandbox={snapshot.sandbox} {...props} /> : <SandboxStart {...props} />}
    </div>
  );
}

function SandboxStart({ showForm, accountsAvailable, onlineSandboxAvailable }: Props) {
  const router = useRouter();

  if (showForm) {
    return (
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-2">
          <SandboxPill />
          <h1 className="text-3xl font-extrabold sm:text-4xl">Create a practice tournament</h1>
          <p className="text-ink-muted">The same form organizers use. It is saved only in this browser.</p>
        </header>
        <TournamentForm
          mode="create"
          showFee={false}
          cancelHref="/sandbox"
          save={async (input) => {
            const failure = apply(() => createLocalSandbox(input));
            if (!failure) router.replace("/sandbox");
            return failure;
          }}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <header className="space-y-3 text-center">
        <SandboxPill />
        <h1 className="text-4xl leading-[1.05] font-extrabold sm:text-5xl">Try it without an account</h1>
        <p className="mx-auto max-w-xl text-lg text-ink-muted">
          Run a practice tournament right here. It is saved only in this browser: nothing is shared or sent anywhere.
        </p>
      </header>

      <ul className="grid gap-4 sm:grid-cols-2">
        <li>
          <button
            type="button"
            onClick={() => apply(() => createSampleSandbox(new Date()))}
            className="group flex h-full w-full flex-col rounded-3xl border border-line bg-surface p-6 text-left transition-colors hover:border-ink-faint hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun sm:p-8"
          >
            <TrophyIcon className="h-8 w-8 text-sun" />
            <span className="mt-6 flex items-center justify-between gap-3 text-2xl font-extrabold tracking-tight">
              Open the sample
              <ArrowRightIcon className="h-6 w-6 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
            </span>
            <span className="mt-2 text-ink-muted">
              Eight beach teams part-way through pool play. Enter the last scores and watch the playoffs build.
            </span>
          </button>
        </li>
        <li>
          <Link
            href="/sandbox?new=1"
            className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-ink-faint hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun sm:p-8"
          >
            <PlusSquareIcon className="h-8 w-8 text-teal" />
            <span className="mt-6 flex items-center justify-between gap-3 text-2xl font-extrabold tracking-tight">
              Create your own
              <ArrowRightIcon className="h-6 w-6 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
            </span>
            <span className="mt-2 text-ink-muted">Name it, add teams, start it and enter scores, start to finish.</span>
          </Link>
        </li>
      </ul>

      <SandboxDifferences accountsAvailable={accountsAvailable} onlineSandboxAvailable={onlineSandboxAvailable} />
    </div>
  );
}

function SandboxTournament({ sandbox, accountsAvailable, onlineSandboxAvailable }: Props & { sandbox: LocalSandbox }) {
  const view = localSandboxView(sandbox);
  const started = sandbox.tournament.startedAt !== null;

  const save: SaveMatchSets = async (matchId, sets) => apply(() => saveMatchScores(sandbox, matchId, sets));

  return (
    <div className="space-y-6">
      <SandboxBar sample={sandbox.tournament.sample} />
      <TournamentHeader view={view} />
      {started ? (
        <>
          <p className="text-sm text-ink-subtle">
            {view.tournament.status === "completed"
              ? "The tournament is finished. You can still correct any score under Matches, or start over."
              : `Enter scores under Matches. Standings and the ${view.tournament.format === "double_elim" ? "bracket" : "playoffs"} update as you go, exactly as they would for a real event.`}
          </p>
          <TournamentSections view={view} matchesContent={<MatchManager view={view} onSave={save} />} />
        </>
      ) : (
        <>
          <StartPanel sandbox={sandbox} />
          <TeamsEditor sandbox={sandbox} />
        </>
      )}
      <SandboxDifferences accountsAvailable={accountsAvailable} onlineSandboxAvailable={onlineSandboxAvailable} />
    </div>
  );
}

function SandboxPill() {
  return (
    <span className="inline-flex items-center rounded-full border border-teal/50 bg-teal/10 px-3 py-1 text-xs font-bold tracking-wide text-teal-300 uppercase">
      Sandbox
    </span>
  );
}

/** Says what this is and offers a way to start fresh, with a confirmation step. */
function SandboxBar({ sample }: { sample: boolean }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-teal/40 bg-teal/10 px-4 py-3 text-sm" role="status">
      <p>
        <span className="font-bold text-teal-300">{sample ? "Sample sandbox tournament." : "Sandbox tournament."}</span>{" "}
        <span className="text-ink-muted">Saved only in this browser. Nobody else can see it.</span>
      </p>
      {confirming ? (
        <span className="flex flex-wrap items-center gap-3">
          <span className="text-ink-muted">Delete it and start over?</span>
          <button
            type="button"
            className="font-bold text-red-300 underline underline-offset-2 hover:text-red-200"
            onClick={() => {
              setLocalSandbox(null);
              router.replace("/sandbox");
            }}
          >
            Delete
          </button>
          <button type="button" className="link" onClick={() => setConfirming(false)}>
            Keep it
          </button>
        </span>
      ) : (
        <button type="button" className="link" onClick={() => setConfirming(true)}>
          Start over
        </button>
      )}
    </div>
  );
}

function StartPanel({ sandbox }: { sandbox: LocalSandbox }) {
  const [error, setError] = useState<string | null>(null);
  const blocker = startBlocker(sandbox);
  return (
    <div className="card flex flex-wrap items-center justify-between gap-4">
      <div className="space-y-1">
        <p className="font-bold">
          {sandbox.teams.length} of {sandbox.tournament.maxTeams} teams
        </p>
        <p className="text-sm text-ink-muted">
          {blocker ?? "Start when every team is in. The schedule is generated and the team list is locked."}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-300">
            {error}
          </p>
        )}
      </div>
      <button type="button" className="btn-primary" disabled={blocker !== null} onClick={() => setError(apply(() => startLocalSandbox(sandbox, new Date())))}>
        Start tournament
      </button>
    </div>
  );
}

/** Before the start, the organizer adds teams by hand (in a real event they sign up from a link). */
function TeamsEditor({ sandbox }: { sandbox: LocalSandbox }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = sandbox.tournament.maxTeams - sandbox.teams.length;

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const failure = apply(() => addTeam(sandbox, name));
    setError(failure);
    if (!failure) setName("");
  }

  return (
    <section aria-labelledby="teams-heading" className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="teams-heading" className="text-xl font-extrabold">
          Teams
        </h2>
        {open > 0 && (
          <button type="button" className="text-sm link" onClick={() => setError(apply(() => fillWithSampleTeams(sandbox)))}>
            Fill {open === 1 ? "the open spot" : `the ${open} open spots`} with sample teams
          </button>
        )}
      </div>
      <form onSubmit={onSubmit} className="flex gap-2">
        <label htmlFor="team-name" className="sr-only">
          Team name
        </label>
        <input
          id="team-name"
          className="input flex-1"
          placeholder={open > 0 ? "Team name" : "The tournament is full"}
          maxLength={60}
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={open <= 0}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "team-error" : undefined}
        />
        <button type="submit" className="btn-secondary" disabled={open <= 0}>
          Add team
        </button>
      </form>
      {error && (
        <p id="team-error" role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
      {sandbox.teams.length === 0 ? (
        <p className="empty-state">No teams yet. Add a few, or fill the spots with sample teams.</p>
      ) : (
        <ol className="border-t border-line">
          {sandbox.teams.map((team, index) => (
            <li key={team.id} className="flex items-center gap-3 border-b border-line px-2 py-3">
              <span className="w-7 shrink-0 text-sm text-ink-faint tabular-nums">{index + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{team.name}</span>
              <button
                type="button"
                className="shrink-0 text-sm text-ink-subtle underline underline-offset-2 hover:text-red-300"
                onClick={() => setError(apply(() => removeTeam(sandbox, team.id)))}
                aria-label={`Remove ${team.name}`}
              >
                Remove
              </button>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/** Honest about what the sandbox leaves out, and where to go for the real thing. */
function SandboxDifferences({ accountsAvailable, onlineSandboxAvailable }: Omit<Props, "showForm">) {
  return (
    <details className="group rounded-2xl border border-line">
      <summary className="cursor-pointer list-none px-4 py-4 font-bold [&::-webkit-details-marker]:hidden">
        How is the sandbox different from a real tournament?
      </summary>
      <div className="space-y-4 border-t border-line px-4 py-4 text-sm text-ink-muted">
        <ul className="list-inside list-disc space-y-1">
          <li>You add the teams yourself. In a real tournament, teams sign up from a link or QR code.</li>
          <li>Only you enter scores. Real captains get a private link to report their own matches.</li>
          <li>It lives in this browser only: no public page, no live updates on other phones, no payments.</li>
          <li>Pools, brackets, byes and the score rules are the real ones.</li>
        </ul>
        {onlineSandboxAvailable && (
          <div className="space-y-2 border-t border-line pt-4">
            <p>Want teams to sign up from their own phones, still without an account? The online sandbox is a real, shareable tournament for 24 hours.</p>
            <TryItButton label="Start the online sandbox" className="btn-secondary" next="/dashboard/tournaments/new" />
          </div>
        )}
        {accountsAvailable && (
          <p className="border-t border-line pt-4">
            Running a real event?{" "}
            <Link href="/signup?next=/dashboard/tournaments/new" className="link">
              Create a free account
            </Link>
            .
          </p>
        )}
      </div>
    </details>
  );
}
