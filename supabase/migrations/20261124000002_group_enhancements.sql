alter table public.conversations add column if not exists description text;
alter table public.conversations drop constraint if exists conversations_description_check;
alter table public.conversations add constraint conversations_description_check check (description is null or length(description) <= 200);

create table if not exists public.typing_presence (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  updated_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
alter table public.typing_presence enable row level security;
revoke all on public.typing_presence from public, anon, authenticated;
grant select, insert, update, delete on public.typing_presence to authenticated;
drop policy if exists "Active members read typing" on public.typing_presence;
create policy "Active members read typing" on public.typing_presence for select using (public.is_active_conversation_member(conversation_id));
drop policy if exists "Active members write typing" on public.typing_presence;
create policy "Active members write typing" on public.typing_presence for insert with check (user_id = auth.uid() and public.is_active_conversation_member(conversation_id));
drop policy if exists "Active members update typing" on public.typing_presence;

create or replace function public.set_typing(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if auth.uid() is null or not public.is_active_conversation_member(p_conversation_id, auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  insert into public.typing_presence(conversation_id,user_id,updated_at) values (p_conversation_id,auth.uid(),now())
  on conflict (conversation_id,user_id) do update set updated_at=now();
end; $$;
revoke all on function public.set_typing(uuid) from public,anon;
grant execute on function public.set_typing(uuid) to authenticated;

create or replace function public.search_users_by_prefix(p_query text)
returns table(id uuid,username text,display_name text)
language sql stable security definer set search_path=public,private,pg_temp as $$
  select p.id,p.username,p.display_name from public.profiles p
  where p.username like lower(btrim(p_query)) || '%'
    and p.id <> auth.uid()
  order by p.username limit 10;
$$;
revoke all on function public.search_users_by_prefix(text) from public,anon;
grant execute on function public.search_users_by_prefix(text) to authenticated;

create or replace function public.search_messages(p_query text)
returns table(conversation_id uuid,message_id uuid,body text,created_at timestamptz)
language sql stable security definer set search_path=public,private,pg_temp as $$
  select m.conversation_id,m.id,m.body,m.created_at
  from public.messages m
  where public.is_active_conversation_member(m.conversation_id,auth.uid())
    and m.body ilike '%' || btrim(p_query) || '%'
  order by m.created_at desc limit 50;
$$;
revoke all on function public.search_messages(text) from public,anon;
grant execute on function public.search_messages(text) to authenticated;

create or replace function public.update_group_description(p_conversation_id uuid,p_description text)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_desc text := nullif(btrim(coalesce(p_description,'')), '');
begin
  if not exists(select 1 from public.conversations where id=p_conversation_id and created_by=auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  if v_desc is not null and length(v_desc)>200 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  update public.conversations set description=v_desc where id=p_conversation_id;
  return v_desc;
end; $$;
revoke all on function public.update_group_description(uuid,text) from public,anon;
grant execute on function public.update_group_description(uuid,text) to authenticated;

drop function if exists public.list_group_members(uuid);
create or replace function public.list_group_members(p_conversation_id uuid)
returns table(user_id uuid,username text,display_name text,role text,joined_at timestamptz,last_read_at timestamptz)
language sql stable security definer set search_path=public,private,pg_temp as $$
  select p.id,p.username,p.display_name,cm.role,cm.joined_at,cm.last_read_at
  from public.conversation_members cm join public.profiles p on p.id=cm.user_id
  where cm.conversation_id=p_conversation_id and cm.removed_at is null and public.is_active_conversation_member(p_conversation_id,auth.uid());
$$;
revoke all on function public.list_group_members(uuid) from public,anon;
grant execute on function public.list_group_members(uuid) to authenticated;

drop function if exists public.list_conversations();
create or replace function public.list_conversations()
returns table(conversation_id uuid,created_at timestamptz,kind text,title text,description text,created_by uuid,other_user_id uuid,other_username text,other_display_name text,member_count bigint,last_message_id uuid,last_message_body text,last_message_sender_id uuid,last_message_created_at timestamptz,unread_count bigint)
language sql security invoker stable set search_path=public,private,pg_temp as $$
  select c.id,c.created_at,c.kind,c.title,c.description,c.created_by,
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