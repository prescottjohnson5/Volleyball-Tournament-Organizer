-- 0003_functions.sql
-- Postgres functions for writes that must change several rows atomically.
-- They are callable only with the service role key (from Next.js server routes).

-- Confirms a team's payment after Stripe reports a paid Checkout Session.
-- Locks the tournament row so two webhooks arriving at once cannot overfill it.
-- Returns one of:
--   'confirmed'        team is now paid
--   'already_paid'     a previous delivery already confirmed it (idempotent replay)
--   'needs_refund'     tournament full or closed; team marked refunded, caller must refund
--   'already_refunded' a previous delivery already marked it for refund
--   'not_found'        no team for that checkout session
create or replace function public.confirm_team_payment(
  p_checkout_session_id text,
  p_payment_intent_id text
)
returns text
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_team public.teams;
  v_tournament public.tournaments;
  v_paid_count integer;
  v_name text;
  v_suffix integer := 2;
begin
  select * into v_team
  from public.teams
  where stripe_checkout_session_id = p_checkout_session_id
  for update;

  if not found then
    return 'not_found';
  end if;
  if v_team.payment_status = 'paid' then
    return 'already_paid';
  end if;
  if v_team.payment_status = 'refunded' then
    return 'already_refunded';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_team.tournament_id
  for update;

  select count(*) into v_paid_count
  from public.teams
  where tournament_id = v_tournament.id and payment_status = 'paid';

  if v_tournament.status <> 'registration' or v_paid_count >= v_tournament.max_teams then
    update public.teams
    set payment_status = 'refunded', stripe_payment_intent_id = p_payment_intent_id
    where id = v_team.id;
    return 'needs_refund';
  end if;

  -- Another team with the same name paid first: keep both by suffixing this one.
  v_name := v_team.name;
  while exists (
    select 1 from public.teams
    where tournament_id = v_tournament.id
      and payment_status = 'paid'
      and lower(name) = lower(v_name)
  ) loop
    v_name := left(v_team.name, 55) || ' (' || v_suffix || ')';
    v_suffix := v_suffix + 1;
  end loop;

  update public.teams
  set payment_status = 'paid',
      paid_at = now(),
      name = v_name,
      stripe_payment_intent_id = p_payment_intent_id
  where id = v_team.id;

  return 'confirmed';
end;
$$;

-- Applies a batch of bracket changes computed by the TypeScript engine, in one transaction.
-- p_expected_version must equal tournaments.version, otherwise the call fails with
-- 'version_conflict' and nothing is written (optimistic locking: the server reloads and retries).
--
-- p_changes shape (every key optional):
-- {
--   "tournament":      { "status": "...", "champion_team_id": "uuid|null", "started_at": "...", "completed_at": "..." },
--   "teams":           [ { "id": "uuid", "seed": 1, "pool": "A" } ],
--   "new_matches":     [ { "id", "phase", "bracket", "round", "position", "pool", "label",
--                          "order_index", "team_a_source", "team_b_source", "reset_of_match_id" } ],
--   "set_replacements":[ { "match_id": "uuid", "sets": [ <match_sets row> ] } ],
--   "set_inserts":     [ <match_sets row> ],
--   "match_updates":   [ { "id", "team_a_id", "team_b_id", "winner_id", "status", "sets_a", "sets_b" } ]
-- }
-- Returns the new version number.
create or replace function public.commit_tournament_changes(
  p_tournament_id uuid,
  p_expected_version integer,
  p_changes jsonb
)
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_version integer;
  v_tournament jsonb := p_changes -> 'tournament';
  v_replacement jsonb;
