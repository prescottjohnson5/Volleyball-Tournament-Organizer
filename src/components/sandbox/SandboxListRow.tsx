"use client";

import { ListRowLink } from "@/components/tournament/TournamentList";
import { useLocalSandbox } from "./useLocalSandbox";

/** A row linking to the visitor's own sandbox tournament, or inviting them to start one. */
export function SandboxListRow() {
  const sandbox = useLocalSandbox()?.sandbox;
  return sandbox ? (
    <ListRowLink href="/sandbox" title={sandbox.tournament.name} detail="Your sandbox tournament · saved in this browser" />
  ) : (
    <ListRowLink href="/sandbox" title="Practice in the sandbox" detail="Run your own tournament, no account needed" />
  );
}
