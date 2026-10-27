import type { Metadata } from "next";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";
import { AuthForm } from "../login/AuthForm";

export const metadata: Metadata = { title: "Create account" };
export const dynamic = "force-dynamic";

export default function SignupPage() {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;
  return <AuthForm mode="signup" />;
}
