import type { Metadata } from "next";
import { BackLink } from "@/components/BackLink";
import { SearchIcon } from "@/components/Icons";
import { SetupNotice } from "@/components/SetupNotice";
import { ListRowLink, TournamentList } from "@/components/tournament/TournamentList";
import { getOrganizer } from "@/lib/auth";
import { listOrganizerTournaments } from "@/lib/data/dashboard";
import { listPublicTournaments } from "@/lib/data/public";
import { missingEnv } from "@/lib/env";
import { matchesSearch, normalizeSearch, sortForBrowsing } from "@/lib/tournaments/browse";

export const metadata: Metadata = { title: "Find a tournament" };
export const dynamic = "force-dynamic";

/** "View a tournament": search and pick a tournament, then open its page. */
export default async function BrowseTournamentsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  const query = normalizeSearch((await searchParams).q);
  const missing = missingEnv(["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"]);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="space-y-4">
        <BackLink href="/">Home</BackLink>
        <h1 className="text-3xl font-extrabold sm:text-4xl">Find a tournament</h1>
        <form role="search" action="/tournaments" className="flex gap-2">
          <div className="relative flex-1">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-ink-subtle" />
            <label htmlFor="q" className="sr-only">
              Tournament name
            </label>
            <input id="q" name="q" type="search" defaultValue={query} maxLength={100} placeholder="Search by name" className="input pl-10" />
          </div>
          <button type="submit" className="btn-secondary">
            Search
          </button>
        </form>
      </div>

      {missing.length > 0 ? <SetupNotice missing={missing} /> : <Results query={query} />}

      <section aria-labelledby="sample" className="space-y-2">
        <h2 id="sample" className="text-sm font-semibold tracking-wide text-ink-subtle uppercase">
          Just looking?
        </h2>
        <div className="border-t border-line">
          <div className="border-b border-line">
            <ListRowLink href="/demo" title="Sample tournament" detail="Simulated teams and scores" />
          </div>
        </div>
      </section>
    </div>
  );
}

async function Results({ query }: { query: string }) {
  const organizer = await getOrganizer();
  const [mine, all] = await Promise.all([
    organizer ? listOrganizerTournaments(organizer.id) : [],
    listPublicTournaments(query),
  ]);
  const mineMatching = sortForBrowsing(mine.filter((t) => matchesSearch(t, query)));
  const mineIds = new Set(mine.map((t) => t.id));
  const others = all.filter((t) => !mineIds.has(t.id));
  const hrefFor = (t: { slug: string }) => `/t/${t.slug}`;

  return (
    <>
      {mineMatching.length > 0 && (
        <section aria-labelledby="mine" className="space-y-2">
          <h2 id="mine" className="text-sm font-semibold tracking-wide text-ink-subtle uppercase">
            Your tournaments
          </h2>
          <TournamentList items={mineMatching} hrefFor={hrefFor} />
        </section>
      )}

      <section aria-labelledby="all" className="space-y-2">
        <h2 id="all" className="text-sm font-semibold tracking-wide text-ink-subtle uppercase">
          {query ? `Results for “${query}”` : mineMatching.length > 0 ? "Other tournaments" : "All tournaments"}
        </h2>
        {others.length > 0 ? (
          <TournamentList items={others} hrefFor={hrefFor} />
        ) : (
          <p className="empty-state">
            {query ? "No tournaments match that name. Check the spelling, or ask the organizer for the link." : "No tournaments yet."}
          </p>
        )}
      </section>
    </>
  );
}
