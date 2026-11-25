-- Migration: 20261125000001_phase_a_security_p0.sql
-- Description: Phase A + Security P0 fixes for group member cap and profile visibility.

-- ---------------------------------------------------------------------------
-- 1. Replace add_group_members: lock, creator-only via created_by, per-username
--    result, strip leading "@", rate-limit, GROUP_FULL/NOT_ALLOWED errors.
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- 2. Fix private.is_conversation_member to exclude removed_at members.
-- ---------------------------------------------------------------------------
create or replace function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select exists (
    select 1 from public.conversation_members
    where conversation_id = p_conversation_id
      and user_id = auth.uid()
      and removed_at is null
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public, anon, authenticated;
grant execute on function private.is_conversation_member(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Move is_active_conversation_member from public to private schema,
--    remove user-id parameter (uses auth.uid()), exclude removed_at,
--    search_path = public, pg_temp.
--    Must drop dependent RLS policies first, then recreate them.
-- ---------------------------------------------------------------------------
-- 3a. Drop RLS policies that depend on public.is_active_conversation_member
drop policy if exists "Active members can read conversations" on public.conversations;
drop policy if exists "Active members can read conversation members" on public.conversation_members;
drop policy if exists "Active members can read messages" on public.messages;
drop policy if exists "Active members can send messages" on public.messages;
drop policy if exists "Active members read typing" on public.typing_presence;
drop policy if exists "Active members write typing" on public.typing_presence;
drop policy if exists "Active members update typing" on public.typing_presence;

-- 3b. Drop the old public function
drop function if exists public.is_active_conversation_member(uuid, uuid);

-- 3c. Create the new private function (single-arg, no user-id param)
create or replace function private.is_active_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.conversation_members cm
    where cm.conversation_id = p_conversation_id
      and cm.user_id = auth.uid()
      and cm.removed_at is null
  );
$$;

revoke all on function private.is_active_conversation_member(uuid) from public, anon, authenticated;
grant execute on function private.is_active_conversation_member(uuid) to authenticated;

-- 3d. Recreate RLS policies using the new private function
create policy "Active members can read conversations" on public.conversations
  for select using (private.is_active_conversation_member(id));

create policy "Active members can read conversation members" on public.conversation_members
  for select using (private.is_active_conversation_member(conversation_id));

create policy "Active members can read messages" on public.messages
  for select using (private.is_active_conversation_member(conversation_id));

create policy "Active members can send messages" on public.messages
  for insert with check (sender_id = auth.uid() and private.is_active_conversation_member(conversation_id));

create policy "Active members read typing" on public.typing_presence
  for select using (private.is_active_conversation_member(conversation_id));

create policy "Active members write typing" on public.typing_presence
  for insert with check (user_id = auth.uid() and private.is_active_conversation_member(conversation_id));

create policy "Active members update typing" on public.typing_presence
  for update using (user_id = auth.uid() and private.is_active_conversation_member(conversation_id))
  with check (user_id = auth.uid() and private.is_active_conversation_member(conversation_id));

-- ---------------------------------------------------------------------------
-- 4. Fix profiles SELECT policy: restore own-row + shared-conversation visibility.
--    Drop the global scrape policy (using true) from migration 000005.
-- ---------------------------------------------------------------------------
drop policy if exists profiles_select_policy on public.profiles;

create policy profiles_select_policy on public.profiles
  for select to authenticated
  using (
    id = auth.uid()
    or exists (
      select 1 from public.conversation_members cm1
      join public.conversation_members cm2
        on cm2.conversation_id = cm1.conversation_id
       and cm2.user_id = auth.uid()
      where cm1.user_id = public.profiles.id
        and cm1.removed_at is null
        and cm2.removed_at is null
    )
  );

-- ---------------------------------------------------------------------------
-- 5. Update list_group_members to use private.is_active_conversation_member
--    (single-arg, no user-id param).
-- ---------------------------------------------------------------------------
drop function if exists public.list_group_members(uuid);

create or replace function public.list_group_members(p_conversation_id uuid)
returns table(
  user_id uuid,
  username text,
  display_name text,
  role text,
  joined_at timestamptz,
  last_read_at timestamptz
)
language sql
stable
security definer
set search_path = public, private, pg_temp
as $$
  select p.id, p.username, p.display_name, cm.role, cm.joined_at, cm.last_read_at
  from public.conversation_members cm
  join public.profiles p on p.id = cm.user_id
  where cm.conversation_id = p_conversation_id
    and cm.removed_at is null
    and private.is_active_conversation_member(p_conversation_id);
$$;

revoke all on function public.list_group_members(uuid) from public, anon;
grant execute on function public.list_group_members(uuid) to authenticated;
