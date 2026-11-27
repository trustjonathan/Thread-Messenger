# Thread Messenger

Public, text-only 1:1 messenger built with React, Vite, TypeScript, Tailwind CSS, and Supabase (Auth, Postgres, Realtime).

## Contract Rules

This repository enforces a strict API and schema contract. Downstream AI builders (Lovable, Bolt, Replit) and contributors building UI, PWA features, or additional tests **MUST NOT** edit the following contract files:

* `supabase/migrations/*` — Canonical database schemas, RLS policies, triggers, and RPC definitions.
* `src/types/*` — Generated database definitions (`database.ts`) and API contract types (`api.ts`).
* `src/lib/api.ts` — The typed client contract implementing all backend interactions and error normalization.
* `.env.example` — Required environment variable declarations.

If a new backend capability or data model change is required, builders must document the request in [NEEDS_API.md](NEEDS_API.md) without modifying contract files directly.

## Development Scripts

* `npm run dev` — Launch Vite local development server.
* `npm run typecheck` — Run TypeScript compiler check without emitting files (`tsc --noEmit`).
* `npm run lint` — Run ESLint across TypeScript source files.
* `npm run test` — Run unit test suite (Vitest with mocked client).
* `npm run test:integration` — Run integration test suite against the local Supabase stack.
* `npm run build` — Build static bundle for production deployment.

## Environment Variables

Copy `.env.example` to `.env` and configure:
```
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<your_local_or_remote_anon_key>
```

## Contract Change Log

Maintainer-authorized changes are recorded in [NEEDS_API.md](NEEDS_API.md):

* `20261128000001_remove_ai_quota.sql` — Thread AI is unrestricted (no quota RPCs/cooldowns) and `send_message` checks all active group members for blocks.
* Generated DB types were brought back in sync with migrations; client-side `as never`/`any` contract casts were removed.

Contributors should still treat the files listed under **Contract Rules** as read-only and request changes through `NEEDS_API.md`.
