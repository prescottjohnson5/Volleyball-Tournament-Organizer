import type { Metadata } from "next";
import { AccountsUnavailable, SandboxHint } from "@/components/SandboxHint";
import { envProblems, SUPABASE_SERVER_VARS } from "@/lib/env";
import { AuthForm } from "../login/AuthForm";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const missing = envProblems(SUPABASE_SERVER_VARS);
  if (missing.length > 0) return <AccountsUnavailable title="Create an account" next={next} problems={missing} />;
  return (
    <div className="space-y-6 pt-6">
      <AuthForm mode="signup" next={next} />
      <SandboxHint next={next} />
    </div>
  );
}
