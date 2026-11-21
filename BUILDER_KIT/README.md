# Thread Messenger — Builder Kit

> **For Lovable · Bolt · Replit and any other UI/PWA/test builder.**
> Read this before touching a single file.

---

## What you are building on

Thread Messenger is a **public, text-only 1:1 chat app**.
Stack: React + Vite + TypeScript + Tailwind + Supabase (Auth, Postgres, Realtime).
Backend is fully defined (migrations, RLS, RPCs). You write UI, PWA glue, and tests.

---

## The Contract

The following files are **frozen**. Do not edit them. Any PR that touches them
requires the `contract` label and human review:

| File | Purpose |
|------|---------|
| `src/types/api.ts` | All shared TypeScript types (`ApiResult`, `Message`, etc.) |
| `src/types/database.ts` | Supabase-generated DB types — do not hand-edit |
| `src/lib/api.ts` | Real Supabase API implementation |
| `src/lib/apiClient.ts` | The **only** import point for builders |
| `supabase/migrations/**` | DB schema — run by humans, not builders |
| `.env.example` | Env var names only — no secrets |

---

## Import Rule (enforced by CI)

```ts
// ✅ CORRECT — always import from apiClient
import { sendMessage, listConversations } from '@/lib/apiClient';

// ❌ WRONG — never import the real or mock api directly
import { sendMessage } from '@/lib/api';
import { sendMessage } from '@/lib/api.mock';
```

---

## Running with the Mock API

No Supabase credentials needed. The mock has seeded users, 3 conversations,
messages, 200–400 ms simulated latency, and a realtime simulation every ~20 s.

```powershell
# Windows PowerShell
$env:VITE_USE_MOCK_API = "true"
npm run dev
```

```bash
# bash / zsh
VITE_USE_MOCK_API=true npm run dev
```

The Vite alias swaps `@/lib/apiClient` → `src/lib/api.mock.ts` at build time.
No code change required when switching back to the real backend (unset the flag).

### Triggering error states in the mock

Send a message whose body starts with one of these magic strings:

| Body prefix | Error returned |
|-------------|---------------|
| `/fail-rate` | `RATE_LIMITED` |
| `/fail-op`   | `OPERATION_FAILED` |
| `/fail-net`  | `NETWORK_ERROR` |
| `/fail-val`  | `VALIDATION_ERROR` |

Use these to test your error UI without needing a real backend.

---

## Folder Ownership

| Builder | Owns | Must NOT touch |
|---------|------|---------------|
| **Lovable** | `src/features/chat/`, `src/features/auth/`, `src/components/` | Contract files |
| **Bolt** | `src/features/settings/`, `src/pwa/`, `public/` | Contract files |
| **Replit** | `tests/`, `scripts/`, `supabase/functions/` (edge functions only) | Contract files, migrations |

Conflicts between builders: resolve by folder boundary. If you need a shared
component, put it in `src/components/` and coordinate via PR.

---

## Hard Rules

1. **Never call Supabase directly** — all calls go through `@/lib/apiClient`.
2. **Never add the service-role key** anywhere in frontend code.
3. **Text only** — no image, file, or media upload code.
4. **De-duplicate realtime messages by `clientId`** — the realtime channel and
   the optimistic UI may both deliver the same message; keep the first, drop duplicates.
5. **Never print or commit secrets** — `.env.example` holds names only.
6. **Never call `supabase db reset` or run migrations** — that's the DBA's job.

---

## API Quick Reference

All functions return `ApiResult<T>` = `{ data: T } | { error: ApiError }`.

```ts
type ApiError = {
  code: ApiErrorCode;   // 'UNAUTHENTICATED' | 'RATE_LIMITED' | 'OPERATION_FAILED' | ...
  message: string;      // human-readable, safe to display
  details?: unknown;    // raw error, for logging only
};
```

Always check for errors before using data:

```ts
const result = await sendMessage({ conversationId, body, clientId: newClientId() });
if ('error' in result) {
  // show result.error.message in UI
  return;
}
// use result.data
```

### Available functions

| Function | Description |
|----------|-------------|
| `searchUserByUsername(username)` | Find a user by exact username (case-insensitive) |
| `setUsername(username)` | Set current user's username (once only) |
| `getOrCreateDirectConversation(otherUserId)` | Open or create a 1:1 chat |
| `listConversations()` | Get all conversations for current user |
| `loadMessages(conversationId, cursor?)` | Paginate messages (newest first) |
| `sendMessage({ conversationId, body, clientId })` | Send a text message |
| `markRead(conversationId)` | Mark conversation as read up to now |
| `blockUser(targetUserId)` | Block a user |
| `unblockUser(targetUserId)` | Unblock a user |
| `reportContent({ messageId?, targetUserId, reason })` | Report abuse |
| `updateLastSeen()` | Update current user's `last_seen_at` |
| `subscribeToUserMessages(userId, onMessage, onResync?)` | Realtime subscription |
| `newClientId()` | Generate a UUID for deduplication |

---

## Setting Up Your Sandbox

Run `BUILDER_KIT\build-kit.ps1 -TargetDir <your-sandbox-dir>` to copy the
contract files into your working environment.

```powershell
.\BUILDER_KIT\build-kit.ps1 -TargetDir "C:\sandbox\my-feature"
```

The script copies:
- `src/types/api.ts`
- `src/lib/apiClient.ts`
- `src/lib/api.mock.ts`
- A stub `src/lib/api.ts` that re-exports the mock (for offline sandbox use)

> [!IMPORTANT]
> Never commit the stub `src/lib/api.ts` back to the main repo. It is for local
> sandbox use only. The real `src/lib/api.ts` must remain untouched in `main`.

---

## CI Checks (must pass before merge)

```
npm run typecheck   # tsc --noEmit
npm run lint        # eslint src/
npm run test        # vitest run (unit tests only)
npm run build       # vite build
```

Integration tests (`tests/integration/`) run locally only. Do not add them to CI.
