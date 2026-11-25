/**
 * Invite helper to store and manage pending invite codes across OAuth redirects.
 * Not a secret. Expiration window: 24 hours.
 */

const PENDING_INVITE_KEY = 'thread_pending_invite_code';
const PENDING_INVITE_TIME_KEY = 'thread_pending_invite_timestamp';
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export function setPendingInviteCode(code: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(PENDING_INVITE_KEY, code.trim());
    window.localStorage.setItem(PENDING_INVITE_TIME_KEY, Date.now().toString());
  } catch {
    // Ignore storage errors in private browsing
  }
}

export function getPendingInviteCode(): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    const code = window.localStorage.getItem(PENDING_INVITE_KEY);
    const tsStr = window.localStorage.getItem(PENDING_INVITE_TIME_KEY);
    if (!code) return null;

    if (tsStr) {
      const ts = parseInt(tsStr, 10);
      if (Date.now() - ts > TWENTY_FOUR_HOURS_MS) {
        clearPendingInviteCode();
        return null;
      }
    }
    return code;
  } catch {
    return null;
  }
}

export function clearPendingInviteCode(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(PENDING_INVITE_KEY);
    window.localStorage.removeItem(PENDING_INVITE_TIME_KEY);
  } catch {
    // Ignore storage errors
  }
}
