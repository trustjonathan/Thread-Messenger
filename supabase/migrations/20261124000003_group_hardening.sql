create index if not exists idx_typing_updated on public.typing_presence (updated_at);
create index if not exists idx_messages_body_search on public.messages (conversation_id, created_at desc);

drop policy if exists "Active members update typing" on public.typing_presence;
create policy "Active members update typing" on public.typing_presence for update using (user_id = auth.uid() and public.is_active_conversation_member(conversation_id)) with check (user_id = auth.uid() and public.is_active_conversation_member(conversation_id));

drop function if exists public.search_users_by_prefix(text);
create or replace function public.search_users_by_prefix(p_query text)
returns table(id uuid,username text,display_name text)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_q text := lower(btrim(coalesce(p_query,'')));
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  if length(v_q) < 2 then return; end if;
  if not private.check_rate_limit('user_prefix:'||auth.uid()::text, 30, interval '60 seconds') then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  return query select p.id,p.username,p.display_name from public.profiles p where p.username like v_q || '%' and p.id <> auth.uid() order by p.username limit 10;
end; $$;
revoke all on function public.search_users_by_prefix(text) from public,anon;
grant execute on function public.search_users_by_prefix(text) to authenticated;

drop function if exists public.search_messages(text);
create or replace function public.search_messages(p_query text)
returns table(conversation_id uuid,message_id uuid,body text,created_at timestamptz)
language plpgsql stable security definer set search_path=public,private,pg_temp as $$
declare v_q text := btrim(coalesce(p_query,''));
begin
  if auth.uid() is null then raise exception 'UNAUTHENTICATED' using errcode='28000'; end if;
  if length(v_q) < 2 then return; end if;
  if not private.check_rate_limit('msg_search:'||auth.uid()::text, 30, interval '60 seconds') then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  return query select m.conversation_id,m.id,m.body,m.created_at from public.messages m where public.is_active_conversation_member(m.conversation_id,auth.uid()) and m.body ilike '%'||v_q||'%' order by m.created_at desc limit 50;
end; $$;
revoke all on function public.search_messages(text) from public,anon;
grant execute on function public.search_messages(text) to authenticated;

create or replace function public.set_typing(p_conversation_id uuid)
returns void language plpgsql security definer set search_path=public,private,pg_temp as $$
begin
  if auth.uid() is null or not public.is_active_conversation_member(p_conversation_id, auth.uid()) then raise exception 'OPERATION_FAILED' using errcode='P0001'; end if;
  if not private.check_rate_limit('typing:'||auth.uid()::text, 60, interval '60 seconds') then raise exception 'RATE_LIMITED' using errcode='P0001'; end if;
  insert into public.typing_presence(conversation_id,user_id,updated_at) values (p_conversation_id,auth.uid(),now())
  on conflict (conversation_id,user_id) do update set updated_at=now();
end; $$;
revoke all on function public.set_typing(uuid) from public,anon;
grant execute on function public.set_typing(uuid) to authenticated;