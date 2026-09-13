create or replace function private.watchlist_current_user_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select id from public.users where auth_user_id = auth.uid() limit 1
$$;

create or replace function private.watchlist_is_active()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and account_status = 'active'
  )
$$;

create or replace function private.watchlist_user_id()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select id
  from public.users
  where auth_user_id = auth.uid()
    and account_status = 'active'
  limit 1
$$;

create or replace function private.watchlist_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.users
    where auth_user_id = auth.uid()
      and role = 'admin'
      and account_status = 'active'
  )
$$;

drop policy if exists users_select_self_or_admin on public.users;
create policy users_select_self_or_admin
on public.users
for select
to authenticated
using ((private.watchlist_is_active() and auth_user_id = auth.uid()) or private.watchlist_is_admin());

drop policy if exists entries_select_public_catalog on public.entries;
create policy entries_select_public_catalog
on public.entries
for select
to anon, authenticated
using (auth.uid() is null or private.watchlist_is_active() or private.watchlist_is_admin());

drop policy if exists entries_admin_write on public.entries;
create policy entries_admin_write
on public.entries
for all
to authenticated
using (private.watchlist_is_admin())
with check (private.watchlist_is_admin());

drop policy if exists entry_reactions_select_public on public.entry_reactions;
create policy entry_reactions_select_public
on public.entry_reactions
for select
to anon, authenticated
using (auth.uid() is null or private.watchlist_is_active() or private.watchlist_is_admin());

drop policy if exists entry_reactions_user_write on public.entry_reactions;
create policy entry_reactions_user_write
on public.entry_reactions
for all
to authenticated
using (private.watchlist_is_active() and user_id = private.watchlist_user_id())
with check (private.watchlist_is_active() and user_id = private.watchlist_user_id());

drop policy if exists friends_participant_select on public.friends;
create policy friends_participant_select
on public.friends
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (user_id = private.watchlist_user_id() or friend_id = private.watchlist_user_id())
  )
);

drop policy if exists friends_participant_write on public.friends;
create policy friends_participant_write
on public.friends
for all
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (user_id = private.watchlist_user_id() or friend_id = private.watchlist_user_id())
  )
)
with check (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (user_id = private.watchlist_user_id() or friend_id = private.watchlist_user_id())
  )
);

drop policy if exists friend_messages_participant_select on public.friend_messages;
create policy friend_messages_participant_select
on public.friend_messages
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (sender_id = private.watchlist_user_id() or receiver_id = private.watchlist_user_id())
  )
);

drop policy if exists friend_messages_participant_insert on public.friend_messages;
create policy friend_messages_participant_insert
on public.friend_messages
for insert
to authenticated
with check (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and sender_id = private.watchlist_user_id())
);

drop policy if exists reports_owner_or_admin_select on public.reports;
create policy reports_owner_or_admin_select
on public.reports
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and user_id = private.watchlist_user_id())
);

drop policy if exists reports_user_insert on public.reports;
create policy reports_user_insert
on public.reports
for insert
to authenticated
with check (private.watchlist_is_active() and user_id = private.watchlist_user_id());

drop policy if exists reports_owner_or_admin_update on public.reports;
create policy reports_owner_or_admin_update
on public.reports
for update
to authenticated
using (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and user_id = private.watchlist_user_id())
)
with check (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and user_id = private.watchlist_user_id())
);

drop policy if exists report_messages_owner_or_admin_select on public.report_messages;
create policy report_messages_owner_or_admin_select
on public.report_messages
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and exists (
      select 1 from public.reports r
      where r.id = report_messages.report_id and r.user_id = private.watchlist_user_id()
    )
  )
);

drop policy if exists report_messages_owner_or_admin_insert on public.report_messages;
create policy report_messages_owner_or_admin_insert
on public.report_messages
for insert
to authenticated
with check (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and exists (
      select 1 from public.reports r
      where r.id = report_messages.report_id and r.user_id = private.watchlist_user_id()
    )
  )
);

drop policy if exists report_attachments_owner_or_admin_select on public.report_attachments;
create policy report_attachments_owner_or_admin_select
on public.report_attachments
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and exists (
      select 1 from public.reports r
      where r.id = report_attachments.report_id and r.user_id = private.watchlist_user_id()
    )
  )
);

drop policy if exists report_attachments_owner_or_admin_insert on public.report_attachments;
create policy report_attachments_owner_or_admin_insert
on public.report_attachments
for insert
to authenticated
with check (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and user_id = private.watchlist_user_id())
);

drop policy if exists teams_member_select on public.teams;
create policy teams_member_select
on public.teams
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (
      owner_id = private.watchlist_user_id()
      or exists (
        select 1 from public.team_members tm
        where tm.team_id = teams.id and tm.user_id = private.watchlist_user_id()
      )
    )
  )
);

drop policy if exists team_members_member_select on public.team_members;
create policy team_members_member_select
on public.team_members
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and (
      user_id = private.watchlist_user_id()
      or exists (
        select 1 from public.teams t
        where t.id = team_members.team_id and t.owner_id = private.watchlist_user_id()
      )
    )
  )
);

drop policy if exists team_items_member_select on public.team_items;
create policy team_items_member_select
on public.team_items
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (
    private.watchlist_is_active()
    and exists (
      select 1 from public.team_members tm
      where tm.team_id = team_items.team_id and tm.user_id = private.watchlist_user_id()
    )
  )
);

drop policy if exists team_votes_member_select on public.team_votes;
create policy team_votes_member_select
on public.team_votes
for select
to authenticated
using (
  private.watchlist_is_admin()
  or (private.watchlist_is_active() and user_id = private.watchlist_user_id())
);

create or replace function public.watchlist_run_maintenance()
returns integer
language plpgsql
security invoker
set search_path = private, public
as $$
begin
  if auth.role() <> 'service_role' then
    raise exception 'not allowed';
  end if;
  return private.watchlist_maintenance_cleanup();
end;
$$;

revoke all on function public.watchlist_run_maintenance() from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.watchlist_maintenance_cleanup() to service_role;
grant execute on function public.watchlist_run_maintenance() to service_role;
