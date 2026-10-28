import Link from "next/link";
import type { EnvProblem } from "@/lib/env";

/**
 * Shown instead of a page when the environment variables it needs are missing or wrong. Names the
 * variables and what is wrong with them, never their values.
 */
export function SetupNotice({ problems }: { problems: readonly EnvProblem[] }) {
  return (
    <div className="notice space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-sun-100">This part of the site is not connected yet</h2>
        <p className="mt-1 text-sm text-sun-100">
          It needs a database (Supabase), and these settings are missing or wrong. Fix them in <code>.env.local</code> (or your
          server&rsquo;s environment settings), then restart the app. The <Link href="/setup" className="underline">setup check</Link>{" "}
          tests the whole connection.
        </p>
      </div>
      <ul className="space-y-1.5 text-sm text-sun-100">
        {problems.map(({ name, problem }) => (
          <li key={name}>
            <code className="font-semibold">{name}</code>: {problem}
          </li>
        ))}
      </ul>
      <p className="border-t border-sun/20 pt-3 text-sm text-ink-muted">
        Just looking around? The{" "}
        <Link href="/sandbox" className="link">
          sandbox
        </Link>{" "}
        works without any setup.
      </p>
    </div>
  );
}
