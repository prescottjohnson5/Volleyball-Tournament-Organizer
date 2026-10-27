import Link from "next/link";
import { LogoMark } from "@/components/Icons";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-md space-y-3 text-center">
      <LogoMark className="mx-auto h-12 w-12" />
      <h1 className="text-xl font-bold">Out of bounds</h1>
      <p className="text-ink-muted">We could not find that page. Check the link you were sent, or ask the organizer for a new one.</p>
      <Link href="/" className="btn-primary">
        Go home
      </Link>
    </div>
  );
}
