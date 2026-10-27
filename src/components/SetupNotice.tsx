import type { EnvName } from "@/lib/env";

/** Shown instead of a page when environment variables it needs are not configured yet. */
export function SetupNotice({ missing }: { missing: readonly EnvName[] }) {
  return (
    <div className="card border-amber-300 bg-amber-50">
      <h2 className="text-lg font-semibold text-amber-900">Setup needed</h2>
      <p className="mt-1 text-sm text-amber-900">
        This page needs the following environment variables. Add them to <code>.env.local</code> and restart{" "}
        <code>npm run dev</code>. See <code>SETUP_STEPS.md</code> for step-by-step instructions.
      </p>
      <ul className="mt-2 list-inside list-disc font-mono text-sm text-amber-900">
        {missing.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}
