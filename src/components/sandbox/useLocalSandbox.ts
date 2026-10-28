"use client";

import { useSyncExternalStore } from "react";
import type { LocalSandbox } from "@/lib/local-sandbox/model";
import { browserStorage, readSandbox, STORAGE_KEY, writeSandbox } from "@/lib/local-sandbox/storage";

export interface SandboxSnapshot {
  sandbox: LocalSandbox | null;
  /** False when the browser will not store data, so the sandbox lasts only until the page is left. */
  persistent: boolean;
  /** Something the visitor should know, such as unreadable saved data having been cleared. */
  notice: string | null;
}

let current: SandboxSnapshot | null = null;
const listeners = new Set<() => void>();

function load(): SandboxSnapshot {
  const storage = browserStorage();
  const { sandbox, problem } = readSandbox(storage);
  if (problem) writeSandbox(storage, null);
  return {
    sandbox,
    persistent: storage !== null,
    notice: problem ? "Your saved sandbox could not be read (it may be from an older version), so it was cleared." : null,
  };
}

function emit() {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  // Another tab changed the sandbox: show the same tournament here.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    current = load();
    emit();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): SandboxSnapshot {
  return (current ??= load());
}

/** The server cannot see the visitor's browser storage, so it renders a loading state. */
function getServerSnapshot(): null {
  return null;
}

/** Saves the sandbox (or deletes it, for null) and updates every component showing it. */
export function setLocalSandbox(sandbox: LocalSandbox | null) {
  const saved = writeSandbox(browserStorage(), sandbox);
  current = { sandbox, persistent: saved, notice: null };
  emit();
}

/** The visitor's sandbox tournament, or null while the page hydrates. Works when storage is blocked, in memory only. */
export function useLocalSandbox(): SandboxSnapshot | null {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
