-- Migration: 20261125000002_phase_a_all_or_nothing.sql
-- Description: Change add_group_members to all-or-nothing: if requested adds
--              exceed free slots, add none and raise GROUP_FULL.

drop function if exists public.add_group_members(uuid, text[]);

create or replace function public.add_group_members(
  p_conversation_id uuid,
  p_usernames text[]
)
returns table(out_username text, out_status text)
language plpgsql
security definer
set search_path = public, private, pg_temp
as $$
declare
  v_auth uuid := auth.uid();
  v_created_by uuid;
  v_active_count int;
  v_max_members int := 20;
  v_new_count int := 0;
  v_clean_username text;
  v_target_id uuid;
  v_cm_removed_at timestamptz;
  i int;
begin
  if v_auth is null then
    raise exception 'UNAUTHENTICATED' using errcode = '28000';
  end if;

  -- Rate limit: max 30 add-member calls per 60 seconds per user
  if not private.check_rate_limit('group_add:' || v_auth::text, 30, interval '60 seconds') then
    raise exception 'RATE_LIMITED' using errcode = 'P0001';
  end if;

  -- Creator-only via created_by (not role)
  select created_by into v_created_by
  from public.conversations
  where id = p_conversation_id;

  if v_created_by is null then
    raise exception 'NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_created_by <> v_auth then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  -- Transaction-scoped advisory lock on the conversation to prevent
  -- concurrent-add race exceeding the member cap.
  perform pg_advisory_xact_lock(hashtext('conv_add:' || p_conversation_id::text));

  -- Count currently active members under the lock.
  select count(*) into v_active_count
  from public.conversation_members
  where conversation_id = p_conversation_id and removed_at is null;

  -- First pass: count how many NEW users would be added.
  v_new_count := 0;
  for i in 1 .. coalesce(array_length(p_usernames, 1), 0) loop
    v_clean_username := lower(btrim(ltrim(coalesce(p_usernames[i], ''), '@')));
    if length(v_clean_username) = 0 then
      continue;
    end if;

    select p.id into v_target_id
    from public.profiles p
    where lower(p.username) = v_clean_username
    limit 1;

    if v_target_id is null then
      continue;
    end if;

    -- Never count the caller's own row.
    if v_target_id = v_auth then
      continue;
    end if;

    -- Check existing membership (active or removed).
    select cm.removed_at into v_cm_removed_at
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = v_target_id;

    if FOUND then
      if v_cm_removed_at is null then
        continue;
      end if;
    end if;

    v_new_count := v_new_count + 1;
  end loop;

  -- All-or-nothing: if requested new adds exceed free slots, add none.
  if v_active_count + v_new_count > v_max_members then
    raise exception 'GROUP_FULL' using errcode = 'P0001';
  end if;

  -- Second pass: perform all adds (we know they all fit).
  for i in 1 .. coalesce(array_length(p_usernames, 1), 0) loop
    v_clean_username := lower(btrim(ltrim(coalesce(p_usernames[i], ''), '@')));
    if length(v_clean_username) = 0 then
      out_username := '';
      out_status := 'not_found';
      return next;
      continue;
    end if;

    select p.id into v_target_id
    from public.profiles p
    where lower(p.username) = v_clean_username
    limit 1;

    if v_target_id is null then
      out_username := v_clean_username;
      out_status := 'not_found';
      return next;
      continue;
    end if;

    -- Never modify the caller's own row.
    if v_target_id = v_auth then
      out_username := v_clean_username;
      out_status := 'already_member';
      return next;
      continue;
    end if;

    select cm.removed_at into v_cm_removed_at
    from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = v_target_id;

    if FOUND then
      if v_cm_removed_at is null then
        out_username := v_clean_username;
        out_status := 'already_member';
        return next;
        continue;
      end if;
      update public.conversation_members
      set removed_at = null, role = 'member'
      where conversation_id = p_conversation_id and user_id = v_target_id;
    else
      insert into public.conversation_members(conversation_id, user_id, role)
      values (p_conversation_id, v_target_id, 'member')
      on conflict do nothing;
    end if;

    out_username := v_clean_username;
    out_status := 'added';
    return next;
  end loop;

  return;
end;
$$;

revoke all on function public.add_group_members(uuid, text[]) from public, anon;
grant execute on function public.add_group_members(uuid, text[]) to authenticated;
