import Link from "next/link";
import type { EnvProblem } from "@/lib/env";
import { SetupNotice } from "./SetupNotice";

/** The sandbox page to open for `next`: straight to the creation form when the visitor came to create a tournament. */
export function sandboxHref(next?: string): string {
  return next?.startsWith("/dashboard/tournaments/new") ? "/sandbox?new=1" : "/sandbox";
}

/** Lets visitors on the sign-in pages carry on without an account, in the browser sandbox. */
export function SandboxHint({ next }: { next?: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-3">
      <p className="flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or
        <span className="h-px flex-1 bg-line" aria-hidden />
      </p>
      <Link href={sandboxHref(next)} className="btn-secondary w-full">
        Continue without an account
      </Link>
      <p className="text-center text-xs text-ink-subtle">Practice in a sandbox saved in this browser. No sign-up, nothing shared.</p>
    </div>
  );
}

/**
 * Shown on the log-in and sign-up pages while Supabase is not configured: accounts cannot work, but the
 * sandbox does, so that is the obvious next step. The setup details are folded away for the site owner.
 */
export function AccountsUnavailable({ title, next, problems }: { title: string; next?: string; problems: readonly EnvProblem[] }) {
  return (
    <div className="mx-auto max-w-md space-y-8 pt-6">
      <div className="space-y-3 text-center">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        <p className="text-ink-muted">
          Accounts are not switched on for this site yet. You can still try everything in a sandbox saved in your browser.
        </p>
      </div>
      <Link href={sandboxHref(next)} className="btn-primary w-full">
        Continue without an account
      </Link>
      <details className="group text-sm">
        <summary className="cursor-pointer text-center text-ink-subtle hover:text-ink">Run this site? See what is missing</summary>
        <div className="mt-3">
          <SetupNotice problems={problems} />
        </div>
      </details>
    </div>
  );
}
