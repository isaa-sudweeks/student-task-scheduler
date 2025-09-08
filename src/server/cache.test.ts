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

describe('cache.deleteByPrefix', () => {
  it('removes keys matching the given prefix', async () => {
    const key1 = 'foo:1';
    const key2 = 'foo:2';
    const otherKey = 'bar:1';

    await cache.set(key1, 1);
    await cache.set(key2, 2);
    await cache.set(otherKey, 3);

    await cache.deleteByPrefix('foo:');

    expect(await cache.get(key1)).toBeNull();
    expect(await cache.get(key2)).toBeNull();
    expect(await cache.get(otherKey)).toBe(3);
  });

  it('removes all keys matching the prefix even when many exist', async () => {
    const prefix = 'many:';
    const keys = Array.from({ length: 150 }, (_, i) => `${prefix}${i}`);
    const otherKey = 'other:1';

    for (const [i, key] of keys.entries()) {
      await cache.set(key, i);
    }
    await cache.set(otherKey, 1);

    await cache.deleteByPrefix(prefix);

    for (const key of keys) {
      expect(await cache.get(key)).toBeNull();
    }
    expect(await cache.get(otherKey)).toBe(1);
  });
});
