create or replace function public.sync_watchlist_identity_sequences()
returns void
language plpgsql
as $$
declare
  table_name text;
  sequence_name text;
  max_id bigint;
begin
  foreach table_name in array array[
    'users',
    'entries',
    'friends',
    'friend_messages',
    'teams',
    'team_members',
    'team_items',
    'team_votes',
    'reports',
    'report_messages',
    'audit_logs'
  ]
  loop
    sequence_name := pg_get_serial_sequence(format('public.%I', table_name), 'id');
    if sequence_name is not null then
      execute format('select coalesce(max(id), 0) from public.%I', table_name) into max_id;
      execute format('select setval(%L, greatest(%s, 1), true)', sequence_name, max_id);
    end if;
  end loop;
end;
$$;
