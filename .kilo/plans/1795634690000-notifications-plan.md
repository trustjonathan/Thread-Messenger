# Incoming Message Notifications Plan (Notifications API, step 1)

## Goal
Show desktop notifications for incoming messages using the browser Notifications API (no Push API, no backend). Permission granted via explicit user gesture; notifications fire only when appropriate; clicking brings the tab to front. Reliable click→open-conversation is deferred to a follow-up (option C, service worker `notificationclick`).

## Why Notifications API, not Push API
- Fires when a message arrives while Thread is open in a background tab or minimized window (skips popups when already viewing that chat).
- No `PushSubscription` to store, no backend send endpoint, no service worker for push — matches the "first step" recommendation and avoids contract-locked backend changes (`src/lib/api.ts`, `supabase/migrations/*`).
- Push API + service worker for `notificationclick` is explicitly out of scope for step 1 (tracked separately via NEEDS_API.md).

## Decisions
- **Permission on user gesture only:** an "Enable notifications" button in `SettingsPage` calls `Notification.requestPermission()`. Never called on page load.
- **`Notification.permission` is the source of truth.** No separate app-level on/off toggle beyond the permission prompt (keeps step 1 simple).
- **Fire conditions** (applied in the incoming-message handler of both `ChatPage` and `ChatListPage`, since both subscribe to realtime):
  1. `Notification.permission === 'granted'`
  2. `incomingMsg.senderId !== currentUserId` (never notify on own messages)
  3. `document.visibilityState !== 'visible'` OR current conversation !== `incomingMsg.conversationId` (no popup when already looking at that chat)
  4. `tag: incomingMsg.conversationId` so rapid messages in the same conversation replace/update instead of spamming
- **Click navigation (out of scope for step 1):** Browser default brings the originating tab to front on notification click, but no JS event fires in-page without a service worker. Reliable `notificationclick` → `clients.openWindow(/chats/:id)` requires a customized service worker (option C), tracked separately via NEEDS_API.md. Step 1 does NOT auto-route to the conversation.

## Files — Notifications (step 1)
- `src/lib/notifications.ts` (new) — helpers:
  - `isNotificationSupported(): boolean`
  - `requestNotificationPermission(): Promise<NotificationPermission>`
  - `showIncomingMessageNotification({ conversationId, title, body }): void` — creates `new Notification` with `tag`, `icon`, `data`, only if permitted; no click handler (reliable click handled by service worker follow-up)
- `src/features/chat/ChatPage.tsx` (edit) — inside `subscribeToUserMessages` `onMessage` (after de-dup + markRead), call `showIncomingMessageNotification` guarded by the fire conditions. `currentUserId` and `conversationId` already in scope.
- `src/features/chat/ChatListPage.tsx` (edit) — same guard + call inside its `subscribeToUserMessages` `onMessage` (line 67). Needs `currentUser?.id`.
- `src/features/settings/SettingsPage.tsx` (edit) — add an "Enable notifications" button/section that calls `requestNotificationPermission()` and displays current `Notification.permission` status ('granted'/'denied'/'default').
- `src/App.tsx` — NO edit for step 1 (the `visibilitychange`→navigate race was rejected; click→route deferred to service worker follow-up).

## Additional feature: Group member click → individual chat
**Status: Already implemented — no new work needed.**
- `GroupSettingsDrawer.tsx:110` — `GroupMemberRow` `onOpen` handler calls `getOrCreateDirectConversation(userId)` then navigates to `/chats/${res.data}`.
- `GroupMemberRow.tsx:15` — member row is clickable via `onClick={() => onOpen(member.userId)}`.
- `getOrCreateDirectConversation` already exists in `src/lib/api.ts` and is contract-implemented.
- Verification: open group settings drawer in any group → click a member's row → navigates to `/chats/<direct-conversation-id>` with that member.

## Additional feature: Group creator adds members after creation
**Status: Frontend implemented, backend blocked.**
- `GroupSettingsDrawer.tsx:89-105` — creator sees a search box; clicking a result calls `add([u.username])` via `useGroupSettings`.
- `useGroupSettings.ts:43-49` — `add` calls `addGroupMembers(conversationId, usernames)`, then refreshes the member list.
- **Blocker:** `REQ-CHAT-04` (group RPCs including `addGroupMembers`) is **Pending** in `NEEDS_API.md` — the backend RPC does not exist yet, so the add button would return an error at runtime.
- To unblock: DBA/coordinator must implement `addGroupMembers` (and related group RPCs: `removeGroupMember`, `leaveGroup`, `deleteGroup`, `renameGroup`, `updateGroupDescription`) per `REQ-CHAT-04` in NEEDS_API.md. No frontend changes needed once backend exists — the UI already supports adding members to a group that started with 2 members and growing over time (the 20-member cap is enforced by `REQ-CHAT-04`).

## Boundaries (contract files untouched)
Do NOT edit: `supabase/migrations/*`, `src/types/*`, `src/lib/api.ts`, `src/lib/apiClient.ts`, `.env.example`. All new code lives in `src/lib/notifications.ts`; edits confined to ChatPage, ChatListPage, SettingsPage.

## Failure modes
- `Notification` unsupported (older browser/private mode) → `isNotificationSupported()` false, button hidden or shows unsupported, no crash.
- Permission denied → `showIncomingMessageNotification` no-ops; button can re-request.
- Click on notification brings tab to front but does NOT auto-route to conversation (known limitation until service worker follow-up).
- Add-members button errors if `addGroupMembers` backend RPC missing (REQ-CHAT-04 pending).

## Validation
- `npm run typecheck` — passes
- `npm run lint` — passes (0 warnings)
- `npm run test` — existing tests still pass
- Manual:
  1. Settings page: click "Enable notifications" → Chrome permission prompt → `Notification.permission` === 'granted'.
  2. Send a test message from another account while this tab is backgrounded/minimized → OS notification shows sender/group title + body.
  3. Click notification → Chrome brings Thread tab to front (no auto-route to conversation in step 1).
  4. Own message sent → no notification.
  5. Already viewing the same conversation in a visible tab → no notification.
  6. Rapid messages in one group → single updating notification (tag dedup), not a spam of popups.
  7. Open group settings drawer → click a member row → navigates to individual `/chats/:id` with that member (already works).
  8. Open group settings drawer as creator → search a username → click to add → member list refreshes (requires REQ-CHAT-04 backend to not error).

## NEEDS_API.md registration (follow-up, not part of step 1)
Create entry `REQ-NOTIF-01` for reliable notification click→route:

| ID | Requester | Requested Capability | Motivation | Proposed Types / Schema | Status |
| `REQ-NOTIF-01` | UI | Service worker `notificationclick` handling for incoming-message notifications | Clicking an incoming-message notification should open the matching `/chats/:conversationId` conversation via `clients.openWindow`, instead of only bringing the tab to front. | Customize PWA service worker (vite-plugin-pwa) to listen to `notificationclick`, read `notification.data.conversationId`, call `clients.openWindow('/chats/' + conversationId)`. Requires `src/pwa/sw.ts` or `VitePWA` injectRegister customization; may involve editing `vite.config.ts` (coordinator scope per WIRING.md). | Pending |

## Open questions (out of scope for step 1)
- Push API for alerts when tab is closed / Chrome not running — requires backend `PushSubscription` table + server-side push sender → separate `NEEDS_API.md` request.
- Per-conversation notification mute / do-not-disturb — future settings addition.
