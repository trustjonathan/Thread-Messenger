-- Group chat support
alter table public.conversations drop constraint if exists conversations_kind_check;
alter table public.conversations add constraint conversations_kind_check check (kind in ('direct','group'));
alter table public.conversations add column if not exists title text;
alter table public.conversations add column if not exists created_by uuid references auth.users(id);
alter table public.conversations drop constraint if exists conversations_group_title_check;
alter table public.conversations add constraint conversations_group_title_check check (kind <> 'group' or (title is not null and length(btrim(title)) between 1 and 80));

alter table public.conversation_members add column if not exists role text not null default 'member';
alter table public.conversation_members add column if not exists removed_at timestamptz;
alter table public.conversation_members drop constraint if exists conversation_members_role_check;
alter table public.conversation_members add constraint conversation_members_role_check check (role in ('admin','member'));

create index if not exists idx_conv_members_active_user on public.conversation_members (user_id, conversation_id) where removed_at is null;
create index if not exists idx_conv_members_active_conv on public.conversation_members (conversation_id, user_id) where removed_at is null;
create index if not exists idx_messages_conv_created on public.messages (conversation_id, created_at desc);

create or replace function public.is_active_conversation_member(p_conversation_id uuid, p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.conversation_members cm where cm.conversation_id = p_conversation_id and cm.user_id = p_user_id and cm.removed_at is null);
$$;

revoke all on function public.is_active_conversation_member(uuid, uuid) from public, anon;
grant execute on function public.is_active_conversation_member(uuid, uuid) to authenticated;

drop policy if exists "Active members can read conversations" on public.conversations;
create policy "Active members can read conversations" on public.conversations for select using (public.is_active_conversation_member(id));
drop policy if exists "Active members can read conversation members" on public.conversation_members;
create policy "Active members can read conversation members" on public.conversation_members for select using (public.is_active_conversation_member(conversation_id));
drop policy if exists "Active members can read messages" on public.messages;
create policy "Active members can read messages" on public.messages for select using (public.is_active_conversation_member(conversation_id));
drop policy if exists "Active members can send messages" on public.messages;
create policy "Active members can send messages" on public.messages for insert with check (sender_id = auth.uid() and public.is_active_conversation_member(conversation_id));

create or replace function public.create_group(p_title text, p_member_usernames text[])
returns uuid language plpgsql security definer set search_path = public, private, pg_temp as $$
declare
  v_auth uuid := auth.uid();
  v_title text := btrim(coalesce(p_title,''));
  v_conv uuid;
  v_count int;
begin
  if v_auth is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  if length(v_title) < 1 or length(v_title) > 80 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  if not private.check_rate_limit('group_create:'||v_auth::text, 10, interval '24 hours') then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  insert into public.conversations(kind,title,created_by) values ('group',v_title,v_auth) returning id into v_conv;
  insert into public.conversation_members(conversation_id,user_id,role) values (v_conv,v_auth,'admin');
  select count(*) into v_count from public.profiles p where p.username = any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_member_usernames,array[]::text[])) u));
  if v_count + 1 > 20 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  select v_conv,p.id,'member' from public.profiles p where p.username = any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_member_usernames,array[]::text[])) u)) and p.id <> v_auth;
  return v_conv;
end; $$;
revoke all on function public.create_group(text,text[]) from public,anon;
grant execute on function public.create_group(text,text[]) to authenticated;

create or replace function public.add_group_members(p_conversation_id uuid,p_usernames text[])
returns int language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_role text; v_active int; v_add int;
begin
  if v_auth is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  select role into v_role from public.conversation_members where conversation_id=p_conversation_id and user_id=v_auth and removed_at is null;
  if v_role is distinct from 'admin' then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  select count(*) into v_active from public.conversation_members where conversation_id=p_conversation_id and removed_at is null;
  select count(*) into v_add from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_usernames,array[]::text[])) u)) and p.id<>v_auth and not exists(select 1 from public.conversation_members cm where cm.conversation_id=p_conversation_id and cm.user_id=p.id and cm.removed_at is null);
  if v_active+v_add>20 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  update public.conversation_members set removed_at=null, role='member' where conversation_id=p_conversation_id and user_id in (select p.id from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_usernames,array[]::text[])) u)));
  insert into public.conversation_members(conversation_id,user_id,role)
  select p_conversation_id,p.id,'member' from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_usernames,array[]::text[])) u)) and p.id<>v_auth on conflict do nothing;
  return v_add;
