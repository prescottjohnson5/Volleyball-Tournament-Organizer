-- 0002_rls.sql
-- Row Level Security: public read, restricted write.
-- Anonymous visitors can read public tournament data. There are NO insert/update/delete
-- policies: every write goes through a Next.js server route that checks the organizer
-- session or captain token and then uses the service role key (which bypasses RLS).

alter table public.organizer_profiles enable row level security;
alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.team_private enable row level security;
alter table public.matches enable row level security;
alter table public.match_sets enable row level security;
alter table public.stripe_events enable row level security;

-- Defense in depth: browser roles cannot write even if a permissive policy is added by mistake.
revoke insert, update, delete, truncate on all tables in schema public from anon, authenticated;

-- Tournaments, matches and sets are public.
create policy "Tournaments are publicly readable"
  on public.tournaments for select
  to anon, authenticated
  using (true);

create policy "Matches are publicly readable"
  on public.matches for select
  to anon, authenticated
  using (true);

create policy "Match sets are publicly readable"
  on public.match_sets for select
  to anon, authenticated
  using (true);

-- Only teams whose payment was confirmed are public.
create policy "Paid teams are publicly readable"
  on public.teams for select
  to anon, authenticated
  using (payment_status = 'paid');

-- Organizers can also see pending, expired and refunded teams in their own tournaments.
create policy "Organizers can read all teams in their tournaments"
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = teams.tournament_id
        and t.organizer_id = (select auth.uid())
    )
  );

-- Captain contact details: organizer of the tournament only.
create policy "Organizers can read captain details for their tournaments"
  on public.team_private for select
  to authenticated
  using (
    exists (
      select 1 from public.tournaments t
      where t.id = team_private.tournament_id
        and t.organizer_id = (select auth.uid())
    )
  );

create policy "Organizers can read their own profile"
  on public.organizer_profiles for select
  to authenticated
  using (id = (select auth.uid()));

-- stripe_events has RLS enabled and no policies: only the service role can touch it.
