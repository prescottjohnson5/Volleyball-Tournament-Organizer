import Link from "next/link";
import { TryItButton } from "@/components/TryItButton";

const STEPS = [
  {
    icon: "📝",
    title: "Create your tournament",
    body: "Pick indoor or beach, how many teams, and the format: pool play then a knockout bracket, or double elimination.",
  },
  {
    icon: "🔗",
    title: "Share one link",
    body: "Teams sign up from a link or a QR code. Each captain gets a private link to report their team's scores.",
  },
  {
    icon: "📱",
    title: "Follow it live",
    body: "Standings and brackets update on everyone's phone as games finish. Players and fans don't need an account.",
  },
];

const HANDLED = [
  "Pools, brackets and byes are worked out for you, even with an odd number of teams",
  "Scores are checked against real volleyball rules (sets to 25 or 21, deciding set to 15, win by 2)",
  "Winners move on automatically, and you can correct any score",
];

export default function HomePage() {
  return (
    <div className="space-y-10 pb-6">
      <section className="-mx-4 -mt-6 bg-linear-to-br from-brand-600 to-brand-700 px-5 py-10 text-white sm:mx-0 sm:mt-0 sm:rounded-2xl sm:px-10 sm:py-14">
        <p className="text-sm font-semibold tracking-wide text-brand-100 uppercase">For volleyball tournament organizers</p>
        <h1 className="mt-3 text-3xl leading-tight font-bold tracking-tight sm:text-5xl">
          Run your volleyball tournament from your phone.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-brand-50">
          Teams sign up with one link, the schedule builds itself, and everyone follows the scores live. No spreadsheets, no
          whiteboard, no group-chat chaos.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:items-start">
          <TryItButton className="btn w-full bg-white text-brand-700 hover:bg-brand-50 sm:w-auto" />
          <Link href="/demo" className="btn w-full border border-white/50 text-white hover:bg-white/10 sm:w-auto">
            Watch a simulated demo
          </Link>
        </div>
        <p className="mt-3 text-sm text-brand-100">
          &ldquo;Try it for real&rdquo; needs no sign-up: you get a private sandbox for 24 hours.
        </p>
      </section>

      <section aria-labelledby="how-it-works" className="space-y-4">
        <h2 id="how-it-works" className="text-xl font-bold">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="card space-y-2">
              <p className="flex items-center gap-2 font-semibold">
                <span aria-hidden className="text-2xl">
                  {step.icon}
                </span>
                <span>
                  {index + 1}. {step.title}
                </span>
              </p>
              <p className="text-sm text-slate-600">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="handled" className="card space-y-3">
        <h2 id="handled" className="text-lg font-bold">
          The fiddly parts are handled
        </h2>
        <ul className="space-y-2 text-sm text-slate-700">
          {HANDLED.map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden className="text-green-600">
                ✓
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="text-center text-sm text-slate-600">
        <p>
          Running a real event?{" "}
          <Link href="/signup" className="font-medium text-brand-700 underline">
            Create a free organizer account
          </Link>{" "}
          or{" "}
          <Link href="/login" className="font-medium text-brand-700 underline">
            sign in
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