end; $$;
revoke all on function public.add_group_members(uuid,text[]) from public,anon;
grant execute on function public.add_group_members(uuid,text[]) to authenticated;

create or replace function public.remove_group_member(p_conversation_id uuid,p_user_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not exists(select 1 from public.conversations where id=p_conversation_id and created_by=auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  update public.conversation_members set removed_at=now() where conversation_id=p_conversation_id and user_id=p_user_id and user_id<>auth.uid();
end; $$;
revoke all on function public.remove_group_member(uuid,uuid) from public,anon;
grant execute on function public.remove_group_member(uuid,uuid) to authenticated;

create or replace function public.rename_group(p_conversation_id uuid,p_title text)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_title text:=btrim(coalesce(p_title,''));
begin
  if not exists(select 1 from public.conversations where id=p_conversation_id and created_by=auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  if length(v_title)<1 or length(v_title)>80 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  update public.conversations set title=v_title where id=p_conversation_id;
  return v_title;
end; $$;
revoke all on function public.rename_group(uuid,text) from public,anon;
grant execute on function public.rename_group(uuid,text) to authenticated;

create or replace function public.leave_group(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if exists(select 1 from public.conversations where id=p_conversation_id and created_by=auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  update public.conversation_members set removed_at=now() where conversation_id=p_conversation_id and user_id=auth.uid() and removed_at is null;
end; $$;
revoke all on function public.leave_group(uuid) from public,anon;
grant execute on function public.leave_group(uuid) to authenticated;

create or replace function public.delete_group(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if not exists(select 1 from public.conversations where id=p_conversation_id and created_by=auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  delete from public.conversations where id=p_conversation_id;
end; $$;
revoke all on function public.delete_group(uuid) from public,anon;
grant execute on function public.delete_group(uuid) to authenticated;

create or replace function public.list_group_members(p_conversation_id uuid)
returns table(user_id uuid,username text,display_name text,role text,joined_at timestamptz)
language sql stable security definer set search_path=public,private,pg_temp as $$
  select p.id,p.username,p.display_name,cm.role,cm.joined_at
  from public.conversation_members cm join public.profiles p on p.id=cm.user_id
  where cm.conversation_id=p_conversation_id and cm.removed_at is null and public.is_active_conversation_member(p_conversation_id,auth.uid());
$$;
revoke all on function public.list_group_members(uuid) from public,anon;
grant execute on function public.list_group_members(uuid) to authenticated;

drop function if exists public.list_conversations();
create or replace function public.list_conversations()
returns table(conversation_id uuid,created_at timestamptz,kind text,title text,other_user_id uuid,other_username text,other_display_name text,member_count bigint,last_message_id uuid,last_message_body text,last_message_sender_id uuid,last_message_created_at timestamptz,unread_count bigint)
language sql security invoker stable set search_path=public,private,pg_temp as $$
  select c.id,c.created_at,c.kind,c.title,
    case when c.kind='direct' then other_p.id end,
    case when c.kind='direct' then other_p.username end,
    case when c.kind='direct' then other_p.display_name end,
    (select count(*) from public.conversation_members cm2 where cm2.conversation_id=c.id and cm2.removed_at is null),
    lm.id,substring(lm.body from 1 for 100),lm.sender_id,lm.created_at,
    coalesce(unread.count,0)
  from public.conversation_members cm
  join public.conversations c on c.id=cm.conversation_id
  left join public.conversation_members other_cm on other_cm.conversation_id=c.id and other_cm.user_id<>cm.user_id and other_cm.removed_at is null
  left join public.profiles other_p on other_p.id=other_cm.user_id
  left join lateral (select m.id,m.body,m.sender_id,m.created_at from public.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) lm on true
  left join lateral (select least(count(*),100) as count from (select 1 from public.messages m where m.conversation_id=c.id and m.sender_id<>cm.user_id and m.created_at>cm.last_read_at limit 100) sub) unread on true
  where cm.user_id=auth.uid() and cm.removed_at is null
  order by coalesce(lm.created_at,c.created_at) desc;
$$;
revoke all on function public.list_conversations() from public,anon;
grant execute on function public.list_conversations() to authenticated;