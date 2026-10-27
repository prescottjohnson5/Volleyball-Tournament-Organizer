-- 0001_schema.sql
-- Tables for the Volleyball Tournament Organizer.
-- Paste into the Supabase SQL Editor and run. Run the migration files in numeric order.

-- Keeps updated_at current on every UPDATE.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- One row per organizer (a Supabase Auth user). Holds Stripe Connect state.
create table public.organizer_profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  stripe_account_id text unique,
  stripe_charges_enabled boolean not null default false,
  stripe_details_submitted boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizer_profiles_updated_at
  before update on public.organizer_profiles
  for each row execute function public.set_updated_at();

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,80}$'),
  name text not null check (char_length(name) between 3 and 100),
  event_date date not null,
  location text not null check (char_length(location) between 1 and 200),
  environment text not null check (environment in ('indoor', 'outdoor')),
  format text not null check (format in ('pool_to_single_elim', 'double_elim')),
  format_options jsonb not null default '{}'::jsonb,
  best_of smallint not null default 3 check (best_of in (1, 3, 5)),
  max_teams smallint not null check (max_teams between 2 and 64),
  registration_fee_cents integer not null check (registration_fee_cents between 100 and 1000000),
  currency text not null default 'usd' check (currency = 'usd'),
  status text not null default 'registration'
    check (status in ('registration', 'in_progress', 'completed')),
  -- Incremented by every bracket write. Used for optimistic locking (see 0003_functions.sql).
  version integer not null default 0,
  champion_team_id uuid,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tournaments_organizer_id_idx on public.tournaments (organizer_id);

create trigger tournaments_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- Public team information. Captain contact details live in team_private.
create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(name) between 2 and 60),
  payment_status text not null default 'pending'
    check (payment_status in ('pending', 'paid', 'expired', 'refunded')),
  seed smallint,
  pool text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index teams_tournament_id_idx on public.teams (tournament_id);
-- Two paid teams in one tournament cannot share a name (case-insensitive).
create unique index teams_paid_name_unique
  on public.teams (tournament_id, lower(name))
  where payment_status = 'paid';

alter table public.tournaments
  add constraint tournaments_champion_team_id_fkey
  foreign key (champion_team_id) references public.teams (id) on delete set null;

-- Private captain details. Only the tournament's organizer can read these rows.
-- The captain link token is never stored: only its SHA-256 hash.
create table public.team_private (
  team_id uuid primary key references public.teams (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  captain_name text not null check (char_length(captain_name) between 1 and 100),
  captain_email text not null check (char_length(captain_email) between 3 and 254),
  captain_token_hash text unique,
  captain_token_created_at timestamptz
);

create index team_private_tournament_id_idx on public.team_private (tournament_id);

-- Matches are created when the tournament starts (and when playoffs are seeded).
-- team_a_source / team_b_source describe where each slot's team comes from
-- (a seeded team, a bye, or the winner/loser of another match). The team ids,
-- status and set counts are derived from those sources plus the reported sets.
create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  phase text not null check (phase in ('pool', 'bracket')),
  bracket text not null check (bracket in ('pool', 'winners', 'losers', 'final')),
  round smallint not null check (round >= 1),
  position smallint not null check (position >= 1),
  pool text,
  label text not null,
  order_index integer not null,
  team_a_source jsonb not null,
  team_b_source jsonb not null,
  reset_of_match_id uuid references public.matches (id) on delete cascade deferrable initially deferred,
  team_a_id uuid references public.teams (id),
  team_b_id uuid references public.teams (id),
  winner_id uuid references public.teams (id),
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'in_progress', 'completed', 'bye', 'not_needed')),
  sets_a smallint not null default 0,
  sets_b smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, order_index)
);

create index matches_tournament_id_idx on public.matches (tournament_id);

create trigger matches_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- One row per completed set. Records who reported it.
create table public.match_sets (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  set_number smallint not null check (set_number between 1 and 5),
  score_a smallint not null check (score_a between 0 and 99),
  score_b smallint not null check (score_b between 0 and 99),
  reported_by text not null check (reported_by in ('captain', 'organizer')),
  reported_by_team_id uuid references public.teams (id) on delete set null,
  reported_by_user_id uuid references auth.users (id) on delete set null,
  reported_at timestamptz not null default now(),
  unique (match_id, set_number)
);

create index match_sets_tournament_id_idx on public.match_sets (tournament_id);

-- Stripe webhook events that were processed, for idempotency.
create table public.stripe_events (
  id text primary key,
  type text not null,
  processed_at timestamptz not null default now()
);
