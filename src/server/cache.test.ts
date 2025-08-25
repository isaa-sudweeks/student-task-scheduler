import { describe, it, expect } from 'vitest';
import { cache, CACHE_PREFIX } from '@/server/cache';

// Since env vars are not set, cache uses in-memory Map implementation.
describe('cache.clear', () => {
  it('removes only keys with the app prefix', async () => {
    const prefixedKey = `${CACHE_PREFIX}foo`;
    const otherKey = 'other:bar';

    await cache.set(prefixedKey, 1);
    await cache.set(otherKey, 2);

    await cache.clear();

    expect(await cache.get(prefixedKey)).toBeNull();
    expect(await cache.get(otherKey)).toBe(2);
  });
});
