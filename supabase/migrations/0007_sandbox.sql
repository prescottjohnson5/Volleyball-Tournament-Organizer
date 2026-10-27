-- 0007_sandbox.sql
-- Sandbox organizers: visitors who press "Try it" are signed in with a Supabase anonymous
-- sign-in. Their data is deleted daily by /api/cron/cleanup. Safe to run more than once.

alter table public.organizer_profiles add column if not exists is_sandbox boolean not null default false;
alter table public.tournaments add column if not exists is_sandbox boolean not null default false;

-- Sandbox limits, enforced here as well as in the API: at most 8 teams, never a fee,
-- and one tournament per sandbox organizer.
alter table public.tournaments drop constraint if exists tournaments_sandbox_limits;
alter table public.tournaments
  add constraint tournaments_sandbox_limits
  check (not is_sandbox or (max_teams <= 8 and registration_fee_cents = 0));

create unique index if not exists tournaments_one_per_sandbox_organizer
  on public.tournaments (organizer_id)
  where is_sandbox;

-- For the daily cleanup.
create index if not exists organizer_profiles_sandbox_created_at_idx
  on public.organizer_profiles (created_at)
  where is_sandbox;
create index if not exists tournaments_sandbox_created_at_idx
  on public.tournaments (created_at)
  where is_sandbox;
