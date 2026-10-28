import { localSandboxSchema, type LocalSandbox } from "./model";

/** Bump the suffix (and LOCAL_SANDBOX_VERSION) if the stored shape ever changes incompatibly. */
export const STORAGE_KEY = "vto.sandbox.v1";

export type ReadResult = { sandbox: LocalSandbox | null; problem: "unreadable" | null };

/** localStorage when the browser lets this site use it, else null (private mode, blocked site data). */
export function browserStorage(): Storage | null {
  try {
    const storage = window.localStorage;
    const probe = `${STORAGE_KEY}.probe`;
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    return storage;
  } catch {
    return null;
  }
}

/** Reads the saved sandbox. Anything that is not a valid sandbox (edited by hand, old version) is reported, not thrown. */
export function readSandbox(storage: Storage | null): ReadResult {
  if (!storage) return { sandbox: null, problem: null };
  let raw: string | null;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { sandbox: null, problem: null };
  }
  if (raw === null) return { sandbox: null, problem: null };
  try {
    const parsed = localSandboxSchema.safeParse(JSON.parse(raw));
    return parsed.success ? { sandbox: parsed.data, problem: null } : { sandbox: null, problem: "unreadable" };
  } catch {
    return { sandbox: null, problem: "unreadable" };
  }
}

/** Saves (or, for null, removes) the sandbox. Returns false when the browser refused, for example when storage is full. */
export function writeSandbox(storage: Storage | null, sandbox: LocalSandbox | null): boolean {
  if (!storage) return false;
  try {
    if (sandbox) storage.setItem(STORAGE_KEY, JSON.stringify(sandbox));
    else storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}
