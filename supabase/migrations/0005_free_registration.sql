-- 0005_free_registration.sql
-- Free registration, used when payments are turned off (PAYMENTS_ENABLED is not "true") and for
-- sandbox tournaments. Safe to run more than once.

-- A tournament without payments stores a fee of 0.
alter table public.tournaments drop constraint if exists tournaments_registration_fee_cents_check;
alter table public.tournaments
  add constraint tournaments_registration_fee_cents_check
  check (registration_fee_cents between 0 and 1000000);

-- Registers a team with no payment step, in one transaction. Locks the tournament row so two
-- captains registering at once cannot overfill it. The team is stored with payment_status 'paid',
-- which the rest of the app reads as "registration confirmed". Only the captain token's hash is
-- stored; the caller shows the token to the captain once.
-- Returns {"status": ...} where status is one of:
--   'registered'  (also returns "team_id")
--   'not_found'   no such tournament
--   'closed'      the tournament has started
--   'full'        max_teams confirmed teams already
--   'name_taken'  a confirmed team already uses that name (case-insensitive)
create or replace function public.register_free_team(
  p_tournament_id uuid,
  p_team_name text,
  p_captain_name text,
  p_captain_email text,
  p_captain_token_hash text
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_tournament public.tournaments;
  v_team_id uuid;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found then
    return jsonb_build_object('status', 'not_found');
  end if;
  if v_tournament.status <> 'registration' then
    return jsonb_build_object('status', 'closed');
  end if;
  if (
    select count(*) from public.teams
    where tournament_id = p_tournament_id and payment_status = 'paid'
  ) >= v_tournament.max_teams then
    return jsonb_build_object('status', 'full');
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = p_tournament_id
      and payment_status = 'paid'
      and lower(name) = lower(p_team_name)
  ) then
    return jsonb_build_object('status', 'name_taken');
  end if;

  insert into public.teams (tournament_id, name, payment_status, paid_at)
  values (p_tournament_id, p_team_name, 'paid', now())
  returning id into v_team_id;

  insert into public.team_private (
    team_id, tournament_id, captain_name, captain_email, captain_token_hash, captain_token_created_at
  )
  values (v_team_id, p_tournament_id, p_captain_name, p_captain_email, p_captain_token_hash, now());

  return jsonb_build_object('status', 'registered', 'team_id', v_team_id);
end;
$$;

revoke execute on function public.register_free_team(uuid, text, text, text, text) from public, anon, authenticated;
grant execute on function public.register_free_team(uuid, text, text, text, text) to service_role;
