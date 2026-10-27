/** Shown on sandbox dashboards and on the public pages of sandbox tournaments. */
export function SandboxBanner() {
  return (
    <p role="status" className="rounded-lg border border-sun/40 bg-sun/10 px-3 py-2 text-sm font-medium text-sun-100">
      Sandbox: data is deleted daily.
    </p>
  );
}
