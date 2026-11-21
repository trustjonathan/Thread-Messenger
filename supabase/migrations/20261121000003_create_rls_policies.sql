-- Migration: 20261121000003_create_rls_policies.sql
-- Description: Sets up Row-Level Security policies with explicit TO authenticated scope.

-- 1. Profiles Policies
-- User can read own profile OR profiles of members in their mutual conversations.
-- Scrape protection: Users cannot enumerate strangers.
CREATE POLICY profiles_select_policy ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR id IN (
      SELECT cm2.user_id
      FROM public.conversation_members cm1
      JOIN public.conversation_members cm2 ON cm1.conversation_id = cm2.conversation_id
      WHERE cm1.user_id = auth.uid()
    )
  );

-- Update allowed for own profile (column-level grant restricts to display_name)
CREATE POLICY profiles_update_policy ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. Conversations Policies
CREATE POLICY conversations_select_policy ON public.conversations
  FOR SELECT TO authenticated
  USING (private.is_conversation_member(id));

-- 3. Conversation Members Policies
CREATE POLICY conversation_members_select_policy ON public.conversation_members
  FOR SELECT TO authenticated
  USING (private.is_conversation_member(conversation_id));

-- 4. Messages Policies
-- Select policy restricts reading to conversation members
CREATE POLICY messages_select_policy ON public.messages
  FOR SELECT TO authenticated
  USING (private.is_conversation_member(conversation_id));

-- Note: No INSERT policy on messages. Direct INSERT is revoked; send_message is the sole writer.

-- 5. Blocks Policies
CREATE POLICY blocks_select_policy ON public.blocks
  FOR SELECT TO authenticated
  USING (blocker_id = auth.uid());

CREATE POLICY blocks_insert_policy ON public.blocks
  FOR INSERT TO authenticated
  WITH CHECK (blocker_id = auth.uid() AND blocker_id <> blocked_id);

CREATE POLICY blocks_delete_policy ON public.blocks
  FOR DELETE TO authenticated
  USING (blocker_id = auth.uid());

-- 6. Reports Policies
CREATE POLICY reports_select_policy ON public.reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid());

-- Note: No INSERT policy on reports. Direct INSERT is revoked; report_content is the sole writer.
