# Plan: WhatsApp Web-Style Split Layout for Chat App

## Context
- **Stack**: React + Vite + TypeScript + Tailwind CSS, React Router v7, Supabase Realtime
- **No state management library**: plain React hooks + local state only
- **No existing split layout**: `ChatListPage` and `ChatPage` are separate full-page views
- **Reference components** in `suggestions/files/`: `App.tsx`, `Avatar.tsx`, `ChatLayout.tsx`, `ChatPane.tsx`, `Sidebar.tsx`, `types.ts`, `useMediaQuery.ts`, `useResizableSidebar.ts` — adapt these to existing codebase types/API
- **Deps already installed**: `lucide-react` ^1.77.0, `react-router-dom` ^7.18.6

## Current Architecture

### Router (`src/App.tsx`)
- `BrowserRouter` with `Routes`/`Route`
- `/chats` → `ChatListPage`, `/chats/:conversationId` → `ChatPage`
- Protected routes wrap with `ProtectedRoute`
- Navigation: `navigate('/chats/:id')` from list, `Link to="/chats"` back from conversation

### API (`src/lib/apiClient.ts` → `src/lib/api.ts`)
- `listConversations()` → `ConversationSummary[]` (kind, title, otherUser, lastMessage, unreadCount, memberCount)
- `loadMessages({conversationId, cursor?, limit?})` → `PaginatedMessages`
- `sendMessage({conversationId, body, clientId})` with optimistic send support
- `markRead(conversationId)`, `setTyping(conversationId)`, `getCurrentUser()`
- `subscribeToUserMessages(userId, onMessage, onResync?)` — Supabase realtime on `messages` INSERT

### Types (`src/types/api.ts`)
- `ConversationSummary`, `Message`, `GroupMember`, `PaginatedMessages`, `MessageCursor`, `CurrentUser`
- No changes needed

### Existing components to reuse
- `Avatar.tsx` — initials avatar (name, size sm/md/lg)
- `IdenticonAvatar.tsx` — identicon with avatarSeed override
- `MessageStatus.tsx`, `DateSeparator.tsx`, `ErrorMessage.tsx` (`getHumanErrorMessage`)

## Design Decisions

### 1. Routing — optional param, single `ChatLayout`
- `/chats` → `ChatLayout` (no `chatId` param): list + empty right pane on desktop, list only on mobile
- `/chats/:chatId` → `ChatLayout` (with `chatId` param): list + conversation on desktop, conversation only on mobile
- Same `ChatLayout` mounts for both routes → sidebar does not remount when switching chats
- `ChatLayout` reads `useParams<{ chatId?: string }>()`, passes `chatId` to `ChatPane`
- Selecting a chat: `navigate('/chats/' + id)` (mobile + desktop)
- Mobile back button: `navigate('/chats')`
- Invalid/unknown `chatId`: `ChatPane` shows "Chat not found" with link back to `/chats`

### 2. Message cache
- `Map<string, PaginatedMessages>` in `ChatLayout`, keyed by `conversationId`
- On chat switch: show cached messages immediately, refetch in background
- Draft messages cached per `chatId` so they survive breakpoint changes

### 3. Sidebar state stability
- `ChatLayout` owns `chats`, `search`, `filter`, `activeChatId` (from route)
- `Sidebar` is pure presentational: receives `chats`, `activeId`, `onSelect`, `search`, `onSearchChange`, `filter`, `onFilterChange`
- Sidebar never remounts on chat switch (single `ChatLayout` mount)

### 4. Realtime
- `subscribeToUserMessages` subscribed once in `ChatLayout`
- Incoming message → update sidebar last message/time/unread count; if it's the open conversation, append to `ChatPane`
- `onResync` → refetch conversations list

### 5. `useMediaQuery` hook (adapted from reference)
- SSR-safe: `useState(() => typeof window !== 'undefined' ? window.matchMedia(query).matches : false)`
- `useIsDesktop()` → `useMediaQuery('(min-width: 1024px)')`

### 6. `useResizableSidebar` hook (adapted from reference)
- Min 300, max 560, default 400
- Pointer drag on `window`, double-click reset, Arrow Left/Right ±16px
- `localStorage` key `thread:sidebarWidth`, try/catch wrapped
- `role="separator"`, `aria-orientation="vertical"`, `aria-valuenow/min/max`, `tabIndex={0}`
- Handle + inline width only rendered when desktop

## Files to Create

### `src/components/layout/ChatLayout.tsx`
- Two-pane shell: desktop = `flex h-dvh overflow-hidden`, sidebar + chat pane; mobile = conditional render
- Fetches `listConversations()` on mount, subscribes to realtime
- Maintains message cache + draft cache
- Reads `chatId` from `useParams`, calls `navigate` on select/back
- Renders `Sidebar` + `ChatPane` (desktop); either/or (mobile)
- Passes current user (from `getCurrentUser`) to `Sidebar` for username/copy row

