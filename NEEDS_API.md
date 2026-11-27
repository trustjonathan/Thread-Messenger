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
| `REQ-AI-01` | Maintainer | unrestricted, fast AI | Remove prompt quotas/cooldowns and the artificial pacing delay so replies render as tokens arrive | Removed `get_ai_quota`/`consume_ai_prompt`/`refund_ai_prompt`, `private.ai_usage`, quota payloads and lock UI; Edge Function no longer depends on `SUPABASE_DB_URL` or `npm:postgres`. See `20261128000001_remove_ai_quota.sql`. | Implemented |
| `REQ-CHAT-05` | Maintainer | group send block safety | Original `send_message` checked only one peer; in groups a block could be bypassed | `send_message` now rejects when the caller is blocked with **any** active member and uses `private.is_active_conversation_member`. See `20261128000001_remove_ai_quota.sql`. | Implemented |
| `REQ-TYPES-01` | Maintainer | generated DB type parity | Client casts hid schema/RPC drift | Added `conversations.description`, corrected `add_group_members` return shape (`out_username`/`out_status`), typed settings/invite RPCs in `src/types/database.ts`; removed `as never`/`any` casts in `src/lib/api.ts`. | Implemented |