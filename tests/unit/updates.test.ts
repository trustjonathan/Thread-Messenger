import { describe, it, expect, beforeEach } from 'vitest';
import {
  pickActiveUpdate,
  getActiveUpdate,
  isUpdateDismissed,
  dismissUpdate,
  type UpdateAnnouncement,
} from '../../src/lib/updates';

const store = new Map<string, string>();

function installLocalStorage(): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      clear: () => {
        store.clear();
      },
    },
    writable: true,
    configurable: true,
  });
}

installLocalStorage();

beforeEach(() => {
  store.clear();
});

const makeEntry = (overrides?: Partial<UpdateAnnouncement>): UpdateAnnouncement => ({
  version: 'test-v1',
  phase: 'after',
  title: 'Test',
  body: 'Test body',
  startsAt: new Date(Date.now() - 60000).toISOString(),
  endsAt: new Date(Date.now() + 60000).toISOString(),
  ...overrides,
});

describe('pickActiveUpdate', () => {
  it('returns null when no window is active', () => {
    const future = makeEntry({
      startsAt: new Date(Date.now() + 100000).toISOString(),
      endsAt: new Date(Date.now() + 200000).toISOString(),
    });
    const past = makeEntry({
      startsAt: new Date(Date.now() - 200000).toISOString(),
      endsAt: new Date(Date.now() - 100000).toISOString(),
    });
    const active = pickActiveUpdate([future, past], Date.now());
    expect(active).toBeNull();
  });

  it('returns the entry whose window contains now', () => {
    const entry = makeEntry();
    const active = pickActiveUpdate([entry], new Date(entry.startsAt).getTime());
    expect(active?.version).toBe(entry.version);
    expect(active?.phase).toBe(entry.phase);
  });

  it('skips entries with malformed dates', () => {
    const bad = makeEntry({ startsAt: 'not-a-date', endsAt: 'also-not-a-date' });
    const good = makeEntry();
    const nowMs = new Date(good.startsAt).getTime();
    const active = pickActiveUpdate([bad, good], nowMs);
    expect(active?.version).toBe(good.version);
  });

  it('treats endsAt as exclusive', () => {
    const entry = makeEntry({
      startsAt: new Date(Date.now() - 120000).toISOString(),
      endsAt: new Date(Date.now() - 60000).toISOString(),
    });
    expect(
      pickActiveUpdate([entry], new Date(entry.endsAt).getTime()),
    ).toBeNull();
  });

  it('picks the most recent startsAt when windows overlap', () => {
    const early = makeEntry({
      startsAt: new Date(Date.now() - 300000).toISOString(),
      endsAt: new Date(Date.now() + 300000).toISOString(),
    });
    const late = makeEntry({
      startsAt: new Date(Date.now() - 100000).toISOString(),
      endsAt: new Date(Date.now() + 300000).toISOString(),
    });
    const active = pickActiveUpdate([early, late], Date.now());
    expect(active?.startsAt).toBe(late.startsAt);
    expect(active).not.toBe(early);
  });
});

describe('getActiveUpdate', () => {
  it('returns null when no configured window is active', () => {
    expect(getActiveUpdate()).toBeNull();
  });
});

describe('dismissal', () => {
  it('is not dismissed by default', () => {
    expect(isUpdateDismissed('v1', 'before')).toBe(false);
  });

  it('marks dismissed after dismissUpdate', () => {
    dismissUpdate('v1', 'before');
    expect(isUpdateDismissed('v1', 'before')).toBe(true);
  });

  it('uses version and phase in the key', () => {
    dismissUpdate('v1', 'before');
    expect(isUpdateDismissed('v1', 'after')).toBe(false);
    expect(isUpdateDismissed('v2', 'before')).toBe(false);
  });

  it('handles localStorage unavailability gracefully', () => {
    const original = globalThis.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
    });
    expect(isUpdateDismissed('v1', 'before')).toBe(false);
    expect(() => dismissUpdate('v1', 'before')).not.toThrow();
    Object.defineProperty(globalThis, 'localStorage', {
      value: original,
      configurable: true,
    });
  });
});
