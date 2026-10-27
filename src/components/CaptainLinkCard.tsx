"use client";

import Link from "next/link";
import { useState } from "react";

/** Shows a newly issued captain link once, with copy and open buttons. */
export function CaptainLinkCard({ token, teamName }: { token: string; teamName: string }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/captain/${token}`;

  return (
    <div className="card space-y-4">
      <div>
        <p className="text-lg font-semibold text-green-700">✅ {teamName} is registered!</p>
        <p className="mt-1 text-sm text-slate-700">
          This is your private captain link. Use it to report your team&apos;s scores. <strong>Save it now</strong>: anyone with the
          link can report scores for your team, and it is shown only on this device.
        </p>
      </div>
      <p className="rounded-lg bg-slate-100 p-3 font-mono text-xs break-all">{link}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="btn-primary"
          onClick={async () => {
            await navigator.clipboard.writeText(link);
            setCopied(true);
          }}
        >
          {copied ? "Copied!" : "Copy link"}
        </button>
        <Link href={`/captain/${token}`} className="btn-secondary">
          Open captain page
        </Link>
      </div>
      <p className="text-xs text-slate-500">Lost it? Ask the organizer to generate a new captain link for your team.</p>
    </div>
  );
}
