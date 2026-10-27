import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

const DESCRIPTION =
  "Run your volleyball tournament from your phone: teams sign up with one link, pools and brackets build themselves, and everyone follows live scores.";

/** Absolute base for Open Graph URLs: NEXT_PUBLIC_APP_URL, else the Vercel production URL, else localhost. */
function siteUrl(): URL {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`,
  ];
  for (const candidate of candidates) {
    try {
      if (candidate?.trim()) return new URL(candidate.trim());
    } catch {
      // Ignore a malformed value and fall through.
    }
  }
  return new URL("http://localhost:3000");
}

export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: {
    default: "Volleyball Tournament Organizer",
    template: "%s · Volleyball Tournament Organizer",
  },
  description: DESCRIPTION,
  applicationName: "Volleyball Tournament Organizer",
  openGraph: {
    type: "website",
    siteName: "Volleyball Tournament Organizer",
    title: "Volleyball Tournament Organizer",
    description: DESCRIPTION,
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Volleyball Tournament Organizer",
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1764bf",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <header className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-bold text-brand-700">
              <span aria-hidden className="text-xl">
                🏐
              </span>
              <span>Tournament Organizer</span>
            </Link>
            <nav className="flex gap-4 text-sm">
              <Link href="/demo" className="font-medium text-slate-600 hover:text-brand-700">
                Demo
              </Link>
              <Link href="/dashboard" className="font-medium text-slate-600 hover:text-brand-700">
                Organizers
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
