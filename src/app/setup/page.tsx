import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { BackLink } from "@/components/BackLink";
import { CheckCircleIcon } from "@/components/Icons";
import { runSetupChecks, type CheckStatus } from "@/lib/setup/checks";

export const metadata: Metadata = { title: "Setup check", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const STATUS: Record<CheckStatus, { label: string; className: string }> = {
  ok: { label: "OK", className: "bg-teal/20 text-teal-300" },
  warn: { label: "Note", className: "bg-sun/15 text-sun-100" },
  fail: { label: "Fix", className: "bg-red-500/20 text-red-200" },
};

/**
 * Tests the live configuration: which settings are missing or wrong, whether Supabase answers and
 * accepts both keys, and whether each migration's tables exist. Never shows a secret value.
 */
export default async function SetupPage() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const checks = await runSetupChecks({ requestOrigin: `${proto}://${host}` });
  const failures = checks.filter((c) => c.status === "fail").length;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <BackLink href="/">Home</BackLink>
      <header className="space-y-2">
        <h1 className="text-3xl font-extrabold sm:text-4xl">Setup check</h1>
        <p className="text-ink-muted">
          {failures === 0
            ? "Everything this page can test is connected."
            : `${failures} ${failures === 1 ? "thing needs" : "things need"} fixing before accounts and shared tournaments work.`}{" "}
          Secret values are never shown here.
        </p>
      </header>

      {failures === 0 && (
        <p className="flex items-center gap-3 rounded-2xl border border-teal/50 px-4 py-3 font-bold" role="status">
          <CheckCircleIcon className="h-6 w-6 shrink-0 text-teal-300" />
          Ready. Create an account and your first tournament.
        </p>
      )}

      <ul className="border-t border-line">
        {checks.map((check) => (
          <li key={check.label} className="flex gap-4 border-b border-line px-1 py-4">
            <span className={`h-fit shrink-0 rounded-full px-2 py-0.5 text-xs font-bold ${STATUS[check.status].className}`}>
              {STATUS[check.status].label}
            </span>
            <div className="min-w-0 space-y-1">
              <p className="font-semibold break-words">{check.label}</p>
              <p className="text-sm text-ink-muted">{check.detail}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 text-sm text-ink-subtle">
        <p>
          Row Level Security (0002), the database functions (0003, 0005) and live updates (0004) cannot be tested from here, so run
          every file in <code>supabase/migrations</code> in order, once each (0005 to 0007 can safely be run again).
        </p>
        <p>
          After changing <code>.env.local</code>, restart the app (and run <code>npm run build</code> again on a live server). Step-by-step
          instructions are in <code>SETUP_STEPS.md</code> and <code>DEPLOY_AWS.md</code>.
        </p>
        <p>
          <Link href="/setup" className="link">
            Run the check again
          </Link>
        </p>
      </div>
    </div>
  );
}
