# Update Banner Plan — client-only scheduled announcements

## Goal
Show time-windowed in-app banners to inform users about Thread updates (before/during/after deploy), starting with the group-chat rollout messages.

**Messages to pre-seed:**
- Before: `"Heads up: We're updating Thread Messenger around [Time] to add group chats. You may see a brief reconnect."`
- During: `"Thread is updating right now. Sending is briefly paused—please refresh in a minute."`
- After: `"Group chat is now live in Thread! Tap New group from your chats list to start a conversation."`

## Decisions
- **Client-only config.** No backend, no admin page, no new tables/RPCs. Admin edits a config file and redeploys before each phase window. Chosen because README contract rules put schema/RPC changes (`src/lib/api.ts`, `src/types/*`, `supabase/migrations/*`) in DBA/coordinator scope via `NEEDS_API.md`.
- **Banner-only MVP.** `UpdateBanner` renders below `OfflineBanner` in `App.tsx`. Send input is NOT disabled during the "during" phase (deferred to follow-up).
- **Dismissal via localStorage** per `version:phase` combo. Banner reappears when the phase changes (e.g., dismissed "during" still shows "after").
- **Time windows in ISO UTC.** Active window = `now >= startsAt && now < endsAt`. Overlapping windows: most recent `startsAt` wins.

## UI appearance
- Fixed full-width top banner, z-index above OfflineBanner (`z-50`), centered text.
- Container: `bg-amber-500 text-white text-sm font-medium text-center shadow`, py-2 gap-2 flex items-center justify-center.
- Leading icon: `WarningTriangle` from lucide-react (`w-4 h-4`, aria-hidden).
- Body: plain text (the announcement `body` string), no HTML.
- Trailing dismiss button: `×` glyph, `aria-label="Dismiss"`, `aria-hidden="true"`, minimal styling (text-white/70, hover:opacity-75, p-1).
- During-deploy phase: amber-500 (matches existing offline banner).
- Before/after phases: indigo-600 variant (`bg-indigo-600 text-white`) to visually distinguish rollout stages; same layout.
- `role="alert"` + `aria-live="polite"` so screen readers announce the change when the phase switches.

- `src/lib/updates.ts` (new) — `UPDATES` array, `UpdateAnnouncement`/`UpdatePhase` types, `getActiveUpdate(now?)` helper, dismissal `localStorage` helpers.
- `src/pwa/UpdateBanner.tsx` (new) — fixed top banner below `OfflineBanner`; `role="alert"`, `aria-live="polite"`; amber/indigo theming matching the existing `OfflineBanner`; leading warning icon; body text; trailing dismiss ("×") button; renders `null` when no update is active or it is dismissed.
- `src/App.tsx` (edit) — mount `<UpdateBanner />` below `<OfflineBanner />`, outside `<Routes>`.

## Data flow
1. App mounts → `UpdateBanner` calls `getActiveUpdate()`.
2. If active and not dismissed → render banner with body text + dismiss button.
3. Dismiss writes `localStorage["thread:update-dismissed:<version>:<phase>"] = "1"`.
4. On each render/re-mount, recompute active window + dismissal state so phase changes re-surface the banner.

## Boundaries (contract files untouched)
Do NOT edit: `supabase/migrations/*`, `src/types/*`, `src/lib/api.ts`, `src/lib/apiClient.ts`, `.env.example`. All new code lives in `src/lib/updates.ts` and `src/pwa/UpdateBanner.tsx`.

## Files
- `src/lib/updates.ts` (new) — `UPDATES` array, `UpdateAnnouncement`/`UpdatePhase` types, `getActiveUpdate(now?)` helper, dismissal `localStorage` helpers.
- `src/pwa/UpdateBanner.tsx` (new) — fixed top banner below `OfflineBanner`; `role="alert"`, `aria-live="polite"`; amber/indigo theming matching the existing `OfflineBanner`; leading warning icon; body text; trailing dismiss ("×") button; renders `null` when no update is active or it is dismissed.
- `src/App.tsx` (edit) — mount `<UpdateBanner />` below `<OfflineBanner />`, outside `<Routes>`.

## UI appearance
- Fixed full-width top banner, z-index above OfflineBanner (`z-50`), centered text.
- Container: `bg-amber-500 text-white text-sm font-medium text-center shadow`, py-2 gap-2 flex items-center justify-center.
- Leading icon: `WarningTriangle` from lucide-react (`w-4 h-4`, aria-hidden).
- Body: plain text (the announcement `body` string), no HTML.
- Trailing dismiss button: `×` glyph, `aria-label="Dismiss"`, `aria-hidden="true"`, minimal styling (text-white/70, hover:opacity-75, p-1).
- During-deploy phase: amber-500 (matches existing offline banner).
- Before/after phases: indigo-600 variant (`bg-indigo-600 text-white`) to visually distinguish rollout stages; same layout.
- `role="alert"` + `aria-live="polite"` so screen readers announce the change when the phase switches.

## Failure modes
- `localStorage` unavailable/private mode → try/catch, treat as not-dismissed (banner shows).
- Malformed dates in config → `getActiveUpdate` skips invalid entries, returns null.
- Overlapping/duplicate windows → deterministic pick (most recent `startsAt`), no crash.
- No active update → component renders `null`.

## Rollout / migration path
1. Pre-seed `UPDATES` with placeholder ISO times; admin replaces with real deploy times before each phase.
2. Redeploy before the "during" window so the banner aligns with actual downtime.
3. After the group-chat rollout, leave the "after" entry until a new update replaces it, or clear `UPDATES`.

## Validation
- `npm run typecheck` — passes
- `npm run lint` — passes (0 warnings)
- `npm run test` — existing unit tests still pass
- Add `tests/unit/updates.test.ts` covering: active-window match, expired/not-yet, overlapping pick, dismissal key by `version:phase`.
- Manual: set a 2-minute future window, confirm banner shows, dismiss, confirm hidden; advance phase in config, confirm banner reappears.

## Open questions (marked out of scope for now)
- Disabling the ChatPage send input during "during" phase — deferred follow-up.
- Backend-driven admin page / maintenance table — would require `NEEDS_API.md` request; explicitly not in this plan.
