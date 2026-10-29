import type { Metadata, Viewport } from "next";
import "@fontsource-variable/figtree";
import Link from "next/link";
import { LogoMark } from "@/components/Icons";
import "./globals.css";

const DESCRIPTION =
  "Tournaments made easy: teams sign up with one link, pools and brackets build themselves, and everyone follows live scores.";

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
  themeColor: "#000000",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="flex min-h-dvh flex-col">
        <header>
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-4">
            <Link href="/" className="flex items-center gap-2.5 text-lg font-extrabold tracking-tight">
              <LogoMark />
              <span>Tournament Organizer</span>
            </Link>
            {/* /dashboard sends visitors who are not signed in to /login and brings them back afterwards. */}
            <Link href="/dashboard" className="text-sm font-bold text-ink-muted hover:text-ink">
              Log in
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 pt-4 pb-16">{children}</main>
        <footer className="border-t border-line">
          <p className="mx-auto max-w-5xl px-4 py-8 text-center text-lg font-bold text-ink-muted">
            Designed and built by <span className="text-ink">Prescott Johnson</span>
          </p>
        </footer>
      </body>
    </html>
  );
}
