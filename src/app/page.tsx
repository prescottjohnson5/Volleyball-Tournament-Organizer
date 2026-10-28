import Link from "next/link";
import { ArrowRightIcon, BracketIcon, LinkIcon, PhoneIcon, TrophyIcon } from "@/components/Icons";

const FEATURES = [
  { Icon: LinkIcon, title: "One sign-up link", body: "Share a link or QR code. Teams register themselves." },
  { Icon: BracketIcon, title: "Brackets build themselves", body: "Pools, playoffs and byes, worked out for any number of teams." },
  { Icon: PhoneIcon, title: "Live on every phone", body: "Scores, standings and the bracket update as games finish." },
];

/** The landing page: what the product is, and the two things a visitor came to do. */
export default function HomePage() {
  return (
    <div className="pb-6">
      <section className="grid items-center gap-12 pt-8 sm:pt-16 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
        <div className="text-center lg:text-left">
          <p className="text-sm font-bold tracking-widest text-teal-300 uppercase">Volleyball tournament organizer</p>
          <h1 className="mt-4 text-5xl leading-[0.95] font-extrabold tracking-tight sm:text-7xl">
            Tournaments
            <br />
            made <span className="text-sun">easy.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-lg text-lg text-ink-muted lg:mx-0">
            Set up a volleyball tournament in minutes. Teams sign up from one link, the schedule and bracket build themselves, and
            everyone follows the scores live.
          </p>
          <div className="mx-auto mt-9 flex max-w-sm flex-col gap-3 sm:max-w-none sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/dashboard/tournaments/new" className="btn-primary px-7 text-base">
              Create a Tournament
            </Link>
            <Link href="/tournaments" className="btn-secondary px-7 text-base">
              View a Tournament
            </Link>
          </div>
          <p className="mt-5 text-sm text-ink-subtle">
            No account needed to try it.{" "}
            <Link href="/sandbox" className="link">
              Open the sandbox
            </Link>
          </p>
        </div>

        <ProductPreview />
      </section>

      <section aria-label="What it does" className="mt-20 grid gap-8 border-t border-line pt-10 sm:mt-24 sm:grid-cols-3 sm:gap-6">
        {FEATURES.map(({ Icon, title, body }) => (
          <div key={title} className="flex gap-4 sm:flex-col sm:gap-3">
            <Icon className="h-6 w-6 shrink-0 text-teal" />
            <div>
              <h2 className="font-bold">{title}</h2>
              <p className="mt-1 text-sm text-ink-muted">{body}</p>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

/** A still picture of the app (a live match and the playoff bracket), drawn with the app's own styles. Decorative. */
function ProductPreview() {
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md select-none">
      {/* Soft stage-light glow, kept inside the column so it never causes sideways scrolling. */}
      <div className="pointer-events-none absolute inset-4 rounded-full bg-[radial-gradient(closest-side_at_35%_45%,rgb(71_139_141/0.45),transparent),radial-gradient(closest-side_at_70%_60%,rgb(41_70_105/0.9),transparent),radial-gradient(closest-side_at_60%_15%,rgb(228_211_41/0.14),transparent)] blur-2xl" />
      <div className="relative space-y-3 rounded-3xl border border-line bg-surface/90 p-4 shadow-2xl sm:p-5">
        <div className="rounded-2xl border border-red-400/60 bg-surface-raised p-4">
          <div className="mb-3 flex items-center justify-between text-xs">
            <span className="font-semibold tracking-wide text-ink-subtle uppercase">Pool A · Court 2</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/20 px-2 py-0.5 font-semibold text-red-200">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
              Live
            </span>
          </div>
          <PreviewRow team="Sand Sharks" scores={[21, 18, 11]} sets={1} />
          <PreviewRow team="Net Ninjas" scores={[17, 21, 9]} sets={1} muted />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
          <div className="space-y-2">
            <PreviewSlot label="Semifinal 1" winner="Sand Sharks" loser="Dig Deep" />
            <PreviewSlot label="Semifinal 2" winner="Block Party" loser="Ace Squad" />
          </div>
          <ArrowRightIcon className="h-4 w-4 text-ink-faint" />
          <div className="rounded-xl border border-sun/40 p-3">
            <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">Final</p>
            <p className="mt-1 truncate font-bold">Sand Sharks</p>
            <p className="truncate text-ink-subtle">Block Party</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-sun">
              <TrophyIcon className="h-4 w-4" />
              Up next
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ team, scores, sets, muted = false }: { team: string; scores: number[]; sets: number; muted?: boolean }) {
  return (
    <div className={`flex items-center gap-2 py-1 text-sm ${muted ? "text-ink-muted" : "font-semibold"}`}>
      <span className="min-w-0 flex-1 truncate">{team}</span>
      {scores.map((score, i) => (
        <span key={i} className="w-7 text-center tabular-nums">
          {score}
        </span>
      ))}
      <span className="w-6 text-right text-base font-bold tabular-nums">{sets}</span>
    </div>
  );
}

function PreviewSlot({ label, winner, loser }: { label: string; winner: string; loser: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface-raised p-3">
      <p className="text-[11px] font-semibold tracking-wide text-ink-subtle uppercase">{label}</p>
      <p className="mt-1 truncate font-bold">{winner}</p>
      <p className="truncate text-ink-faint">{loser}</p>
    </div>
  );
}