### `src/components/layout/Sidebar.tsx`
- Header: "Chats", New chat button → `/chats/new`, menu button, refresh → `listConversations()`
- Username row: `@username` + copy button (existing `handleCopyUsername` logic)
- Search: pill input `rounded-full`, light grey bg `#f0f2f5`
- Filter chips: All / Unread / Groups (rounded-full, indigo active)
- List: flat rows, avatar + name + @handle + time + last message preview + unread badge, divider after avatar, hover + active states, `min-w-0` + `truncate`
- `onSelect(chatId)` → parent `navigate('/chats/' + chatId)`
- Message search results: overlay dropdown in Sidebar (adapted from current `ChatListPage` behavior)

### `src/components/layout/ChatPane.tsx`
- Desktop header: `bg-[#f0f2f5]` 60px; mobile header: back arrow → `/chats`
- Message area: `bg-[#efeae2]`, max-width centered on wide screens
- Bubbles: received white left, sent `bg-[#d9fdd3]` right, timestamp inside bubble, date separators
- Composer: attach button, textarea pill (Enter send, Shift+Enter newline), send disabled when empty
- Auto-scroll to bottom on open/new messages, not if user scrolled up
- Empty state: "Select a chat to start messaging" (desktop, no selection)
- Error state: retry button; Loading: skeleton/spinner
- Mark read on open (`markRead` API)
- Renders `GroupSettingsDrawer`, `ReportModal`, `BlockModal` when group is open (same props as current `ChatPage`)

### `src/hooks/useMediaQuery.ts`
- `useMediaQuery(query: string): boolean` — SSR-safe, `matchMedia` + change listener
- `useIsDesktop(): boolean` — `useMediaQuery('(min-width: 1024px)')`

### `src/hooks/useResizableSidebar.ts`
- `useResizableSidebar()` → `{ width, dragging, handleProps }`
- Drag/keyboard/persistence logic

### `src/components/layout/EmptyState.tsx`
- "Select a chat to start messaging" desktop empty state

## Files to Modify

### `src/App.tsx`
- Replace `/chats` and `/chats/:conversationId` routes → both render `ChatLayout` inside `ProtectedRoute`
- Keep `/chats/new`, `/chats/new-group` as standalone pages
- Remove imports of `ChatListPage`, `ChatPage`; add import of `ChatLayout`

### `src/features/chat/ChatListPage.tsx`
- **Do not modify** — kept as-is (may be used as fallback)

### `src/features/chat/ChatPage.tsx`
- **Do not modify** — kept as-is (may be used as fallback)

## Preserved Existing Features

| Feature | How preserved |
|---|---|
| Search (chat + message) | Sidebar search filters conversations; message search as overlay dropdown |
| Refresh | Refresh button in Sidebar header calls `listConversations()` |
| New chat | Navigates to `/chats/new` |
| Copy username | Copy button in Sidebar username row |
| Groups | Group rows show title + IdenticonAvatar; GroupSettingsDrawer in ChatPane |
| Unread counts | Badge on each row; cleared on open via `markRead` |
| Timestamps | `formatMessageTime` reused in Sidebar rows and ChatPane |
| Message sending/receiving | `ChatPane` uses `sendMessage`, optimistic send, realtime |
| Realtime | `subscribeToUserMessages` in `ChatLayout` updates sidebar + open conversation |
| Block/Report modals | Rendered in `ChatPane` |

## Known Gaps / Assumptions

1. **`ChatListPage`/`ChatPage` left in place**: not deleted, no longer routed
2. **Group member list**: `ChatPane` calls `listGroupMembers` and renders `GroupSettingsDrawer` — same as current `ChatPage`
3. **Typing indicator**: `ChatPane` calls `setTyping` on textarea change — same as current `ChatPage`
4. **Draft persistence**: draft cached per `chatId` in `ChatLayout` so it survives breakpoint changes
5. **Invalid `chatId`**: `ChatPane` shows "Chat not found" with link back to `/chats`

## Validation

1. Desktop ≥1024px: click any chat → conversation appears on right, no reload, URL = `/chats/:id`
2. Browser back/forward and refresh restore correct open chat (route param drives it)
3. Drag handle resizes sidebar 300–560px, width persists after `localStorage` restore, double-click resets to 400
4. Mobile <1024px: no resize handle, list and conversation never both visible, back arrow works
5. Sidebar does not remount/lose scroll/search/filter when switching chats
6. Sidebar and message area scroll independently; no horizontal overflow
7. Unread badges, last message previews, timestamps correct after send/receive
8. `npm run build` and `tsc --noEmit` pass with no type/lint errors
