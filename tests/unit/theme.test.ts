import { describe, expect, it } from 'vitest';
import { resolveDarkTheme } from '../../src/lib/theme';

describe('system theme preference', () => {
  it('follows the device when no manual override is saved', () => {
    expect(resolveDarkTheme(null, true)).toBe(true);
    expect(resolveDarkTheme(null, false)).toBe(false);
  });

  it('keeps an explicit light or dark override when the device theme changes', () => {
    expect(resolveDarkTheme('light', true)).toBe(false);
    expect(resolveDarkTheme('dark', false)).toBe(true);
  });
});
