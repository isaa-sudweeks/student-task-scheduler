import { describe, expect, it, vi } from 'vitest';

vi.mock('@/server/db', () => ({ db: {} }));
vi.mock('@/server/cache', () => ({ cache: { deleteByPrefix: vi.fn() } }));

import { buildListCacheKey } from './utils';

describe('buildListCacheKey', () => {
  it('produces identical keys regardless of property order', () => {
    const user = 'u1';
    const first = { b: 2, a: 1, nested: { z: 1, y: 2 } };
    const second = { nested: { y: 2, z: 1 }, a: 1, b: 2 };
    const key1 = buildListCacheKey(first, user);
    const key2 = buildListCacheKey(second, user);
    expect(key1).toBe(key2);
  });
});

