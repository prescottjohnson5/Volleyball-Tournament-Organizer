import type { Metadata } from "next";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;
  return <div className="space-y-6">{children}</div>;
}
