import type { Metadata } from "next";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; error?: string }> }) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;
  const { next, error } = await searchParams;
  return (
    <div className="space-y-4">
      {error === "confirmation_failed" && (
        <p className="card mx-auto max-w-sm border-amber-300 bg-amber-50 text-sm text-amber-900" role="alert">
          That confirmation link did not work (it may have expired or been used already). Try signing in, or sign up again to get a
          new link.
        </p>
      )}
      <AuthForm mode="login" next={next} />
    </div>
  );
}
