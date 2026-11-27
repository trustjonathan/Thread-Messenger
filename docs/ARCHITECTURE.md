# Architecture

A practical map of Thread Messenger for new contributors. This is a React 18 + Vite 6 + TypeScript single-page app using Tailwind CSS 3 and Supabase for Auth, Postgres, Realtime, and an AI Edge Function. Features include 1:1 and group messaging, Thread AI, a PWA, and an offline outbox.

## Code map

```text
src/
  main.tsx                     React entry point; imports index.css
  App.tsx                      BrowserRouter, route guards, all routes
  components/
    layout/                    Chat shell (see below)
    chat/                      MessageRenderer, MessageStatus
  features/                    Page-level areas
    auth/                      SignInPage, ChooseUsernamePage
    chat/                      ChatPage, ChatListPage, NewChatPage, NewGroupPage,
                               TChatPage, chat components and hooks
    settings/                  SettingsPage, AvatarPage, NotificationPrompt
    public/                    Landing-adjacent pages: Help, Contact, SEO, layout
    legal/                     PrivacyPage, TermsPage
    invite/                    InviteLandingPage
    landing/                   LandingPage
  hooks/                       useMediaQuery, useResizableSidebar
  lib/                         apiClient seam, API types, Supabase client, theme,
                               notifications, offline cache, clipboard, PWA helpers
  pwa/                         InstallPrompt, OfflineBanner, UpdateBanner, pwaOptions
  types/                       api.ts (API contract), database.ts (DB types)
supabase/
  config.toml                  Local Supabase configuration
  migrations/                  Canonical schema, RLS, triggers, RPCs
  functions/ai-chat/           index.ts + systemPrompt.ts (SSE AI Edge Function)
tests/
  unit/                        Vitest unit tests (mock API / components)
  integration/                 Vitest tests against a local Supabase stack
  e2e/                         Playwright specs + routes + config
  rls/                         SQL and shell/PowerShell security checks
  api-smoke/                   PostgREST private-schema exposure checks
```

### Routing — `src/App.tsx`

`App.tsx` defines the route table and three guards: `ProtectedRoute`, `GuestRoute`, and `ChooseUsernameRoute`. It also subscribes to auth changes, applies the theme, flushes queued offline messages on open/`online`, and sends a `last_seen` heartbeat.

- Public: `/`, `/landing`, `/help`, `/contact`, `/privacy`, `/terms`, `/invite/:code`
- Guest-only: `/signin`
- Onboarding: `/choose-username`
- Protected: `/chats`, `/chats/:chatId?`, `/chats/new`, `/chats/new-group`, `/t-chat`, `/ai`, `/settings`, `/settings/avatar`
- Unknown paths redirect to the appropriate sign-in, username, or chat route.

Static chat sub-routes (`/chats/new`, `/chats/new-group`) are declared before `/chats/:chatId?` on purpose.

### Chat shell — `src/components/layout/*`

- `ChatLayout.tsx` — two-pane shell for `/chats/*` and `/ai`. Loads the user and conversation list, owns the user-level Realtime subscription and unread counts, handles refresh/retry and Escape key behavior, and switches between sidebar and panes on mobile/desktop.
- `Sidebar.tsx` — conversation list with search and All/Unread/Groups filters, username copy, invite modal, navigation to settings/help/terms, and the AI entry point.
- `ChatPane.tsx` — active conversation: paginated message list (`loadMessages` with cursor), composer, optimistic send, read receipts (`markRead`), typing signal, group header/settings, block and report dialogs, and its own Realtime subscription.
- `AiChat.tsx` — Thread AI UI: immediate streaming reply rendering, stop/copy/retry controls, Markdown/KaTeX rendering via `src/components/chat/MessageRenderer.tsx`. Thread AI has no quota or cooldown.
- `AIBottomSheet.tsx` — mobile presentation for `AiChat`.
- `EmptyState.tsx` — shared "select a chat" and invite prompt.

Shared building blocks also live in `src/features/chat/components/*` (avatars, date separator, error messages, group settings, modals) and `src/components/chat/*` (message body and delivery status).

## API contract seam

All UI code calls backend functions through one module:

```text
components / features / hooks
          |
          v
  @/lib/apiClient.ts  ── import seam; re-exports the real API by default
          |
          ├── VITE_USE_MOCK_API=true (alias in vite.config.ts)
          |      └── src/lib/api.mock.ts  (seeded in-memory data + fake latency)
          |
          └── default / production
                 └── src/lib/api.ts  (typed Supabase client)
                        ├── Auth + Postgres RPCs + Realtime via @supabase/supabase-js
                        └── Edge Function: supabase/functions/ai-chat
```

Key details:

- The alias is evaluated when the dev server or build starts, **not at runtime**. `VITE_USE_MOCK_API=true npm run dev` gives you a usable UI without a backend. `vite.config.ts` refuses a production build with mock mode unless explicitly overridden.
- `src/lib/apiClient.ts` is also listed as a protected file: it must remain the single stable import point. `src/lib/api.mock.ts` mirrors the real API surface (including `mapError`, `newClientId`, and `OFFLINE_MESSAGE_SYNCED_EVENT`) so tests and mock mode do not need different call sites.
- `src/lib/api.ts` returns `ApiResult<T>` (`{ data, error }`) and normalizes errors through `mapError()` into `ApiError` codes. Types come from `src/types/api.ts`; database row types come from `src/types/database.ts`.
- Do not import from `src/lib/api.ts` or `src/lib/api.mock.ts` directly in feature code. Tests can mock `@/lib/apiClient` at this seam.

