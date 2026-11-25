export type UpdatePhase = 'before' | 'during' | 'after';

export interface UpdateAnnouncement {
  version: string;
  phase: UpdatePhase;
  title: string;
  body: string;
  startsAt: string;
  endsAt: string;
}

export const UPDATES: UpdateAnnouncement[] = [
  {
    version: 'group-chat-1',
    phase: 'before',
    title: 'Upcoming update: group chats',
    body: "Heads up: We're updating Thread Messenger from 9pm to 6am to add group chats. You may see a brief reconnect.",
    startsAt: '2026-11-24T16:00:00Z',
    endsAt: '2026-11-24T21:00:00Z',
  },
  {
    version: 'group-chat-1',
    phase: 'during',
    title: 'Thread is updating',
    body: 'Thread is updating right now. Sending is briefly paused—please refresh in a minute.',
    startsAt: '2026-11-24T21:00:00Z',
    endsAt: '2026-11-25T06:00:00Z',
  },
  {
    version: 'group-chat-1',
    phase: 'after',
    title: 'Group chat is now live',
    body: 'Group chat and Thread AI are now live in Thread! Tap New group from your chats list to start a conversation, or seek help from Thread AI',
    startsAt: '2026-11-25T06:00:00Z',
    endsAt: '2026-11-30T00:00:00Z',
  },
];

function dismissedKey(version: string, phase: UpdatePhase): string {
  return `thread:update-dismissed:${version}:${phase}`;
}

export function isUpdateDismissed(version: string, phase: UpdatePhase): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    return localStorage.getItem(dismissedKey(version, phase)) === '1';
  } catch {
    return false;
  }
}

export function dismissUpdate(version: string, phase: UpdatePhase): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(dismissedKey(version, phase), '1');
  } catch {
    // ignore
  }
}

export function pickActiveUpdate(
  updates: UpdateAnnouncement[],
  nowMs: number,
): UpdateAnnouncement | null {
  let active: UpdateAnnouncement | null = null;
  let activeStartMs = -Infinity;

  for (const entry of updates) {
    const startMs = new Date(entry.startsAt).getTime();
    const endMs = new Date(entry.endsAt).getTime();
    if (Number.isNaN(startMs) || Number.isNaN(endMs)) continue;
    if (nowMs >= startMs && nowMs < endMs && startMs > activeStartMs) {
      active = entry;
      activeStartMs = startMs;
    }
  }

  return active;
}

export function getActiveUpdate(now?: string): UpdateAnnouncement | null {
  const reference = now ? new Date(now) : new Date();
  if (Number.isNaN(reference.getTime())) return null;
  return pickActiveUpdate(UPDATES, reference.getTime());
}
