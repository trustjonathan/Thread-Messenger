# Contributing to Thread Messenger

Thanks for helping out! Thread Messenger is a public, text-only messenger built with React 18, Vite 6, TypeScript, Tailwind CSS 3, and Supabase (Auth, Postgres, Realtime, and an AI Edge Function). It includes 1:1 and group chats, an AI pane, a PWA, and an offline outbox.

If you are new here, read the **Good first contributions** list at the bottom, claim an issue, and ask questions early. Small, focused pull requests are welcome.

## Quick start

Use **Node 20 LTS** (CI runs on Node 20) with its bundled npm.

```bash
node -v          # should be v20.x
npm ci
cp .env.example .env   # Windows: copy .env.example .env
npm run dev
```

Open `http://localhost:5173`. Put your local Supabase URL and anon key in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `.env` is ignored by git — never commit keys, and do not edit `.env.example`.

To work without a backend, run the seeded in-memory mock API:

```bash
VITE_USE_MOCK_API=true npm run dev
# PowerShell: $env:VITE_USE_MOCK_API='true'; npm run dev
```

The mock swap happens when the dev server or build starts, not at runtime. Production builds with the mock flag are intentionally blocked by `vite.config.ts`.

## Architecture orientation

- `src/App.tsx` owns routing and the signed-in / guest / username guards.
- `src/components/layout/*` is the chat shell: `ChatLayout`, `Sidebar`, `ChatPane`, `AiChat`, plus `EmptyState` and the mobile `AIBottomSheet`.
- `src/features/*` holds pages and feature components (`auth`, `chat`, `settings`, `public`, `legal`, `invite`, `landing`).
- `src/lib/apiClient.ts` is the **only** import point for backend calls. It resolves to `src/lib/api.ts` (real Supabase) or `src/lib/api.mock.ts` (mock data).
- `src/types/*` defines the shared API and database types; `supabase/migrations/*` and `supabase/functions/ai-chat/*` are the backend contract.
- `tests/unit`, `tests/integration`, `tests/e2e`, `tests/rls`, and `tests/api-smoke` cover different layers.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the full map, data flows, and the contract boundary.

## Branch and PR workflow

1. Find or open an issue and comment that you would like to work on it. Wait to be assigned so two people do not duplicate work.
2. Branch from `main` with a short, descriptive name, e.g. `test/realtime-unread`, `ui/empty-states`, `docs/onboarding`.
3. Keep the change small and related to one issue. Open a PR against `main`, fill in the PR template, and link the issue (`Closes #123`).
4. CI runs typecheck, lint, unit tests, and a production build. The Contract Guard workflow checks for changes to protected files. Address review feedback with follow-up commits.
5. Do not commit `node_modules/`, `dist/`, `test-results/`, `.env`, keys, or generated screenshots/artifacts.

## Code style

- TypeScript is strict (`noUnusedLocals` and `noUnusedParameters` are on). Prefer typed values over `any`; use types from `@/types/api` rather than locally reinventing shapes.
- Import app modules with the `@/` alias, and import backend calls from `@/lib/apiClient` — never directly from `api.ts` or `api.mock.ts`.
- `npm run lint` must pass with zero warnings (ESLint + React Hooks rules). Avoid adding debug `console` logs to shipped UI code.
- Use Tailwind 3 utility classes and the existing `thread` color tokens from `tailwind.config.js` (`bg-thread-*`, `text-thread-*`, `border-thread-*`), plus `dark:` variants for dark mode. Keep `focus-visible` styles and comfortable touch targets.
- Reuse existing components in `src/components/**` and `src/features/chat/components/**` before adding new ones. Discuss new dependencies in an issue first.

## Testing expectations

Run the checks that match your change before opening a PR:

| Change | Run |
| :--- | :--- |
| Any TypeScript/TSX edit | `npm run typecheck` and `npm run lint` |
| Component, hook, mock API, or bug fix | `npm run test` (Vitest unit suite) |
| Auth/RPC work against a local backend | `npm run test:integration` (start Supabase locally with `supabase start`, or set `SUPABASE_URL` and `SUPABASE_ANON_KEY`) |
| Browser journeys, routing, PWA | `npm run test:e2e` (install Chromium once with `npx playwright install chromium`; the config starts Vite in mock mode) |
| RLS/security or private-schema changes | Run the relevant `tests/rls/*.sql` scripts against a local database and the `tests/rls/*.sh` / `.ps1` concurrency checks; run `tests/api-smoke/*` for API exposure checks. These have no npm script — ask a maintainer if you need help setting up the local database. |
| Final check | `npm run build` |

