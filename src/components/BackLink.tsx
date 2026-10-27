import Link from "next/link";
import { ArrowLeftIcon } from "./Icons";

/** The "go back one level" link at the top of inner pages. */
export function BackLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-subtle hover:text-ink">
      <ArrowLeftIcon className="h-4 w-4" />
      {children}
    </Link>
  );
}
