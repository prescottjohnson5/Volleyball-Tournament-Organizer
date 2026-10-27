import type { Metadata } from "next";
import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

const REQUIRED = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "NEXT_PUBLIC_APP_URL",
] as const;

/** Lists which environment variables are still missing. Never shows their values. */
export default function SetupPage() {
  const missing = missingEnv(REQUIRED);
  if (missing.length === 0) {
    return (
      <div className="card space-y-2">
        <h1 className="text-lg font-semibold">All environment variables are set.</h1>
        <Link href="/dashboard" className="btn-primary">
          Go to the dashboard
        </Link>
      </div>
    );
  }
  return <SetupNotice missing={missing} />;
}