Add or update a test when you fix a bug or add logic. Several browser journeys in `tests/e2e/messenger.spec.ts` are currently marked `test.fixme`; re-enabling them one at a time is a great first contribution. If CI does not run a suite you changed, say exactly which commands you ran in the PR.

## Contract rules and API changes

The following are protected contract files. **Do not edit them in a feature PR**:

- `supabase/migrations/*` — schema, RLS policies, triggers, RPCs
- `src/types/*` — generated database types and API contract types
- `src/lib/api.ts` — typed backend client and error normalization
- `src/lib/apiClient.ts` — the import seam / alias
- `.env.example` — required environment variables

The Contract Guard CI job and `.github/CODEOWNERS` enforce this boundary. If your feature needs a new table, column, RPC, Edge Function behavior, or client method, document the request in [NEEDS_API.md](NEEDS_API.md) with the motivation and proposed types/schema. If you cannot edit that file, describe the request in your issue and ask a maintainer to add it. Work on UI, tests, and docs around the existing contract while the request is reviewed.

## Claiming an issue

1. Comment on the issue with what you plan to do and roughly how long you expect it to take.
2. Wait for assignment (or a maintainer's go-ahead) before starting, especially for popular issues.
3. If you are blocked, comment with what you tried. If you step away, say so so someone else can pick it up.
4. Reference the issue in your PR. Use `Closes #N` only when the PR fully resolves it; otherwise use `Refs #N`.

## Commit messages

Use short, conventional messages in the imperative mood:

- `fix: keep unread count stable for the active chat`
- `test: enable landing page E2E journey`
- `docs: add contributor architecture guide`
- `ui: improve empty state for filtered chat list`

Keep commits focused; avoid final `WIP` commits, and never include secrets or credentials.

## Good first contributions

These are concrete starting points derived from the current repo. Pick one, claim it, and keep the PR scoped.

1. **Re-enable an E2E journey** in `tests/e2e/messenger.spec.ts`. Several tests use `test.fixme(true, ...)` for the landing page, sign-in, username choice, chat list, and full journey. Remove one fixme, fix selectors in `tests/e2e/routes.ts` if needed, and run `npm run test:e2e`.
2. **Add realtime/unread unit tests.** Mock `subscribeToUserMessages` from `@/lib/apiClient` and verify that an incoming message increments unread for an inactive chat but not for the active one (the logic lives in `src/components/layout/ChatLayout.tsx`). Add a new file under `tests/unit/`; report any bug as an issue rather than changing contract files.
3. **Improve empty and loading states.** Add a friendly "no chats match your search/filter" state to `src/components/layout/Sidebar.tsx`, refine `src/components/layout/EmptyState.tsx` or the loading/error states in `src/components/layout/ChatPane.tsx`, and cover it with a unit test. Use existing Tailwind tokens and `dark:` styles.
4. **Audit accessibility labels.** Check focus order, button labels, dialog roles, and keyboardDismiss behavior for the composer and menus in `src/components/layout/ChatPane.tsx`, `Sidebar.tsx`, `AiChat.tsx`, and `AIBottomSheet.tsx`. Add assertions to `tests/unit/ui-fixes.test.tsx` or a new unit test.
5. **Add RLS coverage.** Create a new `tests/rls/08_*.sql` case (for example, a removed group member losing read access) modeled on `tests/rls/01_conversations_isolation.sql`. No migration edits needed — if the policy is wrong, file an issue.
6. **Extend API smoke checks.** Add a case under `tests/api-smoke/` alongside `test_private_schema_hidden.sh` / `.ps1` that verifies another internal table or RPC is not exposed through PostgREST.
7. **Translate onboarding docs.** Create a translated guide under `docs/` based on this file and the README. Keep the English originals intact and ask a maintainer to link the translation.

Not sure where to start? Open an issue with the area you are interested in and we will suggest a task.
