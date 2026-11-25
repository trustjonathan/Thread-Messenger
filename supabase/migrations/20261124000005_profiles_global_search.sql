-- Migration: 20261124000005_profiles_global_search.sql
-- Description: Allow all authenticated users to read all profiles so users
--              are discoverable via global search when adding members to groups.
--              Previously restricted to own profile + mutual conversation members.

drop policy if exists profiles_select_policy on public.profiles;

create policy profiles_select_policy on public.profiles
  for select to authenticated
  using (true);
