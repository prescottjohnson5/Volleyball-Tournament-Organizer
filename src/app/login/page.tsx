import type { Metadata } from "next";
import { SandboxHint } from "@/components/SandboxHint";
import { SetupNotice } from "@/components/SetupNotice";
import { envProblems, SUPABASE_PUBLIC_VARS } from "@/lib/env";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const missing = envProblems(SUPABASE_PUBLIC_VARS);
  if (missing.length > 0) return <SetupNotice problems={missing} />;
  const { next, error } = await searchParams;
  return (
    <div className="space-y-6 pt-6">
      {error === "confirmation_failed" && (
        <p className="notice mx-auto max-w-sm text-sm" role="alert">
          That confirmation link did not work (it may have expired or been used already). Try signing in, or sign up again to get a
          new link.
        </p>
      )}
      <AuthForm mode="login" next={next} />
      <SandboxHint next={next} />
    </div>
  );
}
