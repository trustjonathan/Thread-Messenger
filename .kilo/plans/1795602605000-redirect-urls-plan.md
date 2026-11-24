# Redirect URL / VITE_APP_URL Plan — dynamic OAuth callback origin

## Goal
Ensure Thread's OAuth sign-in redirect/callback points to the running app's own origin (localhost in dev, staging *.onrender.com in staging, production origin in production), never a hardcoded production domain. Add staging URL to Supabase's allowed redirect list and confirm Render staging env vars point to staging.

## Findings (verified against codebase)
- `src/lib/api.ts:557-560` — `signInWithGoogle()` sets `redirectTo = ${window.location.origin}/chats`. This is already dynamic; no hardcoded `thread-messenger.onrender.com` exists anywhere in `src/`, config, or tests.
- `VITE_APP_URL` / `VITE_SITE_URL` — not defined anywhere. `.env.example` declares only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_USE_MOCK_API`.
- **Contract lock (README):** `src/lib/api.ts` and `.env.example` must NOT be edited by builders. Therefore `signInWithGoogle` cannot be changed to read `import.meta.env.VITE_APP_URL`, and `VITE_APP_URL` cannot be added to `.env.example`.
- **Conclusion:** `window.location.origin` already fulfills the dynamic-origin requirement. No source change is needed for item #1. Adding `VITE_APP_URL` to `.env.example` is out of scope (contract-locked) and unnecessary because the code already derives the origin from `window.location`.

## Tasks

### 1. Confirm no hardcoded production redirect URL (code)
- Verified: only `redirectTo` usage is `src/lib/api.ts:557-560` using `window.location.origin`. No `thread-messenger.onrender.com` hardcoded. No `redirect_uri` elsewhere.
- Action: none — requirement already met by existing code.
- Verification: sign in on staging → callback goes to `https://<staging>.onrender.com/chats`, not production.

### 2. Verify Render staging environment variables (operational)
- Open the test/staging static site on Render → Environment.
- Confirm any site/auth env vars reference the staging origin (`https://thread-messenger-staging.onrender.com`), not production.
- If a separate staging Supabase project is used, confirm it's configured separately from production.
- Verification: staging service env list shows the staging URL; redeploying staging picks up updated values.

### 3. Add staging URL to Supabase allowed redirect URLs (operational)
- Supabase Dashboard → Authentication → URL Configuration → Redirect URLs.
- Add exact staging URL: `https://thread-messenger-staging.onrender.com/chats` (and the base origin `https://thread-messenger-staging.onrender.com`).
- If using a single shared Supabase project for staging + production: keep Site URL on production, but explicitly add the staging URL to Redirect URLs.
- Verification: staging URL saved in allowed redirect/callback list without validation errors; Google OAuth sign-in from staging succeeds and returns to staging.

## Boundaries
- Do NOT edit `src/lib/api.ts` (contract-locked) — `window.location.origin` remains the redirect origin.
- Do NOT edit `.env.example` (contract-locked) — `VITE_APP_URL` is not added.
- Source code changes: none required. This is purely verification + operational dashboard work.

## Validation
- Staging sign-in flow completes and redirects back to the staging `*.onrender.com` origin (not production).
- Supabase dashboard shows staging URL in allowed Redirect URLs.
- Render staging env vars list the staging URL.
- `npm run typecheck`, `npm run lint`, `npm run test` still pass (no source changes expected).
