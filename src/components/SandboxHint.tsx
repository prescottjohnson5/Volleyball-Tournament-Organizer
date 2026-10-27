import { TryItButton } from "./TryItButton";

/** Lets visitors on the sign-in pages carry on without an account, in a private sandbox. */
export function SandboxHint({ next }: { next?: string }) {
  return (
    <div className="mx-auto max-w-sm space-y-3">
      <p className="flex items-center gap-3 text-xs font-semibold tracking-wide text-ink-subtle uppercase">
        <span className="h-px flex-1 bg-line" aria-hidden />
        or
        <span className="h-px flex-1 bg-line" aria-hidden />
      </p>
      <TryItButton label="Continue without an account" className="btn-secondary w-full" next={next} />
      <p className="text-center text-xs text-ink-subtle">You get a private sandbox for 24 hours: one tournament, up to 8 teams.</p>
    </div>
  );
}
