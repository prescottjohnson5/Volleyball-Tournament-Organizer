import Link from "next/link";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <section className="space-y-4 pt-4">
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">Run your volleyball tournament from your phone.</h1>
        <p className="max-w-2xl text-lg text-slate-600">
          Create a tournament, share a registration link or QR code, collect fees with Stripe and let everyone follow
          live scores without an account.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/dashboard" className="btn-primary">
            Organizer dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
