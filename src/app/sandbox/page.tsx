import type { Metadata } from "next";
import { envProblems, SUPABASE_SERVER_VARS } from "@/lib/env";
import { onlineSandboxAvailable } from "@/lib/supabase/auth-settings";
import { SandboxApp } from "./SandboxApp";

export const metadata: Metadata = {
  title: "Sandbox",
  description: "Run a practice volleyball tournament in your browser. No account needed.",
};
export const dynamic = "force-dynamic";

/**
 * The no-account sandbox. Everything happens in the browser (see src/lib/local-sandbox), so it works
 * whether or not Supabase is configured; the server only decides which extra links make sense.
 */
export default async function SandboxPage({ searchParams }: { searchParams: Promise<{ new?: string }> }) {
  const { new: showForm } = await searchParams;
  const online = await onlineSandboxAvailable();
  return (
    <SandboxApp
      showForm={showForm === "1"}
      accountsAvailable={envProblems(SUPABASE_SERVER_VARS).length === 0}
      onlineSandboxAvailable={online}
    />
  );
}
