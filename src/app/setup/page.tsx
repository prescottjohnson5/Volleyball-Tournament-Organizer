import type { Metadata } from "next";
import Link from "next/link";
import { SetupNotice } from "@/components/SetupNotice";
import { envProblems, isPaymentsEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Setup" };
export const dynamic = "force-dynamic";

const REQUIRED = ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_APP_URL"] as const;
// Only needed when PAYMENTS_ENABLED=true.
const PAYMENTS = ["STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"] as const;

/** Lists which environment variables are still missing. Never shows their values. */
export default function SetupPage() {
  const missing = envProblems(isPaymentsEnabled() ? [...REQUIRED, ...PAYMENTS] : REQUIRED);
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
  return <SetupNotice problems={missing} />;
}
