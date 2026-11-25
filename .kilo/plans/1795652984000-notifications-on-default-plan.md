# Notifications On-By-Default Plan

## Goal
Make desktop message notifications enabled by default (proactively prompted on first launch), with a Settings toggle so users can turn them off later.

## Constraint (browser limitation)
Browsers cannot silently grant `Notification.permission` — it starts at `'default'` and notifications won't display until `'granted'`. `requestPermission()` must be called from/interactively with the user. Therefore "on by default" means:
- Proactively prompt on first launch (permission `'default'` + app pref `true`)
- App-level preference `thread:notifications-enabled` in `localStorage`, default `true`
- Settings toggle switch (on by default) to turn off / back on

## Decisions
1. **App-level preference:** `thread:notifications-enabled` in `localStorage`, default `true`. This is the app's own on/off switch, independent of browser permission.
2. **First-load prompt:** When `Notification.permission === 'default'` AND app pref is `true`, show a non-intrusive in-app prompt: "Get notified about new messages?" with Enable / Not now. If "Not now", set app pref `false` and don't re-prompt; show subtle Settings link.
3. **Settings UI:** Replace the "Enable notifications" button with a toggle switch (on by default). 
   - Toggle off → set app pref `false`, stop showing notifications even if browser permission is granted.
   - Toggle on → if browser permission `'granted'`, enable; if `'denied'`, show message to change in browser settings + offer to re-request `requestPermission()`.
4. **`showIncomingMessageNotification`** checks BOTH: app pref `true` AND `Notification.permission === 'granted'`. Tag dedup by `conversationId` retained.

## Files to modify
- `src/lib/notifications.ts` — add `areNotificationsEnabled()`, `setNotificationsEnabled()`, `getNotificationAppPref()`; update `showIncomingMessageNotification()` to check app pref + browser permission.
- `src/features/settings/SettingsPage.tsx` — replace "Enable notifications" button section with toggle switch; add first-load prompt state (or keep prompt in App-level component).
- `src/App.tsx` — mount a small `NotificationPrompt` component (or inline prompt) that shows on first load when permission is `'default'` and app pref is `true`. (Revises earlier "NO edit to App.tsx" decision.)
- Optionally `src/features/settings/NotificationPrompt.tsx` — new small component for the first-load enable prompt.

## Data flow
1. App loads → `NotificationPrompt` checks: permission `'default'` + app pref `true` → show prompt.
2. User clicks Enable → `requestPermission()` → if granted, set app pref `true`, notifications active. If denied, set app pref `false`, show browser-settings guidance.
3. User clicks Not now → set app pref `false`, hide prompt, don't re-ask.
4. Settings toggle off → app pref `false`, notifications suppressed. Toggle on → if browser permission granted, reactivate; if denied, prompt browser settings.
5. `ChatPage`/`ChatListPage` call `showIncomingMessageNotification()` which checks app pref + permission before showing.

## Boundaries
- Do NOT edit contract files: `supabase/migrations/*`, `src/types/*`, `src/lib/api.ts`, `src/lib/apiClient.ts`, `.env.example`.
- No backend changes needed (Notifications API is client-only).

## Failure modes
- `Notification` unsupported → hide prompt/toggle, no crash.
- Permission denied → toggle shows "Enable in browser settings" message, app pref stays false until user grants via browser.
- `localStorage` unavailable → try/catch, treat pref as true (default on), no crash.

## Validation
- `npm run typecheck` — passes
- `npm run lint` — passes (0 warnings)
- `npm run test` — existing tests still pass
- Manual:
  1. Fresh browser (permission 'default') → proactive prompt appears on first load.
  2. Click Enable → permission granted → notifications show for incoming messages in background tab.
  3. Settings toggle off → no more notifications even if browser permission granted.
  4. Settings toggle on (browser permission still granted) → notifications reappear.
  5. Settings toggle on (browser permission denied) → guided to browser settings.
  6. Own message → no notification. Same conversation tab visible → no notification.
  7. Rapid messages in one group → single updating notification (tag dedup).

## Open questions / out of scope
- Push API for alerts when tab closed / Chrome not running — separate backend `PushSubscription` work, out of scope.
- Per-conversation mute / do-not-disturb — future settings addition.
