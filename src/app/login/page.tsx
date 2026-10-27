import type { Metadata } from "next";
import { SetupNotice } from "@/components/SetupNotice";
import { missingEnv } from "@/lib/env";
import { AuthForm } from "./AuthForm";

export const metadata: Metadata = { title: "Sign in" };
export const dynamic = "force-dynamic";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);
  if (missing.length > 0) return <SetupNotice missing={missing} />;
  const { next } = await searchParams;
  return <AuthForm mode="login" next={next} />;
}
