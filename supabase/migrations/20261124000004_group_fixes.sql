alter table public.profiles add column if not exists avatar_seed text;
alter table public.profiles drop constraint if exists profiles_avatar_seed_check;
alter table public.profiles add constraint profiles_avatar_seed_check check (avatar_seed is null or length(avatar_seed) between 1 and 64);

create or replace function public.update_avatar_seed(p_seed text)
returns text language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_seed text := btrim(coalesce(p_seed,''));
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  if length(v_seed)<1 or length(v_seed)>64 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  update public.profiles set avatar_seed=v_seed where id=auth.uid();
  return v_seed;
end; $$;
revoke all on function public.update_avatar_seed(text) from public,anon;
grant execute on function public.update_avatar_seed(text) to authenticated;

drop function if exists public.list_conversations();
create or replace function public.list_conversations()
returns table(conversation_id uuid,created_at timestamptz,kind text,title text,description text,created_by uuid,other_user_id uuid,other_username text,other_display_name text,member_count bigint,last_message_id uuid,last_message_body text,last_message_sender_id uuid,last_message_created_at timestamptz,unread_count bigint)
language sql security invoker stable set search_path=public,private,pg_temp as $$
  select c.id,c.created_at,c.kind,c.title,c.description,c.created_by,
    other_p.id,other_p.username,other_p.display_name,
    (select count(*) from public.conversation_members cm2 where cm2.conversation_id=c.id and cm2.removed_at is null),
    lm.id,substring(lm.body from 1 for 100),lm.sender_id,lm.created_at,
    coalesce(unread.count,0)
  from public.conversation_members cm
  join public.conversations c on c.id=cm.conversation_id
  left join lateral (
    select p.id,p.username,p.display_name
    from public.conversation_members ocm join public.profiles p on p.id=ocm.user_id
    where ocm.conversation_id=c.id and ocm.user_id<>cm.user_id and ocm.removed_at is null
    limit 1
  ) other_p on c.kind='direct'
  left join lateral (select m.id,m.body,m.sender_id,m.created_at from public.messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1) lm on true
  left join lateral (select least(count(*),100) as count from (select 1 from public.messages m where m.conversation_id=c.id and m.sender_id<>cm.user_id and m.created_at>cm.last_read_at limit 100) sub) unread on true
  where cm.user_id=auth.uid() and cm.removed_at is null
  order by coalesce(lm.created_at,c.created_at) desc;
$$;
revoke all on function public.list_conversations() from public,anon;
grant execute on function public.list_conversations() to authenticated;

create or replace function public.create_group(p_title text,p_member_usernames text[])
returns uuid language plpgsql security definer set search_path=public,private,pg_temp as $$
declare v_auth uuid:=auth.uid(); v_title text:=btrim(coalesce(p_title,'')); v_conv uuid; v_count int;
begin
  if v_auth is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  if length(v_title)<1 or length(v_title)>80 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  if not private.check_rate_limit('group_create:'||v_auth::text,10,interval '24 hours') then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  insert into public.conversations(kind,title,created_by) values ('group',v_title,v_auth) returning id into v_conv;
  insert into public.conversation_members(conversation_id,user_id,role) values (v_conv,v_auth,'admin') on conflict do nothing;
  select count(*) into v_count from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_member_usernames,array[]::text[])) u));
  if v_count+1>20 then raise exception 'VALIDATION_ERROR' using errcode='P0001'; end if;
  insert into public.conversation_members(conversation_id,user_id,role)
  select v_conv,p.id,'member' from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_member_usernames,array[]::text[])) u)) and p.id<>v_auth on conflict do nothing;
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
  update public.conversation_members set removed_at=null,role='member' where conversation_id=p_conversation_id and user_id in (select p.id from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_usernames,array[]::text[])) u)));
  insert into public.conversation_members(conversation_id,user_id,role)
  select p_conversation_id,p.id,'member' from public.profiles p where p.username=any(array(select distinct lower(btrim(u)) from unnest(coalesce(p_usernames,array[]::text[])) u)) and p.id<>v_auth on conflict do nothing;
  return v_add;
end; $$;
revoke all on function public.add_group_members(uuid,text[]) from public,anon;
grant execute on function public.add_group_members(uuid,text[]) to authenticated;