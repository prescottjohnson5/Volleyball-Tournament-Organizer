import type { Metadata } from "next";
import { SandboxBanner } from "@/components/SandboxBanner";
import { getOrganizer } from "@/lib/auth";

export const metadata: Metadata = { title: "Dashboard" };
// Every dashboard page depends on the signed-in organizer.
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const organizer = await getOrganizer();
  return (
    <div className="space-y-6">
      {organizer?.isSandbox && <SandboxBanner />}
      {children}
    </div>
  );
}
