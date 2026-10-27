import Link from "next/link";
import {
  BracketIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  LinkIcon,
  PhoneIcon,
  PlusSquareIcon,
  TrophyIcon,
} from "@/components/Icons";
import { TryItButton } from "@/components/TryItButton";

const TOPICS = [
  {
    Icon: PlusSquareIcon,
    title: "Create your tournament",
    body: "Pick indoor or beach, how many teams, and the format: pool play then a knockout bracket, or double elimination.",
  },
  {
    Icon: LinkIcon,
    title: "Share one link",
    body: "Teams sign up from a link or a QR code. Each captain gets a private link to report their team's scores.",
  },
  {
    Icon: PhoneIcon,
    title: "Follow it live",
    body: "Standings and brackets update on everyone's phone as games finish. Players and fans don't need an account.",
  },
  {
    Icon: BracketIcon,
    title: "Pools and brackets, built for you",
    body: "Pools, brackets and byes are worked out for you, even with an odd number of teams.",
  },
  {
    Icon: CheckCircleIcon,
    title: "Real volleyball rules",
    body: "Scores are checked as they come in: sets to 25 indoors or 21 on the beach, a deciding set to 15, win by 2.",
  },
  {
    Icon: TrophyIcon,
    title: "Winners move on by themselves",
    body: "The bracket fills in as matches finish, and you can correct any score if a captain gets it wrong.",
  },
];

export default function HomePage() {
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <section className="pt-8 text-center sm:pt-14">
        <h1 className="text-4xl leading-[1.05] font-extrabold tracking-tight sm:text-6xl">
          Run your volleyball tournament from your phone.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-lg text-ink-muted">
          Teams sign up with one link, the schedule builds itself, and everyone follows the scores live.
        </p>
      </section>

      <section aria-label="Get started" className="relative mt-10">
        {/* Soft glow behind the panel, like stage lights. Kept inside the column so it never adds sideways scroll. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-6 -top-6 -bottom-6 rounded-full bg-[radial-gradient(closest-side_at_30%_50%,rgb(71_139_141/0.45),transparent),radial-gradient(closest-side_at_75%_50%,rgb(41_70_105/0.8),transparent),radial-gradient(closest-side_at_55%_20%,rgb(228_211_41/0.12),transparent)] blur-2xl"
        />
        <div className="relative rounded-3xl border border-ink-faint/60 bg-midnight-950/80 p-5 sm:p-6">
          <p className="text-ink-muted">Try every organizer tool in a private sandbox. No account, nothing to install.</p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-start">
            <TryItButton className="btn-primary w-full sm:w-auto" />
            <Link href="/demo" className="btn-secondary w-full sm:w-auto">
              Watch a simulated demo
            </Link>
          </div>
        </div>
        <p className="relative mt-3 text-xs text-ink-subtle">
          Sandbox data is deleted after 24 hours. Running a real event?{" "}
          <Link href="/signup" className="link">
            Create a free account
          </Link>
          .
        </p>
      </section>

      <section aria-labelledby="how-it-works" className="mt-16">
        <h2 id="how-it-works" className="text-2xl font-extrabold tracking-tight">
          How it works
        </h2>
        <ul className="mt-4">
          {TOPICS.map(({ Icon, title, body }) => (
            <li key={title} className="border-b border-line">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-center gap-4 px-2 py-5 font-bold hover:text-sun-100 [&::-webkit-details-marker]:hidden">
                  <Icon className="h-5 w-5 shrink-0 text-teal" />
                  <span className="flex-1">{title}</span>
                  <ChevronDownIcon className="h-5 w-5 shrink-0 text-ink-subtle transition-transform group-open:rotate-180" />
                </summary>
                <p className="pr-2 pb-5 pl-11 text-ink-muted">{body}</p>
              </details>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
