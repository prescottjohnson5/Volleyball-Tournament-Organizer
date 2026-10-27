import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Volleyball Tournament Organizer",
    template: "%s · Volleyball Tournament Organizer",
  },
  description: "Host volleyball tournaments, collect registrations and follow live scores.",
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
