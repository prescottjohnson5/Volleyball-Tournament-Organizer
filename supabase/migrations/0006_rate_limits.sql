-- 0006_rate_limits.sql
-- Simple fixed-window rate limits for public API routes and sign-up related actions.
-- Kept in Postgres so every serverless instance shares the same counters. Safe to run more than once.

-- One row per (limit, client, window). `key` holds the limit name and a hash of the client's IP
-- address, never the raw address. Old rows are deleted by the daily cleanup job.
create table if not exists public.rate_limits (
  key text not null,
  window_start timestamptz not null,
  hits integer not null default 0,
  primary key (key, window_start)
);

-- No policies: only the service role can read or write it.
alter table public.rate_limits enable row level security;
revoke all on public.rate_limits from anon, authenticated;

-- Counts one hit for `p_key` in the current window of `p_window_seconds` and returns the number
-- of hits so far in that window (including this one). Atomic, so concurrent requests count correctly.
create or replace function public.rate_limit_hit(p_key text, p_window_seconds integer)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds
  );
  v_hits integer;
begin
  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, v_window, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into v_hits;
  return v_hits;
end;
$$;

revoke execute on function public.rate_limit_hit(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer) to service_role;
