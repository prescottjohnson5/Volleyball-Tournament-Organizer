import Link from "next/link";
import { requireOrganizer } from "@/lib/auth";
import { listOrganizerTournaments } from "@/lib/data/dashboard";
import { formatCents } from "@/lib/money";
import { FORMAT_LABELS, formatEventDate, STATUS_LABELS } from "@/lib/tournaments/labels";

export default async function DashboardPage() {
  const organizer = await requireOrganizer();
  const tournaments = await listOrganizerTournaments(organizer.id);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Your tournaments</h1>
          <p className="text-sm text-slate-600">Signed in as {organizer.email ?? "organizer"}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/tournaments/new" className="btn-primary">
            New tournament
          </Link>
          <form action="/auth/signout" method="post">
            <button type="submit" className="btn-secondary">
              Sign out
            </button>
          </form>
        </div>
      </div>

      {tournaments.length === 0 ? (
        <div className="card text-center text-slate-600">
          <p>No tournaments yet.</p>
          <p className="mt-1 text-sm">Create one to get a registration link and QR code.</p>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {tournaments.map((t) => (
            <li key={t.id}>
              <Link href={`/dashboard/tournaments/${t.id}`} className="card block hover:border-brand-500">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold">{t.name}</h2>
                  <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                    {STATUS_LABELS[t.status]}
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {formatEventDate(t.event_date)} · {t.location}
                </p>
                <p className="mt-2 text-sm text-slate-700">
                  {FORMAT_LABELS[t.format]} · {t.paidTeams}/{t.max_teams} teams paid ·{" "}
                  {formatCents(t.registration_fee_cents, t.currency)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
