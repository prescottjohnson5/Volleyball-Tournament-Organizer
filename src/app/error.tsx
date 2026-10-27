"use client";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center" role="alert">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="text-slate-600">
        The page could not load. This is usually a brief connection problem. Try again, and if it keeps happening, check that the
        server&apos;s environment variables are set (see <code>/setup</code>).
      </p>
      {error.digest && <p className="font-mono text-xs text-slate-400">Reference: {error.digest}</p>}
      <button type="button" className="btn-primary" onClick={reset}>
        Try again
      </button>
    </div>
  );
}
