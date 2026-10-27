import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dashboard" };
// Every dashboard page depends on the signed-in organizer.
export const dynamic = "force-dynamic";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}
