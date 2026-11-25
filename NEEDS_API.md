# Needs API / Contract Expansion Requests

This file is a template for downstream builders (UI, PWA, testing teams) to request backend schema changes or new API endpoints.

## Instructions for Builders

1. **Do NOT edit contract files directly**:
   - `supabase/migrations/*`
   - `src/types/*`
   - `src/lib/api.ts`
   - `src/lib/apiClient.ts`
   - `.env.example`
2. If your feature requires database modifications or new RPC functions, open an issue or record your request in the table below.

## Pending Requests

| ID | Requester | Requested Capability | Motivation | Proposed Types / Schema | Status |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `REQ-AUTH-01` | Lovable (Auth/Chat Scope) | `signInWithGoogle()` and `getCurrentUser()` | Auth flow requires Google OAuth login and fetching session/user profile data to display current username in headers and authenticate chat requests. | `signInWithGoogle(): Promise<ApiResult<void>>`<br/>`getCurrentUser(): Promise<ApiResult<{ id: string; username: string; displayName: string; usernameSet: boolean }>>` | Implemented |
| `REQ-CHAT-01` | Lovable (Auth/Chat Scope) | `getConversation(conversationId: string)` | Direct retrieval of single conversation metadata & other participant info on `/chats/:id` route, eliminating fallback of scanning `listConversations()`. | `getConversation(conversationId: string): Promise<ApiResult<ConversationSummary>>` | Pending |
| `REQ-SETTINGS-01` | Bolt (Settings Scope) | `listBlockedUsers()` | Settings page needs to display the user's block list | `listBlockedUsers(): Promise<ApiResult<Array<{ id: string; username: string; displayName: string }>>>` | Implemented |
| `REQ-SETTINGS-02` | Bolt (Settings Scope) | `updateDisplayName(displayName: string)` | Settings page needs to update display name | `updateDisplayName(displayName: string): Promise<ApiResult<void>>` | Implemented |
| `REQ-CHAT-02` | UI | per-conversation other-member receipts | message status delivered/read | lastDeliveredAt, lastReadAt (null when the other member has read receipts off) | Pending |
| `REQ-CHAT-03` | UI | group conversations schema | group chat | `conversations.kind` CHECK allows `'group'`; add `title text`, `created_by uuid`; `conversation_members` add `role text DEFAULT 'member' CHECK (role IN ('admin','member'))`, `removed_at timestamptz`; partial indexes on active membership; RLS helper `is_active_conversation_member()`; active members read/send, removed lose access immediately. | Implemented |
| `REQ-CHAT-04` | UI | group RPCs | create/manage groups | `createGroup`, `addGroupMembers`, `removeGroupMember`, `renameGroup`, `leaveGroup`, `deleteGroup`, `listGroupMembers` RPCs + frontend wrappers in `src/lib/api.ts`. Rate-limited, 20-member cap, creator-only remove/delete. | Implemented |