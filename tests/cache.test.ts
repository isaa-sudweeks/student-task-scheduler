import { afterEach, describe, expect, it, vi } from 'vitest';
import { cache, dispose, MAX_CACHE_ENTRIES } from '@/server/cache';

afterEach(async () => {
  await cache.clear();
  dispose();
  vi.useRealTimers();
});

describe('in-memory cache wrapper', () => {
  it('stores and retrieves JSON-serialisable values', async () => {
    await cache.set('task:1', { title: 'Essay' });
    await expect(cache.get<{ title: string }>('task:1')).resolves.toEqual({ title: 'Essay' });
  });

  it('expires entries after the requested ttl', async () => {
    vi.useFakeTimers();
    await cache.set('task:1', { title: 'Essay' }, 60);
    await expect(cache.get('task:1')).resolves.toEqual({ title: 'Essay' });

    await vi.advanceTimersByTimeAsync(60_001);
    await expect(cache.get('task:1')).resolves.toBeNull();
  });

  it('evicts the least recently used entry when over capacity', async () => {
    for (let i = 0; i < MAX_CACHE_ENTRIES; i++) {
      await cache.set(`task:${i}`, i);
    }
    // touch the first key so it becomes most recently used
    await cache.get('task:0');

    await cache.set(`task:${MAX_CACHE_ENTRIES}`, 'new');

    await expect(cache.get('task:0')).resolves.toEqual(0);
    await expect(cache.get('task:1')).resolves.toBeNull();
  });
});
