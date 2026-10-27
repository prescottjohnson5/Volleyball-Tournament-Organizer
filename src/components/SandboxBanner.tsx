/** Shown on sandbox dashboards and on the public pages of sandbox tournaments. */
export function SandboxBanner() {
  return (
    <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
      Sandbox: data is deleted daily.
    </p>
  );
}
