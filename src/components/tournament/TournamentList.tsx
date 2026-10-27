import Link from "next/link";
import { ChevronRightIcon } from "@/components/Icons";
import type { TournamentListItem } from "@/lib/tournaments/browse";
import { formatEventDate } from "@/lib/tournaments/labels";
import { TournamentStatusBadge } from "./TournamentStatusBadge";

/** A plain list of tournaments, one row each, separated by thin lines. */
export function TournamentList({ items, hrefFor }: { items: readonly TournamentListItem[]; hrefFor: (item: TournamentListItem) => string }) {
  return (
    <ul className="border-t border-line">
      {items.map((item) => (
        <li key={item.id} className="border-b border-line">
          <ListRowLink href={hrefFor(item)} title={item.name} detail={`${formatEventDate(item.event_date)} · ${item.location}`}>
            <TournamentStatusBadge status={item.status} />
          </ListRowLink>
        </li>
      ))}
    </ul>
  );
}

/** One tappable row: title and detail on the left, an optional badge, then a chevron. */
export function ListRowLink({ href, title, detail, children }: { href: string; title: string; detail: string; children?: React.ReactNode }) {
  return (
    <Link href={href} className="group flex items-center gap-3 px-2 py-4 hover:bg-surface focus-visible:outline-2 focus-visible:outline-sun">
      <span className="min-w-0 flex-1">
        <span className="block truncate font-bold group-hover:text-sun-100">{title}</span>
        <span className="block truncate text-sm text-ink-subtle">{detail}</span>
      </span>
      {children}
      <ChevronRightIcon className="h-5 w-5 shrink-0 text-ink-subtle" />
    </Link>
  );
}
