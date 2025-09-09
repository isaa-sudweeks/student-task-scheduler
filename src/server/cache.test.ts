import { describe, it, expect, afterEach, vi } from 'vitest';

async function getCacheModule() {
  return await import('@/server/cache');
}

// Since env vars are not set, cache uses in-memory Map implementation.
afterEach(async () => {
  const mod = await import('@/server/cache');
  mod.dispose();
  vi.resetModules();
  vi.useRealTimers();
});

describe('cache.clear', () => {
  it('removes only keys with the app prefix', async () => {
    const { cache, CACHE_PREFIX } = await getCacheModule();
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
    const { cache } = await getCacheModule();
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
    const { cache } = await getCacheModule();
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

describe('cache cleanup interval', () => {
  it('removes expired entries periodically', async () => {
    vi.useFakeTimers();
    const { cache } = await getCacheModule();

    await cache.set('foo', 'bar', 1);
    vi.advanceTimersByTime(60_000);
    expect(await cache.get('foo')).toBeNull();
  });
});