begin
  update public.tournaments
  set version = version + 1
  where id = p_tournament_id and version = p_expected_version
  returning version into v_version;

  if v_version is null then
    raise exception 'version_conflict' using errcode = 'P0001';
  end if;

  if v_tournament is not null then
    update public.tournaments
    set status = coalesce(v_tournament ->> 'status', status),
        champion_team_id = case when v_tournament ? 'champion_team_id'
          then (v_tournament ->> 'champion_team_id')::uuid else champion_team_id end,
        started_at = case when v_tournament ? 'started_at'
          then (v_tournament ->> 'started_at')::timestamptz else started_at end,
        completed_at = case when v_tournament ? 'completed_at'
          then (v_tournament ->> 'completed_at')::timestamptz else completed_at end
    where id = p_tournament_id;
  end if;

  update public.teams t
  set seed = x.seed, pool = x.pool
  from jsonb_to_recordset(coalesce(p_changes -> 'teams', '[]'::jsonb))
    as x (id uuid, seed smallint, pool text)
  where t.id = x.id and t.tournament_id = p_tournament_id;

  insert into public.matches (
    id, tournament_id, phase, bracket, round, position, pool, label, order_index,
    team_a_source, team_b_source, reset_of_match_id
  )
  select
    x.id, p_tournament_id, x.phase, x.bracket, x.round, x.position, x.pool, x.label, x.order_index,
    x.team_a_source, x.team_b_source, x.reset_of_match_id
  from jsonb_to_recordset(coalesce(p_changes -> 'new_matches', '[]'::jsonb))
    as x (
      id uuid, phase text, bracket text, round smallint, position smallint, pool text, label text,
      order_index integer, team_a_source jsonb, team_b_source jsonb, reset_of_match_id uuid
    );

  for v_replacement in
    select value from jsonb_array_elements(coalesce(p_changes -> 'set_replacements', '[]'::jsonb))
  loop
    delete from public.match_sets
    where match_id = (v_replacement ->> 'match_id')::uuid and tournament_id = p_tournament_id;

    insert into public.match_sets (
      match_id, tournament_id, set_number, score_a, score_b,
      reported_by, reported_by_team_id, reported_by_user_id, reported_at
    )
    select
      (v_replacement ->> 'match_id')::uuid, p_tournament_id, x.set_number, x.score_a, x.score_b,
      x.reported_by, x.reported_by_team_id, x.reported_by_user_id, coalesce(x.reported_at, now())
    from jsonb_to_recordset(coalesce(v_replacement -> 'sets', '[]'::jsonb))
      as x (
        set_number smallint, score_a smallint, score_b smallint, reported_by text,
        reported_by_team_id uuid, reported_by_user_id uuid, reported_at timestamptz
      );
  end loop;

  insert into public.match_sets (
    match_id, tournament_id, set_number, score_a, score_b,
    reported_by, reported_by_team_id, reported_by_user_id
  )
  select
    x.match_id, p_tournament_id, x.set_number, x.score_a, x.score_b,
    x.reported_by, x.reported_by_team_id, x.reported_by_user_id
  from jsonb_to_recordset(coalesce(p_changes -> 'set_inserts', '[]'::jsonb))
    as x (
      match_id uuid, set_number smallint, score_a smallint, score_b smallint, reported_by text,
      reported_by_team_id uuid, reported_by_user_id uuid
    );

  update public.matches m
  set team_a_id = x.team_a_id,
      team_b_id = x.team_b_id,
      winner_id = x.winner_id,
      status = x.status,
      sets_a = x.sets_a,
      sets_b = x.sets_b
  from jsonb_to_recordset(coalesce(p_changes -> 'match_updates', '[]'::jsonb))
    as x (
      id uuid, team_a_id uuid, team_b_id uuid, winner_id uuid, status text,
      sets_a smallint, sets_b smallint
    )
  where m.id = x.id and m.tournament_id = p_tournament_id;

  return v_version;
end;
$$;

-- Only the service role may call these functions.
revoke execute on function public.confirm_team_payment(text, text) from public, anon, authenticated;
revoke execute on function public.commit_tournament_changes(uuid, integer, jsonb) from public, anon, authenticated;
grant execute on function public.confirm_team_payment(text, text) to service_role;
grant execute on function public.commit_tournament_changes(uuid, integer, jsonb) to service_role;
