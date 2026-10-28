import type { Metadata } from "next";
import { SandboxHint } from "@/components/SandboxHint";
import { SetupNotice } from "@/components/SetupNotice";
import { envProblems, SUPABASE_PUBLIC_VARS } from "@/lib/env";
import { AuthForm } from "../login/AuthForm";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const missing = envProblems(SUPABASE_PUBLIC_VARS);
  if (missing.length > 0) return <SetupNotice problems={missing} />;
  const { next } = await searchParams;
  return (
    <div className="space-y-6 pt-6">
      <AuthForm mode="signup" next={next} />
      <SandboxHint next={next} />
    </div>
  );
}
