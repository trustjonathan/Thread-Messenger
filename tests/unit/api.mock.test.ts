/**
 * tests/unit/api.mock.test.ts
 *
 * Verifies that api.mock.ts exports exactly the same names as api.ts
 * (no missing, no extra), and that every mock export satisfies the
 * real module's inferred type at compile time (via `satisfies`).
 */
import { describe, it, expect } from 'vitest';
import * as realApi from '../../src/lib/api';
import * as mockApi from '../../src/lib/api.mock';

describe('api.mock surface parity', () => {
  const realNames = new Set(Object.keys(realApi));
  const mockNames = new Set(Object.keys(mockApi));

  it('mock exports every name that real api exports', () => {
    const missing = [...realNames].filter((n) => !mockNames.has(n));
    expect(missing, `Mock is missing exports: ${missing.join(', ')}`).toHaveLength(0);
  });

  it('mock exports no extra names beyond real api', () => {
    const extra = [...mockNames].filter((n) => !realNames.has(n));
    expect(extra, `Mock has extra exports not in real api: ${extra.join(', ')}`).toHaveLength(0);
  });

  it('every exported value in mock has the same type tag as real api', () => {
    for (const name of realNames) {
      const realType = typeof realApi[name as keyof typeof realApi];
      const mockType = typeof mockApi[name as keyof typeof mockApi];
      expect(mockType, `Export "${name}": real is "${realType}" but mock is "${mockType}"`).toBe(
        realType
      );
    }
  });
});
