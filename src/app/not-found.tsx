import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <p className="text-4xl" aria-hidden>
        🏐
      </p>
      <h1 className="text-xl font-bold">Out of bounds</h1>
      <p className="text-slate-600">We could not find that page. Check the link you were sent, or ask the organizer for a new one.</p>
      <Link href="/" className="btn-primary">
        Go home
      </Link>
    </div>
  );
}
