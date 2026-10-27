-- 0004_realtime.sql
-- Enables Supabase Realtime (Postgres Changes) for the tables the public tournament page watches.
-- Realtime respects the RLS select policies from 0002_rls.sql, so anonymous viewers only receive
-- rows they are allowed to read. Safe to run more than once.

do $$
declare
  v_table text;
begin
  foreach v_table in array array['tournaments', 'teams', 'matches', 'match_sets']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = v_table
    ) then
      execute format('alter publication supabase_realtime add table public.%I', v_table);
    end if;
  end loop;
end;
$$;