## Data flow: sending a message

1. `ChatPane.tsx` loads the conversation and a page of messages with `loadMessages`/`getCurrentUser` from `@/lib/apiClient`.
2. The composer validates non-empty text (max 2000 characters), creates a `clientId` with `newClientId()`, and immediately renders an optimistic message with status `sending`.
3. `sendMessage({ conversationId, body, clientId })` in `src/lib/api.ts` calls the `send_message` Postgres RPC. The RPC is idempotent for `(sender_id, client_id)`, so retries do not duplicate messages.
4. On success, the message is cached locally (`src/lib/offlineCache.ts`), the UI flips the optimistic message to `sent`, and `ChatPane` calls `onMessageSent` so `ChatLayout` updates the sidebar's last-message preview and unread count.
5. On a network failure, the message is queued in the durable outbox. `App.tsx` calls `flushQueuedMessages()` on sign-in and on the browser `online` event; successful syncs emit `OFFLINE_MESSAGE_SYNCED_EVENT`. Non-network errors mark the message `failed` with a human-readable error from `src/features/chat/components/ErrorMessage.tsx`.
6. `subscribeToUserMessages()` in `src/lib/api.ts` listens to Realtime inserts and a resync signal. `ChatLayout` uses it to bump unread counts for inactive chats and refresh the conversation list; `ChatPane` uses it to add incoming messages and avoid counting the active chat as unread. `markRead()` runs when the chat is visible.

## Data flow: streaming Thread AI

1. From `Sidebar.tsx`, desktop opens the `/ai` pane; mobile opens `AIBottomSheet.tsx`. Both render `AiChat.tsx` with no quota bootstrap request.
2. `AiChat` calls `streamAiPrompt({ prompt, history, onChunk, onDone, onError, signal })` from `@/lib/apiClient`.
3. In `src/lib/api.ts`, `streamAiPrompt` gets the session's access token and POSTs to `${VITE_SUPABASE_URL}/functions/v1/ai-chat` with `{ prompt, history }` and an `AbortSignal`. It parses SSE `data:` text chunks and `event: done` / `event: error` events with `TextDecoder`, and settles the UI even if a proxy strips the trailing done event.
4. The Edge Function (`supabase/functions/ai-chat/index.ts`, prompt in `systemPrompt.ts`) validates the session and input, streams model text immediately, and sends an empty final `done` event. It has no quota database dependency.
5. `AiChat` renders each chunk as soon as it arrives (no RAF pacing or artificial delay). Stopping aborts the fetch but keeps partial text. Retry drops interrupted turns and resends from the last completed user prompt. History is in-memory only and clears when the panel closes. Errors are normalized to `ApiError` codes and shown in the pane.

## Tests

| Location | Purpose | Command |
| :--- | :--- | :--- |
| `tests/unit/*.test.ts(x)` | Components, hooks, mock API, error mapping, AI streaming UI | `npm run test` |
| `tests/integration/*.test.ts` | Auth/RPC behavior against a local Supabase stack (uses `supabase status -o json` or `SUPABASE_URL` / `SUPABASE_ANON_KEY`) | `npm run test:integration` |
| `tests/e2e/*.spec.ts` | Playwright user journeys in mock mode; config starts Vite with `VITE_USE_MOCK_API=true` | `npm run test:e2e` (after `npx playwright install chromium`) |
| `tests/rls/*.sql`, `*.sh`, `*.ps1` | Row Level Security isolation, group membership, concurrency, performance seeds | Run against a local database; no npm script |
| `tests/api-smoke/*.sh`, `*.ps1` | Verify private-schema tables/RPCs are not exposed through PostgREST | Run against a local stack; no npm script |

Several journeys in `tests/e2e/messenger.spec.ts` are marked `test.fixme` and are intentional first-contribution targets.

## Contract boundary: what you can safely change

**Safe to work in:** `src/components/**`, `src/features/**`, `src/hooks/**`, `src/pwa/**`, non-contract helpers in `src/lib/**` (theme, notifications, offline cache, clipboard, etc.), `tests/**`, `docs/**`, and contributor templates in `.github/**`.

**Do not edit in a feature PR:**

- `supabase/migrations/*` — canonical schema, RLS policies, triggers, RPCs
- `src/types/*` — database and API contract types
- `src/lib/api.ts` — typed client contract
- `src/lib/apiClient.ts` — import seam
- `.env.example` — required environment declarations

These paths are also protected by `.github/CODEOWNERS` and the Contract Guard workflow. If you need a new table, column, RPC, Edge Function capability, or client method, write the request in `NEEDS_API.md` with motivation and proposed types/schema (or open an issue and ask a maintainer to record it). Do not work around the contract by bypassing `@/lib/apiClient` or by editing generated types.
