"use client";

import { useState } from "react";

/** Registration link with copy button, QR preview and QR download. */
export function SharePanel({ slug, baseUrl }: { slug: string; baseUrl: string }) {
  const [copied, setCopied] = useState<string | null>(null);
  const registrationUrl = `${baseUrl}/t/${slug}/register`;
  const publicUrl = `${baseUrl}/t/${slug}`;

  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setCopied(value);
  }

  return (
    <section className="grid gap-6 sm:grid-cols-[1fr_auto]">
      <div className="space-y-5">
        <div>
          <p className="label">Registration link (for captains)</p>
          <p className="font-mono text-xs break-all text-ink-muted">{registrationUrl}</p>
          <button type="button" className="btn-secondary mt-1 min-h-9 py-1" onClick={() => copy(registrationUrl)}>
            {copied === registrationUrl ? "Copied!" : "Copy link"}
          </button>
        </div>
        <div>
          <p className="label">Live results (for everyone)</p>
          <p className="font-mono text-xs break-all text-ink-muted">{publicUrl}</p>
          <button type="button" className="btn-secondary mt-1 min-h-9 py-1" onClick={() => copy(publicUrl)}>
            {copied === publicUrl ? "Copied!" : "Copy link"}
          </button>
        </div>
      </div>
      <div className="flex flex-col items-center gap-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- generated PNG from our own route */}
        <img src={`/t/${slug}/qr`} alt="QR code for the registration link" width={160} height={160} className="rounded-lg border border-line" />
        <a href={`/t/${slug}/qr?download=1`} className="btn-secondary min-h-9 py-1" download>
          Download QR code
        </a>
      </div>
    </section>
  );
}
