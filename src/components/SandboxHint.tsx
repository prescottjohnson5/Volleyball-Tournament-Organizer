import { TryItButton } from "./TryItButton";

/** Offers the sandbox to visitors on the sign-in pages who only want to look around. */
export function SandboxHint() {
  return (
    <div className="mx-auto max-w-sm space-y-2 text-center text-sm text-slate-600">
      <p>Just looking around? Try the organizer tools without an account.</p>
      <TryItButton label="Try it without an account" className="btn-secondary w-full" />
    </div>
  );
}
