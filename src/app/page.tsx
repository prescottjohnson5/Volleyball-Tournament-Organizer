import Link from "next/link";
import { ArrowRightIcon, EyeIcon, PlusSquareIcon } from "@/components/Icons";

const CHOICES = [
  {
    href: "/dashboard/tournaments/new",
    Icon: PlusSquareIcon,
    iconClass: "text-sun",
    title: "Create a tournament",
    body: "Host your own event. Teams sign up with one link and the schedule builds itself.",
  },
  {
    href: "/tournaments",
    Icon: EyeIcon,
    iconClass: "text-teal",
    title: "View a tournament",
    body: "Find an event and follow its teams, matches, standings and bracket.",
  },
];

/** The landing screen: two choices and nothing else. */
export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl pt-10 sm:pt-20">
      <h1 className="text-center text-4xl leading-[1.05] font-extrabold sm:text-6xl">Volleyball tournaments, made simple.</h1>
      <p className="mt-4 text-center text-lg text-ink-muted">What would you like to do?</p>

      <ul className="mt-10 grid gap-4 sm:grid-cols-2">
        {CHOICES.map(({ href, Icon, iconClass, title, body }) => (
          <li key={href}>
            <Link
              href={href}
              className="group flex h-full flex-col rounded-3xl border border-line bg-surface p-6 transition-colors hover:border-ink-faint hover:bg-surface-raised focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sun sm:p-8"
            >
              <Icon className={`h-8 w-8 ${iconClass}`} />
              <span className="mt-6 flex items-center justify-between gap-3 text-2xl font-extrabold tracking-tight">
                {title}
                <ArrowRightIcon className="h-6 w-6 shrink-0 text-ink-subtle transition-transform group-hover:translate-x-1 group-hover:text-ink" />
              </span>
              <span className="mt-2 text-ink-muted">{body}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
